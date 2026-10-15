# 放課後ゲーム部 オンラインWorkerの公開

Web画面はGitHub main → Cloudflare Pagesで公開する。
オンライン通信サーバーは別のCloudflare Worker「houkago-online-api」で、GitHubにソースを保存しただけでは自動更新されない。

## GitHubから公開する

1. GitHubリポジトリの Settings → Secrets and variables → Actions で、CLOUDFLARE_API_TOKEN と CLOUDFLARE_ACCOUNT_ID を登録。秘密値はチャットやソースコードには貼らない。
2. Actions → Deploy Online Worker → Run workflow → main を実行。
3. テストが通過すると worker/wrangler.jsonc の設定で既存Workerを更新する。
4. https://houkago-online-api.kenkyo11.workers.dev/api/health に version:4（またはそれ以上）が返ったら、オンラインロビーで「ニセ転校生を探せ！」が開始可能。

Cloudflare Freeの利用枠を想定する。利用量や請求設定はCloudflareのダッシュボードで確認する。

## オンライン独自仕様

- ゲームページは /online/nise-transfer-student/
- /games/nise-transfer-student/ はオフライン版のまま
- 本人の役職と調査結果だけを各プレイヤーへ送る
- 3〜10人で遊び、ホストが進行する。再接続は元の参加トークンを使う
- 途中退出時は秘密状態と投票を保護するためロビーへ戻る

## コマンドで公開する場合

workerフォルダ内でnpm install → npm test → npx wrangler deploy --config wrangler.jsonc。
