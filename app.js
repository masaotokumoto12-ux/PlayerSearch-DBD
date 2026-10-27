//#region lib/history-records.mjs
var e = () => globalThis.crypto?.randomUUID?.() ?? `psd-${Date.now()}-${Math.random().toString(36).slice(2)}`;
function t(e) {
	return Number.isSafeInteger(e) && e >= 1 ? e : 1;
}
function n(e = new Date(Date.now())) {
	return `${e.getFullYear()}-${String(e.getMonth() + 1).padStart(2, "0")}-${String(e.getDate()).padStart(2, "0")}`;
}
function r(e) {
	let t = typeof e == "string" && /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(e);
	if (!t) return null;
	let [, n, r, i] = t.map(Number), a = new Date(Date.UTC(n, r - 1, i));
	return n < 1900 || n > 9999 || a.getUTCFullYear() !== n || a.getUTCMonth() !== r - 1 || a.getUTCDate() !== i ? null : `${n}-${String(r).padStart(2, "0")}-${String(i).padStart(2, "0")}`;
}
function i(n) {
	let i = /* @__PURE__ */ new Map(), a = /* @__PURE__ */ new Set();
	for (let o of Array.isArray(n) ? n : []) {
		let n = o?.name ?? o?.playerName ?? o?.query;
		if (typeof n != "string" || !n.trim() || [...n].length > 256) continue;
		let s = n.trim(), c = r(o.date), l = typeof o.id == "string" || typeof o.id == "number" && Number.isFinite(o.id) ? String(o.id) : "", u = JSON.stringify([
			s,
			c,
			c ? "" : l || e()
		]), d = t(o.count), f = i.get(u);
		if (f) {
			f.count = Math.max(f.count, d);
			continue;
		}
		let p = l;
		(!p || a.has(p)) && (p = e()), a.add(p), i.set(u, {
			id: p,
			name: s,
			date: c,
			count: d
		});
	}
	return [...i.values()].sort((e, t) => (t.date ?? "").localeCompare(e.date ?? ""));
}
function a(t, r, a = n(), o = t.history) {
	let s = new Map(i(o).filter((e) => e.date === a).map((e) => [e.name, e]));
	t.history = i([...[...new Set(r.map((e) => e.trim()).filter(Boolean))].map((t) => {
		let n = s.get(t);
		return {
			id: n?.id ?? e(),
			name: t,
			date: a,
			count: n ? Math.min(2 ** 53 - 1, n.count + 1) : 1
		};
	}), ...t.history]);
}
//#endregion
//#region client/route-cache.mjs
var o = {
	steam: "Steam",
	x: "X (Twitter)",
	youtube: "YouTube",
	twitch: "Twitch",
	tiktok: "TikTok",
	"5ch": "5ちゃんねる"
}, s = {
	steam: ["steamcommunity.com"],
	x: ["x.com", "twitter.com"],
	youtube: ["youtube.com", "youtu.be"],
	twitch: ["twitch.tv"],
	tiktok: ["tiktok.com"],
	"5ch": ["5ch.net", "2ch.sc"]
};
function c(e) {
	if (!Array.isArray(e)) return [];
	let t = /* @__PURE__ */ new Set(), n = [];
	for (let r of e.slice(0, 6)) if (!(!r || !Object.hasOwn(o, r.id) || t.has(r.id) || typeof r.url != "string")) try {
		let e = (e) => {
			let t = new URL(e);
			return t.protocol === "https:" && !t.username && !t.password && !t.port && (r.id === "5ch" && t.hostname === "www.google.com" || s[r.id].some((e) => t.hostname === e || t.hostname.endsWith("." + e))) ? t.href : null;
		}, i = e(r.url);
		if (!i) continue;
		let a = typeof r.broad == "string" ? e(r.broad) : i;
		if (!a) continue;
		t.add(r.id), n.push({
			id: r.id,
			name: o[r.id],
			url: i,
			broad: a,
			scope: [
				"dbd",
				"profile",
				"name"
			].includes(r.scope) ? r.scope : "name"
		});
	} catch {}
	return n;
}
function l(e) {
	return Array.isArray(e) ? e.slice(0, 4).filter((e) => e && typeof e.name == "string" && e.name.length <= 512).map((e) => ({
		name: e.name,
		routes: c(e.routes)
	})) : [];
}
//#endregion
//#region client/search-guard.mjs
var u = "psd-search-backoff-v1";
function d(e, t = () => Date.now()) {
	let n = 0, r = !1, i = -Infinity;
	try {
		let r = Number(e?.getItem(u));
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
			} : t() - i < 2e3 ? {
				ok: !1,
				reason: "gap"
			} : (r = !0, i = t(), { ok: !0 });
		},
		finish() {
			r = !1;
		},
		pause(r, i) {
			if (![403, 429].includes(r)) return 0;
			let a = r === 429 ? 3600 * 1e3 : 360 * 60 * 1e3, o = /^\d+$/.test(i || "") ? t() + Number(i) * 1e3 : Date.parse(i || "");
			n = Math.max(n, t() + a, Number.isFinite(o) ? o : 0);
			try {
				e?.setItem(u, String(n));
			} catch {}
			return n;
		}
	};
}
//#endregion
//#region client/history-files.mjs
var f = "psd-history-day-v1", p = "psd-history-files-v1", m = "undated";
function h(e) {
	let t = /* @__PURE__ */ new Map();
	for (let n of i(e)) {
		let e = n.date || m;
		t.has(e) || t.set(e, []), t.get(e).push(n);
	}
	return [...t].sort(([e], [t]) => e === m ? 1 : t === m ? -1 : t.localeCompare(e)).map(([e, t]) => ({
		key: e,
		filename: `PSD-history-${e}.json`,
		text: JSON.stringify({
			app: "P.S.D",
			format: f,
			date: e === m ? null : e,
			entries: t
		}, null, 2)
	}));
}
function g(e) {
	return (Array.isArray(e) ? e : []).flatMap((e) => {
		try {
			let t = JSON.parse(e.text);
			return t.app === "P.S.D" && t.format === f && Array.isArray(t.entries) ? t.entries : [];
		} catch {
			return [];
		}
	});
}
function ee(e, t) {
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
			let t = JSON.parse(e?.getItem(p) || "[]");
			return {
				entries: g(Array.isArray(t) ? t : t.files),
				replace: t?.replace === !0
			};
		} catch {
			return {
				entries: [],
				replace: !1
			};
		}
	}
	async function s(t, n) {
		let r = [...t], s = o(), c = n;
		n ||= s.replace;
		let l = c ? [] : s.replace ? s.entries : [...i, ...s.entries], u;
		try {
			let t = await a();
			u = await new Promise((e, i) => {
				let a = t.transaction("files", "readwrite"), o = a.objectStore("files"), s, c = o.getAll();
				c.onsuccess = () => {
					s = h([
						...r,
						...l,
						...n ? [] : g(c.result)
					]), n && o.clear();
					let e = new Map(c.result.map((e) => [e.key, e.text]));
					for (let t of s) (n || e.get(t.key) !== t.text) && o.put(t);
				}, a.oncomplete = () => e(s), a.onerror = a.onabort = () => i(a.error || /* @__PURE__ */ Error("History transaction failed"));
			});
			try {
				e?.removeItem(p);
			} catch {}
		} catch {
			u = h([...r, ...l]);
			try {
				if (!e) throw Error();
				e.setItem(p, JSON.stringify({
					files: u,
					replace: n
				}));
			} catch {
				return i = g(u), {
					files: u,
					entries: i,
					persisted: !1
				};
			}
		}
		return i = g(u), {
			files: u,
			entries: i,
			persisted: !0
		};
	}
	return { sync(e, { replace: t = !1 } = {}) {
		let n = [...e], i = r.then(() => s(n, t));
		return r = i.catch(() => {}), i;
	} };
}
//#endregion
//#region client/app.js
var _ = "3.5.1", v = "3.5.4", y = 4, te = "psd-core-v4", b = 4, ne = 256, x = Object.freeze([
	"dps-state",
	"dps-core-v6",
	"psd-core-v3",
	"player-check-pro-v2",
	"player-check-v3",
	"psd_history"
]), S = (e) => e && typeof e == "object" && !Array.isArray(e), C = (e) => {
	if (typeof e.isWellFormed == "function") return e.isWellFormed();
	try {
		return !0;
	} catch {
		return !1;
	}
}, w = new Set([
	"dbd",
	"apex",
	"valorant",
	"other",
	""
]), T = new Set(["smart", "force-google"]), re = (e) => typeof e == "string" && e.trim().length > 0 && [...e].length <= ne && C(e);
function ie() {
	return {
		schemaVersion: y,
		game: "dbd",
		customGame: "",
		mode: "smart",
		inputs: [""],
		resultNames: [],
		history: [],
		migratedLegacyKeys: []
	};
}
function E(e) {
	let t = S(e?.settings) ? e.settings : {};
	return {
		game: e?.game ?? e?.gameTitle ?? e?.gameSelect ?? t.game,
		mode: e?.mode ?? e?.searchMode ?? e?.routing ?? t.routing,
		customGame: e?.customGame ?? e?.gameCustom ?? t.customGame,
		inputs: e?.inputs ?? e?.players ?? e?.names ?? e?.nameSlots,
		resultNames: e?.resultNames ?? e?.results
	};
}
function D(e) {
	let t = ie();
	if (!S(e)) return t;
	let n = E(e);
	return w.has(n.game) && (t.game = n.game), T.has(n.mode) && (t.mode = n.mode), typeof n.customGame == "string" && [...n.customGame].length <= 80 && C(n.customGame) && (t.customGame = n.customGame), Array.isArray(n.inputs) && (t.inputs = n.inputs.filter((e) => typeof e == "string" && [...e].length <= ne && C(e)).slice(0, b), t.inputs.length || (t.inputs = [""])), Array.isArray(n.resultNames) && (t.resultNames = n.resultNames.map((e) => typeof e == "string" ? e : S(e) ? e.playerName ?? e.name : null).filter(re).slice(0, b).map((e) => e.trim())), t.history = i(e.history), t.migratedLegacyKeys = Array.isArray(e.migratedLegacyKeys) ? [...new Set(e.migratedLegacyKeys.filter((e) => x.includes(e)))] : [], e.migratedLegacyHistory === !0 && !t.migratedLegacyKeys.includes("psd_history") && t.migratedLegacyKeys.push("psd_history"), t;
}
function ae(e) {
	let t = [], n = [], r;
	try {
		r = e.getItem(te);
	} catch {
		return {
			state: ie(),
			warnings: ["保存領域を読み込めません。入力は画面に保持します。"],
			needsSave: !1
		};
	}
	let a = ie(), o = !1, s;
	if (r != null) try {
		let e = JSON.parse(r);
		if (!S(e)) throw Error();
		if (e.schemaVersion > y) return {
			state: a,
			warnings: ["新しい形式の保存データがあります。上書き防止のため保存を停止しています。"],
			blocked: !0,
			needsSave: !1
		};
		a = D(e), o = !0, s = e;
	} catch {
		return {
			state: a,
			warnings: ["保存JSONが壊れています。元データを残し、上書き保存を停止しました。バックアップの読込で復旧できます。"],
			blocked: !0,
			needsSave: !1
		};
	}
	let c = new Set(a.migratedLegacyKeys);
	for (let r of x) if (!c.has(r)) try {
		let t = e.getItem(r);
		if (t != null) {
			let e = JSON.parse(t);
			if (r === "psd_history") {
				if (!Array.isArray(e)) throw Error();
				n.push({ history: e });
			} else {
				if (!S(e) || r === "player-check-v3" && !Array.isArray(e.nameSlots)) throw Error();
				n.push(e);
			}
		}
		c.add(r);
	} catch {
		t.push(`${r} は読み込めません。元データは残しています。`);
	}
	let l = null, u = null;
	try {
		l = e.getItem("psd_game");
	} catch {}
	try {
		u = e.getItem("psd_routing");
	} catch {}
	let d = u === "google" ? "force-google" : u;
	if (!o) {
		let e = n.map(E), r = (t, n) => e.map((e) => e[t]).find(n);
		a = D({
			game: r("game", (e) => w.has(e)) ?? (w.has(l) ? l : "dbd"),
			mode: r("mode", (e) => T.has(e)) ?? (T.has(d) ? d : "smart"),
			customGame: r("customGame", (e) => typeof e == "string"),
			inputs: r("inputs", Array.isArray),
			resultNames: r("resultNames", Array.isArray)
		}), u && !T.has(d) && t.push("旧ダイレクトモード等は互換性がないため、スマート検索に戻しました。");
	}
	if (o) {
		let e = E(s), t = n.map(E), r = (e, n) => t.map((t) => t[e]).find(n), i = {};
		e.game === void 0 && (i.game = r("game", (e) => w.has(e))), e.mode === void 0 && (i.mode = r("mode", (e) => T.has(e))), e.customGame === void 0 && (i.customGame = r("customGame", (e) => typeof e == "string")), e.inputs === void 0 && (i.inputs = r("inputs", Array.isArray)), e.resultNames === void 0 && (i.resultNames = r("resultNames", Array.isArray));
		for (let e of Object.keys(i)) i[e] === void 0 && delete i[e];
		a = D({
			...a,
			...i
		});
	}
	return a.history = i([...a.history, ...n.flatMap((e) => Array.isArray(e.history) ? e.history : [])]), a.migratedLegacyKeys = [...c], (n.length || !o && (l !== null || u !== null)) && t.push("旧データを読み込みました。元の保存キーは削除していません。"), {
		state: a,
		warnings: t,
		blocked: !1,
		needsSave: o || n.length > 0 || l !== null || u !== null
	};
}
function oe(e, t) {
	try {
		return e.setItem(te, JSON.stringify(D(t))), !0;
	} catch {
		return !1;
	}
}
function se(e) {
	let t = JSON.parse(e), n = S(t?.state) ? t.state : t;
	if (!S(n) || !Array.isArray(E(n).inputs) || !Array.isArray(n.history)) throw Error("P.S.Dのバックアップ形式ではありません。");
	if (n.schemaVersion > y) throw Error("新しい形式のため、この版では読めません。");
	let r = D(n);
	return r.migratedLegacyKeys = [...x], r;
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
function ce(e, t) {
	let n = k("a", "", e);
	return n.href = t, n.target = "_blank", n.rel = "noopener noreferrer", n.referrerPolicy = "no-referrer", n.addEventListener("click", (e) => {
		let n = new URL(t).hostname, r = pe.get(n) ?? -Infinity;
		if (Date.now() - r < 2e3) {
			e.preventDefault(), q("連続して開く操作を止めました。少し間をあけてください。");
			return;
		}
		pe.set(n, Date.now());
	}), n;
}
var j;
try {
	j = window.localStorage;
} catch {}
var M = ae(j), le = document.querySelector("meta[name=\"psd-api-base\"]")?.content, N = M.state, P = M.blocked ?? !1, ue = new URL(le || "./api/", document.baseURI).href, F, I = 0, L = !1, de = new Set(M.warnings), fe = /* @__PURE__ */ new Map(), R = /* @__PURE__ */ new Set(), z = "psd-shared-routes-v2", B = /* @__PURE__ */ new Map(), V = /* @__PURE__ */ new Map(), pe = /* @__PURE__ */ new Map(), H = d(j), me = ee(j, globalThis.indexedDB), U = 0, he, W = [], ge = P, _e, G = !1;
try {
	let e = JSON.parse(j?.getItem(z) || "null");
	if (e?.version === _ && Array.isArray(e.entries)) for (let t of e.entries.slice(-100)) {
		if (!Number.isFinite(t?.savedAt)) continue;
		let e = l([t])[0];
		e?.routes.length === 6 && (B.set(e.name, e.routes), V.set(e.name, t.savedAt));
	}
} catch {}
function ve() {
	for (; B.size > 100;) {
		let e = B.keys().next().value;
		B.delete(e), V.delete(e);
	}
	try {
		j?.setItem(z, JSON.stringify({
			version: _,
			entries: [...B].map(([e, t]) => ({
				name: e,
				routes: t,
				savedAt: V.get(e)
			}))
		}));
	} catch {}
}
function q(e) {
	de.add(e), O("notice").textContent = [...de].join("\n"), O("notice").hidden = !1;
}
for (let e of M.warnings) q(e);
function J() {
	if (P) return !1;
	let e = oe(j, N);
	return e || q("端末への保存に失敗しました。入力は画面に残ります。バックアップを書き出してください。"), e;
}
M.needsSave && J();
function Y() {
	return i([...N.history, ...W]);
}
function X({ replace: e = !1 } = {}) {
	let t = U;
	return me.sync(Y(), { replace: e }).then((e) => {
		if (t !== U) return;
		let r = i([...N.history, ...e.entries]);
		if (e.persisted) {
			let e = n();
			W = r.filter((t) => t.date !== e), N.history = r.filter((t) => t.date === e);
		} else N.history = r;
		P || J(), e.persisted || q("履歴を端末内に保存できません。バックアップを書き出してください。"), $();
	}).catch(() => q("履歴を保存できません。バックアップを書き出してください。"));
}
P || (O("export").disabled = !0, O("search").disabled = !0, _e = X().finally(() => {
	ge = !0, O("export").disabled = !1, O("search").disabled = !1;
}));
function ye() {
	I++;
	for (let e of R) e.path === "routes" && e.controller.abort();
	fe.clear();
}
function Z(e) {
	let t = N.inputs.map((e, t) => {
		let n = k("div", "name-row"), r = k("label", "name-label", `プレイヤー${t + 1}`);
		r.htmlFor = `name-${t}`;
		let i = k("input"), field = k("div", "name-field"), clear = A("消去", "clear-name", () => {
			N.inputs[t] = "", i.value = "", clear.disabled = !0, J(), i.focus();
		}, `プレイヤー${t + 1}の名前を消去`);
		clear.id = `clear-name-${t}`, clear.disabled = !e.length;
		return i.id = `name-${t}`, i.type = "text", i.value = e, i.placeholder = "プレイヤー名を入力", i.maxLength = 256, i.autocomplete = "off", i.spellcheck = !1, i.addEventListener("input", () => {
			N.inputs[t] = i.value, clear.disabled = !i.value.length, J();
		}), i.addEventListener("keydown", (e) => {
			e.key === "Enter" && !e.isComposing && e.keyCode !== 229 && (e.preventDefault(), Ce());
		}), field.append(i, clear), n.append(r, field), N.inputs.length > 1 && n.append(A("×", "remove", () => {
			N.inputs.splice(t, 1), J(), Z(Math.min(t, N.inputs.length - 1));
		}, `プレイヤー${t + 1}の入力欄を削除`)), n;
	});
	O("names-container").replaceChildren(...t), O("slot-count").textContent = `${N.inputs.length} / ${b}`, O("add-player").disabled = N.inputs.length >= b, e !== void 0 && O(`name-${e}`)?.focus();
}
function Q(e = !1) {
	let t = N.resultNames.map((t) => {
		let n = k("article", "player-block knight-result");
		n.append(k("h2", "result-player-name", t));
		// The legacy routes API returns destinations, not discovered accounts.
		// Even scope=profile can be derived from user input and proves no existence.
		n.append(k("p", "hint", e ? "検索の応答を待っています…" : B.has(t) ? "候補アカウントは未取得です。現在、内部検索は利用できません。" : "候補アカウントは未取得です。"));
		return n;
	});
	O("results").replaceChildren(...t);
}
function be() {
	return matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
}
async function xe(e, t) {
	if (!ue) throw Error("APIサーバー未接続です。配布版READMEの設定手順を確認してください。");
	let n = new AbortController(), r = {
		path: e,
		controller: n
	};
	R.add(r);
	let i = setTimeout(() => n.abort(), 12e3);
	try {
		let r = await fetch(new URL(e, ue), {
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
		if (!S(a)) throw Error("APIの応答形式が不正です。");
		if (!r.ok) throw Error(typeof a.error == "string" ? a.error : "APIサーバーで取得に失敗しました。");
		return a;
	} catch (e) {
		throw e.name === "AbortError" ? Error("通信が中断されたか、時間内に応答しませんでした。") : e instanceof TypeError ? Error("新しい検索には通信が必要です。入力と履歴は端末に残っています。") : e;
	} finally {
		clearTimeout(i), R.delete(r);
	}
}
async function Se(e, t = {}, n = 8e3) {
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
async function Ce() {
	if (!ge) {
		if (G) return;
		G = !0;
		try {
			await _e;
		} finally {
			G = !1;
		}
	}
	let e = N.inputs.map((e) => e.trim()).filter(Boolean);
	if (!e.length) {
		q("プレイヤー名を入力してください。"), O("name-0").focus();
		return;
	}
	if (e.some((e) => !re(e))) {
		q("プレイヤー名は256文字以内で入力してください。");
		return;
	}
	if ([...R].some((e) => e.path === "routes")) return;
	ye();
	let t = I;
	N.resultNames = [...new Set(e)];
	let r = [...new Set(e)].filter((e) => {
		let t = Date.now() - (V.get(e) ?? -Infinity);
		return !B.has(e) || t < 0 || t >= 6e5;
	}), i = () => {
		a(N, e, n(), Y()), J(), P || X();
	};
	if (!r.length) {
		i(), Q();
		return;
	}
	let o = H.begin();
	if (!o.ok) {
		q(o.reason === "blocked" ? `${new Date(o.until).toLocaleString("ja-JP")}まで新規検索の通信を停止しています。` : "続けての検索を止めました。少し間をあけてください。"), J(), Q();
		return;
	}
	i(), O("search").disabled = !0, Q(!0), O("results").scrollIntoView({
		behavior: be(),
		block: "start"
	});
	try {
		let e = await xe("routes", { names: r });
		if (e.version !== _) throw Error("検索サーバーの更新中です。時間をおいてお試しください。");
		let n = l(e.results);
		if (n.length !== r.length || n.some((e, t) => e.name !== r[t] || e.routes.length !== 6)) throw Error("検索先の応答形式を確認できませんでした。");
		if (t !== I) return;
		for (let e of n) B.delete(e.name), B.set(e.name, e.routes), V.set(e.name, Date.now());
		S(e.settings) && (N.game = e.settings.game, N.mode = e.settings.mode, N.customGame = e.settings.customGame, J()), ve();
	} catch (e) {
		t === I && q(e.message || "新しい検索には通信が必要です。入力と履歴は端末に残っています。");
	} finally {
		H.finish(), O("search").disabled = !1, t === I && Q();
	}
}
function $() {
	let e = O("history-filter").value.toLocaleLowerCase("ja-JP"), t = h(Y()).filter((t) => JSON.parse(t.text).entries.some((t) => t.name.toLocaleLowerCase("ja-JP").includes(e)));
	O("history-days").replaceChildren(...t.length ? t.map((e) => {
		let t = A("", "secondary history-day", () => Ee(e.key));
		return t.append(k("strong", "", we(e.key)), k("small", "", `${JSON.parse(e.text).entries.length}名`)), t;
	}) : [k("p", "hint", e ? "一致する履歴はありません。" : "履歴はありません。")]), O("history-day-dialog").open && Te();
}
function we(e) {
	if (e === "undated") return "日付不明";
	let [t, n, r] = e.split("-").map(Number);
	return `${t}年${n}月${r}日`;
}
function Te() {
	let e = he;
	O("history-day-title").textContent = `${we(e)}の検索履歴`;
	let r = Y().filter((t) => (t.date || "undated") === e).map((e) => {
		let r = k("div", "history-item"), i = A("", "secondary history-pick", () => {
			ye(), N.inputs = [e.name], N.resultNames = [], J(), Z(), Q(), O("history-day-dialog").close(), O("history-dialog").close(), O("name-0").focus();
		});
		return i.append(k("span", "", e.name)), t(e.count) >= 2 && i.append(k("small", "repeat-search", `${e.count}回目の検索`)), r.append(i), e.date === n() && r.append(A("×", "remove", () => {
			N.history = N.history.filter((t) => t.id !== e.id), W = W.filter((t) => t.id !== e.id), U++, J(), X({ replace: !0 }), $();
		}, `${e.name}の履歴を1件削除`)), r;
	});
	O("history-day-list").replaceChildren(...r.length ? r : [k("p", "hint", "この日の履歴はありません。")]);
}
function Ee(e) {
	he = e, Te(), O("history-day-dialog").showModal();
}
function De() {
	O("app-version").textContent = `v${v}`, O("add-player").addEventListener("click", () => {
		N.inputs.length >= b || (N.inputs.push(""), J(), Z(N.inputs.length - 1));
	}), O("search").addEventListener("click", Ce);
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
	if (O("close-history-day").addEventListener("click", () => O("history-day-dialog").close()), addEventListener("focus", $), document.addEventListener?.("visibilitychange", $), typeof document.visibilityState == "string") {
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
		confirm("すべての日付の検索履歴を削除しますか？") && (N.history = [], W = [], U++, J(), X({ replace: !0 }), $());
	}), O("export").addEventListener("click", () => {
		let e = {};
		if (P && j) for (let t of [
			te,
			...x,
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
				history: Y()
			},
			...P ? { originalStorage: e } : {}
		}, null, 2)], { type: "application/json" }), r = URL.createObjectURL(t), i = k("a");
		i.href = r, i.download = `PSD-backup-${n()}.json`, document.body.append(i), i.click(), i.remove(), setTimeout(() => URL.revokeObjectURL(r), 3e4), O("storage-status").textContent = "JSONの書き出しを開始しました。ファイルを保管してください。";
	}), O("import").addEventListener("click", () => O("import-file").click()), O("import-file").addEventListener("change", async (e) => {
		let t = e.target.files?.[0];
		if (t) try {
			O("storage-status").textContent = "バックアップを確認しています…";
			let e = se(await t.text());
			if (!confirm("バックアップの入力・設定・履歴で、このアプリの保存データを置き換えますか？")) return;
			ye(), B.clear(), V.clear();
			try {
				j?.removeItem(z);
			} catch {}
			N = e, P = !1, W = [], U++;
			let n = J();
			X({ replace: !0 }), Z(), Q(), $(), O("storage-status").textContent = n ? "バックアップを読み込み、保存しました。" : "画面には読み込みましたが、端末への保存には失敗しました。";
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
	}), O("update").addEventListener("click", ke);
	let e = /iPad|iPhone|iPod/.test(navigator.userAgent) || /Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1;
	O("install-banner").hidden = !e || navigator.standalone === !0 || matchMedia("(display-mode: standalone)").matches;
	let t = () => {
		O("offline-status").textContent = navigator.onLine ? "オンライン" : "オフライン";
	};
	addEventListener("online", t), addEventListener("offline", t), t();
}
async function Oe() {
	if (!("serviceWorker" in navigator) || !window.isSecureContext) {
		q("この環境ではオフライン起動を準備できません。HTTPSまたはlocalhostを使用してください。");
		return;
	}
	try {
		F = await navigator.serviceWorker.register(new URL("./sw.js", document.baseURI), {
			scope: "./",
			updateViaCache: "none"
		});
		let e = !1;
		navigator.serviceWorker.addEventListener("controllerchange", () => {
			!navigator.serviceWorker.controller || e || L && (e = !0, J(), location.reload());
		}), F.addEventListener("updatefound", () => {
			let e = F.installing;
			e?.addEventListener("statechange", () => {
				e.state === "installed" && navigator.serviceWorker.controller && (O("update-status").textContent = "更新をダウンロードしました。「アプリの更新を確認」で適用できます。");
			});
		});
	} catch {
		q("オフライン用データを準備できませんでした。オンラインの機能は使用できます。");
	}
}
async function ke() {
	O("update").disabled = !0, O("update-status").textContent = "更新を確認中…";
	try {
		if (!navigator.onLine) throw Error("オフラインのため更新を確認できません。");
		let e = await Se("./version.json", { cache: "no-store" });
		if (!e.ok) throw Error("バージョン情報を取得できませんでした。");
		let t = await e.json();
		if (!/^\d+\.\d+\.\d+$/.test(t.version)) throw Error("バージョン情報の形式が不正です。");
		if (!F) {
			t.version === v ? O("update-status").textContent = `最新版です（v${v}）。` : O("update-status").textContent = `v${t.version}があります。ページを再読み込みしてください。`;
			return;
		}
		if (await F.update(), F.installing && await new Promise((e) => {
			let t = F.installing, n = setTimeout(e, 1e4);
			t.addEventListener("statechange", () => {
				["installed", "redundant"].includes(t.state) && (clearTimeout(n), e());
			});
		}), F.waiting) {
			if (!J()) throw Error("入力を保存できないため、更新の適用を止めました。先にバックアップを書き出してください。");
			L = !0, F.waiting.postMessage({ type: "DPS_SKIP_WAITING" }), O("update-status").textContent = "このアプリの更新を適用中…", setTimeout(() => {
				L && (O("update-status").textContent = "更新の切替を確認できませんでした。入力を保存してから、もう一度お試しください。");
			}, 15e3);
		} else O("update-status").textContent = t.version === v ? `最新版です（v${v}）。` : `v${t.version}があります。配信が完了してから再度確認してください。`;
	} catch (e) {
		O("update-status").textContent = e instanceof TypeError ? "通信できないため、更新を確認できませんでした。" : e.message || "更新を確認できませんでした。";
	} finally {
		O("update").disabled = !1;
	}
}
De(), Z(), Q(), Oe();
//#endregion
