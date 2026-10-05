import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.argv[2] ?? 4173);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw Error('Ungültiger Port');
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' };
const server = createServer(async (request, response) => {
  if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405).end(); return; }
  try {
    const url = new URL(request.url, 'http://localhost');
    const pathname = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
    // Serve only the public app, not sources, Git metadata or test datasets.
    const allowed = /^\/[a-z-]+\.html$/.test(pathname) || /^\/assets\/(js|css)\/[\w.-]+$/.test(pathname)
      || ['/data/field-definitions.json', '/data/mapping-hub-authoritative.json'].includes(pathname);
    if (!allowed) { response.writeHead(404).end('Nicht gefunden'); return; }
    const filename = path.resolve(root, '.' + pathname);
    if (!filename.startsWith(root + path.sep)) { response.writeHead(403).end(); return; }
    const content = pathname === '/artikel.html'
      ? (await readFile(path.join(root, 'artikel.md'), 'utf8')).replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '')
      : await readFile(filename);
    response.writeHead(200, { 'Content-Type': `${mime[path.extname(filename)] ?? 'application/octet-stream'}; charset=utf-8`, 'Cache-Control': 'no-store' });
    response.end(request.method === 'HEAD' ? undefined : content);
  } catch { response.writeHead(404).end('Nicht gefunden'); }
});
server.on('error', error => { console.error(error.message); process.exitCode = 1; });
server.listen(port, '127.0.0.1', () => console.log(`SaTourN-Vorschau: http://127.0.0.1:${port}/`));
