// Read-only contract check of the public API; never changes shared settings.
import assert from 'node:assert/strict';

const api = 'https://dbd-player-search.m-aa-k-one-for-all-a.chatgpt.site/api/routes';
// Wire contract is intentionally independent of the client display release.
const expectedVersion = '3.5.1';
const origin = 'https://masaotokumoto12-ux.github.io';
const ids = ['steam', 'x', 'youtube', 'twitch', 'tiktok', '5ch'];
const native = {
  steam: ['steamcommunity.com', '/search/users/', 'text'],
  x: ['x.com', '/search', 'q'],
  youtube: ['www.youtube.com', '/results', 'search_query'],
  twitch: ['www.twitch.tv', '/search', 'term'],
  tiktok: ['www.tiktok.com', '/search/user', 'q']
};
const sites = {
  steam: 'site:steamcommunity.com', x: '(site:x.com OR site:twitter.com)',
  youtube: 'site:youtube.com', twitch: 'site:twitch.tv',
  tiktok: 'site:tiktok.com', '5ch': '(site:5ch.net OR site:2ch.sc)'
};
const cases = ['MaKun_inkya', 'ヅオパン', '日本語の名前', 'name-with-hyphen', 'name.with.dot', 'name-with.dot']
  .map(input => ({input, query: input}));
cases.push(
  {input: 'https://www.youtube.com/channel/UC_x5XG1OV2P6uZZ5FSM9Ttw', direct: 'youtube'},
  {input: 'https://www.youtube.com/c/YouTubeCreators', query: 'YouTubeCreators', direct: 'youtube'},
  {input: 'https://www.youtube.com/user/YouTube', query: 'YouTube', direct: 'youtube'},
  {input: 'https://www.youtube.com/@%E3%83%85%E3%82%AA%E3%83%91%E3%83%B3', query: 'ヅオパン', direct: 'youtube'},
  {input: '76561198000000000', direct: 'steam', directUrl: 'https://steamcommunity.com/profiles/76561198000000000/'},
  {input: 'https://steamcommunity.com/profiles/not-a-steamid/'},
  {input: 'https://x.com/name-with.dot'},
  {input: 'https://www.twitch.tv/name-with.dot'},
  {input: 'https://www.tiktok.com/@name.'},
  {input: 'https://5ch.net/test'},
  {input: 'https://www.youtube.com/@name!'},
  {input: 'https://www.youtube.com/@name.'},
  {input: 'https://help.x.com/sample_123'},
  {input: 'https://x.com/%2Fsearch'}
);
cases.push({input:'@MaKun_inkya',query:'MaKun_inkya',handle:true});
const smokeInputs = new Set(['MaKun_inkya','ヅオパン','@MaKun_inkya','https://www.youtube.com/c/YouTubeCreators']);
const selectedCases = process.argv.includes('--full') ? cases : cases.filter(item => smokeInputs.has(item.input));

const batches = [];
for (let offset = 0; offset < selectedCases.length; offset += 4) {
  const batch = selectedCases.slice(offset, offset + 4);
  const response = await fetch(api, {
    method: 'POST', headers: {'Content-Type': 'application/json', Origin: origin},
    body: JSON.stringify({names: batch.map(item => item.input)}),
    signal: AbortSignal.timeout(20000)
  });
  assert.equal(response.status, 200, `API HTTP ${response.status}`);
  assert.equal(response.headers.get('access-control-allow-origin'), origin);
  const value = await response.json();
  assert.equal(value.version, expectedVersion, 'The public API must serve the compatible wire contract.');
  assert.ok(['smart', 'force-google'].includes(value.settings?.mode));
  assert.equal(value.settings.game,'dbd');
  assert.equal(value.results.length, batch.length);
  for (let index = 0; index < batch.length; index++) {
    const item = batch[index], result = value.results[index], query = item.query ?? item.input;
    assert.equal(result.name, item.input);
    assert.deepEqual(result.routes.map(route => route.id), ids);
    for (const route of result.routes) {
      const url = new URL(route.url), broad = new URL(route.broad);
      const direct = route.id === item.direct || (item.handle && ['x','twitch','youtube','tiktok'].includes(route.id));
      assert.equal(url.protocol,'https:');
      assert.equal(broad.protocol,'https:');
      if (direct) {
        const expected = item.handle ? {
          x:'https://x.com/MaKun_inkya',twitch:'https://www.twitch.tv/makun_inkya',
          youtube:'https://www.youtube.com/@MaKun_inkya',tiktok:'https://www.tiktok.com/@MaKun_inkya'
        }[route.id] : item.directUrl ?? item.input;
        assert.equal(route.url,expected);
        assert.equal(route.broad,expected);
        assert.equal(route.scope,'profile');
      } else if (route.id === '5ch') {
        assert.equal(url.hostname,'www.google.com');
        assert.ok(url.searchParams.get('q').includes('Dead by Daylight'));
        assert.ok(url.searchParams.get('q').endsWith(`"${query}" ${sites[route.id]}`));
        assert.equal(broad.searchParams.get('q'),`"${query}" ${sites[route.id]}`);
      } else {
        const [host,pathname,key] = native[route.id];
        assert.equal(url.hostname,host); assert.equal(url.pathname,pathname);
        assert.equal(url.searchParams.get(key),route.id === 'youtube' ? query + ' DBD' : query);
        assert.equal(broad.hostname,host); assert.equal(broad.pathname,pathname);
        assert.equal(broad.searchParams.get(key),query);
        assert.equal(url.searchParams.has('sp'),false);
        if(route.id === 'x')assert.equal(url.searchParams.get('f'),'user');
      }
    }
  }
  batches.push({status: response.status, cors: response.headers.get('access-control-allow-origin'), ...value});
}

const summary = {
  checkedAt: new Date().toISOString(), versions: [...new Set(batches.map(batch => batch.version))],
  modes: [...new Set(batches.map(batch => batch.settings.mode))],
  inputs: selectedCases.length, links: selectedCases.length * ids.length, apiPosts:batches.length, externalSearchRequests:0, status: 'passed',
  scope: 'URL generation, response order and CORS only; accounts and external search results remain unverified'
};
console.log(JSON.stringify(process.argv.includes('--json') ? {...summary, batches} : summary, null, 2));
