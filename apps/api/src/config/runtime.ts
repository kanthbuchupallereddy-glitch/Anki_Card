export const LOCAL_HOST = '127.0.0.1';
export const DEFAULT_PORT = 4173;
export const ANKI_ENDPOINT = Object.freeze({ hostname: LOCAL_HOST, port: 8765, path: '/api/v1', method: 'POST' });
export const REQUIRED_READS = ['profiles.getActive', 'collection.get', 'decks.list', 'decks.getCounts'] as const;
export const READ_METHODS = ['api.describe', ...REQUIRED_READS] as const;
export const REVIEW_METHODS = ['application.navigate', 'reviewer.get', 'reviewer.showAnswer', 'reviewer.answer', 'operations.get'] as const;
export const API_METHODS = [...READ_METHODS, ...REVIEW_METHODS] as const;
export type ApiMethod = typeof API_METHODS[number];
export const LIMITS = Object.freeze({ rpcTimeoutMs: 3000, snapshotTimeoutMs: 12000, responseBytes: 4 * 1024 * 1024, maxDecks: 1000, countConcurrency: 4 });

export function validatePort(port: number, allowEphemeral = false): number {
  if (!Number.isInteger(port) || port < (allowEphemeral ? 0 : 1) || port > 65535) throw new TypeError('Invalid local port.');
  return port;
}

export function configuredPort(value: string | undefined): number {
  if (value === undefined) return DEFAULT_PORT;
  if (!/^\d+$/.test(value)) throw new TypeError('Invalid local port.');
  return validatePort(Number(value));
}
