import { isLocalConnection, type CollectionSource, type ConnectionState } from './types';

function connectionCopy(source: CollectionSource, connection: ConnectionState) {
  if (source === 'demo') return ['Demo collection', 'Sample cards. No learning history is saved.'];
  if (connection.state === 'ready') {
    const checked = new Date(connection.checkedAt);
    const time = checked.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return [`Connected · ${connection.profile}`, `Anki ${connection.ankiVersion} · read-only · checked ${time}`];
  }
  if (!isLocalConnection()) return ['Start the local connection', 'Launch Start Study.cmd, then open http://127.0.0.1:4173. Keep Anki open.'];
  if (connection.state === 'checking') return ['Connecting to Anki', 'Checking your profile and reading deck counts…'];
  const status = connection.state === 'unsupported' ? 'Connection not supported' : connection.state === 'profile-changed' ? 'Anki profile changed' : 'Anki unavailable';
  return [status, connection.message || 'Keep Anki open on the Decks screen, then refresh the connection.'];
}

export function ConnectionBar({ source, connection, onSourceChange, onRefresh }: {
  source: CollectionSource; connection: ConnectionState;
  onSourceChange: (source: CollectionSource) => void; onRefresh: () => void;
}) {
  const [status, detail] = connectionCopy(source, connection);
  return <section className="connection-bar" aria-label="Collection source" data-state={source === 'demo' ? 'demo' : connection.state}>
    <div className="source-control" role="group" aria-label="Collection source">
      {(['anki', 'demo'] as const).map(value => <button key={value} type="button" data-source={value} aria-pressed={source === value} onClick={() => onSourceChange(value)}>{value === 'anki' ? 'Anki' : 'Demo'}</button>)}
    </div>
    <div className="connection-copy"><p id="connection-status" role="status" aria-live="polite">{status}</p><p id="connection-detail">{detail}</p></div>
    <button type="button" className="text-button" id="refresh-connection" hidden={source === 'demo' || !isLocalConnection()} disabled={connection.state === 'checking'} onClick={onRefresh}>
      {connection.state === 'checking' ? 'Connecting…' : 'Refresh connection ↗'}
    </button>
  </section>;
}
