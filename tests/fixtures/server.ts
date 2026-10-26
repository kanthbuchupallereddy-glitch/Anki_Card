import { createStudyServer } from '../../apps/api/src/app.js';
import { resolve } from 'node:path';
import type { RequestListener } from 'node:http';
import type { AnkiRpc } from '../../apps/api/src/integrations/anki/anki.types.js';
import { collectionFixture } from './collection.js';

const required = ['profiles.getActive', 'collection.get', 'decks.list', 'decks.getCounts'];
const session = 'synthetic-e2e-session';
const rpc: AnkiRpc = async (method, params = {}, { signal } = {}) => {
  if (signal?.aborted) throw new Error('Synthetic request cancelled.');
  const snapshot = collectionFixture();
  if (method === 'api.describe') return {
    apiMajor: 1, ankiVersion: snapshot.ankiVersion,
    methods: required.map(name => ({ name, available: true })),
    schema: { 'x-methods': Object.fromEntries(required.map(name => [name, { effect: 'read' }])) },
  };
  if (method === 'profiles.getActive') return { name: snapshot.profile };
  if (method === 'collection.get') {
    if (params.session !== undefined && params.session !== session) throw new Error('Wrong fixture session.');
    return { profile: snapshot.profile, session, scheduler: 'sm2' };
  }
  if (params.session !== session) throw new Error('Collection reads must pin the fixture session.');
  if (method === 'decks.list') return snapshot.decks.map(({ id, name }) => ({ id, name }));
  if (method === 'decks.getCounts') {
    const deckId = (params.deck as { id?: unknown } | undefined)?.id;
    const deck = snapshot.decks.find(item => item.id === deckId);
    if (!deck || params.includeChildren !== true) throw new Error('Unexpected fixture deck request.');
    return { deckId: deck.id, new: deck.new, learning: deck.learning, review: deck.review, total: deck.total };
  }
  throw new Error('The fixture accepts only the fixed read operations.');
};

const server = createStudyServer({ port: 4174, rpc, webRoot: resolve('apps/web/dist') });
const token = process.env.STUDY_E2E_RUN_ID;
if (!token) throw new Error('Start the synthetic fixture through Playwright.');
const [applicationRequest] = server.listeners('request') as RequestListener[];
if (!applicationRequest) throw new Error('The fixture application has no request handler.');
server.removeAllListeners('request');
server.on('request', (request, response) => {
  // Fixture-only lifecycle control. No equivalent endpoint exists in production.
  if (request.url === '/__fixture__/shutdown' && request.method === 'POST'
      && request.headers.host === '127.0.0.1:4174' && request.headers.origin === undefined
      && request.headers['x-study-fixture-token'] === token) {
    response.writeHead(204).end();
    setImmediate(() => { server.close(); server.closeAllConnections(); });
    return;
  }
  applicationRequest(request, response);
});
server.on('error', error => { console.error(error.message); process.exitCode = 1; });
server.listen(4174, '127.0.0.1', () => console.log('Synthetic Study test app: http://127.0.0.1:4174'));
const close = () => { server.close(); server.closeAllConnections(); };
process.on('SIGINT', close);
process.on('SIGTERM', close);
