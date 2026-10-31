// Tiny static file server for local development: npm start
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const port = Number(process.env.PORT) || 3000;
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

http
  .createServer(async (req, res) => {
    try {
      let rel = decodeURIComponent(req.url.split('?')[0].split('#')[0]);
      if (rel.endsWith('/')) rel += 'index.html';
      const file = path.join(root, rel);
      if (!file.startsWith(root + path.sep)) { res.writeHead(403).end('Forbidden'); return; } // block ../ tricks

      const info = await stat(file).catch(() => null);
      if (!info || !info.isFile()) { res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found'); return; }

      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
      res.end(await readFile(file));
    } catch {
      res.writeHead(500).end('Server error');
    }
  })
  .listen(port, () => console.log(`PustakaGame running at http://localhost:${port}`));
