import type { RequestHandler } from 'express';
import { parseCollectionResponse } from '@study/contracts';
import type { CollectionReader } from './collection.service.js';

export function createCollectionController(readSnapshot: CollectionReader): RequestHandler {
  return (_req, res, next) => {
    void readSnapshot().then(snapshot => { res.status(200).json(parseCollectionResponse(snapshot)); }).catch(next);
  };
}
