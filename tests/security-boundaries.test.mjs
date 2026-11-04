import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const html = read('../index.html');
const client = read('../app.js');
const serviceWorker = read('../sw.js');

test('strict CSP limits scripts, forms and executable content', () => {
  const csp = html.match(/<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]+)"/i)?.[1];
  assert.ok(csp, 'Content Security Policy must remain present');
  for (const policy of ["default-src 'none'", "script-src 'self'", "object-src 'none'", "base-uri 'none'", "form-action 'none'"]) {
    assert.ok(csp.includes(policy), 'Missing protective CSP directive: ' + policy);
  }
  assert.doesNotMatch(csp, /'unsafe-inline'|'unsafe-eval'/i);
  assert.doesNotMatch(html, /<script\b[^>]*\bsrc\s*=\s*["'](?:https?:)?\/\//i);
});

test('browser does not send credentials or referrers to the public search API', () => {
  assert.match(html, /<meta\s+name="referrer"\s+content="no-referrer"/i);
  assert.match(client, /credentials\s*:\s*["']omit["']/);
  assert.match(client, /referrerPolicy\s*:\s*["']no-referrer["']/);
});

test('untrusted names and imported data cannot be directly interpreted as HTML or JavaScript', () => {
  const executableSink = /\.innerHTML\s*=|\binsertAdjacentHTML\s*\(|\beval\s*\(|\bnew\s+Function\s*\(/;
  assert.doesNotMatch(client, executableSink);
  assert.doesNotMatch(serviceWorker, executableSink);
});

test('service worker cache cleanup remains scoped to this repository path', () => {
  assert.match(serviceWorker, /ROOT\.pathname/);
  assert.match(serviceWorker, /key\.startsWith\(PREFIX\)/);
});

test('admin bearer secret is not referenced in public app artifacts', () => {
  for (const [name, source] of [['index.html', html], ['app.js', client], ['sw.js', serviceWorker]]) {
    assert.doesNotMatch(source, /\bPSD_ADMIN_TOKEN\b/, name + ' must not contain the server-only admin secret identifier');
  }
});
