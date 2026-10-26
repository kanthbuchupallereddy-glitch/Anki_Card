import { Router } from 'express';
import type { ReviewService } from './review.service.js';

const entityId = (value: unknown): value is string =>
  typeof value === 'string' && /^[1-9][0-9]{0,18}$/.test(value) && BigInt(value) <= 9223372036854775807n;
const uuid = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9-]{36}$/i.test(value);
const rating = (value: unknown): value is 'again' | 'hard' | 'good' | 'easy' =>
  value === 'again' || value === 'hard' || value === 'good' || value === 'easy';

export function reviewRoute(service: ReviewService): Router {
  const router = Router();
  router.use('/api/review', (req, res, next) => {
    const allowed = new Set(['/api/review', '/api/review/start', '/api/review/reveal', '/api/review/answer']);
    if (!allowed.has(req.originalUrl)) { res.status(404).json({ state: 'not-found', message: 'This resource is not available.' }); return; }
    if (req.headers['x-study-request'] !== '1' || (req.headers['sec-fetch-site'] !== undefined && req.headers['sec-fetch-site'] !== 'same-origin')) {
      res.status(403).json({ state: 'forbidden', message: 'This request is not from the local Study app.' }); return;
    }
    next();
  });
  router.get('/api/review', async (_req, res, next) => {
    try { res.json(await service.current()); } catch (error) { next(error); }
  });
  router.post('/api/review/start', async (req, res, next) => {
    try {
      if (!entityId(req.body?.deckId)) { res.status(400).json({ state: 'bad-request', message: 'Choose a valid Anki deck.' }); return; }
      res.json(await service.start(req.body.deckId));
    } catch (error) { next(error); }
  });
  router.post('/api/review/reveal', async (req, res, next) => {
    try {
      if (!uuid(req.body?.reviewId) || !entityId(req.body?.cardId)) { res.status(400).json({ state: 'bad-request', message: 'Refresh the review and try again.' }); return; }
      res.json(await service.reveal(req.body.reviewId, req.body.cardId));
    } catch (error) { next(error); }
  });
  router.post('/api/review/answer', async (req, res, next) => {
    try {
      if (!uuid(req.body?.reviewId) || !entityId(req.body?.cardId) || !rating(req.body?.rating)) { res.status(400).json({ state: 'bad-request', message: 'Choose one of the offered ratings.' }); return; }
      res.json(await service.answer(req.body.reviewId, req.body.cardId, req.body.rating));
    } catch (error) { next(error); }
  });
  return router;
}
