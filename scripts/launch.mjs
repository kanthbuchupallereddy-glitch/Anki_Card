import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { completed, projectRoot, runNpm, startNode, stopChild } from './processes.mjs';

const [major, minor] = process.versions.node.split('.').map(Number);
if (major < 22 || (major === 22 && minor < 12)) {
  console.error('Study needs Node.js 22.12 or newer. Install a current Node.js LTS release.');
  process.exit(1);
}

try {
  if (!existsSync(join(projectRoot, 'node_modules/typescript/bin/tsc'))) {
    console.log('Installing the project packages from its lockfile…');
    await runNpm(['ci', '--no-audit', '--no-fund']);
  }
  console.log('Preparing Study…');
  await runNpm(['run', 'build']);
  const app = startNode(['apps/api/dist/server.js']);
  const stop = async () => { await stopChild(app); process.exit(0); };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  await completed(app);
} catch (error) {
  console.error(`Study could not start. ${error.message}`);
  process.exitCode = 1;
}
