# 放課後ゲーム部：共通オンライン基盤（2026-10-12）

## 現在地
GitHubにオンラインルーム用フロントエンドとCloudflare Workerを**独立して準備**。
旧来のスマホ1台モード7作品・ランキング・セーブは変更しない。
**Cloudflare Worker公開と `/api/health` 応答確認、および実機3人の部屋参加・準備完了同期を確認済み。2026-10-12に「みんなはどっち？」ひみつ投票の先行オンライン機能をGitHub mainへ追加。新バージョンのCloudflare配信・複数端末の実機プレイは未確認。**

## 無料制約
- Workers Freeのみ。SQLite Durable Objects＋WebSocket Hibernation API。課金有効化やPaid契約は不要。
- ルームは最大10人。8文字招待コード。作成から2時間で期限切れ。
- 普通の連続作成を妨げないよう部屋作成は同一IPで1分60回までに緩和。参加は同一IPで10分40回まで。無料枠保護のため極端な連続操作だけ制限。
- 対応オリジンのみ許可、秘密トークンは共有URLに含めない。
- チャット・ランダムマッチ・カメラ・音声なし。オンラインで遊べるのは当面「みんなはどっち？」ひみつ投票のみ。
- 負荷により無料枠を超えるとAPIが失敗する。保証された無制限無料サービスではない。

## Cloudflare公開・接続手順（実施状況）
1. Workers + Durable Objectsを利用するWorker `houkago-online-api` の公開が完了。課金設定の実地確認は引き続き必要。
2. GitHub連携ビルドで `npm install --prefix worker` → `cd worker && npx wrangler deploy` が成功。`ROOMS` バインディング表示を確認。
3. `https://houkago-online-api.kenkyo11.workers.dev/api/health` にてユーザーのブラウザで `{"ok":true,"mode":"lobby-only","version":1}` の応答を確認。
4. `online/config.js` に実URL `https://houkago-online-api.kenkyo11.workers.dev` を設定しGitHub `main` へ反映済み。
5. `/online/` の3人参加と全員準備OKは実機で確認済み。再接続・退出・無料枠使用状況は追加検証。
6. 本番検証が済むまでトップ画面へオンライン導線は設置しない。
7. 「みんなはどっち？」ひみつ投票の旧5問版は実機で投票まで成功。フィードバックに基づきゲーム専用画面・ジャンル・マイお題・ホスト結果発表へ更新。新版の実機確認は未実施。

## 技術
Workerエンドポイント：`GET /api/health`、`POST /api/rooms`、
`POST /api/rooms/:code/join`、`GET /api/rooms/:code/ws?token=...`。
各部屋はSQLite Durable Object。WebSocket Hibernationで待機中のCPU/実行時間を節約。
既存の共有プレイヤー戦績はサーバーに送らず、部屋内は参加者名とアイコンのみ。

公式資料:
https://developers.cloudflare.com/durable-objects/platform/pricing/
https://developers.cloudflare.com/durable-objects/best-practices/websockets/
https://developers.cloudflare.com/durable-objects/reference/durable-objects-migrations/


## ひみつ投票：オンライン先行プレイ版（2026-10-12）
- ホストが「みんなはどっち？」を選択し、2〜10人全員が「準備OK」ならゲーム専用URL `/online/minna-wa-docchi/` に全員で移動。ホストが設定してから開始できる。3・5・7・10問を選択可。ほかの6作品はオンラインルームの選択のみでゲーム開始不可。
- 各端末は同じお題を見てA／Bを1回だけ投票。最後の1人が投票しても人数は自動発表せず**全員の投票が終わりました**画面で待機。ホストの「結果を発表する！」操作後に各選択の合計人数だけを表示。誰が何を選んだかは他参加者へ送信しない。
- ひみつ投票の問題は既存の10ジャンル200問から選択。初期は「恋バナ」「ちょっとディープ」をOFFにし、必要ならホストが追加できる。ジャンルを複数選択し、ホストが追加したマイお題（最大20問）も出題可能。
- マイお題は作成端末の既存 `houkago_docchi_custom_v1` に保存。部屋に読み込む場合はホストが明示的に操作し、勝手に他人へ公開されない。
- 出題順・投票・進行はCloudflare Durable Objectが管理。WebSocketで部屋のメンバー、準備、問題、回答済み人数、結果を同期。全員回答後には個別の選択データを破棄する。
- ホストだけが設定変更・マイお題追加削除・ゲーム開始・結果発表・次のお題・終了を操作できる。途中離脱時も残りが2人以上で全員回答済みなら「発表待ち」に移り、1人になればロビーへ戻る。回答済みの端末はリロード後も二重送信できない。
- 1台プレイの既存「みんなはどっち？」（よみあいバトル・ひみつ投票）、共有プレイヤー登録、ランキング、セーブ、ほか6ゲームは変更なし。
- 対象ファイル：`worker/src/index.js`、`worker/src/secret-questions.js`、`online/index.html`、`online/lobby.js`、`online/lobby.css`、`online/minna-wa-docchi/index.html`、`online/minna-wa-docchi/game.js`、`online/minna-wa-docchi/game.css`、`tests/online-worker.test.mjs`。
- 確認：連続ルーム作成、15アイコン、10ジャンル、マイお題、3人×5問、全員投票後の待機、ホストのみ結果発表、途中離脱の7つの回帰テストを模擬環境で合格。旧版の実機プレイはユーザーが確認済み。
- **未確認：新版Workers/Pagesの最新デプロイ・専用ページへの全員遷移・新しい設定/結果発表の実機操作・WebSocket再接続・2時間経過時の終了・フリープラン利用枠**。GitHub反映と本番試遊成功は区別する。
