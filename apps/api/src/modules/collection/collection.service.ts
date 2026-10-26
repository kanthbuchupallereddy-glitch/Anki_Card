import type { CollectionSnapshot, Counts, DeckDto } from '@study/contracts';
import { LIMITS } from '../../config/runtime.js';
import { createAnkiAdapter } from '../../integrations/anki/anki.adapter.js';
import { unavailable } from '../../integrations/anki/connection-error.js';
import { COUNT_FIELDS, isCount, verifyContext } from '../../integrations/anki/anki.schemas.js';
import type { AnkiRpc } from '../../integrations/anki/anki.types.js';

export interface SnapshotOptions { snapshotTimeoutMs?: number }
export type CollectionReader = () => Promise<CollectionSnapshot>;

export async function readCollection(rpc: AnkiRpc, { snapshotTimeoutMs = LIMITS.snapshotTimeoutMs }: SnapshotOptions = {}): Promise<CollectionSnapshot> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), snapshotTimeoutMs);
  const anki = createAnkiAdapter(rpc, controller.signal);
  try {
    const description = await anki.describe();
    const profile = await anki.activeProfile();
    const collection = await anki.collection();
    verifyContext(profile, collection);
    const session = collection.session;
    const listed = await anki.decks(session);
    const decks = new Array<DeckDto>(listed.length);
    let next = 0;
    const worker = async () => {
      while (next < listed.length) {
        const index = next++;
        const deck = listed[index];
        if (!deck) throw unavailable('unsupported');
        const counts = await anki.counts(deck.id, session);
        decks[index] = { ...deck, ...counts, depth: deck.name.split('::').length - 1 };
      }
    };
    await Promise.all(Array.from({ length: Math.min(LIMITS.countConcurrency, listed.length) }, worker));
    const afterCollection = await anki.collection(session);
    const afterProfile = await anki.activeProfile();
    verifyContext(afterProfile, afterCollection);
    if (afterCollection.session !== session || afterProfile.name !== profile.name) throw unavailable('profile-changed');
    const totals: Counts = { new: 0, learning: 0, review: 0, total: 0 };
    // Native parent counts include their children. Sum root rows only.
    for (const deck of decks.filter(deck => deck.depth === 0)) {
      for (const field of COUNT_FIELDS) {
        totals[field] += deck[field];
        if (!isCount(totals[field])) throw unavailable('unsupported');
      }
    }
    return { state: 'ready', ...description, profile: profile.name, checkedAt: new Date().toISOString(), decks, totals };
  } finally { clearTimeout(timeout); controller.abort(); }
}

export function createCollectionService(rpc: AnkiRpc, options: SnapshotOptions = {}): CollectionReader {
  let pending: Promise<CollectionSnapshot> | undefined;
  return () => {
    // Concurrent requests share work; subsequent requests never reuse stale results.
    pending ??= readCollection(rpc, options).finally(() => { pending = undefined; });
    return pending;
  };
}
