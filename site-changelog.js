/* 放課後ゲーム部 更新履歴。GitHubコミット時刻に基づき日本時間で表示。
 * 各更新はユーザー視点で要点を編集したもので、未発行のVer番号は付けない。
 */
window.HOUKAGO_CHANGELOG=[
  {
    "date": "2026-10-11",
    "datetime": "2026-10-11T09:54:23.000Z",
    "display": "2026/10/11 18:54",
    "scope": "burst",
    "major": true,
    "title": "4色統一＋エンドレス難易度アップ",
    "changes": [
      "1人用と2人で対戦を青・赤・黄・緑の4色へ統一",
      "エンドレスは経過時間でも加速",
      "旧5色セーブからの復帰に対応"
    ],
    "commit": "73b1f2b1cb5792135934143f12aac65bd5f291df"
  },
  {
    "date": "2026-10-11",
    "datetime": "2026-10-11T09:42:45.000Z",
    "display": "2026/10/11 18:42",
    "scope": "burst",
    "major": false,
    "title": "「2人で対戦」の名称に統一",
    "changes": [
      "対戦準備・対戦画面の表記を整理"
    ],
    "commit": "96dde17369310cf2890b47a188d954938eecd27f"
  },
  {
    "date": "2026-10-11",
    "datetime": "2026-10-11T08:23:43.000Z",
    "display": "2026/10/11 17:23",
    "scope": "burst",
    "major": false,
    "title": "対戦のメンバー登録・編集を改善",
    "changes": [
      "共有メンバーの新規登録と名前・アイコン変更に対応"
    ],
    "commit": "541d2ec4cbe1dcebd3f757d80c09f26d0c395a87"
  },
  {
    "date": "2026-10-11",
    "datetime": "2026-10-11T08:12:04.000Z",
    "display": "2026/10/11 17:12",
    "scope": "burst",
    "major": false,
    "title": "2人対戦画面を盤面重視に再設計",
    "changes": [
      "SCORE・LINK・PAUSEを中央へ集約",
      "盤面を大きく表示"
    ],
    "commit": "75c963f517fecc31332a74c3dbd0b18807ebc814"
  },
  {
    "date": "2026-10-11",
    "datetime": "2026-10-11T06:39:09.000Z",
    "display": "2026/10/11 15:39",
    "scope": "burst",
    "major": true,
    "title": "リンクバーストに同時KO対戦を追加",
    "changes": [
      "左右2盤面での同時タッチとKO判定を実装",
      "JAM・COUNTERは未実装"
    ],
    "commit": "82b5c14ed3686a8cb13119b116c0cf11b777b2e3"
  },
  {
    "date": "2026-10-11",
    "datetime": "2026-10-11T06:28:42.000Z",
    "display": "2026/10/11 15:28",
    "scope": "burst",
    "major": true,
    "title": "「2人で対戦」の準備画面を追加",
    "changes": [
      "1P・2Pを選ぶ画面を追加",
      "横画面の対戦準備を実装"
    ],
    "commit": "b9c5e20b6907aa2cfadcc3a115f527aa24d06152"
  },
  {
    "date": "2026-10-11",
    "datetime": "2026-10-11T05:31:01.000Z",
    "display": "2026/10/11 14:31",
    "scope": "burst",
    "major": false,
    "title": "リンクバーストを一時的に5色化",
    "changes": [
      "紫ブロックを追加",
      "後の更新で4色に戻した経緯を記録"
    ],
    "commit": "e88eec1f25db7e9895ea918b356807b191beddfb"
  },
  {
    "date": "2026-10-11",
    "datetime": "2026-10-11T04:39:02.000Z",
    "display": "2026/10/11 13:39",
    "scope": "burst",
    "major": false,
    "title": "リンクバーストに開始カウントを追加",
    "changes": [
      "3・2・1・STARTの開始演出と安全な停止・再開に対応"
    ],
    "commit": "f79a9ec4f47534d4c052fb2c07ad1d065b91c827"
  },
  {
    "date": "2026-10-11",
    "datetime": "2026-10-11T04:28:41.000Z",
    "display": "2026/10/11 13:28",
    "scope": "burst",
    "major": false,
    "title": "リンクバーストに着地点予告を追加",
    "changes": [
      "着地予定位置を半透明のゴーストで表示"
    ],
    "commit": "4159bd98186b9ef8389603460dce748da4fadeae"
  },
  {
    "date": "2026-10-11",
    "datetime": "2026-10-11T02:17:06.000Z",
    "display": "2026/10/11 11:17",
    "scope": "core",
    "major": false,
    "title": "全7ゲームのナビを見直し",
    "changes": [
      "ゲーム中の上部操作バーをスクロール中も使いやすく改善"
    ],
    "commit": "55715352006439942fbee8150b2aefc5a1487aa5"
  },
  {
    "date": "2026-10-11",
    "datetime": "2026-10-11T01:20:37.000Z",
    "display": "2026/10/11 10:20",
    "scope": "core",
    "major": true,
    "title": "お気に入りゲーム機能が登場",
    "changes": [
      "ゲーム一覧で星を付けてお気に入りを保存",
      "絞り込みとおすすめ表示に対応"
    ],
    "commit": "4bea107af28b04e097029416de4a576a660af4c4"
  },
  {
    "date": "2026-10-10",
    "datetime": "2026-10-10T14:28:25.000Z",
    "display": "2026/10/10 23:28",
    "scope": "burst",
    "major": false,
    "title": "リンクバーストを2個ペア方式に",
    "changes": [
      "落下ブロックを2個セットに変更",
      "配置と操作のルールを再設計"
    ],
    "commit": "2e217c0080f62a0b85d55b93982b46d518b3ce38"
  },
  {
    "date": "2026-10-10",
    "datetime": "2026-10-10T13:06:46.000Z",
    "display": "2026/10/10 22:06",
    "scope": "burst",
    "major": false,
    "title": "リンクバーストの1人用を実装",
    "changes": [
      "落下・4個消し・スコア計算を実装"
    ],
    "commit": "a3e7d3c1b61992f2215896f0ee3e4a6b59cf0520"
  },
  {
    "date": "2026-10-10",
    "datetime": "2026-10-10T13:03:37.000Z",
    "display": "2026/10/10 22:03",
    "scope": "burst",
    "major": true,
    "title": "「リンクバースト！」の制作がスタート",
    "changes": [
      "落ちものパズルのゲームページを追加",
      "連鎖とスコアを競う遊びの開発開始"
    ],
    "commit": "f8c960ef350a0b72bccaaab90e82656d209e243b"
  },
  {
    "date": "2026-10-10",
    "datetime": "2026-10-10T11:38:08.000Z",
    "display": "2026/10/10 20:38",
    "scope": "core",
    "major": false,
    "title": "トップの「つづきから」を改善",
    "changes": [
      "途中復帰カードをスマホ1画面内に収まるよう調整"
    ],
    "commit": "01a025b575811ee9cf0e80458e8ff22891f8702f"
  },
  {
    "date": "2026-10-10",
    "datetime": "2026-10-10T00:07:36.000Z",
    "display": "2026/10/10 09:07",
    "scope": "core",
    "major": true,
    "title": "プレイヤー記録が追加",
    "changes": [
      "参加・勝敗・個人記録を確認できる機能を追加",
      "トップから記録を確認可能に"
    ],
    "commit": "975329f57a39044cbbd2482e640a397a4a7b35f9"
  },
  {
    "date": "2026-10-10",
    "datetime": "2026-10-09T23:37:37.000Z",
    "display": "2026/10/10 08:37",
    "scope": "core",
    "major": true,
    "title": "途中ゲーム復帰に対応",
    "changes": [
      "共通保存・復元システムを追加",
      "各ゲームへ復帰機能を順次接続"
    ],
    "commit": "9eb3e0952a536756c0cec06e1e1da163fd49e271"
  },
  {
    "date": "2026-10-10",
    "datetime": "2026-10-09T23:30:49.000Z",
    "display": "2026/10/10 08:30",
    "scope": "core",
    "major": true,
    "title": "共通設定を各ゲームへ導入",
    "changes": [
      "設定管理と全ゲームで使える共通UIを追加"
    ],
    "commit": "d453596a2c7d14b218d4865817f6f73a3f658fdd"
  },
  {
    "date": "2026-10-10",
    "datetime": "2026-10-09T15:47:08.000Z",
    "display": "2026/10/10 00:47",
    "scope": "pitadome",
    "major": false,
    "title": "ピタ止めに「かんたん」を追加",
    "changes": [
      "初心者向け難易度と専用ランキングを追加"
    ],
    "commit": "716df4965b3a34d3be78bf6a2c5cfbbe1f9c322c"
  },
  {
    "date": "2026-10-09",
    "datetime": "2026-10-09T14:54:29.000Z",
    "display": "2026/10/09 23:54",
    "scope": "pitadome",
    "major": false,
    "title": "ピタ止めにランキングと新要素",
    "changes": [
      "ランキング・変化ギミック・コンボボーナスを追加"
    ],
    "commit": "52152370f8e30d43e5f787a3fa9301ce1e5f402b"
  },
  {
    "date": "2026-10-09",
    "datetime": "2026-10-09T14:28:19.000Z",
    "display": "2026/10/09 23:28",
    "scope": "pitadome",
    "major": true,
    "title": "「ピタ止めチャレンジ」が登場",
    "changes": [
      "10ラウンドとエンドレスを実装",
      "タイミングを狙うゲームを追加"
    ],
    "commit": "7b8ac547d02f862c4fdc23287ba932af08bc5ad3"
  },
  {
    "date": "2026-10-09",
    "datetime": "2026-10-09T11:38:33.000Z",
    "display": "2026/10/09 20:38",
    "scope": "core",
    "major": true,
    "title": "共通メンバー編集を全体へ統一",
    "changes": [
      "メンバー編集UIを共通化",
      "複数ゲームで参加者を選びやすく改善"
    ],
    "commit": "f5146fc5e5d47cfc0e79898d73cba641c96f1dbe"
  },
  {
    "date": "2026-10-09",
    "datetime": "2026-10-09T07:54:10.000Z",
    "display": "2026/10/09 16:54",
    "scope": "gesture",
    "major": true,
    "title": "「ジェスチャーバトル」が登場",
    "changes": [
      "2モード・チーム分け・豊富なお題を実装",
      "みんなで遊べるジェスチャーゲームを追加"
    ],
    "commit": "723ab9db281c8e9d0b05f3f874bf777dd6278003"
  },
  {
    "date": "2026-10-09",
    "datetime": "2026-10-09T07:18:02.000Z",
    "display": "2026/10/09 16:18",
    "scope": "core",
    "major": true,
    "title": "ゲーム一覧を大幅リニューアル",
    "changes": [
      "おすすめと2列カード表示を導入",
      "カテゴリーフィルターを追加"
    ],
    "commit": "0c7c6fcc684fec2e604008c4431f2d348e6806cc"
  },
  {
    "date": "2026-10-07",
    "datetime": "2026-10-07T01:21:19.000Z",
    "display": "2026/10/07 10:21",
    "scope": "tower",
    "major": false,
    "title": "タワーの形と段数を改善",
    "changes": [
      "土台の冊数に応じたピラミッド段数に変更"
    ],
    "commit": "8a602eb01dcd13c86db291b30bfd9cdefb577003"
  },
  {
    "date": "2026-10-07",
    "datetime": "2026-10-07T00:50:38.000Z",
    "display": "2026/10/07 09:50",
    "scope": "tower",
    "major": false,
    "title": "教科書の配置を1画面で完結",
    "changes": [
      "手札と配置候補を同じ画面に表示",
      "仮置きと確定をスムーズに"
    ],
    "commit": "652b863912a88adc7e070349e00971e425847e3b"
  },
  {
    "date": "2026-10-06",
    "datetime": "2026-10-06T12:39:01.000Z",
    "display": "2026/10/06 21:39",
    "scope": "tower",
    "major": true,
    "title": "「教科書タワー」を追加",
    "changes": [
      "教科書を積み上げるゲームを実装",
      "ゲーム一覧からプレイ可能に"
    ],
    "commit": "122f382e4c9d1a8ed2f3bf33cfb657f43ca65c2e"
  },
  {
    "date": "2026-10-05",
    "datetime": "2026-10-05T10:52:43.000Z",
    "display": "2026/10/05 19:52",
    "scope": "meter",
    "major": true,
    "title": "「感覚メーター」を追加",
    "changes": [
      "感覚の違いを楽しむゲームの試作版を実装",
      "お題に沿って順番を並べる遊びを追加"
    ],
    "commit": "3d3845717092cf565fbb07fbbbf8cfafa453340c"
  },
  {
    "date": "2026-10-05",
    "datetime": "2026-10-04T23:10:10.000Z",
    "display": "2026/10/05 08:10",
    "scope": "docchi",
    "major": true,
    "title": "「みんなはどっち？」の2モードを実装",
    "changes": [
      "2種類の遊び方ができるゲームの試作版を追加"
    ],
    "commit": "8507142d6afa56719792d9f142fb9cb5a63dbf32"
  },
  {
    "date": "2026-10-05",
    "datetime": "2026-10-04T22:48:09.000Z",
    "display": "2026/10/05 07:48",
    "scope": "core",
    "major": true,
    "title": "共通メンバー登録を追加",
    "changes": [
      "参加メンバーの登録機能を追加",
      "複数ゲームで同じプレイヤー情報を使う仕組みを整備"
    ],
    "commit": "b3410d104b9e3030783e731d6aaae497153b01d0"
  },
  {
    "date": "2026-10-04",
    "datetime": "2026-10-03T22:46:12.000Z",
    "display": "2026/10/04 07:46",
    "scope": "core",
    "major": true,
    "title": "ゲームを選ぶ専用ページを追加",
    "changes": [
      "トップからゲーム一覧へ進む構成に",
      "ゲームを並べる土台を整備"
    ],
    "commit": "ae1b0d1b4351d436f44b5795d9bf7715f2106f41"
  },
  {
    "date": "2026-10-04",
    "datetime": "2026-10-03T15:56:58.000Z",
    "display": "2026/10/04 00:56",
    "scope": "nise",
    "major": true,
    "title": "「ニセ転校生を探せ！」のゲーム本体を実装",
    "changes": [
      "正体を隠しながら推理するゲームを追加",
      "休み時間・話し合い・投票・勝敗判定を実装"
    ],
    "commit": "6bf8f456c582e6ab37af74fbc24773dfdbada1b2"
  },
  {
    "date": "2026-10-03",
    "datetime": "2026-10-03T14:30:31.000Z",
    "display": "2026/10/03 23:30",
    "scope": "core",
    "major": true,
    "title": "放課後ゲーム部がスタート",
    "changes": [
      "「スマホ1台でみんなで遊ぼう！」をテーマに制作開始",
      "教室を舞台にしたブラウザゲーム集の土台を用意"
    ],
    "commit": "ada0bd401f346546b7801e2311708d4561b30f68"
  }
];
