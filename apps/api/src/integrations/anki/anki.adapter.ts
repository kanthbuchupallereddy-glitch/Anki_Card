import { unavailable } from './connection-error.js';
import { parseCollection, parseCounts, parseDecks, parseDescription, parseProfile } from './anki.schemas.js';
import type { AnkiRpc } from './anki.types.js';

export function createAnkiAdapter(rpc: AnkiRpc, signal: AbortSignal) {
  const call: AnkiRpc = (method, params = {}) => {
    if (signal.aborted) return Promise.reject(unavailable('timeout'));
    return rpc(method, params, { signal });
  };
  return {
    describe: async () => parseDescription(await call('api.describe')),
    activeProfile: async () => parseProfile(await call('profiles.getActive')),
    collection: async (session?: string) => parseCollection(await call('collection.get', session ? { session } : {})),
    decks: async (session: string) => parseDecks(await call('decks.list', { session })),
    counts: async (id: string, session: string) => parseCounts(await call('decks.getCounts', { deck: { id }, includeChildren: true, session }), id),
  };
}
