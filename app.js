const VERSION = '3.2.1';
const SCHEMA = 4;
const STORAGE_KEY = 'psd-core-v4';
const MAX_PLAYERS = 4;
const MAX_NAME = 256;
const PLATFORMS = Object.freeze([
  { id: 'steam', name: 'Steam', site: 'site:steamcommunity.com', hosts: ['steamcommunity.com'] },
  { id: 'x', name: 'X (Twitter)', site: '(site:x.com OR site:twitter.com)', hosts: ['x.com', 'twitter.com'] },
  { id: 'youtube', name: 'YouTube', site: 'site:youtube.com', hosts: ['youtube.com', 'youtu.be'] },
  { id: 'twitch', name: 'Twitch', site: 'site:twitch.tv', hosts: ['twitch.tv'] },
  { id: 'tiktok', name: 'TikTok', site: 'site:tiktok.com', hosts: ['tiktok.com'] },
  { id: '5ch', name: '5ちゃんねる', site: '(site:5ch.net OR site:2ch.sc)', hosts: ['5ch.net', '2ch.sc'] }
]);
const LEGACY_KEYS = Object.freeze(['dps-state', 'dps-core-v6', 'psd-core-v3', 'player-check-pro-v2', 'psd_history']);
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const wellFormed = value => {
  if (typeof value.isWellFormed === 'function') return value.isWellFormed();
  try { encodeURIComponent(value); return true; } catch { return false; }
};
const GAMES = new Set(['dbd', 'apex', 'valorant', 'other', '']);
const MODES = new Set(['smart', 'force-google']);
const uid = () => globalThis.crypto?.randomUUID?.() ?? `dps-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const validName = value => typeof value === 'string' && value.trim().length > 0 && [...value].length <= MAX_NAME && wellFormed(value);
function defaultState() {
  return { schemaVersion: SCHEMA, game: 'dbd', customGame: '', mode: 'smart', inputs: [''], resultNames: [], history: [], migratedLegacyKeys: [] };
}
function dayString(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
function normalizeDate(value) {
  if (typeof value !== 'string') return null;
  const match = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(value);
  if (!match) return null;
  const [, y, m, d] = match.map(Number);
  if (y < 1900 || y > 9999) return null;
  const test = new Date(Date.UTC(y, m - 1, d));
  return test.getUTCFullYear() === y && test.getUTCMonth() === m - 1 && test.getUTCDate() === d
    ? `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}` : null;
}
function cleanHistory(items) {
  const seen = new Set(), ids = new Set();
  return (Array.isArray(items) ? items : [])
    .filter(item => object(item) && validName(item.name ?? item.playerName ?? item.query))
    .map((item, order) => ({ ...item, name: (item.name ?? item.playerName ?? item.query).trim(), date: normalizeDate(item.date), order }))
    .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '') || a.order - b.order)
    .filter(item => {
      // An unknown date is not evidence that two old entries were the same search.
      if (!item.date) return true;
      const key = JSON.stringify([item.name, item.date]);
      if (seen.has(key)) return false;
      seen.add(key); return true;
    }).slice(0, 100).map(item => {
      let id = typeof item.id === 'string' || (typeof item.id === 'number' && Number.isFinite(item.id)) ? String(item.id) : '';
      if (!id || ids.has(id)) id = uid();
      ids.add(id);
      return { id, name: item.name, date: item.date };
    });
}
function fields(raw) {
  const settings = object(raw?.settings) ? raw.settings : {};
  return {
    game: raw?.game ?? raw?.gameTitle ?? raw?.gameSelect ?? settings.game,
    mode: raw?.mode ?? raw?.searchMode ?? raw?.routing ?? settings.routing,
    customGame: raw?.customGame ?? raw?.gameCustom ?? settings.customGame,
    inputs: raw?.inputs ?? raw?.players ?? raw?.names,
    resultNames: raw?.resultNames ?? raw?.results
  };
}
function sanitizeState(raw) {
  const state = defaultState();
  if (!object(raw)) return state;
  const f = fields(raw);
  if (GAMES.has(f.game)) state.game = f.game;
  if (MODES.has(f.mode)) state.mode = f.mode;
  if (typeof f.customGame === 'string' && [...f.customGame].length <= 80 && wellFormed(f.customGame)) state.customGame = f.customGame;
  if (Array.isArray(f.inputs)) {
    state.inputs = f.inputs.filter(v => typeof v === 'string' && [...v].length <= MAX_NAME && wellFormed(v)).slice(0, MAX_PLAYERS);
    if (!state.inputs.length) state.inputs = [''];
  }
  if (Array.isArray(f.resultNames)) {
    state.resultNames = f.resultNames.map(v => typeof v === 'string' ? v : object(v) ? (v.playerName ?? v.name) : null)
      .filter(validName).slice(0, MAX_PLAYERS).map(n => n.trim());
  }
  // Reject persisted URLs and regenerate all search routes.
  state.history = cleanHistory(raw.history);
  state.migratedLegacyKeys = Array.isArray(raw.migratedLegacyKeys)
    ? [...new Set(raw.migratedLegacyKeys.filter(k => LEGACY_KEYS.includes(k)))] : [];
  if (raw.migratedLegacyHistory === true && !state.migratedLegacyKeys.includes('psd_history')) state.migratedLegacyKeys.push('psd_history');
  return state;
}
function readState(storage) {
  const warnings = [], records = [];
  let current;
  try { current = storage.getItem(STORAGE_KEY); }
  catch { return { state: defaultState(), warnings: ['保存領域を読み込めません。入力は画面に保持します。'], needsSave: false }; }
  let state = defaultState(), hasCurrent = false, currentRecord;
  if (current !== null && current !== undefined) {
    try {
      const parsed = JSON.parse(current);
      if (!object(parsed)) throw new Error();
      if (parsed.schemaVersion > SCHEMA) return { state, warnings: ['新しい形式の保存データがあります。上書き防止のため保存を停止しています。'], blocked: true, needsSave: false };
      state = sanitizeState(parsed); hasCurrent = true; currentRecord = parsed;
    } catch { return { state, warnings: ['保存JSONが壊れています。元データを残し、上書き保存を停止しました。バックアップの読込で復旧できます。'], blocked: true, needsSave: false }; }
  }
  const done = new Set(state.migratedLegacyKeys);
  for (const key of LEGACY_KEYS) {
    if (done.has(key)) continue;
    try {
      const raw = storage.getItem(key);
      if (raw !== null && raw !== undefined) {
        const value = JSON.parse(raw);
        if (key === 'psd_history') {
          if (!Array.isArray(value)) throw new Error();
          records.push({ history: value });
        } else {
          if (!object(value)) throw new Error();
          records.push(value);
        }
      }
      done.add(key);
    } catch { warnings.push(`${key} は読み込めません。元データは残しています。`); }
  }
  let oldGame = null, oldMode = null;
  try { oldGame = storage.getItem('psd_game'); } catch { /* preserve other usable data */ }
  try { oldMode = storage.getItem('psd_routing'); } catch { /* preserve other usable data */ }
  // The supplied legacy UI explicitly names 'google' a search-engine-only mode.
  // 'direct' has no equivalent; do not silently reinterpret its meaning.
  const mappedMode = oldMode === 'google' ? 'force-google' : oldMode;
  if (!hasCurrent) {
    const candidates = records.map(fields);
    const choose = (key, valid) => candidates.map(x => x[key]).find(valid);
    state = sanitizeState({
      game: choose('game', value => GAMES.has(value)) ?? (GAMES.has(oldGame) ? oldGame : 'dbd'),
      mode: choose('mode', value => MODES.has(value)) ?? (MODES.has(mappedMode) ? mappedMode : 'smart'),
      customGame: choose('customGame', value => typeof value === 'string'),
      inputs: choose('inputs', Array.isArray), resultNames: choose('resultNames', Array.isArray)
    });
    if (oldMode && !MODES.has(mappedMode)) warnings.push('旧ダイレクトモード等は互換性がないため、スマート検索に戻しました。');
  }
  if (hasCurrent) {
    const present = fields(currentRecord), oldFields = records.map(fields);
    const first = (key, valid) => oldFields.map(item => item[key]).find(valid);
    const fill = {};
    if (present.game === undefined) fill.game = first('game', value => GAMES.has(value));
    if (present.mode === undefined) fill.mode = first('mode', value => MODES.has(value));
    if (present.customGame === undefined) fill.customGame = first('customGame', value => typeof value === 'string');
    if (present.inputs === undefined) fill.inputs = first('inputs', Array.isArray);
    if (present.resultNames === undefined) fill.resultNames = first('resultNames', Array.isArray);
    for (const key of Object.keys(fill)) if (fill[key] === undefined) delete fill[key];
    state = sanitizeState({ ...state, ...fill });
  }
  state.history = cleanHistory([...state.history, ...records.flatMap(value => Array.isArray(value.history) ? value.history : [])]);
  state.migratedLegacyKeys = [...done];
  if (records.length || (!hasCurrent && (oldGame !== null || oldMode !== null))) warnings.push('旧データを読み込みました。元の保存キーは削除していません。');
  return { state, warnings, blocked: false, needsSave: hasCurrent || records.length > 0 || oldGame !== null || oldMode !== null };
}
function saveState(storage, state) {
  try { storage.setItem(STORAGE_KEY, JSON.stringify(sanitizeState(state))); return true; }
  catch { return false; }
}
function addHistory(state, names, date = dayString()) {
  const fresh = names.map(name => ({ id: uid(), name: name.trim(), date }));
  state.history = cleanHistory([...fresh, ...state.history]);
}
function gamePrefix(state) { return (state.game === 'other' ? state.customGame : state.game).trim(); }
function searchQuery(state, name, platform, withGame = true) {
  // Quotes request phrase matching; they do not establish account ownership.
  const phrase = name.trim().replaceAll('"', ' ').replace(/[\r\n\t]/g, ' ');
  return [withGame ? gamePrefix(state) : '', `"${phrase}"`, platform?.site].filter(Boolean).join(' ');
}
const RESERVED_X = new Set(['home','explore','search','i','settings','messages','notifications','login','signup','compose','intent','share','tos','privacy']);
const RESERVED_TWITCH = new Set(['search','directory','downloads','settings','subscriptions','inventory','wallet','login','signup','videos','jobs','p','turbo']);
function searchIdentity(name) {
  const text = name.trim();
  for (const platform of PLATFORMS) {
    const url = safePlatformUrl(text, platform);
    if (!url) continue;
    const path = new URL(url).pathname;
    const pattern = platform.id === 'steam' ? /^\/(?:profiles|id)\/([^/]+)\/?$/
      : ['youtube', 'tiktok'].includes(platform.id) ? /^\/@([^/]+)\/?$/ : /^\/([^/]+)\/?$/;
    const match = pattern.exec(path);
    if (!match) continue;
    try {
      const value = decodeURIComponent(match[1]);
      if (platform.id === 'x' && RESERVED_X.has(value.toLowerCase())) continue;
      if (platform.id === 'twitch' && RESERVED_TWITCH.has(value.toLowerCase())) continue;
      if (validName(value)) return { value, platform: platform.id, url };
    } catch { /* malformed URL: use the original text */ }
  }
  return { value: text.replace(/^@(?=\S)/, ''), platform: null, url: null };
}
function nameVariants(name) {
  const value = searchIdentity(name).value;
  return [...new Set([name.trim(), value, value.normalize('NFKC')])].filter(validName);
}
function generateLinks(state, name) {
  if (!validName(name)) return [];
  const identity = searchIdentity(name), text = identity.value, encoded = encodeURIComponent(text);
  const direct = {
    x: /^[A-Za-z0-9_]{1,15}$/.test(text) && !RESERVED_X.has(text.toLowerCase()),
    youtube: /^[A-Za-z0-9][A-Za-z0-9_.-]{1,28}[A-Za-z0-9]$/.test(text),
    twitch: /^[A-Za-z0-9][A-Za-z0-9_]{0,24}$/.test(text) && !RESERVED_TWITCH.has(text.toLowerCase()),
    tiktok: /^[A-Za-z0-9_.]{2,24}$/.test(text) && !text.endsWith('.')
  };
  const targets = {
    steam: `https://steamcommunity.com/search/users/?text=${encoded}`,
    x: `https://x.com/${encoded}`, youtube: `https://www.youtube.com/@${encoded}`,
    twitch: `https://www.twitch.tv/${encodeURIComponent(text.toLowerCase())}`, tiktok: `https://www.tiktok.com/@${encoded}`
  };
  const native = {
    steam: targets.steam,
    x: `https://x.com/search?q=${encoded}&src=typed_query&f=user`,
    youtube: `https://www.youtube.com/results?search_query=${encoded}&sp=EgIQAg%3D%3D`,
    twitch: `https://www.twitch.tv/search?term=${encoded}`,
    tiktok: `https://www.tiktok.com/search/user?q=${encoded}`
  };
  return PLATFORMS.map(platform => {
    const fallback = `https://www.google.com/search?q=${encodeURIComponent(searchQuery(state, text, platform, false))}`;
    const contextual = `https://www.google.com/search?q=${encodeURIComponent(searchQuery(state, text, platform))}`;
    let url = fallback, kind = platform.id === '5ch' ? 'Google検索・スレッド本文は未確認' : 'Google検索・結果は未確認';
    if (state.mode === 'smart' && native[platform.id]) { url = native[platform.id]; kind = 'サービス内で名前を検索・結果は未確認'; }
    const profile = identity.platform === platform.id ? identity.url : direct[platform.id] ? targets[platform.id] : null;
    return { ...platform, url, fallback, contextual, profile, kind };
  });
}
function safePlatformUrl(value, platform) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.port &&
      platform.hosts.some(host => url.hostname === host || url.hostname.endsWith(`.${host}`)) ? url.href : null;
  } catch { return null; }
}
function compareNames(observed, expected) {
  if (typeof observed !== 'string' || !validName(expected) || !observed) return 'unverified';
  const a = observed.normalize('NFC'), b = expected.trim().normalize('NFC');
  if (a === b) return 'exact';
  return a.includes(b) || b.includes(a) ? 'partial' : 'none';
}
function urlNameMatch(value, platform, expected) {
  const safe = safePlatformUrl(value, platform);
  if (!safe) return { status: 'unverified', observed: '', source: 'profile_url_id' };
  let observed = '', found;
  const path = new URL(safe).pathname;
  if (platform.id === 'youtube' || platform.id === 'tiktok') found = /^\/@([^/]+)\/?$/.exec(path);
  else if (platform.id === 'x' || platform.id === 'twitch') found = /^\/([^/]+)\/?$/.exec(path);
  if (found) { try { observed = decodeURIComponent(found[1]); } catch { /* unavailable */ } }
  return { status: compareNames(observed, searchIdentity(expected).value), observed, source: 'profile_url_id' };
}
function steamProfile(value) {
  const text = value.trim();
  if (/^\d{17}$/.test(text)) return `https://steamcommunity.com/profiles/${text}/`;
  const url = safePlatformUrl(text, PLATFORMS[0]);
  if (!url) return null;
  const parsed = new URL(url);
  if (!/^\/(?:profiles\/\d{17}|id\/[A-Za-z0-9_-]{1,100})\/?$/.test(parsed.pathname)) return null;
  return `https://steamcommunity.com${parsed.pathname}`;
}
function parseBackup(text) {
  const value = JSON.parse(text);
  const data = object(value?.state) ? value.state : value;
  if (!object(data) || !Array.isArray(fields(data).inputs) || !Array.isArray(data.history)) throw new Error('P.S.Dのバックアップ形式ではありません。');
  if (data.schemaVersion > SCHEMA) throw new Error('新しい形式のため、この版では読めません。');
  const state = sanitizeState(data);
  state.migratedLegacyKeys = [...LEGACY_KEYS];
  return state;
}


