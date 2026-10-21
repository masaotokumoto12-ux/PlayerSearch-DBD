import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { webcrypto } from 'node:crypto';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const source = read('app.js');
const context = vm.createContext({ URL, crypto: webcrypto });
vm.runInContext(source.split('const $ =')[0] + '\nglobalThis.core = { VERSION, STORAGE_KEY, LEGACY_KEYS, PLATFORMS, defaultState, validName, readState, saveState, parseBackup, searchIdentity, nameVariants, generateLinks, safePlatformUrl, urlNameMatch, steamProfile, compareNames, addHistory };', context);
const c = context.core;
let checks = 0;
function check(name, fn) { fn(); checks++; console.log(`OK ${name}`); }
const plain = value => JSON.parse(JSON.stringify(value));
const memory = values => ({
  data: new Map(Object.entries(values ?? {})),
  getItem(key) { return this.data.get(key) ?? null; },
  setItem(key, value) { this.data.set(key, value); }
});

check('all HTML, CSS, manifest, and service-worker assets exist', () => {
  const html = read('index.html'), manifest = JSON.parse(read('manifest.webmanifest'));
  const refs = [...html.matchAll(/(?:href|src)="(\.\/[^"?#]+)(?:[^\"]*)"/g)].map(m => m[1]);
  refs.push(...manifest.icons.map(icon => icon.src));
  refs.push(...[...read('styles.css').matchAll(/url\(['"]?(\.\/[^)'"?#]+)/g)].map(m => m[1]));
  for (const ref of refs) assert.ok(fs.statSync(path.join(root, ref)).isFile(), ref);
  assert.match(html, /script-src 'self'/);
  assert.match(html, /style-src 'self'/);
  assert.ok(!/<script[^>]*>(?!\s*<\/script>)/.test(html));
});
check('release versions agree', () => {
  const version = JSON.parse(read('version.json')).version;
  assert.equal(c.VERSION, version);
  assert.ok(read('index.html').includes(`content="${version}"`));
  assert.ok(read('index.html').includes(`app.js?v=${version}`));
  assert.ok(read('index.html').includes(`styles.css?v=${version}`));
  assert.ok(read('sw.js').includes(`const VERSION = '${version}'`));
});
check('home-screen icons have correct PNG sizes', () => {
  for (const [name, size] of [['icon-192.png', 192], ['icon-512.png', 512], ['apple-touch-icon.png', 180]]) {
    const bytes = fs.readFileSync(path.join(root, 'icons', name));
    assert.equal(bytes.readUInt32BE(16), size);
    assert.equal(bytes.readUInt32BE(20), size);
  }
});
check('smart mode searches names rather than assuming profile IDs', () => {
  const routes = c.generateLinks(c.defaultState(), 'Si1veR_YtCh');
  assert.equal(routes.length, 6);
  assert.equal(new URL(routes.find(r => r.id === 'youtube').url).pathname, '/results');
  assert.equal(new URL(routes.find(r => r.id === 'twitch').url).pathname, '/search');
  assert.equal(new URL(routes.find(r => r.id === 'x').url).pathname, '/search');
  assert.ok(routes.find(r => r.id === 'youtube').profile.endsWith('/@Si1veR_YtCh'));
  for (const route of routes) {
    const query = new URL(route.fallback).searchParams.get('q');
    assert.ok(query.includes('"Si1veR_YtCh"'));
    assert.ok(!query.includes('dbd'));
    assert.ok(new URL(route.contextual).searchParams.get('q').includes('dbd'));
  }
});
check('Japanese, symbols, spaces, and emoji remain searchable', () => {
  for (const name of ['那覇のピート56', 'たぁこやぁき', 'a&b #1', '100%🎮', '"quoted"']) {
    const routes = c.generateLinks(c.defaultState(), name);
    assert.equal(routes.length, 6);
    assert.ok(routes.every(route => new URL(route.url).protocol === 'https:'));
    assert.ok(routes.filter(route => route.id !== 'steam').every(route => !route.profile));
  }
  assert.equal(c.validName('\ud800'), false);
});
check('@handles and supported profile URLs generate usable searches', () => {
  assert.equal(c.searchIdentity('@Some_ID').value, 'Some_ID');
  assert.equal(c.searchIdentity('https://www.youtube.com/@Example_yt').value, 'Example_yt');
  assert.equal(c.searchIdentity('https://x.com/explore').platform, null);
  assert.equal(new URL(c.generateLinks(c.defaultState(), '@Some_ID')[2].url).searchParams.get('search_query'), 'Some_ID');
  assert.ok(c.nameVariants('ＡＢＣ').includes('ABC'));
});
check('Google-only mode does not produce direct primary links', () => {
  const state = c.defaultState(); state.mode = 'force-google';
  for (const route of c.generateLinks(state, 'Example')) assert.equal(new URL(route.url).hostname, 'www.google.com');
});
check('unsafe URLs are rejected; URL IDs are compared independently', () => {
  const youtube = c.PLATFORMS.find(p => p.id === 'youtube');
  for (const url of ['javascript:alert(1)', 'https://youtube.com.evil.example/@a', 'https://user@youtube.com/@a', 'https://youtube.com:444/@a']) assert.equal(c.safePlatformUrl(url, youtube), null);
  assert.equal(c.urlNameMatch('https://www.youtube.com/@actual', youtube, '@actual').status, 'exact');
  assert.equal(c.urlNameMatch('https://www.youtube.com/@actual', youtube, 'different').status, 'none');
});
check('Steam profile input accepts IDs and rejects unrelated URLs', () => {
  assert.equal(c.steamProfile('76561198000000000'), 'https://steamcommunity.com/profiles/76561198000000000/');
  assert.equal(c.steamProfile('https://steamcommunity.com/id/EXAMPLE/?x=1'), 'https://steamcommunity.com/id/EXAMPLE/');
  for (const value of ['名前だけ', '123', 'https://evil.example/id/name', 'https://steamcommunity.com/search/users/', 'https://steamcommunity.com/id/../../bad', 'javascript:alert(1)']) assert.equal(c.steamProfile(value), null);
});
check('legacy data migrates without deleting its original storage', () => {
  const storage = memory({ psd_history: JSON.stringify([{ name: 'old', date: '2026/10/20' }]), psd_game: 'dbd', psd_routing: 'google' });
  const loaded = c.readState(storage);
  assert.equal(loaded.state.mode, 'force-google');
  assert.equal(loaded.state.history[0].date, '2026-10-20');
  assert.ok(c.saveState(storage, loaded.state));
  loaded.state.history = []; c.saveState(storage, loaded.state);
  assert.equal(c.readState(storage).state.history.length, 0);
  assert.ok(storage.data.has('psd_history'));
});
check('corrupt and future storage is not overwritten', () => {
  for (const raw of ['{invalid', JSON.stringify({ schemaVersion: 999 })]) {
    const storage = memory({ [c.STORAGE_KEY]: raw });
    const loaded = c.readState(storage);
    assert.equal(loaded.blocked, true);
    assert.equal(loaded.needsSave, false);
    assert.equal(storage.getItem(c.STORAGE_KEY), raw);
  }
});
check('backups reject unexpected formats and discard stored links', () => {
  assert.throws(() => c.parseBackup('{}'));
  const backup = c.parseBackup(JSON.stringify({ state: { inputs: ['例'], history: [{ name: '例', date: '2026-02-30' }], resultNames: ['例'], links: ['javascript:alert(1)'] } }));
  assert.equal(backup.inputs[0], '例');
  assert.equal(backup.history[0].date, null);
  assert.equal(backup.links, undefined);
});
check('history deduplicates known same-day searches only', () => {
  const state = c.defaultState();
  c.addHistory(state, ['same', 'same'], '2026-10-21');
  assert.equal(state.history.length, 1);
  c.addHistory(state, ['same'], '2026-10-20');
  assert.equal(state.history.length, 2);
});

const handlers = {}, deleted = [], cachedAssets = [];
const workerContext = vm.createContext({
  URL, Request,
  self: { registration: { scope: 'https://example.test/PlayerSearch-DBD/' }, addEventListener: (name, fn) => { handlers[name] = fn; }, clients: { claim: async () => {} } },
  caches: { keys: async () => ['foreign-cache', 'psd:%2FPlayerSearch-DBD%2F:3.1.0', 'psd:%2FOTHER%2F:3.1.0'], delete: async key => deleted.push(key), open: async () => ({ addAll: async assets => cachedAssets.push(...assets) }) }
});
vm.runInContext(read('sw.js'), workerContext);
let operation;
handlers.install({ waitUntil: value => { operation = value; } }); await operation;
check('offline precache uses existing versioned assets only', () => {
  for (const asset of cachedAssets) assert.ok(fs.statSync(path.join(root, new URL(asset.url).pathname.replace('/PlayerSearch-DBD/', ''))).isFile());
  assert.ok(cachedAssets.some(asset => asset.url.includes(`app.js?v=${c.VERSION}`)));
});
handlers.activate({ waitUntil: value => { operation = value; } }); await operation;
check('cache cleanup does not affect other sites', () => {
  assert.deepEqual(deleted, ['psd:%2FPlayerSearch-DBD%2F:3.1.0']);
});
check('service worker leaves API, configuration, update, and sibling requests alone', () => {
  for (const [url, method, cache] of [
    ['https://example.test/Other/app.js', 'GET', 'default'],
    ['https://example.test/PlayerSearch-DBD/config.json', 'GET', 'no-store'],
    ['https://example.test/PlayerSearch-DBD/version.json', 'GET', 'no-store'],
    ['https://example.test/PlayerSearch-DBD/api/search', 'POST', 'no-store'],
    ['https://other.test/PlayerSearch-DBD/app.js', 'GET', 'default']
  ]) handlers.fetch({ request: { url, method, cache }, respondWith: () => assert.fail(url) });
});
console.log(`\n${checks} checks passed.`);
