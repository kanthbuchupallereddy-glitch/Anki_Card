import type { CollectionSource, ConnectionState } from '../features/connection/types';

export function AppFooter({ source, connection, theme }: {
  source: CollectionSource; connection: ConnectionState; theme: 'light' | 'dark';
}) {
  const status = source === 'demo' ? 'Sample collection · no reviews saved' : connection.state === 'ready' ? `Anki · ${connection.profile} · read-only` : 'Anki · no live data loaded';
  return <footer className="app-footer"><span id="source-footer">{status}</span><span id="theme-label">{theme === 'dark' ? 'Counterform / dark' : 'Light Field / light'}</span><span>Local desktop companion</span></footer>;
}
