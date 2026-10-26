import type { RequestHandler } from 'express';
import { LOCAL_HOST } from '../config/runtime.js';

const postPaths = new Set(['/api/review/start', '/api/review/reveal', '/api/review/answer']);
export function requestGuards(getPort: () => number): RequestHandler {
  return (req, res, next) => {
    const host = `${LOCAL_HOST}:${getPort()}`;
    const origin = `http://${host}`;
    if (req.headers.host !== host || (req.headers.origin !== undefined && req.headers.origin !== origin)
        || (req.headers['sec-fetch-site'] !== undefined && !['same-origin', 'none'].includes(String(req.headers['sec-fetch-site'])))) {
      res.status(403).json({ state: 'forbidden', message: 'This request is not from the local Study app.' }); return;
    }
    if (req.method === 'POST' && postPaths.has(req.originalUrl)) {
      if (req.headers.origin !== origin || req.headers['sec-fetch-site'] !== 'same-origin'
          || req.headers['content-type']?.split(';')[0]?.trim().toLowerCase() !== 'application/json') {
        res.status(403).json({ state: 'forbidden', message: 'Open Study at its local address to review.' }); return;
      }
      next(); return;
    }
    if (!['GET', 'HEAD'].includes(req.method)) {
      res.setHeader('Allow', 'GET, HEAD');
      res.status(405).json({ state: 'method-not-allowed', message: 'This action is not available.' }); return;
    }
    next();
  };
}
