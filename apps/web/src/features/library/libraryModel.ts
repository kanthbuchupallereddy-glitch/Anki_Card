import type { CollectionSource, ConnectionState } from '../connection/types';
import { demoDecks } from '../review/demoFixtures';

export interface DeckRowModel { id: string; name: string; description: string; review: number; learning: number; new: number }

export function libraryRows(source: CollectionSource, connection: ConnectionState): DeckRowModel[] {
  if (source === 'demo') return demoDecks.map(deck => ({ id: deck.id, name: deck.name, description: deck.subject, review: deck.due, learning: 0, new: deck.new }));
  if (connection.state !== 'ready') return [];
  return connection.decks.map(deck => ({ id: deck.id, name: deck.name, description: `${deck.total} ${deck.total === 1 ? 'card' : 'cards'} · includes subdecks`, review: deck.review, learning: deck.learning, new: deck.new }));
}

export function emptyCollectionMessage(connection: ConnectionState): string {
  if (connection.state === 'checking') return 'Reading your Anki collection…';
  if (connection.state !== 'ready') return 'Connect to Anki above to see your decks.';
  return 'No decks in this Anki profile. Add or import a deck in Anki, then refresh.';
}

export function filterDecks(rows: DeckRowModel[], search: string, source: CollectionSource) {
  const normalized = search.trim().toLocaleLowerCase();
  return rows.filter(deck => `${deck.name} ${source === 'demo' ? deck.description : ''}`.toLocaleLowerCase().includes(normalized));
}
