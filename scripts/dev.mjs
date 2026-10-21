import http from 'node:http';
import path from 'node:path';
import { readFile, stat } from 'node:fs/promises';
import { buildSite, root } from './build.mjs';

const { outDir } = await buildSite({ basePath: '' });
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.xml': 'application/xml', '.txt': 'text/plain' };
http.createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    let filename = path.resolve(outDir, `.${pathname}`);
    if (!filename.startsWith(`${outDir}${path.sep}`) && filename !== outDir) throw new Error('Invalid path');
    if ((await stat(filename)).isDirectory()) filename = path.join(filename, 'index.html');
    const bytes = await readFile(filename);
    response.writeHead(200, { 'content-type': mime[path.extname(filename)] || 'application/octet-stream', 'cache-control': 'no-cache' });
    response.end(bytes);
  } catch {
    response.writeHead(404, { 'content-type': 'text/html; charset=utf-8' });
    response.end(await readFile(path.join(root, 'dist/404.html')));
  }
}).listen(Number(process.env.PORT || 4173), '0.0.0.0', () => console.log('JavaScript Ninja Path ready'));
