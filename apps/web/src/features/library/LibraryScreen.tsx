import type { CollectionSource, ConnectionState } from '../connection/types';
import { DeckTable } from './DeckTable';
import { emptyCollectionMessage, filterDecks, libraryRows } from './libraryModel';

export function LibraryScreen({ active, source, connection, search, onSearch, onStart }: {
  active: boolean; source: CollectionSource; connection: ConnectionState; search: string;
  onSearch: (value: string) => void; onStart: (deck: string) => void;
}) {
  const demo = source === 'demo';
  const ready = connection.state === 'ready';
  const rows = libraryRows(source, connection);
  const filtered = filterDecks(rows, search, source);
  const empty = rows.length || demo ? 'No decks match this search.' : emptyCollectionMessage(connection);
  return <section id="library-screen" className="screen" aria-labelledby="library-title" hidden={!active}>
    <div className="page-heading"><div><div className="eyebrow">02 / Your collection</div><h1 id="library-title" tabIndex={-1}>Library<span className="title-period">.</span></h1></div><span className="sample-label">{demo ? 'Sample collection' : 'Anki · connected'}</span></div>
    <div className="library-toolbar">
      <label className="search-field"><span>Find a deck</span><input id="deck-search" type="search" placeholder={demo ? 'Search by name or subject' : 'Search your Anki decks'} autoComplete="off" value={search} disabled={!demo && !ready} onChange={event => onSearch(event.target.value)} /></label>
      <span id="deck-result-count" className="quiet-note" role="status">{!demo && !ready ? '—' : `${filtered.length} ${filtered.length === 1 ? 'deck' : 'decks'}`}</span>
    </div>
    <div className="library-table-wrap"><DeckTable rows={filtered} source={source} expanded onStart={onStart} /></div>
    <p id="no-decks" className="empty-message" hidden={filtered.length > 0}>{empty}</p>
    <p className="library-note">{demo ? 'This is a separate sample collection. Ratings here never update Anki.' : 'Counts come from Anki. Parent rows include their subdecks; Today counts each top-level deck once. Create and edit cards in Anki; review them here. Anki stores ratings and scheduling.'}</p>
  </section>;
}
