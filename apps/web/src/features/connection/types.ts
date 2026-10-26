import type { CollectionResponse } from '@study/contracts';

export type CollectionSource = 'anki' | 'demo';
export type ConnectionState = CollectionResponse | { state: 'idle'; message?: string } | { state: 'checking' };
export const isLocalConnection = () => location.protocol === 'http:' && location.hostname === '127.0.0.1';

export function readSource(): CollectionSource {
  if (!isLocalConnection()) return 'demo';
  try {
    const saved = localStorage.getItem('study.source');
    if (saved === 'anki' || saved === 'demo') return saved;
  } catch { /* Source selection also works without persistent storage. */ }
  return 'anki';
}
