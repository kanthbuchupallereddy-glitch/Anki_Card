import type { RequestHandler } from 'express';

export function collectionRoute(controller: RequestHandler): RequestHandler {
  return (req, res, next) => {
    // Match the raw URL exactly; Express path normalization must not widen the API.
    if (req.originalUrl !== '/api/collection') { next(); return; }
    if (req.method !== 'GET' || req.headers['x-study-request'] !== '1'
        || (req.headers['sec-fetch-site'] !== undefined && req.headers['sec-fetch-site'] !== 'same-origin')) {
      res.status(403).json({ state: 'forbidden', message: 'This request is not from the local Study app.' }); return;
    }
    controller(req, res, next);
  };
}
