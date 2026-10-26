import { useEffect, useLayoutEffect, useRef } from 'react';
import { ratings } from './demoReviewReducer';
import type { DemoReviewController } from './useDemoReview';

export function useReviewInteractions(review: DemoReviewController, active: boolean) {
  const { state, reveal, rate, undo } = review;
  const lastRevision = useRef(state.revision);

  useLayoutEffect(() => {
    if (lastRevision.current === state.revision) return;
    lastRevision.current = state.revision;
    if (active && state.focusTarget) document.getElementById(state.focusTarget)?.focus({ preventScroll: true });
  }, [state.revision, state.focusTarget, active]);

  useEffect(() => {
    if (!active) return;
    const keydown = (event: KeyboardEvent) => {
      const target = event.target;
      if (!(target instanceof Element) || event.repeat || event.ctrlKey || event.metaKey || event.altKey || target.closest('input,textarea,select,[contenteditable="true"]')) return;
      if (event.key === ' ' && (!target.closest('button,a') || target.id === 'reveal-answer')) {
        event.preventDefault(); reveal();
      }
      if (['1', '2', '3', '4'].includes(event.key) && state.revealed) {
        event.preventDefault(); rate(ratings[Number(event.key) - 1]!);
      }
      if (event.key.toLowerCase() === 'z') { event.preventDefault(); undo(); }
    };
    document.addEventListener('keydown', keydown);
    return () => document.removeEventListener('keydown', keydown);
  }, [active, state.revealed, reveal, rate, undo]);
}
