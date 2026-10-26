/** Close only this run's fixture before Playwright attempts Windows process-tree teardown. */
export default async function teardown() {
  const token = process.env.STUDY_E2E_RUN_ID;
  if (!token) return;
  try {
    const response = await fetch('http://127.0.0.1:4174/__fixture__/shutdown', {
      method: 'POST', headers: { 'X-Study-Fixture-Token': token }, signal: AbortSignal.timeout(2_000),
    });
    // An occupied port from another run cannot be stopped with this run's token.
    if (![204, 403, 404, 405].includes(response.status)) throw new Error('Unexpected fixture shutdown response.');
  } catch (error) {
    // A fixture that already exited has nothing left to close.
    const cause = (error as { cause?: { code?: string } }).cause;
    if (cause?.code !== 'ECONNREFUSED') throw error;
  }
}
