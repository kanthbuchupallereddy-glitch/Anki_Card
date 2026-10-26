import type { NativeAnswerChoice } from '@study/contracts';
import { nativeRatings } from '@study/contracts';
import { unavailable } from './connection-error.js';
import { isRecord } from './anki.schemas.js';
import type { AnkiRpc } from './anki.types.js';

export interface ReviewerCard {
  cardId: string;
  deckId: string;
  deckName: string;
  token: string;
  side: 'question' | 'answer';
  questionHtml: string;
  answerHtml: string;
  css: string;
  answers: NativeAnswerChoice[];
}
export interface OperationReceipt { operationId: string; method: string; session: string }
export interface OperationStatus { state: 'pending' | 'succeeded' | 'failed'; result?: unknown }

const entityId = (value: unknown): value is string => typeof value === 'string' && /^[1-9][0-9]{0,18}$/.test(value) && BigInt(value) <= 9223372036854775807n;
const shortText = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 10000;
const html = (value: unknown): value is string => typeof value === 'string' && value.length <= 1_000_000;

export function parseReviewer(value: unknown): ReviewerCard | null {
  if (!isRecord(value) || typeof value.active !== 'boolean') throw unavailable('unsupported');
  if (!value.active) return null;
  const card = value.card;
  const rendered = value.rendered;
  if (!isRecord(card) || !entityId(card.id) || !isRecord(card.deck) || !entityId(card.deck.id)
      || !shortText(card.deck.name) || !isRecord(rendered) || rendered.cardId !== card.id
      || !html(rendered.questionHtml) || !html(rendered.answerHtml)
      || typeof rendered.css !== 'string' || rendered.css.length > 100_000
      || !shortText(value.stateToken) || !['question', 'answer'].includes(String(value.side))
      || !Array.isArray(value.answers) || value.answers.length < 2 || value.answers.length > 4) throw unavailable('unsupported');
  const answers = value.answers.map(entry => {
    if (!isRecord(entry) || !nativeRatings.some(rating => rating === entry.rating)
        || !shortText(entry.label) || entry.label.length > 100) throw unavailable('unsupported');
    return { rating: entry.rating as NativeAnswerChoice['rating'], label: entry.label };
  });
  if (new Set(answers.map(answer => answer.rating)).size !== answers.length) throw unavailable('unsupported');
  return { cardId: card.id, deckId: card.deck.id, deckName: card.deck.name, token: value.stateToken,
    side: value.side as ReviewerCard['side'], questionHtml: rendered.questionHtml,
    answerHtml: rendered.answerHtml, css: rendered.css, answers };
}

export function parseReceipt(value: unknown, method: string, session: string): OperationReceipt {
  if (!isRecord(value) || !shortText(value.operationId) || value.method !== method || value.session !== session)
    throw unavailable('unsupported');
  return { operationId: value.operationId, method, session };
}

export function parseOperation(value: unknown, receipt: OperationReceipt): OperationStatus {
  if (!isRecord(value) || value.operationId !== receipt.operationId || value.method !== receipt.method
      || value.session !== receipt.session) throw unavailable('unsupported');
  if (value.state === 'succeeded') return { state: 'succeeded', result: value.result };
  if (value.state === 'failed' || value.state === 'cancelled') return { state: 'failed' };
  if (value.state === 'queued' || value.state === 'running' || value.state === 'waitingForUser') return { state: 'pending' };
  throw unavailable('unsupported');
}

export function parseAnswerResult(value: unknown, expectedCardId: string): void {
  if (!isRecord(value) || value.cardId !== expectedCardId || !entityId(value.reviewId))
    throw unavailable('unsupported');
}

export function createReviewerAdapter(rpc: AnkiRpc) {
  return {
    describe: () => rpc('api.describe'),
    profile: () => rpc('profiles.getActive'),
    collection: (session?: string) => rpc('collection.get', session ? { session } : {}),
    decks: (session: string) => rpc('decks.list', { session }),
    navigate: (session: string, deckId: string) => rpc('application.navigate', { view: 'review', deck: { id: deckId }, session }),
    get: async (session: string) => parseReviewer(await rpc('reviewer.get', { session })),
    reveal: (session: string, token: string) => rpc('reviewer.showAnswer', { stateToken: token, session }),
    answer: (session: string, token: string, rating: NativeAnswerChoice['rating']) =>
      rpc('reviewer.answer', { stateToken: token, rating, session }),
    operation: async (receipt: OperationReceipt) =>
      parseOperation(await rpc('operations.get', { operationId: receipt.operationId }), receipt),
  };
}
