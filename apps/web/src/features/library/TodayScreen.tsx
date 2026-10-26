import type { CollectionSource, ConnectionState } from '../connection/types';
import { demoDecks } from '../review/demoFixtures';
import { DeckTable } from './DeckTable';
import { emptyCollectionMessage, libraryRows } from './libraryModel';

export function TodayScreen({ active, source, connection, onStart }: {
  active: boolean; source: CollectionSource; connection: ConnectionState; onStart: (deck: string) => void;
}) {
  const demo = source === 'demo';
  const snapshot = connection.state === 'ready' ? connection : null;
  const rows = libraryRows(source, connection);
  const due = demo ? demoDecks.reduce((sum, deck) => sum + deck.due, 0) : snapshot ? snapshot.totals.review + snapshot.totals.learning : '—';
  const fresh = demo ? demoDecks.reduce((sum, deck) => sum + deck.new, 0) : snapshot?.totals.new ?? '—';
  const note = demo ? 'A six-card preview. Your Anki collection is untouched.' : snapshot ? snapshot.totals.total === 0 ? 'Your Anki collection has no cards yet. Add or import cards in Anki, then refresh.' : `${snapshot.totals.review} review · ${snapshot.totals.learning} learning. Use Anki to study while we build live review.` : 'Your real counts will appear after a successful connection.';
  return <section id="today-screen" className="screen" aria-labelledby="today-title" hidden={!active}>
    <div className="home-grid">
      <div className="home-heading"><div className="eyebrow"><span>01 / Daily practice</span><span className="sample-label">{demo ? 'Design preview' : snapshot ? 'Your Anki collection' : 'Awaiting connection'}</span></div><h1 id="today-title" tabIndex={-1}><span className="light-copy">Your next session.</span><span className="dark-copy">TODAY</span></h1></div>
      <div className="home-summary">
        <div className="workload"><div className="due-metric"><span className="due-number">{due}</span><span className="metric-caption">{demo ? 'cards due' : 'reviews + learning'}</span></div><div className="new-metric"><span className="new-number">{fresh}</span><span className="metric-caption">new cards</span></div></div>
        <button className="primary-button home-start" type="button" data-start="all" disabled={!demo} onClick={() => onStart('all')}><span>{demo ? 'Begin sample review' : 'Live review coming next'}</span><span aria-hidden="true">↗</span></button>
        <span className="quiet-note" id="home-note">{note}</span>
      </div>
      <div className="hero-art" aria-hidden="true"><img src="/assets/light-field-glass.png" alt="" width={1402} height={1122} fetchPriority="high" /></div>
      <section className="home-decks" aria-labelledby="home-decks-title">
        <div className="section-heading"><h2 id="home-decks-title">Your decks</h2><a className="text-link" href="#library">View library <span aria-hidden="true">↗</span></a></div>
        <DeckTable rows={rows} source={source} onStart={onStart} />
        <p id="home-empty" className="empty-message" hidden={rows.length > 0}>{demo ? '' : emptyCollectionMessage(connection)}</p>
      </section>
    </div>
  </section>;
}