const $ = id => document.getElementById(id);
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function button(text, className, handler, label) {
  const node = el('button', `button ${className}`, text); node.type = 'button';
  if (label) node.setAttribute('aria-label', label);
  node.addEventListener('click', handler); return node;
}
function link(text, url) {
  const node = el('a', '', text); node.href = url; node.target = '_blank'; node.rel = 'noopener noreferrer'; node.referrerPolicy = 'no-referrer'; return node;
}
let storage; try { storage = window.localStorage; } catch { /* memory-only mode */ }
const loaded = readState(storage);
let state = loaded.state, blocked = loaded.blocked ?? false, apiBase = '', registration, run = 0, updateRequested = false;
let searchSource = '検索API', steamRun = 0;
const notices = new Set(loaded.warnings), candidateGroups = new Map(), pending = new Set();
const apiStatuses = {
  not_configured: '検索APIキー未設定', no_match: '取得した範囲に文字列一致の候補なし',
  unavailable: '取得できませんでした', invalid_query: '検索語がAPIの上限を超えています', busy: 'サーバーが混雑しています',
  ok: '検索掲載文に一致する候補あり・実在未確認'
};
function showNotice(message) { notices.add(message); $('notice').textContent = [...notices].join('\n'); $('notice').hidden = false; }
for (const warning of loaded.warnings) showNotice(warning);
function persist() {
  if (blocked) return false;
  const ok = saveState(storage, state);
  if (!ok) showNotice('端末への保存に失敗しました。入力は画面に残ります。バックアップを書き出してください。');
  return ok;
}
if (loaded.needsSave) persist();
function invalidateSearch() {
  run++;
  for (const request of pending) if (request.path === 'search') request.controller.abort();
  candidateGroups.clear();
}
function invalidateSteam() {
  steamRun++;
  for (const request of pending) if (request.path === 'steam') request.controller.abort();
  $('check-steam').disabled = false; $('steam-result').replaceChildren();
}
function settingsLabel() { return `${gamePrefix(state) || 'ゲーム指定なし'} · ${state.mode === 'smart' ? 'スマート検索' : 'Google検索'}`; }
function syncSettings() {
  $('game').value = state.game; $('custom-game').value = state.customGame; $('mode').value = state.mode;
  $('custom-game-field').hidden = state.game !== 'other';
  $('active-settings').textContent = settingsLabel();
}
function renderInputs(focusIndex) {
  const rows = state.inputs.map((name, index) => {
    const row = el('div', 'name-row');
    const label = el('label', 'name-label', `プレイヤー${index + 1}`); label.htmlFor = `name-${index}`;
    const input = el('input'); input.id = `name-${index}`; input.type = 'text'; input.value = name;
    input.placeholder = 'プレイヤー名を入力'; input.maxLength = 256; input.autocomplete = 'off'; input.spellcheck = false;
    input.addEventListener('input', () => { state.inputs[index] = input.value; persist(); });
    input.addEventListener('keydown', event => {
      if (event.key === 'Enter' && !event.isComposing && event.keyCode !== 229) { event.preventDefault(); executeSearch(); }
    });
    row.append(label, input);
    if (state.inputs.length > 1) row.append(button('×', 'remove', () => {
      state.inputs.splice(index, 1); persist(); renderInputs(Math.min(index, state.inputs.length - 1));
    }, `プレイヤー${index + 1}の入力欄を削除`));
    return row;
  });
  $('names-container').replaceChildren(...rows);
  $('slot-count').textContent = `${state.inputs.length} / ${MAX_PLAYERS}`;
  $('add-player').disabled = state.inputs.length >= MAX_PLAYERS;
  if (focusIndex !== undefined) $(`name-${focusIndex}`)?.focus();
}
function renderCandidates(target, key) {
  if (state.mode === 'force-google') { target.append(el('p', 'result-status', 'Googleモードです。下の検索先リンクから検索できます。')); return; }
  const result = candidateGroups.get(key);
  if (!result) { target.append(el('p', 'result-status', apiBase ? '自動検索は未実行です。「検索」で取得します。' : '自動検索は未接続です。検索先リンクを利用できます。')); return; }
  if (result.loading || result.error) { target.append(el('p', 'result-status', result.loading ? '公開ページの候補を取得中…' : result.error)); return; }
  const heading = el('h3', '', '名前の文字列が一致する公開ページ'); target.append(heading);
  target.append(el('p', 'hint', '検索エンジンに登録されたタイトル・説明・URLを照合しています。アカウントの現在の存在、表示名の完全一致、同一人物を確認する機能ではありません。'));
  for (const platform of PLATFORMS) {
    const group = result.groups?.find(g => object(g) && g.platform === platform.id);
    const items = (Array.isArray(group?.candidates) ? group.candidates : [])
      .filter(item => object(item) && item.evidence === 'indexed_text_match' && safePlatformUrl(item.url, platform)).slice(0, 5);
    const status = group?.status === 'ok' && !items.length ? '候補データの形式を確認できません' : apiStatuses[group?.status] ?? apiStatuses.unavailable;
    const groupPanel = el('section', 'platform-group');
    const line = el('div', 'platform-status'); line.append(el('strong', '', platform.name), el('span', '', status)); groupPanel.append(line); target.append(groupPanel);
    for (const item of items) {
      const url = safePlatformUrl(item?.url, platform); if (!url || item.evidence !== 'indexed_text_match') continue;
      const card = el('article', 'candidate'); card.append(link(String(item.title || platform.name), url));
      const matchLabels = { exact: '完全一致', partial: '部分一致', none: '一致なし', unverified: '未比較' };
      const nameMatch = urlNameMatch(url, platform, state.resultNames[Number(key.split(':')[0])]);
      if (nameMatch.observed) card.append(el('p', '', `URL上のID：${nameMatch.observed} · ${matchLabels[nameMatch.status]}`));
      if (typeof item.description === 'string') card.append(el('p', '', item.description.slice(0, 500)));
      card.append(el('p', '', `出典：${searchSource} · 取得：${formatTime(group.checkedAt)} · 本人未確認`));
      if (platform.id === 'steam' && steamProfile(url)) card.append(button('このSteamアカウントのBAN情報を確認', 'secondary', () => { invalidateSteam(); $('steam-target').value = url; $('steam-name').value = state.resultNames[Number(key.split(':')[0])] || ''; checkSteam(); $('steam-result').scrollIntoView({ block: 'nearest', behavior: motion() }); }));
      groupPanel.append(card);
    }
  }
}
function renderResults() {
  const blocks = state.resultNames.map((name, index) => {
    const key = `${index}:${name}`, block = el('article', 'panel player-block');
    const header = el('div', 'player-header'); header.append(el('h2', '', name), button('閉じる', 'secondary', () => {
      invalidateSearch(); state.resultNames.splice(index, 1); persist(); renderResults();
    }, `${name}の結果を閉じる`)); block.append(header, el('p', 'hint', settingsLabel()));
    const candidateArea = el('div'); renderCandidates(candidateArea, key); block.append(candidateArea);
    const ordinary = el('div', 'search-tools');
    ordinary.append(link('まず名前だけでGoogle検索', `https://www.google.com/search?q=${encodeURIComponent(searchQuery(state, name, null, false))}`));
    if (gamePrefix(state)) ordinary.append(link('ゲーム名を加えて検索', `https://www.google.com/search?q=${encodeURIComponent(searchQuery(state, searchIdentity(name).value))}`));
    block.append(ordinary);
    const details = el('details'); details.open = !apiBase || state.mode === 'force-google' || !!candidateGroups.get(key)?.error;
    details.append(el('summary', '', '媒体別に検索する'));
    details.append(el('p', 'hint', '検索先へのリンクです。発見済みのアカウントではありません。'));
    const routeGrid = el('div', 'route-grid');
    for (const route of generateLinks(state, name)) {
      const row = el('section', 'route');
      const routeHeader = el('div', 'route-heading');
      routeHeader.append(el('h3', '', route.name), el('span', 'badge', '未確認'));
      const mainLink = link(state.mode === 'force-google' || route.id === '5ch' ? 'Googleで検索 ↗' : '名前で検索 ↗', route.url);
      mainLink.className = 'route-primary';
      mainLink.setAttribute('aria-label', `${route.name}：${mainLink.textContent}`);
      row.append(routeHeader, mainLink);
      const extra = el('details', 'route-extra');
      extra.append(el('summary', '', 'ほかの探し方'));
      if (route.fallback !== route.url) extra.append(link('Googleで検索', route.fallback));
      if (route.contextual !== route.fallback) extra.append(link('ゲーム名も含める', route.contextual));
      if (state.mode === 'smart' && route.profile) extra.append(link('ID候補を開く（未確認）', route.profile));
      row.append(extra); routeGrid.append(row);
    }
    details.append(routeGrid);
    block.append(details);
    const variants = nameVariants(name).slice(1);
    if (variants.length) {
      const alternative = el('div', 'search-tools');
      alternative.append(el('p', 'hint', '記号・全角半角を変えた検索（別名の可能性があります）'));
      for (const variant of variants) alternative.append(link(`「${variant}」を検索`, `https://www.google.com/search?q=${encodeURIComponent(searchQuery(state, variant, null, false))}`));
      block.append(alternative);
    }
    return block;
  });
  $('results').replaceChildren(...blocks);
}
function formatTime(value) {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) return '日時不明';
  return new Date(value).toLocaleString('ja-JP');
}
function motion() { return matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'; }
async function request(path, data) {
  if (!apiBase) throw new Error('APIサーバー未接続です。配布版READMEの設定手順を確認してください。');
  const controller = new AbortController(), active = { path, controller }; pending.add(active);
  const timer = setTimeout(() => controller.abort(), 45_000);
  try {
    const response = await fetch(new URL(path, apiBase), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data), signal: controller.signal, cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer' });
    let value;
    try { value = await response.json(); } catch { throw new Error('APIからJSON形式の応答を取得できませんでした。'); }
    if (!object(value)) throw new Error('APIの応答形式が不正です。');
    if (!response.ok) throw new Error(typeof value.error === 'string' ? value.error : 'APIサーバーで取得に失敗しました。');
    return value;
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('通信が中断されたか、時間内に応答しませんでした。');
    if (error instanceof TypeError) throw new Error('APIに接続できません。通信状態とサーバー設定を確認してください。');
    throw error;
  } finally { clearTimeout(timer); pending.delete(active); }
}
async function timedFetch(url, options = {}, timeout = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try { return await fetch(url, { ...options, signal: controller.signal }); }
  finally { clearTimeout(timer); }
}
const configReady = (async () => {
  try {
    const response = await timedFetch('./config.json', { cache: 'no-store' }, 5000);
    if (!response.ok) throw new Error();
    const config = await response.json();
    if (!object(config)) throw new Error();
    if (typeof config.searchSource === 'string' && config.searchSource.trim()) searchSource = config.searchSource.trim().slice(0, 80);
    if (typeof config.apiBase === 'string' && config.apiBase) {
      const url = new URL(config.apiBase, location.href);
      if ((url.protocol === 'https:' || (url.origin === location.origin && url.protocol === 'http:')) && !url.username && !url.password && !url.search && !url.hash) {
        url.pathname = url.pathname.replace(/\/?$/, '/'); apiBase = url.href;
      } else showNotice('APIのURL設定を確認してください。HTTPSが必要です。');
    }
  } catch { showNotice('接続設定を取得できませんでした。検索先リンクと端末内データは利用できます。'); }
  $('connection-status').textContent = apiBase ? 'APIサーバー接続先を設定済み' : '静的モード · 自動検索は未接続';
  $('steam-api-status').textContent = apiBase ? '照会先を設定済み・取得は未確認' : 'BAN情報の自動照会は未接続です。プロフィールは開けます。';
  renderResults();
})();
async function executeSearch() {
  const names = state.inputs.map(value => value.trim()).filter(Boolean);
  if (!names.length) { showNotice('プレイヤー名を入力してください。'); $('name-0').focus(); return; }
  if (names.some(n => !validName(n))) { showNotice('プレイヤー名は256文字以内で入力してください。'); return; }
  if (state.game === 'other' && !state.customGame.trim()) { showNotice('設定でゲーム名を入力するか、「ゲーム名を付けない」を選んでください。'); return; }
  invalidateSearch(); const thisRun = run;
  state.resultNames = names; addHistory(state, names); persist(); renderResults();
  $('results').scrollIntoView({ behavior: motion(), block: 'start' });
  await configReady;
  if (thisRun !== run || !apiBase || state.mode === 'force-google') return;
  for (let index = 0; index < names.length; index++) candidateGroups.set(`${index}:${names[index]}`, { loading: true });
  renderResults();
  await Promise.allSettled(names.map(async (name, index) => {
    const key = `${index}:${name}`;
    try {
      const result = await request('search', { name: searchIdentity(name).value, prefix: gamePrefix(state) });
      if (thisRun === run) candidateGroups.set(key, Array.isArray(result.groups) ? result : { error: '検索APIの応答形式が不正です。' });
    } catch (error) { if (thisRun === run) candidateGroups.set(key, { error: error.message }); }
    if (thisRun === run) renderResults();
  }));
}
function renderHistory() {
  const query = $('history-filter').value.toLocaleLowerCase('ja-JP');
  const items = state.history.filter(item => item.name.toLocaleLowerCase('ja-JP').includes(query)).map(item => {
    const row = el('div', 'history-item');
    const pick = button('', 'secondary history-pick', () => {
      invalidateSearch(); state.inputs = [item.name]; state.resultNames = []; persist(); renderInputs(); renderResults(); $('history-dialog').close(); $('name-0').focus();
    });
    pick.append(el('span', '', item.name), el('small', '', item.date ?? '日付不明'));
    row.append(pick, button('×', 'remove', () => { state.history = state.history.filter(h => h.id !== item.id); persist(); renderHistory(); }, `${item.name}の履歴を1件削除`)); return row;
  });
  $('history-list').replaceChildren(...(items.length ? items : [el('p', 'hint', query ? '一致する履歴はありません。' : '履歴はありません。')]));
}
async function checkSteam() {
  await configReady;
  if ($('check-steam').disabled) return;
  const target = $('steam-target').value.trim(); if (!target) { $('steam-result').textContent = 'SteamID64かSteamプロフィールURLを入力してください。'; return; }
  const profile = steamProfile(target);
  if (!profile) { $('steam-result').textContent = 'SteamID64（17桁）か、steamcommunity.comの/profiles/・/id/のURLを入力してください。'; return; }
  if (!apiBase) {
    $('steam-result').replaceChildren(el('p', '', 'BAN情報は未確認です。自動照会先が未接続です。'), link('Steam公式プロフィールを開く', profile));
    return;
  }
  const thisRun = ++steamRun, expectedName = $('steam-name').value.trim();
  $('check-steam').disabled = true; $('steam-result').textContent = 'Steam公式APIに照会中…';
  try {
    const data = await request('steam', { target: profile, expectedName });
    if (thisRun !== steamRun) return;
    if (data.status !== 'ok') { $('steam-result').textContent = ({ not_configured: 'Steam Web APIキーが未設定です。BAN情報は未確認です。', no_match: '指定URLのSteamIDを解決できませんでした。', unavailable: 'Steam APIから取得できませんでした。BAN情報は未確認です。' })[data.status] ?? '取得できませんでした。BAN情報は未確認です。'; return; }
    const bans = data.bans;
    if (!/^\d{17}$/.test(data.steamId) || !bans || typeof bans.vac !== 'boolean' || typeof bans.community !== 'boolean' || ![bans.vacCount, bans.gameCount, bans.daysSinceLastBan].every(v => Number.isSafeInteger(v) && v >= 0) || typeof bans.economy !== 'string') throw new Error('Steam APIの応答形式が不正です。BAN情報は未確認です。');
    const requestedId = /\/profiles\/(\d{17})\/?$/.exec(profile)?.[1];
    if ((requestedId && data.steamId !== requestedId) || bans.vac !== (bans.vacCount > 0)) throw new Error('Steam APIの応答が指定アカウントまたはBAN件数と一致しません。');
    const result = el('div'); result.append(link(`${data.name || data.steamId}（プロフィール）`, `https://steamcommunity.com/profiles/${data.steamId}/`));
    const list = el('dl');
    if (expectedName) result.append(el('p', '', `現在のSteam表示名との比較：${({ exact: '完全一致', partial: '部分一致', none: '一致なし', unverified: '未比較' })[compareNames(data.name, expectedName)]}（同一人物の証明ではありません）`));
    const pairs = [['SteamID64', data.steamId], ['VAC BAN', `${bans.vac ? 'あり' : 'なし'} · ${bans.vacCount}件`], ['ゲームBAN', `${bans.gameCount}件`], ['コミュニティBAN', bans.community ? 'あり' : 'なし'], ['トレード制限（EconomyBan）', bans.economy], ['最後のBANからの日数', bans.vacCount || bans.gameCount ? `${bans.daysSinceLastBan}日` : '該当情報なし']];
    for (const [title, value] of pairs) list.append(el('dt', '', title), el('dd', '', value));
    result.append(list, el('p', 'hint', `出典：Steam Web API / ISteamUser · 取得：${formatTime(data.checkedAt)}`), el('p', 'hint', 'Steam APIが返した情報です。DbDでの不正や、他媒体と同一人物であることを示しません。'));
    $('steam-result').replaceChildren(result);
  } catch (error) { if (thisRun === steamRun) $('steam-result').textContent = `${error.message} BAN情報は未確認です。`; }
  finally { if (thisRun === steamRun) $('check-steam').disabled = false; }
}
function bind() {
  $('app-version').textContent = `v${VERSION}`;
  $('add-player').addEventListener('click', () => { if (state.inputs.length >= MAX_PLAYERS) return; state.inputs.push(''); persist(); renderInputs(state.inputs.length - 1); });
  $('search').addEventListener('click', executeSearch);
  $('check-steam').addEventListener('click', checkSteam);
  $('open-steam').addEventListener('click', () => {
    const url = steamProfile($('steam-target').value);
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
    else $('steam-result').textContent = '有効なSteamID64かプロフィールURLを入力してください。';
  });
  for (const id of ['steam-target', 'steam-name']) $(id).addEventListener('input', invalidateSteam);
  $('steam-target').addEventListener('keydown', event => { if (event.key === 'Enter' && !event.isComposing && event.keyCode !== 229) { event.preventDefault(); checkSteam(); } });
  for (const id of ['game', 'custom-game', 'mode']) $(id).addEventListener(id === 'custom-game' ? 'input' : 'change', () => {
    state.game = $('game').value; state.customGame = $('custom-game').value; state.mode = $('mode').value;
    invalidateSearch(); syncSettings(); persist(); renderResults();
  });
  for (const name of ['settings', 'history']) {
    $(`open-${name}`).addEventListener('click', () => { if (name === 'history') renderHistory(); $(`${name}-dialog`).showModal(); });
    $(`close-${name}`).addEventListener('click', () => $(`${name}-dialog`).close());
    $(`${name}-dialog`).addEventListener('keydown', event => {
      if (event.key !== 'Tab') return;
      const dialog = event.currentTarget;
      const items = [...dialog.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),a[href],[tabindex="0"]')].filter(node => node.getClientRects().length);
      const first = items[0], last = items.at(-1);
      if (!first) { event.preventDefault(); return; }
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    });
  }
  $('history-filter').addEventListener('input', renderHistory);
  $('clear-history').addEventListener('click', () => { if (confirm('全履歴を削除しますか？')) { state.history = []; persist(); renderHistory(); } });
  $('export').addEventListener('click', () => {
    const original = {};
    if (blocked && storage) for (const key of [STORAGE_KEY, ...LEGACY_KEYS, 'psd_game', 'psd_routing']) {
      try { const value = storage.getItem(key); if (value !== null) original[key] = value; } catch { /* export other readable keys */ }
    }
    const blob = new Blob([JSON.stringify({ app: 'P.S.D', exportedAt: new Date().toISOString(), state, ...(blocked ? { originalStorage: original } : {}) }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob), a = el('a'); a.href = url; a.download = `PSD-backup-${new Date().toISOString().slice(0, 10)}.json`; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 30_000);
    $('storage-status').textContent = 'JSONの書き出しを開始しました。ファイルを保管してください。';
  });
  $('import').addEventListener('click', () => $('import-file').click());
  $('import-file').addEventListener('change', async event => {
    const file = event.target.files?.[0]; if (!file) return;
    try {
      if (file.size > 2_000_000) throw new Error('2MB以内のJSONを選んでください。');
      const imported = parseBackup(await file.text());
      if (!confirm('バックアップの入力・設定・履歴で、このアプリの保存データを置き換えますか？')) return;
      invalidateSearch(); state = imported; blocked = false;
      const ok = persist(); syncSettings(); renderInputs(); renderResults(); renderHistory();
      $('storage-status').textContent = ok ? 'バックアップを読み込み、保存しました。' : '画面には読み込みましたが、端末への保存には失敗しました。';
    } catch (error) { $('storage-status').textContent = `読込できません：${error.message}`; }
    finally { event.target.value = ''; }
  });
  $('persist').addEventListener('click', async () => {
    try {
      if (!navigator.storage?.persist) { $('storage-status').textContent = 'この環境は保存領域の保護リクエストに対応していません。バックアップをご利用ください。'; return; }
      const granted = await navigator.storage.persist();
      $('storage-status').textContent = granted ? '保存領域の保護が許可されました。ユーザーによる削除等には備え、バックアップを続けてください。' : '保存領域の保護は許可されませんでした。バックアップをご利用ください。';
    } catch { $('storage-status').textContent = '保存領域の保護を確認できませんでした。'; }
  });
  $('update').addEventListener('click', checkUpdate);
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
  $('install-banner').hidden = !isIOS || navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;
  const connection = () => { $('offline-status').textContent = navigator.onLine ? 'オンライン' : 'オフライン'; };
  addEventListener('online', connection); addEventListener('offline', connection); connection();
}
async function setupServiceWorker() {
  if (!('serviceWorker' in navigator) || !window.isSecureContext) { showNotice('この環境ではオフライン起動を準備できません。HTTPSまたはlocalhostを使用してください。'); return; }
  try {
    registration = await navigator.serviceWorker.register(new URL('./sw.js', document.baseURI), { scope: './', updateViaCache: 'none' });
    let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!navigator.serviceWorker.controller || reloading) return;
      if (updateRequested) { reloading = true; persist(); location.reload(); }
    });
    registration.addEventListener('updatefound', () => {
      const worker = registration.installing;
      worker?.addEventListener('statechange', () => { if (worker.state === 'installed' && navigator.serviceWorker.controller) $('update-status').textContent = '更新をダウンロードしました。「アプリの更新を確認」で適用できます。'; });
    });
  } catch { showNotice('オフライン用データを準備できませんでした。オンラインの機能は使用できます。'); }
}
async function checkUpdate() {
  $('update').disabled = true; $('update-status').textContent = '更新を確認中…';
  try {
    if (!navigator.onLine) throw new Error('オフラインのため更新を確認できません。');
    const response = await timedFetch('./version.json', { cache: 'no-store' });
    if (!response.ok) throw new Error('バージョン情報を取得できませんでした。');
    const data = await response.json();
    if (!/^\d+\.\d+\.\d+$/.test(data.version)) throw new Error('バージョン情報の形式が不正です。');
    if (!registration) { if (data.version === VERSION) $('update-status').textContent = `最新版です（v${VERSION}）。`; else $('update-status').textContent = `v${data.version}があります。ページを再読み込みしてください。`; return; }
    await registration.update();
    if (registration.installing) await new Promise(resolve => {
      const worker = registration.installing, timer = setTimeout(resolve, 10_000);
      worker.addEventListener('statechange', () => { if (['installed', 'redundant'].includes(worker.state)) { clearTimeout(timer); resolve(); } });
    });
    if (registration.waiting) {
      if (!persist()) throw new Error('入力を保存できないため、更新の適用を止めました。先にバックアップを書き出してください。');
      updateRequested = true;
      registration.waiting.postMessage({ type: 'DPS_SKIP_WAITING' });
      $('update-status').textContent = 'このアプリの更新を適用中…';
      setTimeout(() => { if (updateRequested) $('update-status').textContent = '更新の切替を確認できませんでした。入力を保存してから、もう一度お試しください。'; }, 15_000);
    } else $('update-status').textContent = data.version === VERSION ? `最新版です（v${VERSION}）。` : `v${data.version}があります。配信が完了してから再度確認してください。`;
  } catch (error) { $('update-status').textContent = error instanceof TypeError ? '通信できないため、更新を確認できませんでした。' : error.message || '更新を確認できませんでした。'; }
  finally { $('update').disabled = false; }
}
bind(); syncSettings(); renderInputs(); renderResults(); setupServiceWorker();
