import assert from 'node:assert/strict';
import http from 'node:http';
import type { OutgoingHttpHeaders, Server } from 'node:http';
import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createStudyServer } from '../../apps/api/src/app.js';
import { createAnkiRpc } from '../../apps/api/src/integrations/anki/anki.client.js';
import { ConnectionError } from '../../apps/api/src/integrations/anki/connection-error.js';
import { readCollection } from '../../apps/api/src/modules/collection/collection.service.js';

interface RpcRequest { method: string; params: Record<string, unknown>; id: string }
const required = ['profiles.getActive', 'collection.get', 'decks.list', 'decks.getCounts'];
const description = { apiMajor: 1, ankiVersion: '26.09.3', methods: required.map(name => ({ name, available: true })),
  schema: { 'x-methods': Object.fromEntries(required.map(name => [name, { effect: 'read' }])) } };
const listed = [{ id: '1', name: 'Medicine' }, { id: '2', name: 'Medicine::Anatomy' }, { id: '3', name: 'Language' }];
const counts: Record<string, { deckId: string; new: number; learning: number; review: number; total: number }> = {
  '1': { deckId: '1', new: 20, learning: 3, review: 7, total: 100 },
  '2': { deckId: '2', new: 18, learning: 3, review: 7, total: 80 },
  '3': { deckId: '3', new: 5, learning: 1, review: 2, total: 40 },
};

const listen = (server: Server) => new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
const close = (server: Server) => new Promise<void>(resolve => { server.close(() => resolve()); server.closeAllConnections(); });
function getPort(server: Server): number {
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  return address.port;
}
function requestLocal(port: number, { url = '/api/collection', method = 'GET', headers = { 'X-Study-Request': '1' } }:
  { url?: string; method?: string; headers?: OutgoingHttpHeaders } = {}) {
  return new Promise<{ status: number | undefined; headers: http.IncomingHttpHeaders; body: string }>((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port, path: url, method, headers }, res => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('error', reject); req.end();
  });
}

