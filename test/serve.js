// ABOUTME: Serves a folder over HTTP under a base path, the way GitHub Pages serves the site.
// ABOUTME: The end-to-end tests start it, and `node test/serve.js site 4173` runs it from the command line.
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { startedAsCommand } from '../tools/command-line.js';

const CONTENT_TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
};

// Maps a request URL to a file under root, or to null when it's outside basePath.
// The URL parser has already resolved "." and ".." segments, so the file can't be outside root.
function filePathFor(root, basePath, requestUrl) {
  const { pathname } = new URL(requestUrl, 'http://localhost');
  if (!pathname.startsWith(basePath)) {
    return null;
  }
  const relativePath = pathname.slice(basePath.length);
  const isFolder = relativePath === '' || relativePath.endsWith('/');
  return path.join(root, isFolder ? `${relativePath}index.html` : relativePath);
}

// Serves rootDir under basePath on port (0 for a free one). Every response carries the Cache-Control header given,
// no-cache unless a test asks for another, such as the max-age=600 that GitHub Pages sends.
export function startServer(rootDir, port, { basePath = '/car-buying-helper/', cacheControl = 'no-cache' } = {}) {
  const root = path.resolve(rootDir);
  const server = createServer(async (request, response) => {
    const filePath = filePathFor(root, basePath, request.url);
    const body = filePath === null ? null : await readFile(filePath).catch(() => null);
    if (body === null) {
      response.writeHead(404, { 'Content-Type': 'text/plain', 'Cache-Control': cacheControl });
      response.end('Not found');
      return;
    }
    response.writeHead(200, {
      'Content-Type': CONTENT_TYPES[path.extname(filePath)] ?? 'application/octet-stream',
      'Cache-Control': cacheControl,
    });
    response.end(body);
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, 'localhost', () => resolve(server));
  });
}

if (startedAsCommand(import.meta.url)) {
  const [rootDir, port] = process.argv.slice(2);
  await startServer(rootDir, Number(port));
  console.log(`Serving ${rootDir} at http://localhost:${port}/car-buying-helper/`);
}
