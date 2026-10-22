# P.S.D v3.4.6

[アプリ](https://masaotokumoto12-ux.github.io/PlayerSearch-DBD/) / [共有版](https://dbd-player-search.m-aa-k-one-for-all-a.chatgpt.site)

最大4名、Steam・X・YouTube・Twitch・TikTok・5chの6媒体。
DBD関連検索を優先し、見つからない時だけ「検索を広げる」で従来の名前・ID検索へ切り替える。
切替は取得済みURLを使い、追加通信しない。
明示プロフィールURL・SteamID64はスマート検索で直接開く。
リンク表示はアカウントの実在・本人一致・DBD関連の確認済みを意味しない。

同じ名前の検索先は10分再利用する。連打・重複送信・自動再試行を抑止する。
新規の名前だけを自分のAPIへ送信し、媒体を押すまで外部検索しない。
入力・履歴は端末内に保持し、戻る・再読込・復帰では検索を自動送信しない。
履歴→バックアップ・更新で旧JSONも扱える。保存形式psd-core-v4を維持する。

有料API・追加課金サービスは導入しない。既存ChatGPT契約の範囲だけを使う。
現行Sitesは公開βの対象プラン内提供。将来の価格まで保証しない。
検索処理と管理鍵はサーバーだけに置く。所有者専用管理画面は非公開を維持する。
公開HTML/CSS/JavaScriptと過去のGit履歴は閲覧可能。

正本は [CANONICAL.md](./CANONICAL.md)。
判断理由、制限の範囲、費用、検証は [SEARCH_POLICY_2026-10-23.md](./SEARCH_POLICY_2026-10-23.md) を参照。

## 確認

```sh
node scripts/check.mjs
node --test tests/client-flow.test.mjs
node scripts/audit-search.mjs
```

audit-searchは自分のAPIだけを検証する。外部検索結果の取得や管理設定変更は行わない。
通常は4入力・1 POSTだけを確認する。20入力の拡張試験は --full を明示した時だけ行う。
