import { parseCollectionResponse, type CollectionResponse } from '@study/contracts';

export function createCollectionClient(fetcher: typeof fetch = fetch) {
  let generation = 0;
  let pending: AbortController | null = null;

  function cancel() {
    generation += 1;
    pending?.abort();
    pending = null;
  }

  async function read(): Promise<CollectionResponse | null> {
    cancel();
    const current = generation;
    const controller = new AbortController();
    pending = controller;
    const timeout = setTimeout(() => controller.abort(), 15_000);
    try {
      const response = await fetcher('/api/collection', {
        method: 'GET', headers: { 'X-Study-Request': '1' },
        cache: 'no-store', credentials: 'omit', signal: controller.signal,
      });
      const raw: unknown = await response.json();
      if (current !== generation) return null;
      try {
        const data = parseCollectionResponse(raw);
        if (!response.ok && data.state === 'ready') throw new TypeError('Unexpected successful response.');
        return data;
      } catch {
        return { state: 'unsupported', message: 'The connection returned an unsupported collection format.' };
      }
    } catch {
      if (current !== generation) return null;
      return {
        state: controller.signal.aborted ? 'timeout' : 'unavailable',
        message: 'Could not reach the local connection. Keep Anki and the Study server open, then refresh.',
      };
    } finally {
      clearTimeout(timeout);
      if (current === generation) pending = null;
    }
  }
  return { read, cancel };
}
