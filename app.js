//#region client/route-cache.mjs
var e = {
	steam: "Steam",
	x: "X (Twitter)",
	youtube: "YouTube",
	twitch: "Twitch",
	tiktok: "TikTok",
	"5ch": "5ちゃんねる"
}, t = {
	steam: ["steamcommunity.com"],
	x: ["x.com", "twitter.com"],
	youtube: ["youtube.com", "youtu.be"],
	twitch: ["twitch.tv"],
	tiktok: ["tiktok.com"],
	"5ch": ["5ch.net", "2ch.sc"]
};
function n(n) {
	if (!Array.isArray(n)) return [];
	let r = /* @__PURE__ */ new Set(), i = [];
	for (let a of n.slice(0, 6)) if (!(!a || !Object.hasOwn(e, a.id) || r.has(a.id) || typeof a.url != "string")) try {
		let n = (e) => {
			let n = new URL(e);
			return n.protocol === "https:" && !n.username && !n.password && !n.port && (a.id === "5ch" && n.hostname === "www.google.com" || t[a.id].some((e) => n.hostname === e || n.hostname.endsWith("." + e))) ? n.href : null;
		}, o = n(a.url);
		if (!o) continue;
		let s = typeof a.broad == "string" ? n(a.broad) : o;
		if (!s) continue;
		r.add(a.id), i.push({
			id: a.id,
			name: e[a.id],
			url: o,
			broad: s,
			scope: [
				"dbd",
				"profile",
				"name"
			].includes(a.scope) ? a.scope : "name"
		});
	} catch {}
	return i;
}
function r(e) {
	return Array.isArray(e) ? e.slice(0, 4).filter((e) => e && typeof e.name == "string" && e.name.length <= 512).map((e) => ({
		name: e.name,
		routes: n(e.routes)
	})) : [];
}
//#endregion
//#region client/search-guard.mjs
var i = "psd-search-backoff-v1";
function a(e, t = () => Date.now()) {
	let n = 0, r = !1, a = -Infinity;
	try {
		let r = Number(e?.getItem(i));
		Number.isFinite(r) && r > t() && (n = r);
	} catch {}
	return {
		begin() {
			return r ? {
				ok: !1,
				reason: "active"
			} : t() < n ? {
				ok: !1,
				reason: "blocked",
				until: n
			} : t() - a < 2e3 ? {
				ok: !1,
				reason: "gap"
			} : (r = !0, a = t(), { ok: !0 });
		},
		finish() {
			r = !1;
		},
		pause(r, a) {
			if (![403, 429].includes(r)) return 0;
			let o = r === 429 ? 3600 * 1e3 : 360 * 60 * 1e3, s = /^\d+$/.test(a || "") ? t() + Number(a) * 1e3 : Date.parse(a || "");
			n = Math.max(n, t() + o, Number.isFinite(s) ? s : 0);
			try {
				e?.setItem(i, String(n));
			} catch {}
			return n;
		}
	};
}
//#endregion
//#region client/history-files.mjs
var o = "psd-history-day-v1", s = "psd-history-files-v1", c = "undated";
function l(e) {
	if (typeof e != "string" || !/^\d{4}-\d{2}-\d{2}$/.test(e)) return !1;
	let t = /* @__PURE__ */ new Date(e + "T00:00:00Z");
	return Number.isFinite(t.getTime()) && t.toISOString().slice(0, 10) === e;
}
function u(e) {
	let t = /* @__PURE__ */ new Map(), n = /* @__PURE__ */ new Set();
	for (let r of Array.isArray(e) ? e : []) {
		if (!r || typeof r.name != "string" || !r.name.trim() || [...r.name].length > 256) continue;
		let e = l(r.date) ? r.date : null, i = e || c, a = r.name.trim(), o = JSON.stringify([
			i,
			a,
			e ? "" : r.id
		]);
		n.has(o) || (n.add(o), t.has(i) || t.set(i, []), t.get(i).push({
			id: String(r.id ?? o),
			name: a,
			date: e
		}));
	}
	return [...t].sort(([e], [t]) => t.localeCompare(e)).map(([e, t]) => ({
		key: e,
		filename: `PSD-history-${e}.json`,
		text: JSON.stringify({
			app: "P.S.D",
			format: o,
			date: e === c ? null : e,
			entries: t
		}, null, 2)
	}));
}
function d(e) {
	return (Array.isArray(e) ? e : []).flatMap((e) => {
		try {
			let t = JSON.parse(e.text);
			return t.app === "P.S.D" && t.format === o && Array.isArray(t.entries) ? t.entries : [];
		} catch {
			return [];
		}
	});
}
function f(e, t) {
	let n, r = Promise.resolve(), i = [], a = () => n ??= new Promise((e, n) => {
		if (!t) {
			n(/* @__PURE__ */ Error("IndexedDB unavailable"));
			return;
		}
		let r = t.open("psd-history-files-v1", 1), i = setTimeout(() => n(/* @__PURE__ */ Error("History database timed out")), 1500);
		r.onupgradeneeded = () => {
			r.result.objectStoreNames.contains("files") || r.result.createObjectStore("files", { keyPath: "key" });
		}, r.onsuccess = () => {
			clearTimeout(i), e(r.result);
		}, r.onerror = () => {
			clearTimeout(i), n(r.error);
		}, r.onblocked = () => {
			clearTimeout(i), n(/* @__PURE__ */ Error("History database blocked"));
		};
	});
	function o() {
		try {
			let t = JSON.parse(e?.getItem(s) || "[]");
			return {
				entries: d(Array.isArray(t) ? t : t.files),
				replace: t?.replace === !0
			};
		} catch {
			return {
				entries: [],
				replace: !1
			};
		}
	}
	async function c(t, n) {
		let r = [...t], c = o(), l = n;
		n ||= c.replace;
		let f = l ? [] : c.replace ? c.entries : [...i, ...c.entries], p;
		try {
			let t = await a();
			p = await new Promise((e, i) => {
				let a = t.transaction("files", "readwrite"), o = a.objectStore("files"), s, c = o.getAll();
				c.onsuccess = () => {
					s = u([
						...r,
						...f,
						...n ? [] : d(c.result)
					]), n && o.clear();
					let e = new Map(c.result.map((e) => [e.key, e.text]));
					for (let t of s) (n || e.get(t.key) !== t.text) && o.put(t);
				}, a.oncomplete = () => e(s), a.onerror = a.onabort = () => i(a.error || /* @__PURE__ */ Error("History transaction failed"));
			});
			try {
				e?.removeItem(s);
			} catch {}
		} catch {
			p = u([...r, ...f]);
			try {
				if (!e) throw Error();
				e.setItem(s, JSON.stringify({
					files: p,
					replace: n
				}));
			} catch {
				return i = d(p), {
					files: p,
					entries: i,
					persisted: !1
				};
			}
		}
		return i = d(p), {
			files: p,
			entries: i,
			persisted: !0
		};
	}
	return { sync(e, { replace: t = !1 } = {}) {
		let n = [...e], i = r.then(() => c(n, t));
		return r = i.catch(() => {}), i;
	} };
}
//#endregion
//#region client/app.js
var p = "3.5.0", m = 4, h = "psd-core-v4", g = 4, ee = 256, _ = Object.freeze([
	"dps-state",
	"dps-core-v6",
	"psd-core-v3",
	"player-check-pro-v2",
	"psd_history"
]), v = (e) => e && typeof e == "object" && !Array.isArray(e), y = (e) => {
	if (typeof e.isWellFormed == "function") return e.isWellFormed();
	try {
		return !0;
	} catch {
		return !1;
	}
}, b = new Set([
	"dbd",
	"apex",
	"valorant",
	"other",
	""
]), x = new Set(["smart", "force-google"]), te = () => globalThis.crypto?.randomUUID?.() ?? `dps-${Date.now()}-${Math.random().toString(36).slice(2)}`, S = (e) => typeof e == "string" && e.trim().length > 0 && [...e].length <= ee && y(e);
function C() {
	return {
		schemaVersion: m,
		game: "dbd",
		customGame: "",
		mode: "smart",
		inputs: [""],
		resultNames: [],
		history: [],
		migratedLegacyKeys: []
	};
}
function w(e = new Date(Date.now())) {
	return `${e.getFullYear()}-${String(e.getMonth() + 1).padStart(2, "0")}-${String(e.getDate()).padStart(2, "0")}`;
}
function ne(e) {
	if (typeof e != "string") return null;
	let t = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(e);
	if (!t) return null;
	let [, n, r, i] = t.map(Number);
	if (n < 1900 || n > 9999) return null;
	let a = new Date(Date.UTC(n, r - 1, i));
	return a.getUTCFullYear() === n && a.getUTCMonth() === r - 1 && a.getUTCDate() === i ? `${n}-${String(r).padStart(2, "0")}-${String(i).padStart(2, "0")}` : null;
}
function T(e) {
	let t = /* @__PURE__ */ new Set(), n = /* @__PURE__ */ new Set();
	return (Array.isArray(e) ? e : []).filter((e) => v(e) && S(e.name ?? e.playerName ?? e.query)).map((e, t) => ({
		...e,
		name: (e.name ?? e.playerName ?? e.query).trim(),
		date: ne(e.date),
		order: t
	})).sort((e, t) => (t.date ?? "").localeCompare(e.date ?? "") || e.order - t.order).filter((e) => {
		if (!e.date) return !0;
		let n = JSON.stringify([e.name, e.date]);
		return t.has(n) ? !1 : (t.add(n), !0);
	}).map((e) => {
		let t = typeof e.id == "string" || typeof e.id == "number" && Number.isFinite(e.id) ? String(e.id) : "";
		return (!t || n.has(t)) && (t = te()), n.add(t), {
			id: t,
			name: e.name,
			date: e.date
		};
	});
}
function E(e) {
	let t = v(e?.settings) ? e.settings : {};
	return {
		game: e?.game ?? e?.gameTitle ?? e?.gameSelect ?? t.game,
		mode: e?.mode ?? e?.searchMode ?? e?.routing ?? t.routing,
		customGame: e?.customGame ?? e?.gameCustom ?? t.customGame,
		inputs: e?.inputs ?? e?.players ?? e?.names,
		resultNames: e?.resultNames ?? e?.results
	};
}
function D(e) {
	let t = C();
	if (!v(e)) return t;
	let n = E(e);
	return b.has(n.game) && (t.game = n.game), x.has(n.mode) && (t.mode = n.mode), typeof n.customGame == "string" && [...n.customGame].length <= 80 && y(n.customGame) && (t.customGame = n.customGame), Array.isArray(n.inputs) && (t.inputs = n.inputs.filter((e) => typeof e == "string" && [...e].length <= ee && y(e)).slice(0, g), t.inputs.length || (t.inputs = [""])), Array.isArray(n.resultNames) && (t.resultNames = n.resultNames.map((e) => typeof e == "string" ? e : v(e) ? e.playerName ?? e.name : null).filter(S).slice(0, g).map((e) => e.trim())), t.history = T(e.history), t.migratedLegacyKeys = Array.isArray(e.migratedLegacyKeys) ? [...new Set(e.migratedLegacyKeys.filter((e) => _.includes(e)))] : [], e.migratedLegacyHistory === !0 && !t.migratedLegacyKeys.includes("psd_history") && t.migratedLegacyKeys.push("psd_history"), t;
}
function re(e) {
	let t = [], n = [], r;
	try {
		r = e.getItem(h);
	} catch {
		return {
			state: C(),
			warnings: ["保存領域を読み込めません。入力は画面に保持します。"],
			needsSave: !1
		};
	}
	let i = C(), a = !1, o;
	if (r != null) try {
		let e = JSON.parse(r);
		if (!v(e)) throw Error();
		if (e.schemaVersion > m) return {
			state: i,
			warnings: ["新しい形式の保存データがあります。上書き防止のため保存を停止しています。"],
			blocked: !0,
			needsSave: !1
		};
		i = D(e), a = !0, o = e;
	} catch {
		return {
			state: i,
			warnings: ["保存JSONが壊れています。元データを残し、上書き保存を停止しました。バックアップの読込で復旧できます。"],
			blocked: !0,
			needsSave: !1
		};
	}
	let s = new Set(i.migratedLegacyKeys);
	for (let r of _) if (!s.has(r)) try {
		let t = e.getItem(r);
		if (t != null) {
			let e = JSON.parse(t);
			if (r === "psd_history") {
				if (!Array.isArray(e)) throw Error();
				n.push({ history: e });
			} else {
				if (!v(e)) throw Error();
				n.push(e);
			}
		}
		s.add(r);
	} catch {
		t.push(`${r} は読み込めません。元データは残しています。`);
	}
	let c = null, l = null;
	try {
		c = e.getItem("psd_game");
	} catch {}
	try {
		l = e.getItem("psd_routing");
	} catch {}
	let u = l === "google" ? "force-google" : l;
	if (!a) {
		let e = n.map(E), r = (t, n) => e.map((e) => e[t]).find(n);
		i = D({
			game: r("game", (e) => b.has(e)) ?? (b.has(c) ? c : "dbd"),
			mode: r("mode", (e) => x.has(e)) ?? (x.has(u) ? u : "smart"),
			customGame: r("customGame", (e) => typeof e == "string"),
			inputs: r("inputs", Array.isArray),
			resultNames: r("resultNames", Array.isArray)
		}), l && !x.has(u) && t.push("旧ダイレクトモード等は互換性がないため、スマート検索に戻しました。");
	}
	if (a) {
		let e = E(o), t = n.map(E), r = (e, n) => t.map((t) => t[e]).find(n), a = {};
		e.game === void 0 && (a.game = r("game", (e) => b.has(e))), e.mode === void 0 && (a.mode = r("mode", (e) => x.has(e))), e.customGame === void 0 && (a.customGame = r("customGame", (e) => typeof e == "string")), e.inputs === void 0 && (a.inputs = r("inputs", Array.isArray)), e.resultNames === void 0 && (a.resultNames = r("resultNames", Array.isArray));
		for (let e of Object.keys(a)) a[e] === void 0 && delete a[e];
		i = D({
			...i,
			...a
		});
	}
	return i.history = T([...i.history, ...n.flatMap((e) => Array.isArray(e.history) ? e.history : [])]), i.migratedLegacyKeys = [...s], (n.length || !a && (c !== null || l !== null)) && t.push("旧データを読み込みました。元の保存キーは削除していません。"), {
		state: i,
		warnings: t,
		blocked: !1,
		needsSave: a || n.length > 0 || c !== null || l !== null
	};
}
function ie(e, t) {
	try {
		return e.setItem(h, JSON.stringify(D(t))), !0;
	} catch {
		return !1;
	}
}
function ae(e, t, n = w()) {
	e.history = T([...t.map((e) => ({
		id: te(),
		name: e.trim(),
		date: n
	})), ...e.history]);
}
function oe(e) {
	let t = JSON.parse(e), n = v(t?.state) ? t.state : t;
	if (!v(n) || !Array.isArray(E(n).inputs) || !Array.isArray(n.history)) throw Error("P.S.Dのバックアップ形式ではありません。");
	if (n.schemaVersion > m) throw Error("新しい形式のため、この版では読めません。");
	let r = D(n);
	return r.migratedLegacyKeys = [..._], r;
}
var O = (e) => document.getElementById(e);
function k(e, t, n) {
	let r = document.createElement(e);
	return t && (r.className = t), n !== void 0 && (r.textContent = n), r;
}
function A(e, t, n, r) {
	let i = k("button", `button ${t}`, e);
	return i.type = "button", r && i.setAttribute("aria-label", r), i.addEventListener("click", n), i;
}
function se(e, t) {
	let n = k("a", "", e);
	return n.href = t, n.target = "_blank", n.rel = "noopener noreferrer", n.referrerPolicy = "no-referrer", n.addEventListener("click", (e) => {
		let n = new URL(t).hostname, r = fe.get(n) ?? -Infinity;
		if (Date.now() - r < 2e3) {
			e.preventDefault(), K("連続して開く操作を止めました。少し間をあけてください。");
			return;
		}
		fe.set(n, Date.now());
	}), n;
}
var j;
try {
	j = window.localStorage;
} catch {}
var M = re(j), ce = document.querySelector("meta[name=\"psd-api-base\"]")?.content, N = M.state, P = M.blocked ?? !1, le = new URL(ce || "./api/", document.baseURI).href, F, I = 0, L = !1, ue = new Set(M.warnings), de = /* @__PURE__ */ new Map(), R = /* @__PURE__ */ new Set(), z = "psd-shared-routes-v2", B = /* @__PURE__ */ new Map(), V = /* @__PURE__ */ new Map(), fe = /* @__PURE__ */ new Map(), H = a(j), pe = f(j, globalThis.indexedDB), U = 0, me, W = [], G = !1;
try {
	let e = JSON.parse(j?.getItem(z) || "null");
	if (e?.version === p && Array.isArray(e.entries)) for (let t of e.entries.slice(-100)) {
		if (!Number.isFinite(t?.savedAt)) continue;
		let e = r([t])[0];
		e?.routes.length === 6 && (B.set(e.name, e.routes), V.set(e.name, t.savedAt));
	}
} catch {}
function he() {
	for (; B.size > 100;) {
		let e = B.keys().next().value;
		B.delete(e), V.delete(e);
	}
	try {
		j?.setItem(z, JSON.stringify({
			version: p,
			entries: [...B].map(([e, t]) => ({
				name: e,
				routes: t,
				savedAt: V.get(e)
			}))
		}));
	} catch {}
}
function K(e) {
	ue.add(e), O("notice").textContent = [...ue].join("\n"), O("notice").hidden = !1;
}
for (let e of M.warnings) K(e);
function q() {
	if (P) return !1;
	let e = ie(j, N);
	return e || K("端末への保存に失敗しました。入力は画面に残ります。バックアップを書き出してください。"), e;
}
M.needsSave && q();
function J() {
	return T([...N.history, ...W]);
}
function Y({ replace: e = !1 } = {}) {
	let t = U;
	return pe.sync(J(), { replace: e }).then((e) => {
		if (t !== U) return;
		let n = T([...N.history, ...e.entries]);
		if (e.persisted) {
			let e = w();
			W = n.filter((t) => t.date !== e), N.history = n.filter((t) => t.date === e);
		} else N.history = n;
		P || q(), e.persisted || K("日別ファイルを端末に保存できません。履歴の保存ボタンで書き出してください。"), $();
	}).catch(() => K("日別ファイルを保存できません。履歴の保存ボタンで書き出してください。"));
}
P || (O("export").disabled = !0, Y().finally(() => {
	O("export").disabled = !1;
}));
function X() {
	I++;
	for (let e of R) e.path === "routes" && e.controller.abort();
	de.clear();
}
function Z(e) {
	let t = N.inputs.map((e, t) => {
		let n = k("div", "name-row"), r = k("label", "name-label", `プレイヤー${t + 1}`);
		r.htmlFor = `name-${t}`;
		let i = k("input");
		return i.id = `name-${t}`, i.type = "text", i.value = e, i.placeholder = "プレイヤー名を入力", i.maxLength = 256, i.autocomplete = "off", i.spellcheck = !1, i.addEventListener("input", () => {
			N.inputs[t] = i.value, q();
		}), i.addEventListener("keydown", (e) => {
			e.key === "Enter" && !e.isComposing && e.keyCode !== 229 && (e.preventDefault(), ye());
		}), n.append(r, i), N.inputs.length > 1 && n.append(A("×", "remove", () => {
			N.inputs.splice(t, 1), q(), Z(Math.min(t, N.inputs.length - 1));
		}, `プレイヤー${t + 1}の入力欄を削除`)), n;
	});
	O("names-container").replaceChildren(...t), O("slot-count").textContent = `${N.inputs.length} / ${g}`, O("add-player").disabled = N.inputs.length >= g, e !== void 0 && O(`name-${e}`)?.focus();
}
function Q(e = !1) {
	let t = N.resultNames.map((t) => {
		let n = k("article", "player-block knight-result");
		n.append(k("h2", "result-player-name", t));
		let r = k("nav", "media-grid");
		r.setAttribute("aria-label", `${t}の媒体別検索先`);
		for (let n of e ? [] : B.get(t) ?? []) {
			let e = se(n.name, G ? n.broad : n.url);
			e.className = `media-link media-${n.id}`, e.setAttribute("aria-label", `${t}を${n.name}で${!G && n.scope === "dbd" ? "DBD関連検索" : n.scope === "profile" ? "ID・URLを開く・DBD関連未確認" : "検索"}（新しいタブ）`), r.append(e);
		}
		return n.append(r), r.childElementCount || n.append(k("p", "hint", e ? "検索先を準備中…" : "検索ボタンで検索先を準備できます。")), n;
	});
	O("results").replaceChildren(...t), O("expand-search").hidden = e || !N.resultNames.some((e) => B.get(e)?.some((e) => e.broad !== e.url)), O("expand-search").textContent = G ? "DBD関連に戻す" : "検索を広げる", O("expand-search").setAttribute("aria-pressed", String(G));
}
function ge() {
	return matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
}
async function _e(e, t) {
	if (!le) throw Error("APIサーバー未接続です。配布版READMEの設定手順を確認してください。");
	let n = new AbortController(), r = {
		path: e,
		controller: n
	};
	R.add(r);
	let i = setTimeout(() => n.abort(), 12e3);
	try {
		let r = await fetch(new URL(e, le), {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(t),
			signal: n.signal,
			cache: "no-store",
			credentials: "omit",
			referrerPolicy: "no-referrer"
		}), i = H.pause(r.status, r.headers?.get("Retry-After"));
		if (i) throw Error(`${new Date(i).toLocaleString("ja-JP")}まで新規検索の通信を停止します。自動再試行はしません。`);
		let a;
		try {
			a = await r.json();
		} catch {
			throw Error("APIからJSON形式の応答を取得できませんでした。");
		}
		if (!v(a)) throw Error("APIの応答形式が不正です。");
		if (!r.ok) throw Error(typeof a.error == "string" ? a.error : "APIサーバーで取得に失敗しました。");
		return a;
	} catch (e) {
		throw e.name === "AbortError" ? Error("通信が中断されたか、時間内に応答しませんでした。") : e instanceof TypeError ? Error("新しい検索には通信が必要です。入力と履歴は端末に残っています。") : e;
	} finally {
		clearTimeout(i), R.delete(r);
	}
}
async function ve(e, t = {}, n = 8e3) {
	let r = new AbortController(), i = setTimeout(() => r.abort(), n);
	try {
		return await fetch(e, {
			...t,
			signal: r.signal
		});
	} finally {
		clearTimeout(i);
	}
}
async function ye() {
	let e = N.inputs.map((e) => e.trim()).filter(Boolean);
	if (!e.length) {
		K("プレイヤー名を入力してください。"), O("name-0").focus();
		return;
	}
	if (e.some((e) => !S(e))) {
		K("プレイヤー名は256文字以内で入力してください。");
		return;
	}
	if ([...R].some((e) => e.path === "routes")) return;
	X();
	let t = I;
	G = !1, N.resultNames = e, ae(N, e), q(), P || Y();
	let n = [...new Set(e)].filter((e) => {
		let t = Date.now() - (V.get(e) ?? -Infinity);
		return !B.has(e) || t < 0 || t >= 6e5;
	});
	if (!n.length) {
		Q();
		return;
	}
	let i = H.begin();
	if (!i.ok) {
		K(i.reason === "blocked" ? `${new Date(i.until).toLocaleString("ja-JP")}まで新規検索の通信を停止しています。` : "続けての検索を止めました。少し間をあけてください。"), Q();
		return;
	}
	O("search").disabled = !0, Q(!0), O("results").scrollIntoView({
		behavior: ge(),
		block: "start"
	});
	try {
		let e = await _e("routes", { names: n });
		if (e.version !== p) throw Error("検索サーバーの更新中です。時間をおいてお試しください。");
		let i = r(e.results);
		if (i.length !== n.length || i.some((e, t) => e.name !== n[t] || e.routes.length !== 6)) throw Error("検索先の応答形式を確認できませんでした。");
		if (t !== I) return;
		for (let e of i) B.delete(e.name), B.set(e.name, e.routes), V.set(e.name, Date.now());
		v(e.settings) && (N.game = e.settings.game, N.mode = e.settings.mode, N.customGame = e.settings.customGame, q()), he();
	} catch (e) {
		t === I && K(e.message || "新しい検索には通信が必要です。入力と履歴は端末に残っています。");
	} finally {
		H.finish(), O("search").disabled = !1, t === I && Q();
	}
}
function $() {
	let e = O("history-filter").value.toLocaleLowerCase("ja-JP"), t = w(), n = J(), r = n.filter((n) => n.date === t && n.name.toLocaleLowerCase("ja-JP").includes(e)).map((e) => {
		let t = k("div", "history-item"), n = A("", "secondary history-pick", () => {
			X(), N.inputs = [e.name], N.resultNames = [], q(), Z(), Q(), O("history-dialog").close(), O("name-0").focus();
		});
		return n.append(k("span", "", e.name), k("small", "", e.date ?? "日付不明")), t.append(n, A("×", "remove", () => {
			N.history = N.history.filter((t) => t.id !== e.id), W = W.filter((t) => t.id !== e.id), U++, q(), Y({ replace: !0 }), $();
		}, `${e.name}の履歴を1件削除`)), t;
	});
	O("history-list").replaceChildren(...r.length ? r : [k("p", "hint", e ? "一致する当日の履歴はありません。" : "当日の履歴はありません。")]);
	let i = u(n).filter((n) => n.key !== t && JSON.parse(n.text).entries.some((t) => t.name.toLocaleLowerCase("ja-JP").includes(e)));
	O("history-files").replaceChildren(...i.length ? i.map((e) => {
		let t = A("", "secondary history-file", () => xe(e));
		return t.append(k("strong", "", e.filename), k("small", "", `${JSON.parse(e.text).entries.length}件・開く`)), t;
	}) : [k("p", "hint", e ? "一致する日別ファイルはありません。" : "日別ファイルはありません。")]), O("save-today-history").disabled = !n.some((e) => e.date === t);
}
function be(e) {
	if (!e) return;
	let t = new Blob([e.text], { type: "application/json;charset=utf-8" }), n = URL.createObjectURL(t), r = k("a");
	r.href = n, r.download = e.filename, document.body.append(r), r.click(), r.remove(), setTimeout(() => URL.revokeObjectURL(n), 3e4), O("history-file-status").textContent = "ファイルの書き出しを開始しました。保存先を確認してください。";
}
function xe(e) {
	me = e;
	let t = JSON.parse(e.text);
	O("history-file-title").textContent = e.filename, O("history-file-content").textContent = `${t.date ?? "日付不明"}　${t.entries.length}件\n\n${t.entries.map((e) => e.name).join("\n")}`, O("history-file-status").textContent = "", O("history-file-dialog").showModal();
}
function Se() {
	O("app-version").textContent = `v${p}`, O("add-player").addEventListener("click", () => {
		N.inputs.length >= g || (N.inputs.push(""), q(), Z(N.inputs.length - 1));
	}), O("search").addEventListener("click", ye), O("expand-search").addEventListener("click", () => {
		G = !G, Q();
	});
	for (let e of ["data", "history"]) O(`open-${e}`).addEventListener("click", () => {
		e === "history" ? $() : O("history-dialog").close(), O(`${e}-dialog`).showModal();
	}), O(`close-${e}`).addEventListener("click", () => O(`${e}-dialog`).close()), O(`${e}-dialog`).addEventListener("keydown", (e) => {
		if (e.key !== "Tab") return;
		let t = [...e.currentTarget.querySelectorAll("button:not(:disabled),input:not(:disabled),select:not(:disabled),a[href],[tabindex=\"0\"]")].filter((e) => e.getClientRects().length), n = t[0], r = t.at(-1);
		if (!n) {
			e.preventDefault();
			return;
		}
		e.shiftKey && document.activeElement === n ? (e.preventDefault(), r.focus()) : !e.shiftKey && document.activeElement === r && (e.preventDefault(), n.focus());
	});
	if (O("close-history-file").addEventListener("click", () => O("history-file-dialog").close()), O("save-history-file").addEventListener("click", () => be(me)), O("save-today-history").addEventListener("click", () => {
		let e = u(J()).find((e) => e.key === w());
		e && (xe(e), be(e));
	}), addEventListener("focus", $), document.addEventListener?.("visibilitychange", $), typeof document.visibilityState == "string") {
		let e, t = () => {
			clearTimeout(e);
			let n = new Date(Date.now()), r = new Date(n);
			r.setHours(24, 0, 0, 0), e = setTimeout(() => {
				$(), t();
			}, r.getTime() - n.getTime() + 100);
		};
		t();
	}
	O("history-filter").addEventListener("input", $), O("clear-history").addEventListener("click", () => {
		confirm("当日の履歴と日別ファイルをすべて削除しますか？") && (N.history = [], W = [], U++, q(), Y({ replace: !0 }), $());
	}), O("export").addEventListener("click", () => {
		let e = {};
		if (P && j) for (let t of [
			h,
			..._,
			"psd_game",
			"psd_routing"
		]) try {
			let n = j.getItem(t);
			n !== null && (e[t] = n);
		} catch {}
		let t = new Blob([JSON.stringify({
			app: "P.S.D",
			exportedAt: (/* @__PURE__ */ new Date()).toISOString(),
			state: {
				...N,
				history: J()
			},
			...P ? { originalStorage: e } : {}
		}, null, 2)], { type: "application/json" }), n = URL.createObjectURL(t), r = k("a");
		r.href = n, r.download = `PSD-backup-${w()}.json`, document.body.append(r), r.click(), r.remove(), setTimeout(() => URL.revokeObjectURL(n), 3e4), O("storage-status").textContent = "JSONの書き出しを開始しました。ファイルを保管してください。";
	}), O("import").addEventListener("click", () => O("import-file").click()), O("import-file").addEventListener("change", async (e) => {
		let t = e.target.files?.[0];
		if (t) try {
			if (t.size > 2e6) throw Error("2MB以内のJSONを選んでください。");
			let e = oe(await t.text());
			if (!confirm("バックアップの入力・設定・履歴で、このアプリの保存データを置き換えますか？")) return;
			X(), B.clear(), V.clear();
			try {
				j?.removeItem(z);
			} catch {}
			N = e, P = !1, W = [], U++;
			let n = q();
			Y({ replace: !0 }), Z(), Q(), $(), O("storage-status").textContent = n ? "バックアップを読み込み、保存しました。" : "画面には読み込みましたが、端末への保存には失敗しました。";
		} catch (e) {
			O("storage-status").textContent = `読込できません：${e.message}`;
		} finally {
			e.target.value = "";
		}
	}), O("persist").addEventListener("click", async () => {
		try {
			if (!navigator.storage?.persist) {
				O("storage-status").textContent = "この環境は保存領域の保護リクエストに対応していません。バックアップをご利用ください。";
				return;
			}
			let e = await navigator.storage.persist();
			O("storage-status").textContent = e ? "保存領域の保護が許可されました。ユーザーによる削除等には備え、バックアップを続けてください。" : "保存領域の保護は許可されませんでした。バックアップをご利用ください。";
		} catch {
			O("storage-status").textContent = "保存領域の保護を確認できませんでした。";
		}
	}), O("update").addEventListener("click", we);
	let e = /iPad|iPhone|iPod/.test(navigator.userAgent) || /Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1;
	O("install-banner").hidden = !e || navigator.standalone === !0 || matchMedia("(display-mode: standalone)").matches;
	let t = () => {
		O("offline-status").textContent = navigator.onLine ? "オンライン" : "オフライン";
	};
	addEventListener("online", t), addEventListener("offline", t), t();
}
async function Ce() {
	if (!("serviceWorker" in navigator) || !window.isSecureContext) {
		K("この環境ではオフライン起動を準備できません。HTTPSまたはlocalhostを使用してください。");
		return;
	}
	try {
		F = await navigator.serviceWorker.register(new URL("./sw.js", document.baseURI), {
			scope: "./",
			updateViaCache: "none"
		});
		let e = !1;
		navigator.serviceWorker.addEventListener("controllerchange", () => {
			!navigator.serviceWorker.controller || e || L && (e = !0, q(), location.reload());
		}), F.addEventListener("updatefound", () => {
			let e = F.installing;
			e?.addEventListener("statechange", () => {
				e.state === "installed" && navigator.serviceWorker.controller && (O("update-status").textContent = "更新をダウンロードしました。「アプリの更新を確認」で適用できます。");
			});
		});
	} catch {
		K("オフライン用データを準備できませんでした。オンラインの機能は使用できます。");
	}
}
async function we() {
	O("update").disabled = !0, O("update-status").textContent = "更新を確認中…";
	try {
		if (!navigator.onLine) throw Error("オフラインのため更新を確認できません。");
		let e = await ve("./version.json", { cache: "no-store" });
		if (!e.ok) throw Error("バージョン情報を取得できませんでした。");
		let t = await e.json();
		if (!/^\d+\.\d+\.\d+$/.test(t.version)) throw Error("バージョン情報の形式が不正です。");
		if (!F) {
			t.version === p ? O("update-status").textContent = `最新版です（v${p}）。` : O("update-status").textContent = `v${t.version}があります。ページを再読み込みしてください。`;
			return;
		}
		if (await F.update(), F.installing && await new Promise((e) => {
			let t = F.installing, n = setTimeout(e, 1e4);
			t.addEventListener("statechange", () => {
				["installed", "redundant"].includes(t.state) && (clearTimeout(n), e());
			});
		}), F.waiting) {
			if (!q()) throw Error("入力を保存できないため、更新の適用を止めました。先にバックアップを書き出してください。");
			L = !0, F.waiting.postMessage({ type: "DPS_SKIP_WAITING" }), O("update-status").textContent = "このアプリの更新を適用中…", setTimeout(() => {
				L && (O("update-status").textContent = "更新の切替を確認できませんでした。入力を保存してから、もう一度お試しください。");
			}, 15e3);
		} else O("update-status").textContent = t.version === p ? `最新版です（v${p}）。` : `v${t.version}があります。配信が完了してから再度確認してください。`;
	} catch (e) {
		O("update-status").textContent = e instanceof TypeError ? "通信できないため、更新を確認できませんでした。" : e.message || "更新を確認できませんでした。";
	} finally {
		O("update").disabled = !1;
	}
}
Se(), Z(), Q(), Ce();
//#endregion
