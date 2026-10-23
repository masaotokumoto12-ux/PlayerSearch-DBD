# P.S.D 認証・通信・保存の確認記録

2026-10-24 JST。クライアント修正版 v3.5.2。検索通信契約は v3.5.1 を維持。
確認元: GitHub 782bd7570ace9c80eda483f1335d2268da280eeb、共有ソース 10d2b462206127ba3b8f851663543863090f3ed5、管理ソース 39facc52e809b03e9a6fb36a03f9cc0b6f985c7d を起点に差分検証。

## 構成と認証境界

|構成|役割|本人確認・権限|
|---|---|---|
|GitHub Pages / 共有Siteの画面|入力・履歴・検索先表示|公開。独自ログインなし|
|共有Site `/api/routes`|最大4名から6媒体のURLを生成|公開。Origin検査、JSON検証、送信頻度制限|
|Sitesの管理サイト入口|ChatGPTログインと公開範囲の判定|プラットフォームが実施|
|管理Site `/api/settings`|設定の読込・変更を中継|本人情報ヘッダの有無、PUTの同一Origin検査|
|共有Site `/api/manage/settings`|共有設定をD1へ保存|サーバー専用のBearer鍵を検証|

CORSはブラウザーが別サイトへ通信する条件であり、本人認証ではない。
公開検索はOriginなしも受け付ける。検索用のユーザートークンは存在しない。
SNSへのログインは各SNSで行う。P.S.DがSNSのパスワードやトークンを取得する構成ではない。

## 通常検索の流れ

1. `client/app.js` が入力を検証し、重複をまとめる。
2. 10分の有効期間内にある検索先は端末のキャッシュを使う。
3. 未取得分だけ共有Siteの `/api/routes` へJSONでPOSTする。
4. `app/api/routes/route.ts` がOrigin・入力・頻度を検証する。
5. `lib/settings.ts` がD1の共通設定を読み、検索先URLを生成する。
6. URLを返し、画面がHTTPSと媒体ホストを再検査する。
7. 利用者が媒体をタップした時だけ外部サイトを開く。

クライアントの実装抜粋（`client/app.js` のAPI関数）:

```js
fetch(new URL(path, apiBase), {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data),
  signal: controller.signal,
  cache: 'no-store',
  credentials: 'omit',
  referrerPolicy: 'no-referrer'
});
```

この通信にはCookieやAuthorizationヘッダを付けない。
サーバーはSNSを巡回せず、検索先URLを返すだけである。
実在・本人一致・DBD関連を自動確認した結果ではない。

## 管理操作の流れ

1. 管理Siteにアクセスし、Sitesがログインとアクセス許可を判定する。
2. Sitesが `oai-authenticated-user-id` と `oai-authenticated-user-email` を付与する。
3. 管理トップ `app/route.ts` は両ヘッダがなければサインインへリダイレクトする。
4. `lib/admin-api.mjs` の `proxySettings` は両ヘッダがなければ401にする。
5. PUTではOriginが管理Site自身と一致することを確認する。
6. 管理サーバーが環境変数から `PSD_ADMIN_TOKEN` を取り出す。
7. 固定接続先 `PSD_APP_ORIGIN` の `/api/manage/settings` にBearer鍵を付ける。
8. 共有サーバーが鍵を照合し、設定だけをD1へ読書きする。

管理サーバーはリダイレクト転送を拒否し、8秒で中断する。
エラーのログは状態コードと設定有無を記録し、鍵の値を出力しない。
ブラウザーへ返す値は検証済み設定だけで、管理鍵は含まない。

## 資格情報とトークン

|種類|置き場所|処理・制約|
|---|---|---|
|ChatGPTのログイン情報|Sitesの認証基盤|P.S.D独自のパスワード保管やOAuth更新処理はない|
|訪問者の本人情報|プラットフォームからのリクエストヘッダ|認証基盤の信頼境界に依存する|
|`PSD_ADMIN_TOKEN`|管理・共有Siteのサーバー環境変数|ブラウザー、URL、公開ソースに渡さない|
|管理Bearer照合|共有サーバー|SHA-256の結果を全バイト比較。欠落・不一致で拒否|
|ソース更新用資格情報|開発時のみ|実行時の管理鍵とは別。アプリ配信物に含めない|
|検索名・回数|localStorage / IndexedDB|認証トークンではない。ブラウザーの保存領域|

管理鍵は最低32文字を必要とし、受信Bearerは256文字超を拒否する。
鍵の有効期限・自動更新・失効リストはアプリ内に実装されていない。
SHA-256による照合は通信の暗号化とは別で、通信はHTTPSを使う。
秘密値自体は今回取得・表示・変更していない。

## 認証の未解決事項

管理APIの `hasIdentity` は「IDとメールがあるか」だけを確認する。
アプリ内で所有者IDや役割の一致を検証していない。
2026-10-24確認時、管理Siteはcustom公開範囲で、外部viewer登録が1件あった。
登録者が所有者本人の別アカウントかは未確認。
したがって「所有者だけが設定変更できる」とは現状断言できない。

推奨: 正当な管理アカウントを確定し、サイト固有の本人IDで管理APIも照合する。
メールアドレスの推測で許可を増減しない。今回、既存許可と鍵は変更していない。
公開APIに管理鍵を渡す方式や、localStorageのownerフラグによる保護は採用しない。

## 今回の改善と検証

- 自アプリが出力した2MB超のJSONを読込側だけで拒否する不整合を修正。
- 旧 `player-check-v3` の `nameSlots` を最大4入力へ移行。旧キーは残す。
- 公開応答を `id / url / broad / scope` に限定。検索経路は維持。
- 管理画面のGoogle優先設定について、DBDでは対象外である旨へ修正。
- 表示版と通信契約を分け、既存v3.5.1クライアントも継続利用できる形にした。

3500件・2MB超の書出し→別環境への読込→再出力で名前・日付・回数を照合。
不正JSONと未来の保存形式では、現在の入力・保存値を上書きしないことを確認。
共有46試験、管理4試験が合格。共有Workerの管理鍵なし401も含む。
ブラウザーのプレビューは接続拒否のため未検証。iPhone実機も未検証。
巨大ファイルの処理時間やメモリ量には端末差がある。無制限の復元保証ではない。

未実施: 複数タブ同時加算、日別保存の全件処理削減、SNSの本人端末ログイン状態別検証。
固定の2秒・10分・30回/分・429の1時間・403の6時間は変更していない。

## 資料の優先順位と調査範囲

現行CANONICALと今回の依頼を優先した。
保存済み `PSD_通常報告書_20261023.pdf` のF01/F03/F09/F10/F13/F15/F16を現行コードで照合した。
Notionの整理マスターとGoogle Driveの「履歴分析と修正実行計画」も確認した。
旧資料の100件切捨て、全媒体Google検索、完全なコード不可視化は採用しない。
SlackのP.S.D検索では関連記録を発見できなかった。
全チャット原文、NotebookLM、全ChatGPTプロジェクトを取得したとは主張しない。
Replitへの移設、Canvaの再デザイン、Windsorの広告分析は今回の修正に不要なため未実行。

参考:
- [現行正本](https://github.com/masaotokumoto12-ux/PlayerSearch-DBD/blob/main/CANONICAL.md)
- [Fetchの公式解説](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch)
- [OWASP HTML5 Security](https://cheatsheetseries.owasp.org/cheatsheets/HTML5_Security_Cheat_Sheet.html)
- Sites公式スキル `references/identity-and-secrets.md`（2026-10-24取得）
