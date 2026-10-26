import http from 'node:http';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { DEFAULT_PORT, validatePort } from './config/runtime.js';
import { createAnkiRpc } from './integrations/anki/anki.client.js';
import type { AnkiRpc } from './integrations/anki/anki.types.js';
import { errorHandler } from './middleware/error-handler.js';
import { requestGuards } from './middleware/request-guards.js';
import { securityHeaders } from './middleware/security-headers.js';
import { createCollectionController } from './modules/collection/collection.controller.js';
import { collectionRoute } from './modules/collection/collection.routes.js';
import { createCollectionService } from './modules/collection/collection.service.js';
import { publicAssets } from './static/public-assets.js';
import { reviewRoute } from './modules/review/review.routes.js';
import { createReviewService } from './modules/review/review.service.js';

export interface StudyServerOptions { port?: number; rpc?: AnkiRpc; snapshotTimeoutMs?: number; webRoot?: string }

export function createStudyServer({ port = DEFAULT_PORT, rpc = createAnkiRpc(), snapshotTimeoutMs, webRoot = fileURLToPath(new URL('../../web/dist/', import.meta.url)) }: StudyServerOptions = {}): http.Server {
  validatePort(port, true);
  const app = express();
  app.disable('x-powered-by');
  app.disable('etag');
  app.set('trust proxy', false);
  const server = http.createServer(app);
  app.use(securityHeaders);
  app.use(requestGuards(() => {
    const address = server.address();
    return address && typeof address !== 'string' ? address.port : port;
  }));
  const service = createCollectionService(rpc, snapshotTimeoutMs === undefined ? {} : { snapshotTimeoutMs });
  app.use(collectionRoute(createCollectionController(service)));
  app.use(express.json({ limit: '4kb' }));
  app.use(reviewRoute(createReviewService(rpc)));
  app.use(publicAssets(webRoot));
  app.use((_req, res) => { res.status(404).json({ state: 'not-found', message: 'This resource is not available.' }); });
  app.use(errorHandler);
  server.requestTimeout = 35_000;
  server.headersTimeout = 5000;
  server.keepAliveTimeout = 1000;
  server.maxHeadersCount = 40;
  return server;
}
