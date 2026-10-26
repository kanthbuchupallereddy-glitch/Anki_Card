import type { ErrorRequestHandler } from 'express';
import { ConnectionError, unavailable } from '../integrations/anki/connection-error.js';

export const errorHandler: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
  const safe = error instanceof ConnectionError ? error : unavailable();
  res.status(503).json({ state: safe.state, message: safe.message });
};
