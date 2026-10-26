import type { CollectionSource } from '../connection/types';
import type { DeckRowModel } from './libraryModel';

export function DeckTable({ rows, source, expanded = false, onStart }: {
  rows: DeckRowModel[]; source: CollectionSource; expanded?: boolean; onStart: (deck: string) => void;
}) {
  const demo = source === 'demo';
  return <table className={`deck-table${expanded ? ' library-table' : ''}`}>
    <caption className="sr-only" data-deck-caption>{demo ? 'Sample deck counts' : 'Native Anki counts. Parent decks include subdecks. Learn means cards in learning.'}</caption>
    <thead><tr><th scope="col">Deck</th><th scope="col" className="number" data-review-column>{demo ? 'Due' : 'Review'}</th><th scope="col" className="number learning-column" hidden={demo}>Learn</th><th scope="col" className="number">New</th><th scope="col" className="action-column" hidden={!demo}><span className="sr-only">Action</span></th></tr></thead>
    <tbody id={expanded ? 'library-deck-rows' : 'home-deck-rows'}>{rows.map(deck => <tr key={deck.id}>
      <td><span className="deck-name">{deck.name}</span>{expanded && <span className="deck-description">{deck.description}</span>}</td>
      <td className="number">{deck.review}</td>{!demo && <td className="number">{deck.learning}</td>}<td className="number">{deck.new}</td>
      {demo && <td><button type="button" className="deck-open" data-start={deck.id} aria-label={`Study ${deck.name} sample cards`} onClick={() => onStart(deck.id)}>↗</button></td>}
    </tr>)}</tbody>
  </table>;
}
