import type { CollectionSnapshot } from '@study/contracts';

/** Synthetic examples only: no user's collection, profile or filesystem paths. */
export function collectionFixture(): CollectionSnapshot {
  return {
    state: 'ready', apiMajor: 1, ankiVersion: '26.09.3', profile: 'Test profile',
    checkedAt: new Date().toISOString(),
    decks: [
      { id: '10', name: 'Medicine', depth: 0, new: 7, learning: 2, review: 11, total: 50 },
      { id: '11', name: 'Medicine::Cardiology', depth: 1, new: 3, learning: 1, review: 4, total: 20 },
      { id: '12', name: 'Language', depth: 0, new: 1, learning: 0, review: 2, total: 5 },
    ],
    totals: { new: 8, learning: 2, review: 13, total: 55 },
  };
}

export function emptyCollectionFixture(): CollectionSnapshot {
  return { ...collectionFixture(), decks: [], totals: { new: 0, learning: 0, review: 0, total: 0 } };
}
