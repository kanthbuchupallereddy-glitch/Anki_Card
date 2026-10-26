import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const projectRoot = fileURLToPath(new URL('../', import.meta.url));

export function startNode(args) {
  return spawn(process.execPath, args, {
    cwd: projectRoot, stdio: 'inherit', windowsHide: true,
    detached: process.platform !== 'win32',
  });
}

export function completed(child) {
  return new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code, signal) => code === 0 ? resolve() : reject(new Error(`Process stopped (${signal ?? code}).`)));
  });
}

export function runNpm(args) {
  if (!process.env.npm_execpath) throw new Error('Please run this helper through its npm script.');
  return completed(startNode([process.env.npm_execpath, ...args]));
}

/** Stop only children launched by this helper, including their own build workers. */
export function stopChild(child) {
  if (!child?.pid || child.exitCode !== null || child.signalCode !== null) return Promise.resolve();
  if (process.platform === 'win32') {
    return new Promise(resolve => {
      const directStop = () => {
        if (child.exitCode !== null || child.signalCode !== null) { resolve(); return; }
        const timeout = setTimeout(resolve, 3000);
        child.once('exit', () => { clearTimeout(timeout); resolve(); });
        child.kill();
      };
      const stop = spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
      stop.once('error', directStop);
      stop.once('exit', code => { if (code === 0) resolve(); else directStop(); });
    });
  }
  return new Promise(resolve => {
    let fallback;
    const done = () => { clearTimeout(timeout); clearTimeout(fallback); child.removeListener('exit', done); resolve(); };
    child.once('exit', done);
    const timeout = setTimeout(() => {
      try { process.kill(-child.pid, 'SIGKILL'); } catch { /* Already exited. */ }
      fallback = setTimeout(done, 1000);
    }, 3000);
    try { process.kill(-child.pid, 'SIGTERM'); } catch { done(); }
  });
}
