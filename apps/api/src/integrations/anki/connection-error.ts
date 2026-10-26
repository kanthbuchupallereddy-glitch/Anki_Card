import type { ConnectionFailureState } from '@study/contracts';

const messages: Record<ConnectionFailureState, string> = {
  offline: 'Anki is not reachable. Open Anki, leave a profile open, and try again.',
  timeout: 'Anki took too long to respond. Wait for it to finish its current work, then retry.',
  unsupported: 'This AnkiConnect installation does not provide the verified read-only interface.',
  unavailable: 'Anki could not provide its collection. Leave the Decks screen open and retry.',
  'profile-changed': 'The open Anki collection changed during this read. Refresh to load it again.',
  authentication: 'AnkiConnect requires authentication. Its connection settings need to be configured.',
  busy: 'Anki is busy. Wait for its current operation to finish, then retry.',
};

export class ConnectionError extends Error {
  readonly state: ConnectionFailureState;

  constructor(state: ConnectionFailureState) {
    super(messages[state]);
    this.name = 'ConnectionError';
    this.state = state;
  }
}

export function unavailable(state: ConnectionFailureState = 'unavailable'): ConnectionError {
  return new ConnectionError(state);
}

export class AnkiMethodError extends ConnectionError {
  constructor(state: ConnectionFailureState, readonly upstreamType: string) { super(state); }
}
