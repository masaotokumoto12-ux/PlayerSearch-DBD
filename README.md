# PlayerSearch-DBD

P.S.D v3.2.0（2026-10-21）。GitHub Pages向けの静的アプリです。

公開先：https://masaotokumoto12-ux.github.io/PlayerSearch-DBD/

## 使い方

1. 最大4人の表示名・@ID・プロフィールURLを入力して一括検索。
2. まず名前だけの通常検索、次に媒体別の名前検索を開きます。
3. ゲーム名を加える検索、記号・全角半角の表記違いも確認できます。
4. 名前やIDの一致だけでは、同一人物と判定しません。

スマート検索は、Steam・X・YouTube・Twitch・TikTokのサービス内検索と、
5chのGoogle検索を生成します。IDから作ったURLは別の「未確認」リンクです。
Googleモードは6媒体ともGoogle検索を使い、自動検索APIには送信しません。
サービス側でログインが必要になる場合があります。
検索を開いただけでは「見つかった」と認定しません。
未発見と取得失敗も区別します。5ch本文、プロフィール内部・相互リンクの
自動確認や、同一人物の自動判定は実装していません。

## 保存・ホーム画面・更新

- 履歴・入力・設定は端末内に保存。旧保存キーは削除しません。
- 設定からJSONを書き出し・読み込みできます。
- 保存JSONが壊れている場合は上書きを停止します。
  その状態で書き出すと、読める旧キーと元JSONも`originalStorage`に含めます。
  元データの復旧は手動です。通常の読込は`state`を使います。
- Safariの共有メニューからホーム画面に追加できます。
- 初回のオンライン読み込みとキャッシュ準備後は、オフラインで起動できます。
  外部検索とAPI照会には通信が必要です。永久保存は保証しません。
- 設定の「アプリの更新を確認」で新しい版を適用します。
  他のGitHub PagesアプリのService Workerやキャッシュは削除しません。

## 自動検索・Steam BAN照会の接続

現行の`config.json`は`apiBase`が空です。
**自動検索とBAN情報取得は未接続**です。
静的アプリ単体ではAPIキーを秘匿して照会できません。
SteamID64・プロフィールURLから公式プロフィールを開く機能は使えます。

既存の互換APIサーバーがある場合だけ、`config.json`を設定してください。
APIサーバーの実装・配備は、このリポジトリには含まれません。

```json
{
  "apiBase": "https://YOUR-API-HOST.example/api/",
  "searchSource": "実際に利用する検索サービス名"
}
```

キーはサーバーの環境変数に置き、リポジトリや`config.json`に書かないでください。
APIはHTTPSとCORSに対応し、この公開サイトのOriginを許可する必要があります。
設定されたAPIへ送る情報は、検索時の名前とゲーム名、
Steam照会時のプロフィールURLと任意の比較名です。

### 互換APIの最小仕様

`POST search`は`{"name":"表示名またはID","prefix":"dbd"}`を受け取ります。
応答は`{"groups":[...]}`。各groupの形式は次のとおりです。

```json
{
  "platform": "youtube",
  "status": "ok",
  "checkedAt": "2026-10-21T00:00:00Z",
  "candidates": [{
    "title": "検索に掲載されたページの題名",
    "url": "https://www.youtube.com/@EXAMPLE",
    "description": "検索掲載文",
    "evidence": "indexed_text_match"
  }]
}
```

媒体IDは`steam`, `x`, `youtube`, `twitch`, `tiktok`, `5ch`。
状態は`ok`, `no_match`, `not_configured`, `unavailable`, `invalid_query`, `busy`。
`no_match`は取得した範囲の候補なしを意味し、人物の不存在を示しません。
掲載文の一致はサーバー側で検証してください。
クライアントはHTTPS・媒体のドメイン・evidenceを確認して表示します。
URL上のID一致はクライアントで再計算し、本人確認と混同しません。

`POST steam`は`{"target":"https://steamcommunity.com/profiles/76561198000000000/","expectedName":"任意の比較名"}`を受け取ります。
Steam Web APIのISteamUserを照会した実データだけを返してください。

```json
{
  "status": "ok",
  "steamId": "76561198000000000",
  "name": "現在の表示名",
  "checkedAt": "2026-10-21T00:00:00Z",
  "bans": {
    "vac": false,
    "vacCount": 0,
    "gameCount": 0,
    "community": false,
    "economy": "none",
    "daysSinceLastBan": 0
  }
}
```

失敗時は`not_configured`, `no_match`, `unavailable`のいずれかを返します。
取得失敗をBANなしに置き換えないでください。
Steam全体の情報であり、DbDでの不正や他媒体の本人一致を証明しません。

## ファイルとメンテナンス

| ファイル | 用途 |
| --- | --- |
| `index.html` | 画面と外部参照 |
| `app.js` | 検索・履歴・バックアップ・更新 |
| `styles.css` | 画面のスタイル |
| `IMG_8813.jpeg` | 実際に参照中の背景画像 |
| `manifest.webmanifest`, `icons/` | ホーム画面用の情報・アイコン |
| `sw.js` | このアプリ専用のオフラインキャッシュ |
| `version.json` | 配信バージョン |
| `config.json` | 秘密情報を含まないAPI接続先 |
| `scripts/check.mjs` | 外部依存なしの回帰チェック |
| `.nojekyll` | 静的ファイルをそのまま配信 |

画像ではなく14バイトのテキストだった未参照の`bg-knight.jpg`を削除しました。
背景本体の`IMG_8813.jpeg`は維持しています。

ローカル確認（Node.js 20以上、Python 3）:

```sh
node scripts/check.mjs
python3 -m http.server 8080
```

更新時は`app.js`、`version.json`、HTMLの版・CSS/JSクエリ、
`sw.js`のVERSIONとASSETSの版をそろえてください。
チェックは参照切れ、版の不一致、検索URL、データ移行・保護を検出します。
