import type { Counts } from '@study/contracts';
import { LIMITS, REQUIRED_READS } from '../../config/runtime.js';
import { unavailable } from './connection-error.js';
import type { NativeCollection, NativeDeck, NativeDescription, NativeProfile } from './anki.types.js';

export const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const nonempty = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 10000;
export const isCount = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const entityId = (value: unknown): value is string => typeof value === 'string' && /^[1-9][0-9]{0,18}$/.test(value) && BigInt(value) <= 9223372036854775807n;
export const COUNT_FIELDS = ['new', 'learning', 'review', 'total'] as const;

export function parseDescription(value: unknown): NativeDescription {
  if (!isRecord(value) || value.apiMajor !== 1 || !nonempty(value.ankiVersion) || !Array.isArray(value.methods)
      || !isRecord(value.schema) || !isRecord(value.schema['x-methods'])) throw unavailable('unsupported');
  const methods = value.schema['x-methods'];
  for (const name of REQUIRED_READS) {
    const method = methods[name];
    if (!value.methods.some(entry => isRecord(entry) && entry.name === name && entry.available === true)
        || !isRecord(method) || method.effect !== 'read') throw unavailable('unsupported');
  }
  return { ankiVersion: value.ankiVersion, apiMajor: 1 };
}

export function parseProfile(value: unknown): NativeProfile {
  if (value === null) throw unavailable();
  if (!isRecord(value) || !nonempty(value.name)) throw unavailable('unsupported');
  return { name: value.name };
}

export function parseCollection(value: unknown): NativeCollection {
  if (!isRecord(value) || !nonempty(value.profile) || !nonempty(value.session)) throw unavailable('unsupported');
  return { profile: value.profile, session: value.session };
}

export function verifyContext(profile: NativeProfile, collection: NativeCollection): void {
  if (profile.name !== collection.profile) throw unavailable('profile-changed');
}

export function parseDecks(value: unknown): NativeDeck[] {
  if (!Array.isArray(value) || value.length > LIMITS.maxDecks) throw unavailable('unsupported');
  const names = new Set<string>();
  const ids = new Set<string>();
  const decks = value.map((deck: unknown) => {
    if (!isRecord(deck) || !entityId(deck.id) || !nonempty(deck.name) || names.has(deck.name)
        || ids.has(deck.id) || deck.name.split('::').some(part => !part)) throw unavailable('unsupported');
    names.add(deck.name); ids.add(deck.id);
    return { id: deck.id, name: deck.name };
  });
  for (const deck of decks) {
    const parentEnd = deck.name.lastIndexOf('::');
    if (parentEnd >= 0 && !names.has(deck.name.slice(0, parentEnd))) throw unavailable('unsupported');
  }
  return decks;
}

export function parseCounts(value: unknown, expectedId: string): Counts {
  if (!isRecord(value) || value.deckId !== expectedId || !isCount(value.new) || !isCount(value.learning)
      || !isCount(value.review) || !isCount(value.total)) throw unavailable('unsupported');
  return { new: value.new, learning: value.learning, review: value.review, total: value.total };
}
