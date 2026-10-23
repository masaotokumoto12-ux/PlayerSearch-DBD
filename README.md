# P.S.D v3.5.2

[アプリ](https://masaotokumoto12-ux.github.io/PlayerSearch-DBD/) / [共有版](https://dbd-player-search.m-aa-k-one-for-all-a.chatgpt.site)

X・Twitch・Steam・YouTube・TikTokは各サービスへ直接アクセスする。
表示名はサービス内で検索し、@ID・有効なプロフィールURLは直接開く。
YouTubeは「名前 DBD」を優先し、「検索を広げる」で名前だけに切り替える。
5chだけは既存の媒体限定Google検索を使う。
プロフィールの存在、本人一致、DBD関連を確認済みとは表示しない。

履歴は内部の日別ファイルへ自動保存し、画面には当日を含む日付だけを表示する。
日付をタップすると、その日のプレイヤー名を確認できる。
同日・同名の重複行は作らず、2回目以降は「2回目の検索」のように回数を表示する。
閲覧・再読込・再保存では加算しない。翌日の検索は1回から数える。
旧履歴の不明な回数は1回として引き継ぐ。ファイル名や日別の手動保存操作は画面に出さない。
当日の入力はpsd-core-v4を維持し、全体バックアップには過去の日別履歴も含む。
ブラウザーの保存データ削除に備える場合は、端末へ書き出したファイルを保管する。

最大4入力・6媒体。検索先URLを10分保存し、重複・連打・自動再試行を防止する。
戻る・再読込・復帰・履歴閲覧では外部検索を自動送信しない。
検索APIはURLを作るだけで、X・Twitchなどへの自動リクエストは行わない。
外部サービスの制限が絶対に発生しない保証はできない。
有料API・追加課金は導入しない。検索処理と管理鍵はサーバーだけに置く。
管理Siteの公開範囲、管理設定、採用済みデザインを維持する。

正本は [CANONICAL.md](./CANONICAL.md)。
変更内容と検証の範囲は [更新記録](./HISTORY_DAYS_COUNTS_2026-10-23.md) を参照。

```sh
node scripts/check.mjs
node --test tests/client-flow.test.mjs
node scripts/audit-search.mjs
```

audit-searchは自分のAPIへ通常4入力・1 POSTだけ送る。外部検索は実行しない。


認証と今回の改善は [AUTHENTICATION.md](./AUTHENTICATION.md)。
表示版v3.5.2、検索通信契約v3.5.1。既存の検索先と固定待機値を維持。
