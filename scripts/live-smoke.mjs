import { parseCollectionResponse } from '@study/contracts';

// Optional read-only check. The deterministic test suite never calls real Anki.
try {
  const response = await fetch('http://127.0.0.1:4173/api/collection', {
    headers: { 'X-Study-Request': '1' }, signal: AbortSignal.timeout(15000),
  });
  const snapshot = parseCollectionResponse(await response.json());
  if (!response.ok || snapshot.state !== 'ready') throw new Error(snapshot.message ?? 'Collection unavailable.');
  console.log(`Live read succeeded: Anki ${snapshot.ankiVersion}; ${snapshot.decks.length} decks; ${snapshot.totals.total} cards. No data changed.`);
} catch (error) {
  console.error(`Live read did not succeed. Start Study and Anki first. ${error.message}`);
  process.exitCode = 1;
}
