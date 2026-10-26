import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCollectionResponse } from '@study/contracts';

const sample = () => ({
  state: 'ready', apiMajor: 1, ankiVersion: '26.09.3', profile: 'Fixture', checkedAt: new Date().toISOString(),
  decks: [
    { id: '1', name: 'Parent', new: 4, learning: 2, review: 3, total: 30, depth: 0 },
    { id: '2', name: 'Parent::Child', new: 2, learning: 1, review: 1, total: 10, depth: 1 },
  ],
  totals: { new: 4, learning: 2, review: 3, total: 30 },
});

test('public contract keeps top-level totals and removes unexpected native data', () => {
  const raw = { ...sample(), session: 'private', path: 'private', decks: sample().decks.map(deck => ({ ...deck, native: 'private' })) };
  assert.deepEqual(parseCollectionResponse(raw), sampleWithTime(raw.checkedAt));
});
function sampleWithTime(checkedAt: string) { return { ...sample(), checkedAt }; }

for (const [name, mutate] of Object.entries({
  'wrong API version': (value: any) => { value.apiMajor = 2; },
  'invalid timestamp': (value: any) => { value.checkedAt = 'yesterday'; },
  'negative count': (value: any) => { value.decks[0].new = -1; },
  'unsafe count': (value: any) => { value.totals.total = Number.MAX_SAFE_INTEGER + 1; },
  'duplicate ID': (value: any) => { value.decks[1].id = '1'; },
  'numeric ID': (value: any) => { value.decks[0].id = 1; },
  'wrong depth': (value: any) => { value.decks[1].depth = 0; },
  'missing parent': (value: any) => { value.decks.shift(); },
  'double-counted totals': (value: any) => { value.totals.total += value.decks[1].total; },
  'non-array decks': (value: any) => { value.decks = {}; },
})) {
  test(`contract rejects ${name}`, () => {
    const value = sample(); mutate(value); assert.throws(() => parseCollectionResponse(value), TypeError);
  });
}
test('known failures are accepted and unknown successes are rejected', () => {
  assert.deepEqual(parseCollectionResponse({ state: 'profile-changed', message: 'Refresh', secret: 'private' }), { state: 'profile-changed', message: 'Refresh' });
  assert.throws(() => parseCollectionResponse({ state: 'saved', message: 'done' }), TypeError);
  assert.throws(() => parseCollectionResponse(null), TypeError);
});
