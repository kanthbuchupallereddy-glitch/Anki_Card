import { useCallback, useEffect, useRef, useState } from 'react';
import { createCollectionClient } from '../../api/collectionClient';
import { isLocalConnection, readSource, type CollectionSource, type ConnectionState } from './types';

export function useCollectionConnection() {
  const [source, setSource] = useState<CollectionSource>(readSource);
  const [connection, setConnection] = useState<ConnectionState>({ state: 'idle' });
  const client = useRef<ReturnType<typeof createCollectionClient> | null>(null);
  if (!client.current) client.current = createCollectionClient();
  const sourceRef = useRef(source);
  const generation = useRef(0);
  const busy = useRef(false);
  const mounted = useRef(false);

  const cancel = useCallback(() => {
    generation.current += 1;
    busy.current = false;
    client.current!.cancel();
  }, []);

  const refresh = useCallback(async () => {
    if (!mounted.current || sourceRef.current !== 'anki' || !isLocalConnection()) return;
    const token = ++generation.current;
    busy.current = true;
    setConnection({ state: 'checking' });
    const snapshot = await client.current!.read();
    if (token !== generation.current || !mounted.current || sourceRef.current !== 'anki') return;
    busy.current = false;
    if (snapshot) setConnection(snapshot);
  }, []);

  const selectSource = useCallback((next: CollectionSource) => {
    if (next === sourceRef.current) return;
    cancel();
    sourceRef.current = next;
    setConnection({ state: 'idle' });
    setSource(next);
    try { localStorage.setItem('study.source', next); } catch { /* Optional persistence. */ }
  }, [cancel]);

  useEffect(() => {
    mounted.current = true;
    sourceRef.current = source;
    document.documentElement.dataset.source = source;
    const refreshVisible = () => {
      if (!document.hidden && !busy.current) void refresh();
    };
    const visibilityChanged = () => {
      if (document.hidden && sourceRef.current === 'anki') {
        cancel();
        setConnection({ state: 'idle', message: 'Refresh the connection to read your current Anki profile.' });
      } else refreshVisible();
    };
    if (source === 'anki') {
      if (!document.hidden) void refresh();
      window.addEventListener('focus', refreshVisible);
      document.addEventListener('visibilitychange', visibilityChanged);
    }
    const interval = source === 'anki' ? setInterval(refreshVisible, 60_000) : null;
    return () => {
      mounted.current = false;
      cancel();
      if (interval !== null) clearInterval(interval);
      window.removeEventListener('focus', refreshVisible);
      document.removeEventListener('visibilitychange', visibilityChanged);
    };
  }, [source, refresh, cancel]);

  return { source, connection, selectSource, refresh };
}
