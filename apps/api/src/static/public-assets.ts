import { lstat, readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import type { RequestHandler } from 'express';

const contentTypes: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp',
  '.avif': 'image/avif', '.ico': 'image/x-icon', '.svg': 'image/svg+xml', '.woff': 'font/woff', '.woff2': 'font/woff2',
};

function publicPath(url: string): string | null {
  if (url === '/' || url === '/index.html') return 'index.html';
  if (!/^\/assets\/[a-zA-Z0-9][a-zA-Z0-9._/-]*$/.test(url)) return null;
  const pieces = url.slice(1).split('/');
  if (pieces.some(piece => !piece || piece.startsWith('.'))) return null;
  const extension = path.extname(url);
  if (extension === '.html' || !Object.hasOwn(contentTypes, extension)) return null;
  return pieces.join(path.sep);
}

export function publicAssets(webRoot: string): RequestHandler {
  const root = path.resolve(webRoot);
  return async (req, res, next) => {
    const relative = publicPath(req.originalUrl);
    if (relative === null) { next(); return; }
    try {
      if ((await lstat(root)).isSymbolicLink()) { next(); return; }
      const rootReal = await realpath(root);
      let candidate = root;
      const pieces = relative.split(path.sep);
      for (let index = 0; index < pieces.length; index++) {
        candidate = path.join(candidate, pieces[index] ?? '');
        const metadata = await lstat(candidate);
        if (metadata.isSymbolicLink() || (index < pieces.length - 1 ? !metadata.isDirectory() : !metadata.isFile())) { next(); return; }
      }
      const actual = await realpath(candidate);
      const within = path.relative(rootReal, actual);
      if (within.startsWith('..') || path.isAbsolute(within)) { next(); return; }
      const content = await readFile(actual);
      res.status(200).setHeader('Content-Type', contentTypes[path.extname(relative)] ?? 'application/octet-stream');
      res.setHeader('Content-Length', content.length);
      res.end(req.method === 'HEAD' ? undefined : content);
    } catch { next(); }
  };
}
