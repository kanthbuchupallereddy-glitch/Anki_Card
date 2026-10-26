import { useCallback, useReducer } from 'react';
import { demoReviewReducer, initialDemoReview, type Rating } from './demoReviewReducer';

export function useDemoReview(enabled: boolean) {
  const [state, dispatch] = useReducer(demoReviewReducer, undefined, initialDemoReview);
  const start = useCallback((deck: string) => { if (enabled) dispatch({ type: 'start', deck }); }, [enabled]);
  const reveal = useCallback(() => { if (enabled) dispatch({ type: 'reveal' }); }, [enabled]);
  const rate = useCallback((rating: Rating) => { if (enabled) dispatch({ type: 'rate', rating }); }, [enabled]);
  const undo = useCallback(() => { if (enabled) dispatch({ type: 'undo' }); }, [enabled]);
  return { state, start, reveal, rate, undo };
}
export type DemoReviewController = ReturnType<typeof useDemoReview>;
