import assert from 'node:assert/strict';
import test from 'node:test';
import http from 'node:http';
import { createStudyServer } from '../../apps/api/src/app.js';
import type { AnkiRpc } from '../../apps/api/src/integrations/anki/anki.types.js';
import { createReviewService } from '../../apps/api/src/modules/review/review.service.js';

const session = 'session-1';
const methods = ['application.navigate','reviewer.get','reviewer.showAnswer','reviewer.answer','operations.get'];
function fixture() {
  let side: 'question' | 'answer' = 'question';
  let token = 0;
  let saved = 0;
  let profile = 'Test';
  let failOperation = false;
  let answerCalls = 0;
  let media = false;
  const rpc: AnkiRpc = async (method, params = {}) => {
    switch (method) {
      case 'api.describe': return { apiMajor: 1, methods: methods.map(name => ({ name, available: true })),
        schema: { 'x-methods': Object.fromEntries(methods.map(name => [name, { effect: name === 'reviewer.answer' ? 'write' : name === 'reviewer.get' || name === 'operations.get' ? 'read' : 'gui' }])) } };
      case 'profiles.getActive': return { name: profile };
      case 'collection.get': return { profile, session };
      case 'decks.list': return [{ id: '1', name: 'Test deck' }];
      case 'application.navigate': return { operationId: 'navigate', method, session };
      case 'operations.get': return { operationId: params.operationId, method: params.operationId === 'navigate' ? 'application.navigate' : 'reviewer.answer', session,
        state: failOperation && params.operationId !== 'navigate' ? 'failed' : 'succeeded',
        result: params.operationId === 'navigate' ? {} : { cardId: '2', reviewId: '42', scheduling: { type: 'learning' } } };
      case 'reviewer.get':
        if (saved) return { active: false };
        token++;
        return { active: true, card: { id: '2', deck: { id: '1', name: 'Test deck' } },
          rendered: { cardId: '2', questionHtml: media ? '<img src="picture.png">' : 'Question', answerHtml: 'Answer', css: '' },
          stateToken: `token-${token}`, side, answers: ['again','hard','good','easy'].map(rating => ({ rating, label: '10m' })) };
      case 'reviewer.showAnswer': side = 'answer'; return { changed: true };
      case 'reviewer.answer': answerCalls++; if (!failOperation) saved++; return { operationId: 'answer', method, session };
      default: throw new Error(`Unexpected method: ${method}`);
    }
  };
  return { rpc, get saved() { return saved; }, get answerCalls() { return answerCalls; }, switchProfile: () => { profile = 'Other'; }, fail: () => { failOperation = true; }, useMedia: () => { media = true; } };
}

test('native review saves one rating and rejects duplicate submission', async () => {
  const anki = fixture(); const service = createReviewService(anki.rpc);
  const started = await service.start('1'); assert.equal(started.state, 'ready');
  if (started.state !== 'ready') return;
  const shown = await service.reveal(started.reviewId, started.cardId); assert.equal(shown.state, 'ready');
  if (shown.state !== 'ready') return;
  assert.equal(shown.side, 'answer');
  const after = await service.answer(shown.reviewId, shown.cardId, 'good');
  assert.equal(after.state, 'complete'); assert.equal(anki.saved, 1); assert.equal(anki.answerCalls, 1);
  const duplicate = await service.answer(shown.reviewId, shown.cardId, 'good');
  assert.equal(duplicate.state, 'profile-changed'); assert.equal(anki.answerCalls, 1);
});

test('media cards pause in Study before a rating can be submitted', async () => {
  const anki = fixture(); anki.useMedia(); const service = createReviewService(anki.rpc);
  const started = await service.start('1'); assert.equal(started.state, 'unsupported');
  assert.equal(anki.answerCalls, 0);
});

test('native review stops when Anki profile changes', async () => {
  const anki = fixture(); const service = createReviewService(anki.rpc);
  const started = await service.start('1'); assert.equal(started.state, 'ready');
  if (started.state !== 'ready') return;
  anki.switchProfile();
  const shown = await service.reveal(started.reviewId, started.cardId);
  assert.equal(shown.state, 'profile-changed'); assert.equal(anki.answerCalls, 0);
});

test('unconfirmed answer freezes the session to avoid a duplicate review', async () => {
  const anki = fixture(); const service = createReviewService(anki.rpc);
  const started = await service.start('1'); if (started.state !== 'ready') throw new Error('Expected card');
  const shown = await service.reveal(started.reviewId, started.cardId); if (shown.state !== 'ready') throw new Error('Expected answer');
  anki.fail(); const response = await service.answer(shown.reviewId, shown.cardId, 'good');
  assert.equal(response.state, 'uncertain'); assert.equal(anki.answerCalls, 1);
  assert.equal((await service.answer(shown.reviewId, shown.cardId, 'good')).state, 'profile-changed');
  assert.equal(anki.answerCalls, 1);
});


test('review HTTP actions require the exact local browser origin and request header', async () => {
  const anki = fixture();
  const server = createStudyServer({ port: 0, rpc: anki.rpc, webRoot: 'C:/nonexistent-study-test-assets' });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address(); if (!address || typeof address === 'string') throw new Error('Missing address');
  const port = address.port;
  const call = (path: string, headers: Record<string, string>) => new Promise<number>((resolve, reject) => {
    const body = JSON.stringify({ deckId: '1' });
    const req = http.request({ hostname: '127.0.0.1', port, method: 'POST', path,
      headers: { 'Content-Type': 'application/json', ...headers } }, res => { res.resume(); res.on('end', () => resolve(res.statusCode ?? 0)); });
    req.on('error', reject); req.end(body);
  });
  try {
    assert.equal(await call('/api/review/start', { 'X-Study-Request': '1', Origin: 'https://evil.example', 'Sec-Fetch-Site': 'cross-site' }), 403);
    assert.equal(await call('/api/review/start', { Origin: `http://127.0.0.1:${port}`, 'Sec-Fetch-Site': 'same-origin' }), 403);
    assert.equal(await call('/api/review/start?deck=1', { 'X-Study-Request': '1', Origin: `http://127.0.0.1:${port}`, 'Sec-Fetch-Site': 'same-origin' }), 405);
    assert.equal(await call('/api/review/start', { 'X-Study-Request': '1', Origin: `http://127.0.0.1:${port}`, 'Sec-Fetch-Site': 'same-origin' }), 200);
  } finally { await new Promise<void>((resolve, reject) => { server.close(error => error ? reject(error) : resolve()); server.closeAllConnections(); }); }
});
