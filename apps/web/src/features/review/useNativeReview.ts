import { useCallback, useRef, useState } from 'react';
import type { NativeRating, NativeReviewResponse } from '@study/contracts';
import { createReviewClient } from '../../api/reviewClient';

export function useNativeReview(onSaved: () => void | Promise<void>) {
  const client = useRef(createReviewClient());
  const [state, setState] = useState<NativeReviewResponse>({ state: 'unavailable', message: 'Choose a deck to start reviewing.' });
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const current = useRef(state);
  const apply = (next: NativeReviewResponse) => { current.current = next; setState(next); };
  const run = useCallback(async (action: () => Promise<NativeReviewResponse>, saved = false) => {
    if (lock.current) return;
    lock.current = true; setBusy(true);
    try {
      const next = await action();
      apply(next);
      if (saved && (next.state === 'ready' || next.state === 'complete')) void onSaved();
    } finally { lock.current = false; setBusy(false); }
  }, [onSaved]);
  const start = useCallback((deckId: string) => run(() => client.current.start(deckId)), [run]);
  const reveal = useCallback(() => {
    const card = current.current;
    if (card.state === 'ready' && card.side === 'question') void run(() => client.current.reveal(card.reviewId, card.cardId));
  }, [run]);
  const rate = useCallback((rating: NativeRating) => {
    const card = current.current;
    if (card.state === 'ready' && card.side === 'answer' && card.answers.some(answer => answer.rating === rating))
      void run(() => client.current.answer(card.reviewId, card.cardId, rating), true);
  }, [run]);
  const refresh = useCallback(() => run(() => client.current.current()), [run]);
  return { state, busy, start, reveal, rate, refresh };
}
export type NativeReviewController = ReturnType<typeof useNativeReview>;
