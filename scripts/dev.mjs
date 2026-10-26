import { watch } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { dirname } from 'node:path';
import { projectRoot, runNpm, startNode, stopChild } from './processes.mjs';

const require = createRequire(import.meta.url);
await runNpm(['run', 'build']);

const children = new Set();
const expectedExits = new WeakSet();
let stopping = false;
let restartTimer;
let restartQueue = Promise.resolve();
let app;
const watchers = [];

function spawn(args) {
  const child = startNode(args);
  children.add(child);
  child.once('error', error => { console.error(error.message); void stop(1); });
  child.once('exit', code => {
    children.delete(child);
    if (!stopping && !expectedExits.has(child)) { console.error(`A development process stopped (${code}).`); void stop(1); }
  });
  return child;
}

async function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  clearTimeout(restartTimer);
  watchers.forEach(watcher => watcher.close());
  await Promise.all([...children].map(stopChild));
  process.exit(code);
}

function scheduleRestart() {
  clearTimeout(restartTimer);
  restartTimer = setTimeout(() => {
    restartQueue = restartQueue.then(async () => {
      if (stopping) return;
      expectedExits.add(app);
      await stopChild(app);
      if (!stopping) app = spawn(['apps/api/dist/server.js']);
    }).catch(error => { console.error(error.message); void stop(1); });
  }, 350);
}

app = spawn(['apps/api/dist/server.js']);
for (const folder of ['apps/api/dist', 'packages/contracts/dist']) {
  watchers.push(watch(join(projectRoot, folder), { recursive: true }, (_event, file) => {
    if (file?.endsWith('.js')) scheduleRestart();
  }));
}
spawn([require.resolve('typescript/bin/tsc'), '-b', 'tsconfig.build.json', '--watch', '--preserveWatchOutput']);
spawn([join(dirname(require.resolve('vite/package.json')), 'bin/vite.js'), 'build', '--watch', '--config', 'apps/web/vite.config.ts', 'apps/web']);
console.log('Development: http://127.0.0.1:4173. Frontend changes rebuild; reload the browser. API changes restart automatically.');
process.once('SIGINT', () => void stop());
process.once('SIGTERM', () => void stop());