test('read-only Anki adapter and HTTP boundary', async t => {
  let scenario = 'ready';
  let collectionReads = 0;
  let calls: RpcRequest[] = [];
  const reset = (value: string) => { scenario = value; collectionReads = 0; calls = []; };
  const fake = http.createServer(async (req, res) => {
    let raw = '';
    for await (const chunk of req) raw += String(chunk);
    const request = JSON.parse(raw) as RpcRequest;
    calls.push(request);
    const { method, params, id } = request;
    assert.equal(req.url, '/api/v1');
    assert.equal(req.method, 'POST');
    assert.ok(['api.describe', ...required].includes(method));
    if (scenario === 'rpc-timeout') return;
    if (scenario === 'authentication') { res.writeHead(401); res.end('private token file path'); return; }
    if (scenario === 'malformed-json') { res.end('{broken'); return; }
    if (scenario === 'wrong-id') { res.end(JSON.stringify({ jsonrpc: '2.0', id: 'wrong', result: {} })); return; }
    const reply = (value: Record<string, unknown>) => res.end(JSON.stringify({ jsonrpc: '2.0', id, ...value }));
    if (scenario === 'upstream-error') { reply({ error: { code: -32603, message: 'secret C:/private/collection.anki2' } }); return; }
    if (scenario === 'stale-session' && method === 'decks.list') {
      reply({ error: { code: 1005, message: 'private error', data: { type: 'staleSession' } } }); return;
    }
    let result: unknown;
    if (method === 'api.describe') {
      const value = structuredClone(description);
      if (scenario === 'unsupported') value.apiMajor = 2;
      if (scenario === 'missing-capability') value.methods.pop();
      if (scenario === 'write-capability') value.schema['x-methods']['decks.list'] = { effect: 'write' };
      result = value;
    } else if (method === 'profiles.getActive') {
      result = scenario === 'closed-profile' ? null : { name: scenario === 'profile-change' && collectionReads >= 2 ? 'Other' : 'Example profile' };
    } else if (method === 'collection.get') {
      collectionReads++;
      if (Object.hasOwn(params, 'session')) assert.equal(params.session, 'session-a');
      result = { profile: scenario === 'profile-change' && collectionReads >= 2 ? 'Other' : 'Example profile',
        session: scenario === 'session-change' && collectionReads >= 2 ? 'session-b' : 'session-a', scheduler: 'sm2' };
    } else if (method === 'decks.list') {
      assert.equal(params.session, 'session-a');
      result = scenario === 'missing-parent' ? [listed[1]] : scenario === 'empty' ? [] : listed;
    } else if (method === 'decks.getCounts') {
      assert.equal(params.session, 'session-a');
      assert.equal(params.includeChildren, true);
      const deck = params.deck as { id: string };
      const value = { ...counts[deck.id] };
      if (scenario === 'bad-count') value.new = -1;
      result = value;
    }
    if (scenario === 'overall-timeout') await new Promise(resolve => setTimeout(resolve, 30));
    reply({ result });
  });
  const temp = await mkdtemp(path.join(os.tmpdir(), 'study-api-tests-'));
  const webRoot = path.join(temp, 'web-dist');
  await mkdir(path.join(webRoot, 'assets'), { recursive: true });
  await mkdir(path.join(temp, 'private'));
  await Promise.all([
    writeFile(path.join(webRoot, 'index.html'), '<!doctype html><title>Study test</title>'),
    writeFile(path.join(webRoot, 'assets', 'index-test.js'), 'export const safe = true;'),
    writeFile(path.join(webRoot, 'assets', 'style-test.css'), ':root { color: black }'),
    writeFile(path.join(webRoot, 'assets', 'light-field-glass.png'), 'fixture'),
    writeFile(path.join(webRoot, 'assets', 'index-test.js.map'), 'private source content'),
    writeFile(path.join(temp, 'private', 'secret.js'), 'private source content'),
  ]);
  let app: Server | undefined;
  t.after(async () => {
    if (app?.listening) await close(app);
    if (fake.listening) await close(fake);
    const expectedPrefix = path.resolve(os.tmpdir()) + path.sep + 'study-api-tests-';
    assert.ok(path.resolve(temp).startsWith(expectedPrefix), 'cleanup stays inside the named test directory');
    await rm(temp, { recursive: true, force: true });
  });
  await listen(fake);
  const upstreamPort = getPort(fake);
  const rpc = createAnkiRpc({ timeoutMs: 250, request: (options, callback) => {
    assert.equal(options.hostname, '127.0.0.1');
    assert.equal(options.port, 8765);
    return http.request({ ...options, port: upstreamPort }, callback);
  } });

  await t.test('native parents and root totals never double-count children', async () => {
    reset('ready'); const data = await readCollection(rpc);
    assert.deepEqual(data.totals, { new: 25, learning: 4, review: 9, total: 140 });
    assert.equal(data.decks[1]?.depth, 1); assert.equal(data.decks[1]?.name, 'Medicine::Anatomy');
    assert.equal(data.decks[0]?.new, 20); assert.equal(data.profile, 'Example profile');
    assert.equal(data.state, 'ready'); assert.ok(Number.isFinite(Date.parse(data.checkedAt)));
    assert.ok(!JSON.stringify(data).includes('session-a'));
    assert.equal(calls.at(-2)?.method, 'collection.get'); assert.equal(calls.at(-1)?.method, 'profiles.getActive');
  });
  await t.test('empty collection is a valid zero-count snapshot', async () => {
    reset('empty'); const data = await readCollection(rpc);
    assert.deepEqual(data.decks, []); assert.deepEqual(data.totals, { new: 0, learning: 0, review: 0, total: 0 });
  });
  for (const [mode, state] of [
    ['profile-change', 'profile-changed'], ['session-change', 'profile-changed'], ['stale-session', 'profile-changed'],
    ['closed-profile', 'unavailable'], ['unsupported', 'unsupported'], ['missing-capability', 'unsupported'],
    ['write-capability', 'unsupported'], ['missing-parent', 'unsupported'], ['bad-count', 'unsupported'],
    ['authentication', 'authentication'], ['rpc-timeout', 'timeout'], ['malformed-json', 'unsupported'], ['wrong-id', 'unsupported'],
  ] as const) {
    await t.test(`${mode} invalidates the snapshot`, async () => {
      reset(mode); await assert.rejects(readCollection(rpc), error => error instanceof ConnectionError && error.state === state);
    });
  }
  await t.test('overall deadline bounds multiple successful RPC calls', async () => {
    reset('overall-timeout'); const started = Date.now();
    await assert.rejects(readCollection(rpc, { snapshotTimeoutMs: 65 }), error => error instanceof ConnectionError && error.state === 'timeout');
    assert.ok(Date.now() - started < 500);
  });
  await t.test('RPC runtime allowlist rejects mutations before transport', async () => {
    const before = calls.length;
    await assert.rejects((rpc as (method: string) => Promise<unknown>)('reviewer.answer'), error => error instanceof ConnectionError && error.state === 'unsupported');
    assert.equal(calls.length, before);
  });
  reset('ready');
  app = createStudyServer({ port: 0, rpc, webRoot }); await listen(app);
  const port = getPort(app);
  await t.test('same-origin request receives a fresh validated snapshot', async () => {
    const result = await requestLocal(port, { headers: { 'X-Study-Request': '1', Origin: `http://127.0.0.1:${port}`, 'Sec-Fetch-Site': 'same-origin' } });
    assert.equal(result.status, 200); assert.equal(JSON.parse(result.body).state, 'ready');
    assert.equal(result.headers['cache-control'], 'no-store');
    assert.equal(result.headers['access-control-allow-origin'], undefined);
    assert.equal(result.headers['x-powered-by'], undefined);
  });
  await t.test('concurrent reads share work; subsequent requests refresh Anki', async () => {
    reset('ready');
    assert.ok((await Promise.all([requestLocal(port), requestLocal(port)])).every(result => result.status === 200));
    assert.equal(calls.filter(call => call.method === 'api.describe').length, 1);
    assert.equal((await requestLocal(port)).status, 200);
    assert.equal(calls.filter(call => call.method === 'api.describe').length, 2);
  });
  const blocked = [
    { label: 'missing app header', headers: {} },
    { label: 'foreign Origin', headers: { 'X-Study-Request': '1', Origin: 'https://example.com' } },
    { label: 'null Origin', headers: { 'X-Study-Request': '1', Origin: 'null' } },
    { label: 'different local port', headers: { 'X-Study-Request': '1', Origin: 'http://127.0.0.1:1234' } },
    { label: 'cross-site', headers: { 'X-Study-Request': '1', 'Sec-Fetch-Site': 'cross-site' } },
    { label: 'same-site other origin', headers: { 'X-Study-Request': '1', 'Sec-Fetch-Site': 'same-site' } },
    { label: 'navigation context', headers: { 'X-Study-Request': '1', 'Sec-Fetch-Site': 'none' } },
    { label: 'foreign Host', headers: { 'X-Study-Request': '1', Host: `evil.example:${port}` } },
    { label: 'localhost alias Host', headers: { 'X-Study-Request': '1', Host: `localhost:${port}` } },
  ];
  for (const item of blocked) await t.test(`${item.label} cannot reach Anki`, async () => {
    const before = calls.length; const result = await requestLocal(port, item);
    assert.equal(result.status, 403); assert.equal(calls.length, before);
  });
  await t.test('mutations, URL variants, private files and traversal are unavailable', async () => {
    const before = calls.length;
    for (const method of ['POST', 'PUT', 'DELETE', 'OPTIONS']) assert.equal((await requestLocal(port, { method })).status, 405);
    for (const url of ['/server.cjs', '/specs/README.md', '/docs/product-spec.md', '/.git/config', '/.env',
      '/api/collection?method=reviewer.answer', '/api/collection/', '/API/collection', '/api/%63ollection', '/api/reviewer.answer',
      '/assets/../server.cjs', '/%2e%2e/server.cjs', '//server.cjs', 'http://evil.example/index.html',
      '/assets/index-test.js.map', '/assets/.env', '/assets/%2e%2e/index.html', '/assets//index-test.js',
      '/@fs/specs/README.md', '/src/app.ts', '/node_modules/express/package.json']) {
      assert.equal((await requestLocal(port, { url })).status, 404, url);
    }
    assert.equal(calls.length, before);
  });
  await t.test('built assets and HEAD work without exposing sources or frame embedding', async () => {
    for (const url of ['/', '/index.html', '/assets/index-test.js', '/assets/style-test.css', '/assets/light-field-glass.png']) {
      const result = await requestLocal(port, { url, headers: { 'Sec-Fetch-Site': 'none' } });
      assert.equal(result.status, 200, url); assert.equal(result.headers['x-frame-options'], 'DENY');
    }
    const head = await requestLocal(port, { url: '/', method: 'HEAD', headers: {} });
    assert.equal(head.status, 200); assert.equal(head.body, '');
  });
  await t.test('new build assets are available without broad source-directory serving', async () => {
    await writeFile(path.join(webRoot, 'assets', 'index-next.js'), 'export const next = true;');
    assert.equal((await requestLocal(port, { url: '/assets/index-next.js', headers: {} })).status, 200);
  });
  await t.test('symlinked asset directories cannot escape the compiled frontend', async () => {
    await symlink(path.join(temp, 'private'), path.join(webRoot, 'assets', 'escape'), 'junction');
    assert.equal((await requestLocal(port, { url: '/assets/escape/secret.js' })).status, 404);
  });
  await t.test('untrusted upstream details never reach the browser', async () => {
    reset('upstream-error'); const result = await requestLocal(port);
    assert.equal(result.status, 503); assert.equal(JSON.parse(result.body).state, 'unavailable');
    assert.ok(!result.body.includes('secret')); assert.ok(!result.body.includes('private')); assert.ok(!result.body.includes('stack'));
  });
  await close(fake);
  await t.test('stopped upstream produces an offline result', async () => {
    const result = await requestLocal(port); assert.equal(result.status, 503); assert.equal(JSON.parse(result.body).state, 'offline');
  });
});
