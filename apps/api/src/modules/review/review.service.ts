import { randomUUID } from 'node:crypto';
import { parseNativeReviewResponse, type NativeRating, type NativeReviewResponse } from '@study/contracts';
import { createReviewerAdapter, parseAnswerResult, parseReceipt, type OperationReceipt, type ReviewerCard } from '../../integrations/anki/reviewer.adapter.js';
import { ConnectionError, unavailable } from '../../integrations/anki/connection-error.js';
import { isRecord, parseCollection, parseDecks, parseProfile, verifyContext } from '../../integrations/anki/anki.schemas.js';
import type { AnkiRpc } from '../../integrations/anki/anki.types.js';

interface ActiveReview {
  id: string; session: string; profile: string; deckId: string; deckName: string;
  completed: number; card: ReviewerCard | null; uncertain: boolean;
}
const reviewMethods: Record<string, string> = {
  'application.navigate': 'gui', 'reviewer.get': 'read', 'reviewer.showAnswer': 'gui',
  'reviewer.answer': 'write', 'operations.get': 'read',
};
const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const needsNativeAnki = (card: ReviewerCard): boolean =>
  /<\s*(script|img|audio|video|iframe|object|embed|svg|canvas|form|input|button|select|textarea)\b|\[sound:/i.test(card.questionHtml + card.answerHtml)
  || /url\s*\(/i.test(card.css);
const failure = (state: NativeReviewResponse['state'], message: string): NativeReviewResponse =>
  parseNativeReviewResponse({ state, message });

function supported(description: unknown): boolean {
  if (!isRecord(description) || description.apiMajor !== 1 || !Array.isArray(description.methods)
      || !isRecord(description.schema) || !isRecord(description.schema['x-methods'])) return false;
  const schema = description.schema['x-methods'];
  return Object.entries(reviewMethods).every(([name, effect]) =>
    (description.methods as unknown[]).some((entry: unknown) => isRecord(entry) && entry.name === name && entry.available === true)
    && isRecord(schema[name]) && schema[name].effect === effect);
}

export function createReviewService(rpc: AnkiRpc) {
  const anki = createReviewerAdapter(rpc);
  let active: ActiveReview | null = null;
  let busy = false;

  function publicState(): NativeReviewResponse {
    if (!active) return failure('unavailable', 'Choose a deck to start reviewing.');
    if (active.uncertain) return failure('uncertain', 'Anki may have saved the last rating, but Study could not confirm it. Check the card in Anki before continuing.');
    if (!active.card) return parseNativeReviewResponse({
      state: 'complete', deckId: active.deckId, completed: active.completed,
      message: active.completed ? 'This deck has no more cards ready right now.' : 'No cards are due in this deck right now.',
    });
    if (needsNativeAnki(active.card)) return failure('unsupported', 'This card uses media or an interactive template. Review it in Anki, then refresh Study.');
    return parseNativeReviewResponse({
      state: 'ready', reviewId: active.id, deckId: active.deckId, deckName: active.card.deckName,
      cardId: active.card.cardId, side: active.card.side, questionHtml: active.card.questionHtml,
      answerHtml: active.card.answerHtml, css: active.card.css, answers: active.card.answers,
      completed: active.completed,
    });
  }

  async function context(): Promise<void> {
    if (!active) throw unavailable();
    const profile = parseProfile(await anki.profile());
    const collection = parseCollection(await anki.collection(active.session));
    verifyContext(profile, collection);
    if (profile.name !== active.profile || collection.session !== active.session) throw unavailable('profile-changed');
  }

  async function loadCard(): Promise<NativeReviewResponse> {
    if (!active) throw unavailable();
    await context();
    active.card = await anki.get(active.session);
    return publicState();
  }

  async function waitFor(receipt: OperationReceipt, timeoutMs: number): Promise<unknown> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const status = await anki.operation(receipt);
      if (status.state === 'succeeded') return status.result;
      if (status.state === 'failed') throw unavailable();
      await pause(250);
    }
    throw unavailable('timeout');
  }

  async function exclusive(action: () => Promise<NativeReviewResponse>): Promise<NativeReviewResponse> {
    if (busy) return failure('busy', 'Study is waiting for Anki to finish the current action.');
    busy = true;
    try { return await action(); }
    catch (error) {
      if (error instanceof ConnectionError) {
        if (error.state === 'profile-changed') active = null;
        return failure(error.state, error.message);
      }
      return failure('unavailable', 'Study could not read the current Anki review. Check Anki and try again.');
    } finally { busy = false; }
  }

  return {
    current: () => exclusive(async () => {
      if (!active) return publicState();
      if (active.uncertain) return publicState();
      return loadCard();
    }),
    start: (deckId: string) => exclusive(async () => {
      if (active?.uncertain) return publicState();
      if (active?.deckId === deckId && active.card) return loadCard();
      const description = await anki.describe();
      if (!supported(description)) return failure('unsupported', 'This AnkiConnect installation cannot safely run native reviews through Study.');
      const profile = parseProfile(await anki.profile());
      const collection = parseCollection(await anki.collection());
      verifyContext(profile, collection);
      const decks = parseDecks(await anki.decks(collection.session));
      const deck = decks.find(item => item.id === deckId);
      if (!deck) return failure('unavailable', 'That deck is no longer in the open Anki profile. Refresh your library.');
      active = { id: randomUUID(), session: collection.session, profile: profile.name,
        deckId, deckName: deck.name, completed: 0, card: null, uncertain: false };
      const receipt = parseReceipt(await anki.navigate(collection.session, deckId), 'application.navigate', collection.session);
      await waitFor(receipt, 15_000);
      await context();
      for (let attempt = 0; attempt < 8; attempt++) {
        const card = await anki.get(collection.session);
        if (card) { active.card = card; return publicState(); }
        await pause(150);
      }
      return publicState();
    }),
    reveal: (reviewId: string, cardId: string) => exclusive(async () => {
      if (!active || active.id !== reviewId || active.uncertain) return failure('profile-changed', 'The review session changed. Return to your deck and refresh.');
      await context();
      const current = active.card;
      if (!current || needsNativeAnki(current) || current.cardId !== cardId || current.side !== 'question')
        return failure('profile-changed', 'The review card changed. Refresh the review before answering.');
      const result = await anki.reveal(active.session, current.token);
      if (!isRecord(result) || result.changed !== true) throw unavailable('unsupported');
      return loadCard();
    }),
    answer: (reviewId: string, cardId: string, rating: NativeRating) => exclusive(async () => {
      if (!active || active.id !== reviewId || active.uncertain) return failure('profile-changed', 'The review session changed. Return to your deck and refresh.');
      await context();
      const current = active.card;
      if (!current || needsNativeAnki(current) || current.cardId !== cardId || current.side !== 'answer'
          || !current.answers.some(choice => choice.rating === rating))
        return failure('profile-changed', 'Anki changed this card or its available ratings. Refresh before answering.');
      const session = active.session;
      try {
        const receipt = parseReceipt(await anki.answer(session, current.token, rating), 'reviewer.answer', session);
        const result = await waitFor(receipt, 25_000);
        parseAnswerResult(result, cardId);
        active.completed += 1;
        return await loadCard();
      } catch {
        active.uncertain = true;
        return publicState();
      }
    }),
  };
}
export type ReviewService = ReturnType<typeof createReviewService>;
