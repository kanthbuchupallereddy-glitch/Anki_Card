import type { RequestHandler } from 'express';
import { LOCAL_HOST } from '../config/runtime.js';

export function requestGuards(getPort: () => number): RequestHandler {
  return (req, res, next) => {
    const host = `${LOCAL_HOST}:${getPort()}`;
    if (req.headers.host !== host || (req.headers.origin !== undefined && req.headers.origin !== `http://${host}`)
        || (req.headers['sec-fetch-site'] !== undefined && !['same-origin', 'none'].includes(String(req.headers['sec-fetch-site'])))) {
      res.status(403).json({ state: 'forbidden', message: 'This request is not from the local Study app.' }); return;
    }
    if (!['GET', 'HEAD'].includes(req.method)) {
      res.setHeader('Allow', 'GET, HEAD');
      res.status(405).json({ state: 'method-not-allowed', message: 'Only read requests are supported.' }); return;
    }
    next();
  };
}
