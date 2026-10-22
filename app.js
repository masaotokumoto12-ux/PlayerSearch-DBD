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
			return n.protocol === "https:" && !n.username && !n.password && !n.port && (n.hostname === "www.google.com" || t[a.id].some((e) => n.hostname === e || n.hostname.endsWith("." + e))) ? n.href : null;
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
//#region client/app.js
var o = "3.4.6", s = 4, c = "psd-core-v4", l = 4, u = 256, d = Object.freeze([
	"dps-state",
	"dps-core-v6",
	"psd-core-v3",
	"player-check-pro-v2",
	"psd_history"
]), f = (e) => e && typeof e == "object" && !Array.isArray(e), p = (e) => {
	if (typeof e.isWellFormed == "function") return e.isWellFormed();
	try {
		return !0;
	} catch {
		return !1;
	}
}, m = new Set([
	"dbd",
	"apex",
	"valorant",
	"other",
	""
]), h = new Set(["smart", "force-google"]), g = () => globalThis.crypto?.randomUUID?.() ?? `dps-${Date.now()}-${Math.random().toString(36).slice(2)}`, _ = (e) => typeof e == "string" && e.trim().length > 0 && [...e].length <= u && p(e);
function v() {
	return {
		schemaVersion: s,
		game: "dbd",
		customGame: "",
		mode: "smart",
		inputs: [""],
		resultNames: [],
		history: [],
		migratedLegacyKeys: []
	};
}
function y(e = /* @__PURE__ */ new Date()) {
	return `${e.getFullYear()}-${String(e.getMonth() + 1).padStart(2, "0")}-${String(e.getDate()).padStart(2, "0")}`;
}
function b(e) {
	if (typeof e != "string") return null;
	let t = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(e);
	if (!t) return null;
	let [, n, r, i] = t.map(Number);
	if (n < 1900 || n > 9999) return null;
	let a = new Date(Date.UTC(n, r - 1, i));
	return a.getUTCFullYear() === n && a.getUTCMonth() === r - 1 && a.getUTCDate() === i ? `${n}-${String(r).padStart(2, "0")}-${String(i).padStart(2, "0")}` : null;
}
function x(e) {
	let t = /* @__PURE__ */ new Set(), n = /* @__PURE__ */ new Set();
	return (Array.isArray(e) ? e : []).filter((e) => f(e) && _(e.name ?? e.playerName ?? e.query)).map((e, t) => ({
		...e,
		name: (e.name ?? e.playerName ?? e.query).trim(),
		date: b(e.date),
		order: t
	})).sort((e, t) => (t.date ?? "").localeCompare(e.date ?? "") || e.order - t.order).filter((e) => {
		if (!e.date) return !0;
		let n = JSON.stringify([e.name, e.date]);
		return t.has(n) ? !1 : (t.add(n), !0);
	}).slice(0, 100).map((e) => {
		let t = typeof e.id == "string" || typeof e.id == "number" && Number.isFinite(e.id) ? String(e.id) : "";
		return (!t || n.has(t)) && (t = g()), n.add(t), {
			id: t,
			name: e.name,
			date: e.date
		};
	});
}
function S(e) {
	let t = f(e?.settings) ? e.settings : {};
	return {
		game: e?.game ?? e?.gameTitle ?? e?.gameSelect ?? t.game,
		mode: e?.mode ?? e?.searchMode ?? e?.routing ?? t.routing,
		customGame: e?.customGame ?? e?.gameCustom ?? t.customGame,
		inputs: e?.inputs ?? e?.players ?? e?.names,
		resultNames: e?.resultNames ?? e?.results
	};
}
function C(e) {
	let t = v();
	if (!f(e)) return t;
	let n = S(e);
	return m.has(n.game) && (t.game = n.game), h.has(n.mode) && (t.mode = n.mode), typeof n.customGame == "string" && [...n.customGame].length <= 80 && p(n.customGame) && (t.customGame = n.customGame), Array.isArray(n.inputs) && (t.inputs = n.inputs.filter((e) => typeof e == "string" && [...e].length <= u && p(e)).slice(0, l), t.inputs.length || (t.inputs = [""])), Array.isArray(n.resultNames) && (t.resultNames = n.resultNames.map((e) => typeof e == "string" ? e : f(e) ? e.playerName ?? e.name : null).filter(_).slice(0, l).map((e) => e.trim())), t.history = x(e.history), t.migratedLegacyKeys = Array.isArray(e.migratedLegacyKeys) ? [...new Set(e.migratedLegacyKeys.filter((e) => d.includes(e)))] : [], e.migratedLegacyHistory === !0 && !t.migratedLegacyKeys.includes("psd_history") && t.migratedLegacyKeys.push("psd_history"), t;
}
function ee(e) {
	let t = [], n = [], r;
	try {
		r = e.getItem(c);
	} catch {
		return {
			state: v(),
			warnings: ["保存領域を読み込めません。入力は画面に保持します。"],
			needsSave: !1
		};
	}
	let i = v(), a = !1, o;
	if (r != null) try {
		let e = JSON.parse(r);
		if (!f(e)) throw Error();
		if (e.schemaVersion > s) return {
			state: i,
			warnings: ["新しい形式の保存データがあります。上書き防止のため保存を停止しています。"],
			blocked: !0,
			needsSave: !1
		};
		i = C(e), a = !0, o = e;
	} catch {
		return {
			state: i,
			warnings: ["保存JSONが壊れています。元データを残し、上書き保存を停止しました。バックアップの読込で復旧できます。"],
			blocked: !0,
			needsSave: !1
		};
	}
	let l = new Set(i.migratedLegacyKeys);
	for (let r of d) if (!l.has(r)) try {
		let t = e.getItem(r);
		if (t != null) {
			let e = JSON.parse(t);
			if (r === "psd_history") {
				if (!Array.isArray(e)) throw Error();
				n.push({ history: e });
			} else {
				if (!f(e)) throw Error();
				n.push(e);
			}
		}
		l.add(r);
	} catch {
		t.push(`${r} は読み込めません。元データは残しています。`);
	}
	let u = null, p = null;
	try {
		u = e.getItem("psd_game");
	} catch {}
	try {
		p = e.getItem("psd_routing");
	} catch {}
	let g = p === "google" ? "force-google" : p;
	if (!a) {
		let e = n.map(S), r = (t, n) => e.map((e) => e[t]).find(n);
		i = C({
			game: r("game", (e) => m.has(e)) ?? (m.has(u) ? u : "dbd"),
			mode: r("mode", (e) => h.has(e)) ?? (h.has(g) ? g : "smart"),
			customGame: r("customGame", (e) => typeof e == "string"),
			inputs: r("inputs", Array.isArray),
			resultNames: r("resultNames", Array.isArray)
		}), p && !h.has(g) && t.push("旧ダイレクトモード等は互換性がないため、スマート検索に戻しました。");
	}
	if (a) {
		let e = S(o), t = n.map(S), r = (e, n) => t.map((t) => t[e]).find(n), a = {};
		e.game === void 0 && (a.game = r("game", (e) => m.has(e))), e.mode === void 0 && (a.mode = r("mode", (e) => h.has(e))), e.customGame === void 0 && (a.customGame = r("customGame", (e) => typeof e == "string")), e.inputs === void 0 && (a.inputs = r("inputs", Array.isArray)), e.resultNames === void 0 && (a.resultNames = r("resultNames", Array.isArray));
		for (let e of Object.keys(a)) a[e] === void 0 && delete a[e];
		i = C({
			...i,
			...a
		});
	}
	return i.history = x([...i.history, ...n.flatMap((e) => Array.isArray(e.history) ? e.history : [])]), i.migratedLegacyKeys = [...l], (n.length || !a && (u !== null || p !== null)) && t.push("旧データを読み込みました。元の保存キーは削除していません。"), {
		state: i,
		warnings: t,
		blocked: !1,
		needsSave: a || n.length > 0 || u !== null || p !== null
	};
}
function w(e, t) {
	try {
		return e.setItem(c, JSON.stringify(C(t))), !0;
	} catch {
		return !1;
	}
}
function te(e, t, n = y()) {
	e.history = x([...t.map((e) => ({
		id: g(),
		name: e.trim(),
		date: n
	})), ...e.history]);
}
function ne(e) {
	let t = JSON.parse(e), n = f(t?.state) ? t.state : t;
	if (!f(n) || !Array.isArray(S(n).inputs) || !Array.isArray(n.history)) throw Error("P.S.Dのバックアップ形式ではありません。");
	if (n.schemaVersion > s) throw Error("新しい形式のため、この版では読めません。");
	let r = C(n);
	return r.migratedLegacyKeys = [...d], r;
}
var T = (e) => document.getElementById(e);
function E(e, t, n) {
	let r = document.createElement(e);
	return t && (r.className = t), n !== void 0 && (r.textContent = n), r;
}
function D(e, t, n, r) {
	let i = E("button", `button ${t}`, e);
	return i.type = "button", r && i.setAttribute("aria-label", r), i.addEventListener("click", n), i;
}
function O(e, t) {
	let n = E("a", "", e);
	return n.href = t, n.target = "_blank", n.rel = "noopener noreferrer", n.referrerPolicy = "no-referrer", n.addEventListener("click", (e) => {
		let n = new URL(t).hostname, r = U.get(n) ?? -Infinity;
		if (Date.now() - r < 2e3) {
			e.preventDefault(), q("連続して開く操作を止めました。少し間をあけてください。");
			return;
		}
		U.set(n, Date.now());
	}), n;
}
var k;
try {
	k = window.localStorage;
} catch {}
var A = ee(k), j = document.querySelector("meta[name=\"psd-api-base\"]")?.content, M = A.state, N = A.blocked ?? !1, P = new URL(j || "./api/", document.baseURI).href, F, I = 0, L = !1, R = new Set(A.warnings), re = /* @__PURE__ */ new Map(), z = /* @__PURE__ */ new Set(), B = "psd-shared-routes-v2", V = /* @__PURE__ */ new Map(), H = /* @__PURE__ */ new Map(), U = /* @__PURE__ */ new Map(), W = a(k), G = !1;
try {
	let e = JSON.parse(k?.getItem(B) || "null");
	if (e?.version === o && Array.isArray(e.entries)) for (let t of e.entries.slice(-100)) {
		if (!Number.isFinite(t?.savedAt)) continue;
		let e = r([t])[0];
		e?.routes.length === 6 && (V.set(e.name, e.routes), H.set(e.name, t.savedAt));
	}
} catch {}
function K() {
	for (; V.size > 100;) {
		let e = V.keys().next().value;
		V.delete(e), H.delete(e);
	}
	try {
		k?.setItem(B, JSON.stringify({
			version: o,
			entries: [...V].map(([e, t]) => ({
				name: e,
				routes: t,
				savedAt: H.get(e)
			}))
		}));
	} catch {}
}
function q(e) {
	R.add(e), T("notice").textContent = [...R].join("\n"), T("notice").hidden = !1;
}
for (let e of A.warnings) q(e);
function J() {
	if (N) return !1;
	let e = w(k, M);
	return e || q("端末への保存に失敗しました。入力は画面に残ります。バックアップを書き出してください。"), e;
}
A.needsSave && J();
function Y() {
	I++;
	for (let e of z) e.path === "routes" && e.controller.abort();
	re.clear();
}
function X(e) {
	let t = M.inputs.map((e, t) => {
		let n = E("div", "name-row"), r = E("label", "name-label", `プレイヤー${t + 1}`);
		r.htmlFor = `name-${t}`;
		let i = E("input");
		return i.id = `name-${t}`, i.type = "text", i.value = e, i.placeholder = "プレイヤー名を入力", i.maxLength = 256, i.autocomplete = "off", i.spellcheck = !1, i.addEventListener("input", () => {
			M.inputs[t] = i.value, J();
		}), i.addEventListener("keydown", (e) => {
			e.key === "Enter" && !e.isComposing && e.keyCode !== 229 && (e.preventDefault(), Q());
		}), n.append(r, i), M.inputs.length > 1 && n.append(D("×", "remove", () => {
			M.inputs.splice(t, 1), J(), X(Math.min(t, M.inputs.length - 1));
		}, `プレイヤー${t + 1}の入力欄を削除`)), n;
	});
	T("names-container").replaceChildren(...t), T("slot-count").textContent = `${M.inputs.length} / ${l}`, T("add-player").disabled = M.inputs.length >= l, e !== void 0 && T(`name-${e}`)?.focus();
}
function Z(e = !1) {
	let t = M.resultNames.map((t) => {
		let n = E("article", "player-block knight-result");
		n.append(E("h2", "result-player-name", t));
		let r = E("nav", "media-grid");
		r.setAttribute("aria-label", `${t}の媒体別検索先`);
		for (let n of e ? [] : V.get(t) ?? []) {
			let e = O(n.name, G ? n.broad : n.url);
			e.className = `media-link media-${n.id}`, e.setAttribute("aria-label", `${t}を${n.name}で${!G && n.scope === "dbd" ? "DBD関連検索" : n.scope === "profile" ? "入力URLを開く・DBD関連未確認" : "検索"}（新しいタブ）`), r.append(e);
		}
		return n.append(r), r.childElementCount || n.append(E("p", "hint", e ? "検索先を準備中…" : "検索ボタンで検索先を準備できます。")), n;
	});
	T("results").replaceChildren(...t), T("expand-search").hidden = e || !M.resultNames.some((e) => V.get(e)?.some((e) => e.broad !== e.url)), T("expand-search").textContent = G ? "DBD関連に戻す" : "検索を広げる", T("expand-search").setAttribute("aria-pressed", String(G));
}
function ie() {
	return matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
}
async function ae(e, t) {
	if (!P) throw Error("APIサーバー未接続です。配布版READMEの設定手順を確認してください。");
	let n = new AbortController(), r = {
		path: e,
		controller: n
	};
	z.add(r);
	let i = setTimeout(() => n.abort(), 12e3);
	try {
		let r = await fetch(new URL(e, P), {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(t),
			signal: n.signal,
			cache: "no-store",
			credentials: "omit",
			referrerPolicy: "no-referrer"
		}), i = W.pause(r.status, r.headers?.get("Retry-After"));
		if (i) throw Error(`${new Date(i).toLocaleString("ja-JP")}まで新規検索の通信を停止します。自動再試行はしません。`);
		let a;
		try {
			a = await r.json();
		} catch {
			throw Error("APIからJSON形式の応答を取得できませんでした。");
		}
		if (!f(a)) throw Error("APIの応答形式が不正です。");
		if (!r.ok) throw Error(typeof a.error == "string" ? a.error : "APIサーバーで取得に失敗しました。");
		return a;
	} catch (e) {
		throw e.name === "AbortError" ? Error("通信が中断されたか、時間内に応答しませんでした。") : e instanceof TypeError ? Error("新しい検索には通信が必要です。入力と履歴は端末に残っています。") : e;
	} finally {
		clearTimeout(i), z.delete(r);
	}
}
async function oe(e, t = {}, n = 8e3) {
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
async function Q() {
	let e = M.inputs.map((e) => e.trim()).filter(Boolean);
	if (!e.length) {
		q("プレイヤー名を入力してください。"), T("name-0").focus();
		return;
	}
	if (e.some((e) => !_(e))) {
		q("プレイヤー名は256文字以内で入力してください。");
		return;
	}
	if ([...z].some((e) => e.path === "routes")) return;
	Y();
	let t = I;
	G = !1, M.resultNames = e, te(M, e), J();
	let n = [...new Set(e)].filter((e) => {
		let t = Date.now() - (H.get(e) ?? -Infinity);
		return !V.has(e) || t < 0 || t >= 6e5;
	});
	if (!n.length) {
		Z();
		return;
	}
	let i = W.begin();
	if (!i.ok) {
		q(i.reason === "blocked" ? `${new Date(i.until).toLocaleString("ja-JP")}まで新規検索の通信を停止しています。` : "続けての検索を止めました。少し間をあけてください。"), Z();
		return;
	}
	T("search").disabled = !0, Z(!0), T("results").scrollIntoView({
		behavior: ie(),
		block: "start"
	});
	try {
		let e = await ae("routes", { names: n });
		if (e.version !== o) throw Error("検索サーバーの更新中です。時間をおいてお試しください。");
		let i = r(e.results);
		if (i.length !== n.length || i.some((e, t) => e.name !== n[t] || e.routes.length !== 6)) throw Error("検索先の応答形式を確認できませんでした。");
		if (t !== I) return;
		for (let e of i) V.delete(e.name), V.set(e.name, e.routes), H.set(e.name, Date.now());
		f(e.settings) && (M.game = e.settings.game, M.mode = e.settings.mode, M.customGame = e.settings.customGame, J()), K();
	} catch (e) {
		t === I && q(e.message || "新しい検索には通信が必要です。入力と履歴は端末に残っています。");
	} finally {
		W.finish(), T("search").disabled = !1, t === I && Z();
	}
}
function $() {
	let e = T("history-filter").value.toLocaleLowerCase("ja-JP"), t = M.history.filter((t) => t.name.toLocaleLowerCase("ja-JP").includes(e)).map((e) => {
		let t = E("div", "history-item"), n = D("", "secondary history-pick", () => {
			Y(), M.inputs = [e.name], M.resultNames = [], J(), X(), Z(), T("history-dialog").close(), T("name-0").focus();
		});
		return n.append(E("span", "", e.name), E("small", "", e.date ?? "日付不明")), t.append(n, D("×", "remove", () => {
			M.history = M.history.filter((t) => t.id !== e.id), J(), $();
		}, `${e.name}の履歴を1件削除`)), t;
	});
	T("history-list").replaceChildren(...t.length ? t : [E("p", "hint", e ? "一致する履歴はありません。" : "履歴はありません。")]);
}
function se() {
	T("app-version").textContent = `v${o}`, T("add-player").addEventListener("click", () => {
		M.inputs.length >= l || (M.inputs.push(""), J(), X(M.inputs.length - 1));
	}), T("search").addEventListener("click", Q), T("expand-search").addEventListener("click", () => {
		G = !G, Z();
	});
	for (let e of ["data", "history"]) T(`open-${e}`).addEventListener("click", () => {
		e === "history" ? $() : T("history-dialog").close(), T(`${e}-dialog`).showModal();
	}), T(`close-${e}`).addEventListener("click", () => T(`${e}-dialog`).close()), T(`${e}-dialog`).addEventListener("keydown", (e) => {
		if (e.key !== "Tab") return;
		let t = [...e.currentTarget.querySelectorAll("button:not(:disabled),input:not(:disabled),select:not(:disabled),a[href],[tabindex=\"0\"]")].filter((e) => e.getClientRects().length), n = t[0], r = t.at(-1);
		if (!n) {
			e.preventDefault();
			return;
		}
		e.shiftKey && document.activeElement === n ? (e.preventDefault(), r.focus()) : !e.shiftKey && document.activeElement === r && (e.preventDefault(), n.focus());
	});
	T("history-filter").addEventListener("input", $), T("clear-history").addEventListener("click", () => {
		confirm("全履歴を削除しますか？") && (M.history = [], J(), $());
	}), T("export").addEventListener("click", () => {
		let e = {};
		if (N && k) for (let t of [
			c,
			...d,
			"psd_game",
			"psd_routing"
		]) try {
			let n = k.getItem(t);
			n !== null && (e[t] = n);
		} catch {}
		let t = new Blob([JSON.stringify({
			app: "P.S.D",
			exportedAt: (/* @__PURE__ */ new Date()).toISOString(),
			state: M,
			...N ? { originalStorage: e } : {}
		}, null, 2)], { type: "application/json" }), n = URL.createObjectURL(t), r = E("a");
		r.href = n, r.download = `PSD-backup-${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}.json`, document.body.append(r), r.click(), r.remove(), setTimeout(() => URL.revokeObjectURL(n), 3e4), T("storage-status").textContent = "JSONの書き出しを開始しました。ファイルを保管してください。";
	}), T("import").addEventListener("click", () => T("import-file").click()), T("import-file").addEventListener("change", async (e) => {
		let t = e.target.files?.[0];
		if (t) try {
			if (t.size > 2e6) throw Error("2MB以内のJSONを選んでください。");
			let e = ne(await t.text());
			if (!confirm("バックアップの入力・設定・履歴で、このアプリの保存データを置き換えますか？")) return;
			Y(), V.clear(), H.clear();
			try {
				k?.removeItem(B);
			} catch {}
			M = e, N = !1;
			let n = J();
			X(), Z(), $(), T("storage-status").textContent = n ? "バックアップを読み込み、保存しました。" : "画面には読み込みましたが、端末への保存には失敗しました。";
		} catch (e) {
			T("storage-status").textContent = `読込できません：${e.message}`;
		} finally {
			e.target.value = "";
		}
	}), T("persist").addEventListener("click", async () => {
		try {
			if (!navigator.storage?.persist) {
				T("storage-status").textContent = "この環境は保存領域の保護リクエストに対応していません。バックアップをご利用ください。";
				return;
			}
			let e = await navigator.storage.persist();
			T("storage-status").textContent = e ? "保存領域の保護が許可されました。ユーザーによる削除等には備え、バックアップを続けてください。" : "保存領域の保護は許可されませんでした。バックアップをご利用ください。";
		} catch {
			T("storage-status").textContent = "保存領域の保護を確認できませんでした。";
		}
	}), T("update").addEventListener("click", le);
	let e = /iPad|iPhone|iPod/.test(navigator.userAgent) || /Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1;
	T("install-banner").hidden = !e || navigator.standalone === !0 || matchMedia("(display-mode: standalone)").matches;
	let t = () => {
		T("offline-status").textContent = navigator.onLine ? "オンライン" : "オフライン";
	};
	addEventListener("online", t), addEventListener("offline", t), t();
}
async function ce() {
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
				e.state === "installed" && navigator.serviceWorker.controller && (T("update-status").textContent = "更新をダウンロードしました。「アプリの更新を確認」で適用できます。");
			});
		});
	} catch {
		q("オフライン用データを準備できませんでした。オンラインの機能は使用できます。");
	}
}
async function le() {
	T("update").disabled = !0, T("update-status").textContent = "更新を確認中…";
	try {
		if (!navigator.onLine) throw Error("オフラインのため更新を確認できません。");
		let e = await oe("./version.json", { cache: "no-store" });
		if (!e.ok) throw Error("バージョン情報を取得できませんでした。");
		let t = await e.json();
		if (!/^\d+\.\d+\.\d+$/.test(t.version)) throw Error("バージョン情報の形式が不正です。");
		if (!F) {
			t.version === o ? T("update-status").textContent = `最新版です（v${o}）。` : T("update-status").textContent = `v${t.version}があります。ページを再読み込みしてください。`;
			return;
		}
		if (await F.update(), F.installing && await new Promise((e) => {
			let t = F.installing, n = setTimeout(e, 1e4);
			t.addEventListener("statechange", () => {
				["installed", "redundant"].includes(t.state) && (clearTimeout(n), e());
			});
		}), F.waiting) {
			if (!J()) throw Error("入力を保存できないため、更新の適用を止めました。先にバックアップを書き出してください。");
			L = !0, F.waiting.postMessage({ type: "DPS_SKIP_WAITING" }), T("update-status").textContent = "このアプリの更新を適用中…", setTimeout(() => {
				L && (T("update-status").textContent = "更新の切替を確認できませんでした。入力を保存してから、もう一度お試しください。");
			}, 15e3);
		} else T("update-status").textContent = t.version === o ? `最新版です（v${o}）。` : `v${t.version}があります。配信が完了してから再度確認してください。`;
	} catch (e) {
		T("update-status").textContent = e instanceof TypeError ? "通信できないため、更新を確認できませんでした。" : e.message || "更新を確認できませんでした。";
	} finally {
		T("update").disabled = !1;
	}
}
se(), X(), Z(), ce();
//#endregion
