import type { ConnectionState, CollectionSource } from '../connection/types';
import { demoDeckName } from './demoFixtures';
import { ratings } from './demoReviewReducer';
import type { DemoReviewController } from './useDemoReview';
import { useReviewInteractions } from './useReviewInteractions';

export function ReviewScreen({ active, source, connection, review }: {
  active: boolean; source: CollectionSource; connection: ConnectionState; review: DemoReviewController;
}) {
  const demo = source === 'demo';
  const { state, reveal, rate, undo, start } = review;
  useReviewInteractions(review, active && demo);
  const complete = state.position >= state.queue.length;
  const card = state.queue[state.position];
  const deckName = demo ? demoDeckName(state.deck) : connection.state === 'ready' ? connection.profile : 'Anki';
  return <section id="review-screen" className="screen review-screen" aria-labelledby="review-title" hidden={!active}>
    <div className="review-topline"><a href="#today" className="text-link">← Back to Today</a><span className="sample-label">{demo ? 'Sample review · no scheduling changes' : 'Live review not available yet'}</span></div>
    <div className="review-heading"><div><div className="eyebrow" id="review-deck">{deckName}</div><h1 id="review-title" tabIndex={-1}>One thought at a time.</h1></div><span id="review-position" className="review-position" hidden={!demo}>{complete ? state.queue.length : state.position + 1} / {state.queue.length}</span></div>
    <div id="live-review-unavailable" className="session-complete" hidden={demo}>
      <span className="eyebrow">Next stage</span><h2>Your reviews, remembered.</h2><p>Reviewing through Study is still being built. Use Anki to study for now. Choose Demo above to try the review design with sample cards.</p><a className="text-link" href="#library">Back to your library ↗</a>
    </div>
    <div id="sample-review-body" hidden={!demo}>
      <div className="review-progress" role="progressbar" aria-label="Sample session progress" aria-valuemin={0} aria-valuemax={state.queue.length} aria-valuenow={state.position}>
        <div id="review-progress-fill" style={{ width: `${state.position / state.queue.length * 100}%` }} />
      </div>
      <div id="review-card-area" hidden={complete}>
        <article className="review-card" aria-label="Sample flashcard">
          <span className="eyebrow" id="card-subject">{card ? demoDeckName(card.deck) : ''}</span>
          <h2 id="card-question" tabIndex={-1} aria-describedby="card-subject">{card?.question}</h2>
          <div id="card-answer" className="card-answer" hidden={!state.revealed}>
            <span className="eyebrow">Answer</span><p id="card-answer-text" tabIndex={-1} aria-describedby="card-answer-detail">{card?.answer}</p><p id="card-answer-detail" className="answer-detail">{card?.detail}</p>
          </div>
        </article>
        <div className="review-controls">
          <button id="reveal-answer" type="button" className="primary-button reveal-button" hidden={state.revealed} onClick={reveal}><span>Reveal answer</span><kbd>Space</kbd></button>
          <div id="rating-buttons" className="rating-buttons" role="group" aria-label="Rate recall" hidden={!state.revealed}>
            {ratings.map((rating, index) => <button key={rating} type="button" data-rating={rating} onClick={() => rate(rating)}>{rating}<kbd>{index + 1}</kbd></button>)}
          </div>
        </div>
      </div>
      <div id="session-complete" className="session-complete" hidden={!complete}>
        <span className="eyebrow">Preview complete</span><h2>A little more familiar.</h2><p>You have reached the end of the sample cards. No Anki reviews or learning history were recorded.</p><button className="primary-button" type="button" id="restart-session" onClick={() => start(state.deck)}>Try this session again <span aria-hidden="true">↗</span></button>
      </div>
      <div className="review-bottom"><button className="text-button" type="button" id="undo-review" disabled={!state.history.length} onClick={undo}>↶ Undo sample rating</button><span className="quiet-note">Space to reveal · 1–4 to rate · Z to undo</span></div>
      <p id="review-notice" className="review-notice" role="status" aria-live="polite">{state.notice}</p>
    </div>
  </section>;
}
