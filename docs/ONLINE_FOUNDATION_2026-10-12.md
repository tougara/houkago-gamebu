# 放課後ゲーム部：共通オンライン基盤（2026-10-12）

## 現在地
GitHubにオンラインルーム用フロントエンドとCloudflare Workerを**独立して準備**。
旧来のスマホ1台モード7作品・ランキング・セーブは変更しない。
**Cloudflare Worker公開と `/api/health` 応答確認、および実機3人の部屋参加・準備完了同期を確認済み。2026-10-12に「みんなはどっち？」ひみつ投票の先行オンライン機能をGitHub mainへ追加。新バージョンのCloudflare配信・複数端末の実機プレイは未確認。**

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
5. `/online/` の3人参加と全員準備OKは実機で確認済み。再接続・退出・無料枠使用状況は追加検証。
6. 本番検証が済むまでトップ画面へオンライン導線は設置しない。
7. 最初のオンラインプレイとして「みんなはどっち？」の「ひみつ投票」5問をGitHubへ実装。実機確認後にUI・進行を再調整。

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
- ホストが「みんなはどっち？」を選択し、2〜10人全員が「準備OK」になったら5問を開始できる。ほかの6作品はオンラインルームの選択のみでゲーム開始不可。
- 各端末は同じお題を見て自分の端末からA／Bを1回だけ投票。最後の1人が投票すると、**各選択の合計人数だけ**を表示。誰が何を選んだかは部屋に送信しない。
- ひみつ投票の問題は既存の問題集と共通で、センシティブな「恋バナ」「ちょっとディープ」を除いた160問から重複なく5問をランダム選択する。
- 出題順・投票・進行はCloudflare Durable Objectが管理。WebSocketで部屋のメンバー、準備、問題、回答済み人数、結果を同期。全員回答後には個別の選択データを破棄する。
- 次のお題／終了はホスト専用。途中離脱時も残りが2人以上で全員回答済みなら集計、1人になればロビーへ戻る。回答済みの端末はリロード後も回答を二重送信できない。
- 1台プレイの既存「みんなはどっち？」（よみあいバトル・ひみつ投票）、共有プレイヤー登録、ランキング、セーブ、ほか6ゲームは変更なし。
- 対象ファイル：`worker/src/index.js`、`worker/src/secret-questions.js`、`online/index.html`、`online/lobby.js`、`online/lobby.css`、`tests/online-worker.test.mjs`。
- 確認：3人×5問の投票、ホスト権限、集計の匿名性、二重投票拒否、終了後ロビー復帰を模擬し19項目合格。
- **未確認：Workers最新デプロイ・ブラウザからの実ゲーム開始・WebSocket再接続・2時間経過時の終了・端末表示・フリープラン利用枠**。GitHub反映と本番試遊成功は区別する。
