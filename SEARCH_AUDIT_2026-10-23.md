# P.S.D v3.4.5 媒体別検索監査

監査日：2026-10-23（日本時間）。対象はGitHub Pages版と共有版。
GitHubの確認元：`9b508bcbfb69a47cb1e89450a7d304fa4afb46df`（v3.4.4）。
両画面は同じ公開検索APIへ接続する。検索処理の正本は共有Siteのサーバー側。
公開GitHubには画面、配信アセット、検証、監査記録のみを反映する。

## 判定の範囲

「確認済み」は入力、URL生成、API応答、画面コードの試験を指す。
遷移先の検索結果、実アカウント、本人一致、DBD関連は別の確認項目。
リンクの表示だけで「登録あり」「本人」と認定しない。

## 媒体別の判定

| 媒体 | 確認済みの経路 | v3.4.4で再現した不具合と修正 | 未確認・残る制約 |
| --- | --- | --- | --- |
| Steam | 通常名はユーザー検索。明示プロフィールURLと17桁SteamIDは直接遷移 | `/profiles/not-a-steamid/`をプロフィールとして扱う問題を修正 | 外部検索結果、実在、本人一致、DBD関連。BAN確認は対象外 |
| Twitch | 日本語・ハイフン・ドットも表示名として検索 | 無効なID文字やヘルプ用ドメインを直接プロフィールと誤認する問題を修正 | 外部検索結果、実在、ログイン状態による表示差 |
| YouTube | 通常名は動画も含む検索。@handle・channel・c・userは明示URLとして認識 | channel・c・userがURL文字列の検索になる問題を修正。不正ハンドル文字も検索へ戻す | 実チャンネルの実在、本人一致、各言語の全登録条件。形式が有効でも実在は保証しない |
| TikTok | 通常名はユーザー検索。明示URLはプロフィールへ | ハイフンや末尾ドットを含む不正IDの直接遷移を修正 | 外部検索結果、地域・ログイン制限、実在、本人一致 |
| X | 通常名はユーザー検索。明示URLのID文字・長さ・予約パスを検査 | ハイフン・ドット入りID、ヘルプページの直接プロフィール誤認を修正 | 外部検索結果、ログイン要求、実在、本人一致 |
| 5ちゃんねる | 5ch.net・2ch.scに限定したGoogle検索 | 一般ページURLをアカウントと見なして直接開く問題を修正 | Google掲載範囲、スレッド本文、書込者、本人一致。全掲示板の全件検索ではない |

短い既存IDを登録時の最小文字数だけで排除しない。
日本語YouTubeハンドルを英数字限定ルールに変更しない。
通常の表示名からプロフィールIDを推定して直接遷移しない。

## 検索モードとDBD語

スマート検索は上記の媒体内検索を使い、5chはGoogle検索を使う。
Googleモードでは全媒体をドメイン指定のGoogle検索へ送る。
入力プロフィールURLの直接遷移はスマート検索のみ。
既存の検索モードや管理設定は今回変更しない。

主検索ではDBD関連語を必須条件にしない。
DBD語入りの補助URLはAPIにあるが、現行画面では採用していない。
サービス内検索が失敗した際のGoogle自動再検索は未実装。
未発見媒体の自動非表示も未実装。6リンク表示は発見の証拠ではない。

## 指定入力の再現手順

1. アプリを更新し、画面の版がv3.4.5であることを確認する。
2. 次表の入力を4名以内に分けて入力し、「検索」を押す。
3. 各媒体リンクのURLの検索語を確認する。日本語と記号が保持されることを確認する。
4. 外部検索結果の有無と本人一致は別途記録する。未掲載を不在と断定しない。

| 入力 | 検証点 |
| --- | --- |
| MaKun_inkya | 大文字・小文字・アンダースコア |
| ヅオパン | カタカナ、濁点 |
| 日本語の名前 | 漢字とひらがな |
| name-with-hyphen | ハイフンを名前として保持 |
| name.with.dot | ドットを名前として保持 |
| name-with.dot | ハイフンとドットの混在 |

| 媒体 | スマート検索の期待パス | 検索語のパラメーター |
| --- | --- | --- |
| Steam | steamcommunity.com/search/users/ | text |
| X | x.com/search | q（f=user） |
| YouTube | www.youtube.com/results | search_query（spによるチャンネル限定なし） |
| Twitch | www.twitch.tv/search | term |
| TikTok | www.tiktok.com/search/user | q |
| 5ちゃんねる | www.google.com/search | q（名前を引用符で囲み、媒体ドメインを指定） |

## 不具合の再現

| 入力例 | v3.4.4 | v3.4.5の期待値 |
| --- | --- | --- |
| https://www.youtube.com/channel/UC_x5XG1OV2P6uZZ5FSM9Ttw | URL全体をYouTubeの検索語にする | YouTubeリンクは入力URLを開く |
| https://www.youtube.com/c/YouTubeCreators | URL全体を検索語にする | 同上 |
| https://www.youtube.com/user/YouTube | URL全体を検索語にする | 同上 |
| https://x.com/name-with.dot | 無効なIDのURLを直接開く | Xの名前検索へ戻す |
| https://www.twitch.tv/name-with.dot | 無効なIDのURLを直接開く | Twitchの名前検索へ戻す |
| https://www.tiktok.com/@name. | 不正な末尾ドットのURLを直接開く | TikTokの名前検索へ戻す |
| https://www.youtube.com/@name! | 不正文字を含むURLを直接開く | YouTubeの名前検索へ戻す |

channel IDは表示名ではないため、他媒体の人物名として扱わない。
YouTubeの動画URLや短縮URLから、所有チャンネルを推定する処理はない。

## 検証方法と結果

サーバー単体・クライアント試験：16件合格。
指定6入力×6媒体×2モードの72経路を含む。
公開用ビルド成功。ビルド済みWorkerのAPI試験：1件合格。
4名同時検索、CORS、明示URL、Googleモード、不正入力、管理認証を検証。
v3.4.4の本番APIでもYouTube channel URLの不具合を再現した。

GitHub配信物は次のコマンドで確認する。

```sh
node scripts/check.mjs
node --test tests/client-flow.test.mjs
node scripts/audit-search.mjs
```

audit-searchは公開APIへ20入力・120リンクの読取試験を実施する。
版、順序、検索語、直接遷移、CORSを確認する。管理設定は書き換えない。
本番試験で使うモードはサーバーの現設定。両モードの比較は単体試験で実施する。
詳細JSONが必要な場合は`node scripts/audit-search.mjs --json`を使う。

ブラウザー画面の試験は、確認用環境への接続拒否により未確認。
各媒体の外部検索画面とアカウントの本人確認も未確認。
公開反映後のAPI試験も合格した。

## 公開後の確認

2026-10-23 02:49:50（日本時間）に本番APIを確認。
応答版は3.4.5、現設定はsmart。
20入力・120リンクすべてでURL、順序、検索語、CORSが試験に合格した。
指定6入力の36リンク、YouTube4形式、不正URLの異常系を含む。
共有版の公開処理も成功した。検索設定の書換えは行っていない。

## 一次資料

2026-10-23参照。

- [YouTube：チャンネルURLの形式](https://support.google.com/youtube/answer/6180214?hl=en)
- [YouTube：ハンドルの文字と多言語条件](https://support.google.com/youtube/answer/11585688?hl=en)
- [X：ユーザー名と表示名](https://help.x.com/en/managing-your-account/change-x-handle)
- [TikTok：ユーザー名の変更と使用文字](https://support.tiktok.com/en/getting-started/setting-up-your-profile/changing-your-username)
