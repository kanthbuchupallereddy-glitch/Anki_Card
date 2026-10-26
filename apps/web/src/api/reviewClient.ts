import { parseNativeReviewResponse, type NativeRating, type NativeReviewResponse } from '@study/contracts';

type ReviewAction = 'start' | 'reveal' | 'answer';
export function createReviewClient(fetcher: typeof fetch = fetch) {
  async function request(path: string, body?: object): Promise<NativeReviewResponse> {
    try {
      const response = await fetcher(`/api/review${path}`, {
        method: body ? 'POST' : 'GET',
        headers: { 'X-Study-Request': '1', ...(body ? { 'Content-Type': 'application/json' } : {}) },
        body: body ? JSON.stringify(body) : undefined,
        cache: 'no-store', credentials: 'omit',
      });
      const raw: unknown = await response.json();
      return parseNativeReviewResponse(raw);
    } catch {
      return { state: path === '/answer' ? 'uncertain' : 'offline',
        message: path === '/answer'
          ? 'Study could not confirm that Anki saved this rating. Check Anki before answering again.'
          : 'Could not reach Anki through the local Study server. Keep both apps open and try again.' };
    }
  }
  return {
    current: () => request(''),
    start: (deckId: string) => request('/start', { deckId }),
    reveal: (reviewId: string, cardId: string) => request('/reveal', { reviewId, cardId }),
    answer: (reviewId: string, cardId: string, rating: NativeRating) => request('/answer', { reviewId, cardId, rating }),
  } satisfies Record<ReviewAction | 'current', (...args: never[]) => Promise<NativeReviewResponse>>;
}
