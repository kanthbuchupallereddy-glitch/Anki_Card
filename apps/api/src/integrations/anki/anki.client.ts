import http from 'node:http';
import type { ClientRequest } from 'node:http';
import type { ConnectionFailureState } from '@study/contracts';
import { ANKI_ENDPOINT, LIMITS, READ_METHODS } from '../../config/runtime.js';
import { unavailable } from './connection-error.js';
import { isRecord } from './anki.schemas.js';
import type { AnkiRpc, RequestTransport } from './anki.types.js';

export interface AnkiRpcOptions { request?: RequestTransport; timeoutMs?: number }

// Destination and operations are fixed; no browser input selects an Anki RPC.
export function createAnkiRpc({ request = http.request, timeoutMs = LIMITS.rpcTimeoutMs }: AnkiRpcOptions = {}): AnkiRpc {
  let nextId = 0;
  return (method, params = {}, { signal } = {}) => {
    if (!(READ_METHODS as readonly string[]).includes(method)) return Promise.reject(unavailable('unsupported'));
    const id = `study-read-${++nextId}`;
    const body = JSON.stringify({ jsonrpc: '2.0', id, method, params });
    return new Promise<unknown>((resolve, reject) => {
      let finished = false;
      let req: ClientRequest | undefined;
      const finish = (error: Error | null, result?: unknown) => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        signal?.removeEventListener('abort', abort);
        if (error) reject(error); else resolve(result);
      };
      const abort = () => { finish(unavailable('timeout')); req?.destroy(); };
      const timer = setTimeout(abort, timeoutMs);
      signal?.addEventListener('abort', abort, { once: true });
      if (signal?.aborted) { abort(); return; }
      try {
        req = request({ ...ANKI_ENDPOINT, headers: {
          'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body),
        } }, res => {
          if (res.statusCode === 401 || res.statusCode === 403) { res.resume(); finish(unavailable('authentication')); return; }
          if (res.statusCode !== 200) { res.resume(); finish(unavailable('unsupported')); return; }
          const chunks: Buffer[] = [];
          let length = 0;
          res.on('data', (chunk: Buffer) => {
            length += chunk.length;
            if (length > LIMITS.responseBytes) { finish(unavailable('unsupported')); req?.destroy(); return; }
            chunks.push(chunk);
          });
          res.on('error', () => finish(unavailable('offline')));
          res.on('end', () => {
            if (finished) return;
            let envelope: unknown;
            try { envelope = JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown; }
            catch { finish(unavailable('unsupported')); return; }
            if (!isRecord(envelope) || envelope.jsonrpc !== '2.0' || envelope.id !== id) { finish(unavailable('unsupported')); return; }
            if (envelope.error) {
              const data = isRecord(envelope.error) ? envelope.error.data : undefined;
              const type = isRecord(data) && typeof data.type === 'string' ? data.type : '';
              const states: Record<string, ConnectionFailureState> = {
                staleSession: 'profile-changed', collectionUnavailable: 'unavailable', authenticationRequired: 'authentication',
                busy: 'busy', unsupportedCapability: 'unsupported',
              };
              finish(unavailable(states[type])); return;
            }
            if (!Object.hasOwn(envelope, 'result')) { finish(unavailable('unsupported')); return; }
            finish(null, envelope.result);
          });
        });
        req.on('error', () => finish(unavailable('offline')));
        req.end(body);
      } catch { finish(unavailable('offline')); }
    });
  };
}
