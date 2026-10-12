# 放課後ゲーム部：共通オンライン基盤（2026-10-12）

## 現在地
GitHubにオンラインルーム用フロントエンドとCloudflare Workerを**独立して準備**。
旧来のスマホ1台モード7作品・ランキング・セーブは変更しない。
**Cloudflare Workersへの公開と `/api/health` 応答確認が完了。オンラインロビーのブラウザ接続試験とゲーム本体の同期対応は未実施。**

## 無料制約
- Workers Freeのみ。SQLite Durable Objects＋WebSocket Hibernation API。課金有効化やPaid契約は不要。
- ルームは最大10人。8文字招待コード。作成から2時間で期限切れ。
- IPごとに1時間あたり部屋作成4回、10分あたり参加40回の簡易制限。
- 対応オリジンのみ許可、秘密トークンは共有URLに含めない。
- チャット・ランダムマッチ・カメラ・音声なし。ゲーム本体接続前はスタートできない。
- 負荷により無料枠を超えるとAPIが失敗する。保証された無制限無料サービスではない。

## Cloudflare公開・接続手順（実施状況）
1. Workers + Durable Objectsを利用するWorker `houkago-online-api` の公開が完了。課金設定の実地確認は引き続き必要。
2. GitHub連携ビルドで `npm install --prefix worker` → `cd worker && npx wrangler deploy` が成功。`ROOMS` バインディング表示を確認。
3. `https://houkago-online-api.kenkyo11.workers.dev/api/health` にてユーザーのブラウザで `{"ok":true,"mode":"lobby-only","version":1}` の応答を確認。
4. `online/config.js` に実URL `https://houkago-online-api.kenkyo11.workers.dev` を設定しGitHub `main` へ反映済み。
5. `/online/` へ2端末でアクセスし、作成・参加・準備完了・再接続・退出・無料枠使用状況を検証。
6. 本番検証が済むまでトップ画面へオンライン導線は設置しない。
7. 最初に「みんなはどっち？」の「ひみつ投票」を接続する（別工程）。

## 技術
Workerエンドポイント：`GET /api/health`、`POST /api/rooms`、
`POST /api/rooms/:code/join`、`GET /api/rooms/:code/ws?token=...`。
各部屋はSQLite Durable Object。WebSocket Hibernationで待機中のCPU/実行時間を節約。
既存の共有プレイヤー戦績はサーバーに送らず、部屋内は参加者名とアイコンのみ。

公式資料:
https://developers.cloudflare.com/durable-objects/platform/pricing/
https://developers.cloudflare.com/durable-objects/best-practices/websockets/
https://developers.cloudflare.com/durable-objects/reference/durable-objects-migrations/
