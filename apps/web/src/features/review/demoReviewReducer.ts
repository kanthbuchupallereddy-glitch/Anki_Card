import { demoCards, demoDecks, type DemoCard } from './demoFixtures';

export const ratings = ['Again', 'Hard', 'Good', 'Easy'] as const;
export type Rating = typeof ratings[number];
export interface DemoReviewState {
  deck: string;
  queue: readonly DemoCard[];
  position: number;
  revealed: boolean;
  history: readonly { position: number; rating: Rating }[];
  notice: string;
  revision: number;
  focusTarget: 'card-answer-text' | 'card-question' | 'restart-session' | null;
}
export type ReviewAction = { type: 'start'; deck: string } | { type: 'reveal' } | { type: 'rate'; rating: Rating } | { type: 'undo' };

export function initialDemoReview(): DemoReviewState {
  return { deck: 'all', queue: demoCards, position: 0, revealed: false, history: [], notice: '', revision: 0, focusTarget: null };
}

// This reducer only changes local demo state. It has no API or scheduling access.
export function demoReviewReducer(state: DemoReviewState, action: ReviewAction): DemoReviewState {
  if (action.type === 'start') {
    const deck = demoDecks.some(item => item.id === action.deck) ? action.deck : 'all';
    return { ...initialDemoReview(), deck, queue: deck === 'all' ? demoCards : demoCards.filter(card => card.deck === deck),
      notice: 'Sample session. Ratings here do not update Anki.', revision: state.revision + 1 };
  }
  if (action.type === 'reveal') {
    if (state.revealed || state.position >= state.queue.length) return state;
    return { ...state, revealed: true, notice: 'Choose how well you recalled the answer. This is a sample interaction.',
      revision: state.revision + 1, focusTarget: 'card-answer-text' };
  }
  if (action.type === 'rate') {
    if (!state.revealed || state.position >= state.queue.length || !ratings.includes(action.rating)) return state;
    const position = state.position + 1;
    return { ...state, position, revealed: false, history: [...state.history, { position: state.position, rating: action.rating }],
      notice: `${action.rating} selected in the preview. No learning history was saved.`, revision: state.revision + 1,
      focusTarget: position < state.queue.length ? 'card-question' : 'restart-session' };
  }
  const previous = state.history.at(-1);
  if (!previous) return state;
  return { ...state, position: previous.position, revealed: true, history: state.history.slice(0, -1),
    notice: 'Last sample rating undone. No Anki data was changed.', revision: state.revision + 1, focusTarget: 'card-answer-text' };
}
