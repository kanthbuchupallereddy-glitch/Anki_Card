export const nativeRatings = ['again', 'hard', 'good', 'easy'] as const;
export type NativeRating = typeof nativeRatings[number];

export interface NativeAnswerChoice {
  rating: NativeRating;
  label: string;
}

export interface NativeReviewReady {
  state: 'ready';
  reviewId: string;
  deckId: string;
  deckName: string;
  cardId: string;
  side: 'question' | 'answer';
  questionHtml: string;
  answerHtml: string;
  css: string;
  answers: NativeAnswerChoice[];
  completed: number;
}

export interface NativeReviewComplete {
  state: 'complete';
  deckId: string;
  completed: number;
  message: string;
}

export type NativeReviewFailureState = 'offline' | 'timeout' | 'unsupported' | 'unavailable' | 'profile-changed' | 'authentication' | 'busy' | 'uncertain';
export interface NativeReviewFailure { state: NativeReviewFailureState; message: string }
export type NativeReviewResponse = NativeReviewReady | NativeReviewComplete | NativeReviewFailure;

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Expected an object.');
  return value as Record<string, unknown>;
}
function string(value: unknown, max = 10000): string {
  if (typeof value !== 'string' || !value || value.length > max) throw new TypeError('Invalid text.');
  return value;
}
function entityId(value: unknown): string {
  const id = string(value, 20);
  if (!/^[1-9][0-9]{0,18}$/.test(id) || BigInt(id) > 9223372036854775807n) throw new TypeError('Invalid card or deck identity.');
  return id;
}
function boundedString(value: unknown, max: number, label: string): string {
  if (typeof value !== 'string' || value.length > max) throw new TypeError(`Invalid ${label}.`);
  return value;
}
function nonnegative(value: unknown): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) throw new TypeError('Invalid progress.');
  return value as number;
}
export function parseNativeReviewResponse(value: unknown): NativeReviewResponse {
  const data = object(value);
  if (data.state === 'ready') {
    if (data.side !== 'question' && data.side !== 'answer' || !Array.isArray(data.answers) || data.answers.length < 2 || data.answers.length > 4)
      throw new TypeError('Invalid reviewer state.');
    const answers = data.answers.map(item => {
      const answer = object(item);
      if (!nativeRatings.some(rating => rating === answer.rating)) throw new TypeError('Invalid rating.');
      return { rating: answer.rating as NativeRating, label: string(answer.label, 100) };
    });
    if (new Set(answers.map(answer => answer.rating)).size !== answers.length) throw new TypeError('Duplicate rating.');
    return {
      state: 'ready', reviewId: string(data.reviewId, 100), deckId: entityId(data.deckId),
      deckName: string(data.deckName), cardId: entityId(data.cardId), side: data.side,
      questionHtml: boundedString(data.questionHtml, 1_000_000, 'card front'),
      answerHtml: boundedString(data.answerHtml, 1_000_000, 'card back'),
      css: boundedString(data.css, 100_000, 'card style'),
      answers, completed: nonnegative(data.completed),
    };
  }
  if (data.state === 'complete') return { state: 'complete', deckId: entityId(data.deckId), completed: nonnegative(data.completed), message: string(data.message) };
  const failures: NativeReviewFailureState[] = ['offline','timeout','unsupported','unavailable','profile-changed','authentication','busy','uncertain'];
  if (failures.some(state => state === data.state)) return { state: data.state as NativeReviewFailureState, message: string(data.message) };
  throw new TypeError('Unknown reviewer state.');
}
