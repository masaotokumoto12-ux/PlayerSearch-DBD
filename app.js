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
		let n = new URL(a.url);
		if (n.protocol !== "https:" || n.username || n.password || n.port || n.hostname !== "www.google.com" && !t[a.id].some((e) => n.hostname === e || n.hostname.endsWith("." + e))) continue;
		r.add(a.id), i.push({
			id: a.id,
			name: e[a.id],
			url: n.href
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
//#region client/app.js
var i = "3.4.5", a = 4, o = "psd-core-v4", s = 4, c = 256, l = Object.freeze([
	"dps-state",
	"dps-core-v6",
	"psd-core-v3",
	"player-check-pro-v2",
	"psd_history"
]), u = (e) => e && typeof e == "object" && !Array.isArray(e), d = (e) => {
	if (typeof e.isWellFormed == "function") return e.isWellFormed();
	try {
		return !0;
	} catch {
		return !1;
	}
}, f = new Set([
	"dbd",
	"apex",
	"valorant",
	"other",
	""
]), p = new Set(["smart", "force-google"]), m = () => globalThis.crypto?.randomUUID?.() ?? `dps-${Date.now()}-${Math.random().toString(36).slice(2)}`, h = (e) => typeof e == "string" && e.trim().length > 0 && [...e].length <= c && d(e);
function g() {
	return {
		schemaVersion: a,
		game: "dbd",
		customGame: "",
		mode: "smart",
		inputs: [""],
		resultNames: [],
		history: [],
		migratedLegacyKeys: []
	};
}
function _(e = /* @__PURE__ */ new Date()) {
	return `${e.getFullYear()}-${String(e.getMonth() + 1).padStart(2, "0")}-${String(e.getDate()).padStart(2, "0")}`;
}
function v(e) {
	if (typeof e != "string") return null;
	let t = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(e);
	if (!t) return null;
	let [, n, r, i] = t.map(Number);
	if (n < 1900 || n > 9999) return null;
	let a = new Date(Date.UTC(n, r - 1, i));
	return a.getUTCFullYear() === n && a.getUTCMonth() === r - 1 && a.getUTCDate() === i ? `${n}-${String(r).padStart(2, "0")}-${String(i).padStart(2, "0")}` : null;
}
function y(e) {
	let t = /* @__PURE__ */ new Set(), n = /* @__PURE__ */ new Set();
	return (Array.isArray(e) ? e : []).filter((e) => u(e) && h(e.name ?? e.playerName ?? e.query)).map((e, t) => ({
		...e,
		name: (e.name ?? e.playerName ?? e.query).trim(),
		date: v(e.date),
		order: t
	})).sort((e, t) => (t.date ?? "").localeCompare(e.date ?? "") || e.order - t.order).filter((e) => {
		if (!e.date) return !0;
		let n = JSON.stringify([e.name, e.date]);
		return t.has(n) ? !1 : (t.add(n), !0);
	}).slice(0, 100).map((e) => {
		let t = typeof e.id == "string" || typeof e.id == "number" && Number.isFinite(e.id) ? String(e.id) : "";
		return (!t || n.has(t)) && (t = m()), n.add(t), {
			id: t,
			name: e.name,
			date: e.date
		};
	});
}
function b(e) {
	let t = u(e?.settings) ? e.settings : {};
	return {
		game: e?.game ?? e?.gameTitle ?? e?.gameSelect ?? t.game,
		mode: e?.mode ?? e?.searchMode ?? e?.routing ?? t.routing,
		customGame: e?.customGame ?? e?.gameCustom ?? t.customGame,
		inputs: e?.inputs ?? e?.players ?? e?.names,
		resultNames: e?.resultNames ?? e?.results
	};
}
function x(e) {
	let t = g();
	if (!u(e)) return t;
	let n = b(e);
	return f.has(n.game) && (t.game = n.game), p.has(n.mode) && (t.mode = n.mode), typeof n.customGame == "string" && [...n.customGame].length <= 80 && d(n.customGame) && (t.customGame = n.customGame), Array.isArray(n.inputs) && (t.inputs = n.inputs.filter((e) => typeof e == "string" && [...e].length <= c && d(e)).slice(0, s), t.inputs.length || (t.inputs = [""])), Array.isArray(n.resultNames) && (t.resultNames = n.resultNames.map((e) => typeof e == "string" ? e : u(e) ? e.playerName ?? e.name : null).filter(h).slice(0, s).map((e) => e.trim())), t.history = y(e.history), t.migratedLegacyKeys = Array.isArray(e.migratedLegacyKeys) ? [...new Set(e.migratedLegacyKeys.filter((e) => l.includes(e)))] : [], e.migratedLegacyHistory === !0 && !t.migratedLegacyKeys.includes("psd_history") && t.migratedLegacyKeys.push("psd_history"), t;
}
function S(e) {
	let t = [], n = [], r;
	try {
		r = e.getItem(o);
	} catch {
		return {
			state: g(),
			warnings: ["保存領域を読み込めません。入力は画面に保持します。"],
			needsSave: !1
		};
	}
	let i = g(), s = !1, c;
	if (r != null) try {
		let e = JSON.parse(r);
		if (!u(e)) throw Error();
		if (e.schemaVersion > a) return {
			state: i,
			warnings: ["新しい形式の保存データがあります。上書き防止のため保存を停止しています。"],
			blocked: !0,
			needsSave: !1
		};
		i = x(e), s = !0, c = e;
	} catch {
		return {
			state: i,
			warnings: ["保存JSONが壊れています。元データを残し、上書き保存を停止しました。バックアップの読込で復旧できます。"],
			blocked: !0,
			needsSave: !1
		};
	}
	let d = new Set(i.migratedLegacyKeys);
	for (let r of l) if (!d.has(r)) try {
		let t = e.getItem(r);
		if (t != null) {
			let e = JSON.parse(t);
			if (r === "psd_history") {
				if (!Array.isArray(e)) throw Error();
				n.push({ history: e });
			} else {
				if (!u(e)) throw Error();
				n.push(e);
			}
		}
		d.add(r);
	} catch {
		t.push(`${r} は読み込めません。元データは残しています。`);
	}
	let m = null, h = null;
	try {
		m = e.getItem("psd_game");
	} catch {}
	try {
		h = e.getItem("psd_routing");
	} catch {}
	let _ = h === "google" ? "force-google" : h;
	if (!s) {
		let e = n.map(b), r = (t, n) => e.map((e) => e[t]).find(n);
		i = x({
			game: r("game", (e) => f.has(e)) ?? (f.has(m) ? m : "dbd"),
			mode: r("mode", (e) => p.has(e)) ?? (p.has(_) ? _ : "smart"),
			customGame: r("customGame", (e) => typeof e == "string"),
			inputs: r("inputs", Array.isArray),
			resultNames: r("resultNames", Array.isArray)
		}), h && !p.has(_) && t.push("旧ダイレクトモード等は互換性がないため、スマート検索に戻しました。");
	}
	if (s) {
		let e = b(c), t = n.map(b), r = (e, n) => t.map((t) => t[e]).find(n), a = {};
		e.game === void 0 && (a.game = r("game", (e) => f.has(e))), e.mode === void 0 && (a.mode = r("mode", (e) => p.has(e))), e.customGame === void 0 && (a.customGame = r("customGame", (e) => typeof e == "string")), e.inputs === void 0 && (a.inputs = r("inputs", Array.isArray)), e.resultNames === void 0 && (a.resultNames = r("resultNames", Array.isArray));
		for (let e of Object.keys(a)) a[e] === void 0 && delete a[e];
		i = x({
			...i,
			...a
		});
	}
	return i.history = y([...i.history, ...n.flatMap((e) => Array.isArray(e.history) ? e.history : [])]), i.migratedLegacyKeys = [...d], (n.length || !s && (m !== null || h !== null)) && t.push("旧データを読み込みました。元の保存キーは削除していません。"), {
		state: i,
		warnings: t,
		blocked: !1,
		needsSave: s || n.length > 0 || m !== null || h !== null
	};
}
function C(e, t) {
	try {
		return e.setItem(o, JSON.stringify(x(t))), !0;
	} catch {
		return !1;
	}
}
function w(e, t, n = _()) {
	e.history = y([...t.map((e) => ({
		id: m(),
		name: e.trim(),
		date: n
	})), ...e.history]);
}
function T(e) {
	let t = JSON.parse(e), n = u(t?.state) ? t.state : t;
	if (!u(n) || !Array.isArray(b(n).inputs) || !Array.isArray(n.history)) throw Error("P.S.Dのバックアップ形式ではありません。");
	if (n.schemaVersion > a) throw Error("新しい形式のため、この版では読めません。");
	let r = x(n);
	return r.migratedLegacyKeys = [...l], r;
}
var E = (e) => document.getElementById(e);
function D(e, t, n) {
	let r = document.createElement(e);
	return t && (r.className = t), n !== void 0 && (r.textContent = n), r;
}
function O(e, t, n, r) {
	let i = D("button", `button ${t}`, e);
	return i.type = "button", r && i.setAttribute("aria-label", r), i.addEventListener("click", n), i;
}
function k(e, t) {
	let n = D("a", "", e);
	return n.href = t, n.target = "_blank", n.rel = "noopener noreferrer", n.referrerPolicy = "no-referrer", n;
}
var A;
try {
	A = window.localStorage;
} catch {}
var j = S(A), M = document.querySelector("meta[name=\"psd-api-base\"]")?.content, N = j.state, P = j.blocked ?? !1, F = new URL(M || "./api/", document.baseURI).href, I, L = 0, R = !1, z = new Set(j.warnings), B = /* @__PURE__ */ new Map(), V = /* @__PURE__ */ new Set(), H = "psd-shared-routes-v1", U = /* @__PURE__ */ new Map();
try {
	for (let e of r(JSON.parse(A?.getItem(H) || "[]"))) U.set(e.name, e.routes);
} catch {}
function W(e) {
	z.add(e), E("notice").textContent = [...z].join("\n"), E("notice").hidden = !1;
}
for (let e of j.warnings) W(e);
function G() {
	if (P) return !1;
	let e = C(A, N);
	return e || W("端末への保存に失敗しました。入力は画面に残ります。バックアップを書き出してください。"), e;
}
j.needsSave && G();
function K() {
	L++;
	for (let e of V) e.path === "routes" && e.controller.abort();
	B.clear();
}
function q(e) {
	let t = N.inputs.map((e, t) => {
		let n = D("div", "name-row"), r = D("label", "name-label", `プレイヤー${t + 1}`);
		r.htmlFor = `name-${t}`;
		let i = D("input");
		return i.id = `name-${t}`, i.type = "text", i.value = e, i.placeholder = "プレイヤー名を入力", i.maxLength = 256, i.autocomplete = "off", i.spellcheck = !1, i.addEventListener("input", () => {
			N.inputs[t] = i.value, G();
		}), i.addEventListener("keydown", (e) => {
			e.key === "Enter" && !e.isComposing && e.keyCode !== 229 && (e.preventDefault(), Q());
		}), n.append(r, i), N.inputs.length > 1 && n.append(O("×", "remove", () => {
			N.inputs.splice(t, 1), G(), q(Math.min(t, N.inputs.length - 1));
		}, `プレイヤー${t + 1}の入力欄を削除`)), n;
	});
	E("names-container").replaceChildren(...t), E("slot-count").textContent = `${N.inputs.length} / ${s}`, E("add-player").disabled = N.inputs.length >= s, e !== void 0 && E(`name-${e}`)?.focus();
}
function J(e = !1) {
	let t = N.resultNames.map((t) => {
		let n = D("article", "player-block knight-result");
		n.append(D("h2", "result-player-name", t));
		let r = D("nav", "media-grid");
		r.setAttribute("aria-label", `${t}の媒体別検索先`);
		for (let n of e ? [] : U.get(t) ?? []) {
			let e = k(n.name, n.url);
			e.className = `media-link media-${n.id}`, e.setAttribute("aria-label", `${t}を${n.name}で検索（新しいタブ）`), r.append(e);
		}
		return n.append(r), r.childElementCount || n.append(D("p", "hint", e ? "検索先を準備中…" : "検索ボタンで検索先を準備できます。")), n;
	});
	E("results").replaceChildren(...t);
}
function Y() {
	return matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
}
async function X(e, t) {
	if (!F) throw Error("APIサーバー未接続です。配布版READMEの設定手順を確認してください。");
	let n = new AbortController(), r = {
		path: e,
		controller: n
	};
	V.add(r);
	let i = setTimeout(() => n.abort(), 12e3);
	try {
		let r = await fetch(new URL(e, F), {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(t),
			signal: n.signal,
			cache: "no-store",
			credentials: "omit",
			referrerPolicy: "no-referrer"
		}), i;
		try {
			i = await r.json();
		} catch {
			throw Error("APIからJSON形式の応答を取得できませんでした。");
		}
		if (!u(i)) throw Error("APIの応答形式が不正です。");
		if (!r.ok) throw Error(typeof i.error == "string" ? i.error : "APIサーバーで取得に失敗しました。");
		return i;
	} catch (e) {
		throw e.name === "AbortError" ? Error("通信が中断されたか、時間内に応答しませんでした。") : e instanceof TypeError ? Error("新しい検索には通信が必要です。入力と履歴は端末に残っています。") : e;
	} finally {
		clearTimeout(i), V.delete(r);
	}
}
async function Z(e, t = {}, n = 8e3) {
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
	let e = N.inputs.map((e) => e.trim()).filter(Boolean);
	if (!e.length) {
		W("プレイヤー名を入力してください。"), E("name-0").focus();
		return;
	}
	if (e.some((e) => !h(e))) {
		W("プレイヤー名は256文字以内で入力してください。");
		return;
	}
	K();
	let t = L;
	N.resultNames = e, w(N, e), G(), J(!0), E("results").scrollIntoView({
		behavior: Y(),
		block: "start"
	});
	try {
		let n = await X("routes", { names: e }), i = r(n.results);
		if (i.length !== e.length || i.some((t, n) => t.name !== e[n] || t.routes.length !== 6)) throw Error("検索先の応答形式を確認できませんでした。");
		if (t !== L) return;
		U.clear();
		for (let e of i) U.set(e.name, e.routes);
		u(n.settings) && (N.game = n.settings.game, N.mode = n.settings.mode, N.customGame = n.settings.customGame, G());
		try {
			A?.setItem(H, JSON.stringify(i));
		} catch {}
	} catch (e) {
		t === L && W(e.message || "新しい検索には通信が必要です。入力と履歴は端末に残っています。");
	} finally {
		t === L && J();
	}
}
function $() {
	let e = E("history-filter").value.toLocaleLowerCase("ja-JP"), t = N.history.filter((t) => t.name.toLocaleLowerCase("ja-JP").includes(e)).map((e) => {
		let t = D("div", "history-item"), n = O("", "secondary history-pick", () => {
			K(), N.inputs = [e.name], N.resultNames = [], G(), q(), J(), E("history-dialog").close(), E("name-0").focus();
		});
		return n.append(D("span", "", e.name), D("small", "", e.date ?? "日付不明")), t.append(n, O("×", "remove", () => {
			N.history = N.history.filter((t) => t.id !== e.id), G(), $();
		}, `${e.name}の履歴を1件削除`)), t;
	});
	E("history-list").replaceChildren(...t.length ? t : [D("p", "hint", e ? "一致する履歴はありません。" : "履歴はありません。")]);
}
function ee() {
	E("app-version").textContent = `v${i}`, E("add-player").addEventListener("click", () => {
		N.inputs.length >= s || (N.inputs.push(""), G(), q(N.inputs.length - 1));
	}), E("search").addEventListener("click", Q);
	for (let e of ["data", "history"]) E(`open-${e}`).addEventListener("click", () => {
		e === "history" ? $() : E("history-dialog").close(), E(`${e}-dialog`).showModal();
	}), E(`close-${e}`).addEventListener("click", () => E(`${e}-dialog`).close()), E(`${e}-dialog`).addEventListener("keydown", (e) => {
		if (e.key !== "Tab") return;
		let t = [...e.currentTarget.querySelectorAll("button:not(:disabled),input:not(:disabled),select:not(:disabled),a[href],[tabindex=\"0\"]")].filter((e) => e.getClientRects().length), n = t[0], r = t.at(-1);
		if (!n) {
			e.preventDefault();
			return;
		}
		e.shiftKey && document.activeElement === n ? (e.preventDefault(), r.focus()) : !e.shiftKey && document.activeElement === r && (e.preventDefault(), n.focus());
	});
	E("history-filter").addEventListener("input", $), E("clear-history").addEventListener("click", () => {
		confirm("全履歴を削除しますか？") && (N.history = [], G(), $());
	}), E("export").addEventListener("click", () => {
		let e = {};
		if (P && A) for (let t of [
			o,
			...l,
			"psd_game",
			"psd_routing"
		]) try {
			let n = A.getItem(t);
			n !== null && (e[t] = n);
		} catch {}
		let t = new Blob([JSON.stringify({
			app: "P.S.D",
			exportedAt: (/* @__PURE__ */ new Date()).toISOString(),
			state: N,
			...P ? { originalStorage: e } : {}
		}, null, 2)], { type: "application/json" }), n = URL.createObjectURL(t), r = D("a");
		r.href = n, r.download = `PSD-backup-${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}.json`, document.body.append(r), r.click(), r.remove(), setTimeout(() => URL.revokeObjectURL(n), 3e4), E("storage-status").textContent = "JSONの書き出しを開始しました。ファイルを保管してください。";
	}), E("import").addEventListener("click", () => E("import-file").click()), E("import-file").addEventListener("change", async (e) => {
		let t = e.target.files?.[0];
		if (t) try {
			if (t.size > 2e6) throw Error("2MB以内のJSONを選んでください。");
			let e = T(await t.text());
			if (!confirm("バックアップの入力・設定・履歴で、このアプリの保存データを置き換えますか？")) return;
			K(), U.clear();
			try {
				A?.removeItem(H);
			} catch {}
			N = e, P = !1;
			let n = G();
			q(), J(), $(), E("storage-status").textContent = n ? "バックアップを読み込み、保存しました。" : "画面には読み込みましたが、端末への保存には失敗しました。";
		} catch (e) {
			E("storage-status").textContent = `読込できません：${e.message}`;
		} finally {
			e.target.value = "";
		}
	}), E("persist").addEventListener("click", async () => {
		try {
			if (!navigator.storage?.persist) {
				E("storage-status").textContent = "この環境は保存領域の保護リクエストに対応していません。バックアップをご利用ください。";
				return;
			}
			let e = await navigator.storage.persist();
			E("storage-status").textContent = e ? "保存領域の保護が許可されました。ユーザーによる削除等には備え、バックアップを続けてください。" : "保存領域の保護は許可されませんでした。バックアップをご利用ください。";
		} catch {
			E("storage-status").textContent = "保存領域の保護を確認できませんでした。";
		}
	}), E("update").addEventListener("click", ne);
	let e = /iPad|iPhone|iPod/.test(navigator.userAgent) || /Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1;
	E("install-banner").hidden = !e || navigator.standalone === !0 || matchMedia("(display-mode: standalone)").matches;
	let t = () => {
		E("offline-status").textContent = navigator.onLine ? "オンライン" : "オフライン";
	};
	addEventListener("online", t), addEventListener("offline", t), t();
}
async function te() {
	if (!("serviceWorker" in navigator) || !window.isSecureContext) {
		W("この環境ではオフライン起動を準備できません。HTTPSまたはlocalhostを使用してください。");
		return;
	}
	try {
		I = await navigator.serviceWorker.register(new URL("./sw.js", document.baseURI), {
			scope: "./",
			updateViaCache: "none"
		});
		let e = !1;
		navigator.serviceWorker.addEventListener("controllerchange", () => {
			!navigator.serviceWorker.controller || e || R && (e = !0, G(), location.reload());
		}), I.addEventListener("updatefound", () => {
			let e = I.installing;
			e?.addEventListener("statechange", () => {
				e.state === "installed" && navigator.serviceWorker.controller && (E("update-status").textContent = "更新をダウンロードしました。「アプリの更新を確認」で適用できます。");
			});
		});
	} catch {
		W("オフライン用データを準備できませんでした。オンラインの機能は使用できます。");
	}
}
async function ne() {
	E("update").disabled = !0, E("update-status").textContent = "更新を確認中…";
	try {
		if (!navigator.onLine) throw Error("オフラインのため更新を確認できません。");
		let e = await Z("./version.json", { cache: "no-store" });
		if (!e.ok) throw Error("バージョン情報を取得できませんでした。");
		let t = await e.json();
		if (!/^\d+\.\d+\.\d+$/.test(t.version)) throw Error("バージョン情報の形式が不正です。");
		if (!I) {
			t.version === i ? E("update-status").textContent = `最新版です（v${i}）。` : E("update-status").textContent = `v${t.version}があります。ページを再読み込みしてください。`;
			return;
		}
		if (await I.update(), I.installing && await new Promise((e) => {
			let t = I.installing, n = setTimeout(e, 1e4);
			t.addEventListener("statechange", () => {
				["installed", "redundant"].includes(t.state) && (clearTimeout(n), e());
			});
		}), I.waiting) {
			if (!G()) throw Error("入力を保存できないため、更新の適用を止めました。先にバックアップを書き出してください。");
			R = !0, I.waiting.postMessage({ type: "DPS_SKIP_WAITING" }), E("update-status").textContent = "このアプリの更新を適用中…", setTimeout(() => {
				R && (E("update-status").textContent = "更新の切替を確認できませんでした。入力を保存してから、もう一度お試しください。");
			}, 15e3);
		} else E("update-status").textContent = t.version === i ? `最新版です（v${i}）。` : `v${t.version}があります。配信が完了してから再度確認してください。`;
	} catch (e) {
		E("update-status").textContent = e instanceof TypeError ? "通信できないため、更新を確認できませんでした。" : e.message || "更新を確認できませんでした。";
	} finally {
		E("update").disabled = !1;
	}
}
ee(), q(), J(), te();
//#endregion
