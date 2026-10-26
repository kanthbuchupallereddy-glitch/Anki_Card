/** Public browser/API data only. Native Anki session tokens never cross this boundary. */
export interface Counts {
  new: number;
  learning: number;
  review: number;
  total: number;
}

export interface DeckDto extends Counts {
  id: string;
  name: string;
  depth: number;
}

export interface CollectionSnapshot {
  state: 'ready';
  ankiVersion: string;
  apiMajor: 1;
  profile: string;
  checkedAt: string;
  decks: DeckDto[];
  totals: Counts;
}

export const connectionFailureStates = [
  'offline', 'timeout', 'unsupported', 'unavailable', 'profile-changed', 'authentication', 'busy',
] as const;
export type ConnectionFailureState = typeof connectionFailureStates[number];
export interface ConnectionFailure { state: ConnectionFailureState; message: string }
export type CollectionResponse = CollectionSnapshot | ConnectionFailure;

const countKeys = ['new', 'learning', 'review', 'total'] as const;
function record(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Expected an object.');
  return value as Record<string, unknown>;
}
function text(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 10000) throw new TypeError('Expected text.');
  return value;
}
function count(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw new TypeError('Expected a nonnegative safe count.');
  return value;
}
function parseCounts(value: unknown): Counts {
  const source = record(value);
  return { new: count(source.new), learning: count(source.learning), review: count(source.review), total: count(source.total) };
}
function parseDeck(value: unknown): DeckDto {
  const source = record(value);
  const id = text(source.id);
  if (!/^[1-9][0-9]{0,18}$/.test(id) || BigInt(id) > 9223372036854775807n) throw new TypeError('Invalid deck identity.');
  const name = text(source.name);
  const parts = name.split('::');
  const depth = count(source.depth);
  if (parts.some(part => !part) || depth !== parts.length - 1) throw new TypeError('Invalid deck hierarchy.');
  return { id, name, depth, ...parseCounts(source) };
}

/** Validates at runtime and reconstructs the public shape, dropping unexpected fields. */
export function parseCollectionResponse(value: unknown): CollectionResponse {
  const source = record(value);
  if (source.state !== 'ready') {
    if (!connectionFailureStates.some(state => state === source.state)) throw new TypeError('Unknown connection state.');
    return { state: source.state as ConnectionFailureState, message: text(source.message) };
  }
  if (source.apiMajor !== 1 || !Array.isArray(source.decks) || source.decks.length > 1000) throw new TypeError('Unsupported collection.');
  const checkedAt = text(source.checkedAt);
  if (!/^\d{4}-\d{2}-\d{2}T/.test(checkedAt) || Number.isNaN(Date.parse(checkedAt))) throw new TypeError('Invalid snapshot time.');
  const decks = source.decks.map(parseDeck);
  const names = new Set(decks.map(deck => deck.name));
  if (names.size !== decks.length || new Set(decks.map(deck => deck.id)).size !== decks.length) throw new TypeError('Duplicate decks.');
  for (const deck of decks) {
    if (deck.depth && !names.has(deck.name.slice(0, deck.name.lastIndexOf('::')))) throw new TypeError('Missing parent deck.');
  }
  const totals = parseCounts(source.totals);
  for (const key of countKeys) {
    const expected = decks.filter(deck => deck.depth === 0).reduce((sum, deck) => sum + deck[key], 0);
    if (!Number.isSafeInteger(expected) || totals[key] !== expected) throw new TypeError('Inconsistent collection totals.');
  }
  return { state: 'ready', apiMajor: 1, ankiVersion: text(source.ankiVersion), profile: text(source.profile), checkedAt, decks, totals };
}
