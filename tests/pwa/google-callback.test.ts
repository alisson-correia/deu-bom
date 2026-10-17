import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { callback, status } from '../../server/google.js';

test('OAuth e API chegam ao servidor com o service worker ativo', { timeout: 60_000 }, async () => {
  const root = path.resolve('dist');
  let callbackHits = 0;
  const server = createServer(async (req, res) => {
    const url = new URL(req.url || '/', 'http://localhost');
    if (url.pathname === '/api/google/callback') { callbackHits += 1; await callback(req, res); return; }
    if (url.pathname === '/api/google/status') { await status(req, res); return; }
    if (url.pathname.startsWith('/api/')) { res.writeHead(404).end(); return; }
    const file = path.resolve(root, `.${decodeURIComponent(url.pathname)}`);
    if (!file.startsWith(`${root}${path.sep}`) && file !== root) { res.writeHead(403).end(); return; }
    const target = path.extname(file) ? file : path.join(root, 'index.html');
    try {
      const body = await readFile(target);
      const mime = { '.js': 'application/javascript', '.html': 'text/html', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json' }[path.extname(target)] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': mime }).end(body);
    } catch { res.writeHead(404).end(); }
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address(); assert(address && typeof address !== 'string');
  const origin = `http://127.0.0.1:${address.port}`;
  const previousOrigin = process.env.PUBLIC_APP_URL;
  process.env.PUBLIC_APP_URL = origin;
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext();
    const install = await context.newPage();
    await install.goto(`${origin}/auth`);
    await install.waitForFunction(async () => (await navigator.serviceWorker.getRegistration())?.active?.state === 'activated', undefined, { timeout: 15000 });
    const page = await context.newPage();
    await page.goto(`${origin}/auth`);
    const appResponsePromise = page.waitForResponse((r) => new URL(r.url()).pathname === '/auth' && r.request().isNavigationRequest());
    await Promise.all([
      page.waitForURL(`${origin}/auth?worker-check=1`, { waitUntil: 'networkidle' }),
      page.evaluate(() => { window.location.assign('/auth?worker-check=1'); }),
    ]);
    const appResponse = await appResponsePromise;
    assert.equal(appResponse.fromServiceWorker(), true);
    await page.waitForLoadState();
    const callbackResponse = page.waitForResponse((r) => new URL(r.url()).pathname === '/api/google/callback');
    await page.goto(`${origin}/api/google/callback?state=invalid`);
    const response = await callbackResponse;
    assert.equal(response.status(), 302);
    assert.equal(response.fromServiceWorker(), false);
    assert.equal(response.headers().location, `${origin}/settings?google=error`);
    assert.equal(callbackHits, 1);
    assert.equal(await page.getByText('Oops! Page not found', { exact: true }).count(), 0);
    const api = await page.goto(`${origin}/api/google/status`);
    assert.equal(api?.status(), 401);
    assert.equal(api?.fromServiceWorker(), false);
    assert.match(api?.headers()['content-type'] || '', /application\/json/);
    await context.close();
  } finally {
    await browser.close();
    if (previousOrigin === undefined) delete process.env.PUBLIC_APP_URL; else process.env.PUBLIC_APP_URL = previousOrigin;
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
