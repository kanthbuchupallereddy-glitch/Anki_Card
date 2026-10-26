import { useEffect } from 'react';
import type { NativeReviewController } from './useNativeReview';

function frameDocument(css: string, html: string): string {
  const safeCss = css.replace(/<\/style/gi, '<\\/style');
  return `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font:18px/1.5 system-ui,sans-serif;margin:0;padding:12px;color:#26221e;background:transparent;overflow-wrap:anywhere}${safeCss}</style></head><body>${html}</body></html>`;
}
export function NativeReview({ review }: { review: NativeReviewController }) {
  const { state, busy, reveal, rate, refresh } = review;
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      const target = event.target;
      if (busy || event.repeat || event.ctrlKey || event.metaKey || event.altKey || !(target instanceof Element)
          || target.closest('input,textarea,select,[contenteditable="true"]')) return;
      if (state.state !== 'ready') return;
      if (event.key === ' ' && state.side === 'question' && !target.closest('a')) { event.preventDefault(); reveal(); }
      if (state.side === 'answer' && ['1','2','3','4'].includes(event.key)) {
        const choice = state.answers[Number(event.key) - 1];
        if (choice) { event.preventDefault(); rate(choice.rating); }
      }
    };
    document.addEventListener('keydown', keydown);
    return () => document.removeEventListener('keydown', keydown);
  }, [state, busy, reveal, rate]);
  if (state.state === 'complete') return <div className="session-complete"><span className="eyebrow">Session complete</span><h2>Good work.</h2><p>{state.message} {state.completed} review{state.completed === 1 ? '' : 's'} saved in Anki during this session.</p><a className="text-link" href="#library">Back to your library ↗</a></div>;
  if (state.state !== 'ready') return <div className="session-complete"><span className="eyebrow">Anki review</span><h2>Review paused.</h2><p role="alert">{state.message}</p>{state.state !== 'uncertain' && <button className="primary-button" type="button" disabled={busy} onClick={refresh}>Refresh review</button>}<p className="quiet-note">Your cards and review history remain in Anki.</p></div>;
  return <>
    <div className="review-heading"><div><div className="eyebrow">{state.deckName}</div><h1 id="native-review-title" tabIndex={-1}>One thought at a time.</h1></div><span className="review-position">{state.completed} saved this session</span></div>
    <article className="review-card native-card" aria-label="Anki flashcard">
      <span className="eyebrow">{state.side === 'question' ? 'Recall' : 'Answer'}</span>
      <iframe className="native-card-frame" title={state.side === 'question' ? 'Anki card question' : 'Anki card question and answer'} sandbox="" srcDoc={frameDocument(state.css, state.side === 'question' ? state.questionHtml : state.answerHtml)} />
    </article>
    <div className="review-controls">
      {state.side === 'question' ? <button className="primary-button reveal-button" type="button" disabled={busy} onClick={reveal}>Reveal answer <kbd>Space</kbd></button> :
      <div className="rating-buttons" role="group" aria-label="Rate recall in Anki">{state.answers.map((answer, index) => <button key={answer.rating} type="button" data-rating={answer.rating} disabled={busy} onClick={() => rate(answer.rating)}><span><strong>{answer.rating[0]!.toUpperCase() + answer.rating.slice(1)}</strong><small className="rating-interval">{answer.label}</small></span><kbd>{index + 1}</kbd></button>)}</div>}
    </div>
    <div className="review-bottom"><span className="quiet-note">Anki saves and schedules each rating. Keep Anki open.</span><span className="quiet-note">Space to reveal · 1–4 to rate</span></div>
  </>;
}
