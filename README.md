# P.S.D v3.4.4

公開URL：https://masaotokumoto12-ux.github.io/PlayerSearch-DBD/
共有URL：https://dbd-player-search.m-aa-k-one-for-all-a.chatgpt.site

GitHub Pagesと共有版は同じ画面を配信し、同じ検索サーバーへ接続します。
このリポジトリは画面・画像・端末内保存だけです。検索生成や管理鍵は含めません。

## 検索

最大4名、Steam・X・YouTube・Twitch・TikTok・5chの6媒体。
まず名前・IDで探します。DBD語を本人ページの必須条件にしません。
入力されたプロフィールURLやSteamID64は、スマート検索で直接開きます。
表示名からプロフィールIDを決めつけません。
YouTubeのチャンネル限定フィルターを外し、動画も含めて探します。
媒体リンクが表示されても、本人・アカウント実在・DBD関連の確認済みを意味しません。
自動本人判定、各媒体の全件検索、未発見媒体の自動非表示は未実装です。

## 保存・更新

入力・履歴・検索先は端末内に保存します。旧psd-core-v4とバックアップを維持します。
新規検索は通信が必要です。取得中に古いリンクを押せないようにしました。
再読込やアプリ復帰から、自動で検索を送りません。
履歴→バックアップ・更新からJSON読込・書出しと更新ができます。
GitHubと共有URLの保存領域は別です。旧URLからJSONを書き出して移せます。
旧アイコン・背景・config.jsonは旧キャッシュとの互換性のため保持しています。

## 管理とコード

設定画面は公開版から削除しています。管理用Siteは所有者限定です。
公開APIの接続先だけをindex.htmlのpsd-api-baseに記載します。
サーバーは既知のGitHub OriginだけにCORSを許可し、管理APIは公開しません。
配信HTML/CSS/JavaScriptは閲覧可能です。過去のGit履歴は消していません。

## 検証

```sh
node scripts/check.mjs
node --test tests/client-flow.test.mjs
```

サーバー側でも4名×6媒体、名前検索、入力URL、CORS、管理認証を検証します。
