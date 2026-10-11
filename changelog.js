/* 放課後ゲーム部のサイト全体の履歴。各項目はGitHub実コミットに基づく。 */
globalThis.HOUKAGO_CHANGELOG=[
  {
    "date": "2026-10-11",
    "datetime": "2026-10-11T20:56:58.000+09:00",
    "category": "link",
    "major": false,
    "title": "2人対戦のNEXT2とJAM送信を改善",
    "changes": [
      "NEXTとNEXT2の2組を両プレイヤーの盤面に表示",
      "JAMを送った瞬間に飛ぶ演出と予告を表示",
      "JAMの着弾を現在のペア終了後へ早め、連鎖中の待ち時間も短縮"
    ],
    "commit": "be9705418bcc184281cdb2aa05ce601a97e12973"
  },
  {
    "date": "2026-10-11",
    "datetime": "2026-10-11T19:47:11.000+09:00",
    "category": "link",
    "major": true,
    "title": "リンクバーストの2人対戦にJAM・COUNTERを追加",
    "changes": [
      "連鎖で相手に灰色のJAMブロックを送り合えるように",
      "JAMの到着予告・連鎖による相殺・7個ずつの段階的な着弾に対応",
      "同時攻撃と逆転の読み合いを楽しめる試作対戦を追加",
      "1人用のゲームと保存データは変更なし"
    ],
    "commit": "69a72b7751bc23b475b176284fbeb8b4340c549d"
  },
  {
    "date": "2026-10-11",
    "datetime": "2026-10-11T19:17:16.000+09:00",
    "category": "site",
    "major": true,
    "title": "放課後ゲーム部全体の更新履歴を公開",
    "changes": [
      "トップから全7ゲームと共通機能の更新履歴を確認できるように",
      "制作開始までさかのぼり、日付・作品別に絞り込める記録画面を追加",
      "大型更新を専用デザインで分かりやすく表示"
    ],
    "commit": "4705c7b274ddeb317dbcb7a1fd1c604d07052b3e"
  },
  {
    "date": "2026-10-11",
    "datetime": "2026-10-11T18:54:23.000+09:00",
    "category": "link",
    "major": true,
    "title": "4色統一とエンドレス難易度を強化",
    "changes": [
      "両モードを青・赤・黄・緑の4色に統一",
      "エンドレスは経過時間でも加速",
      "旧5色セーブを変換"
    ],
    "commit": "73b1f2b1cb5792135934143f12aac65bd5f291df"
  },
  {
    "date": "2026-10-11",
    "datetime": "2026-10-11T17:12:04.000+09:00",
    "category": "link",
    "major": false,
    "title": "2人対戦の中央コンソールを導入",
    "changes": [
      "SCORE・LINK・PAUSEを中央に集め盤面を大型化"
    ],
    "commit": "75c963f517fecc31332a74c3dbd0b18807ebc814"
  },
  {
    "date": "2026-10-11",
    "datetime": "2026-10-11T15:39:09.000+09:00",
    "category": "link",
    "major": true,
    "title": "リンクバーストに2人同時KO対戦を追加",
    "changes": [
      "スマホ1台で左右2盤面の同時操作とKO判定に対応",
      "JAM・COUNTERは今後実装予定"
    ],
    "commit": "82b5c14ed3686a8cb13119b116c0cf11b777b2e3"
  },
  {
    "date": "2026-10-11",
    "datetime": "2026-10-11T15:06:49.000+09:00",
    "category": "link",
    "major": false,
    "title": "リンクバーストの操作をゲーム機風に刷新",
    "changes": [
      "移動・回転・落下ボタンをダークなパッドに変更"
    ],
    "commit": "7bbdda2b7d0fb4a09de3764d35e8a13a016f4326"
  },
  {
    "date": "2026-10-11",
    "datetime": "2026-10-11T13:34:32.000+09:00",
    "category": "link",
    "major": false,
    "title": "リンクバーストを縦ペア方式に統一",
    "changes": [
      "新しいペアとNEXTを縦2個表示にし盤面を拡大"
    ],
    "commit": "4bb171ab290fe3cf8f72459a6446fd7797b3f374"
  },
  {
    "date": "2026-10-11",
    "datetime": "2026-10-11T10:20:37.000+09:00",
    "category": "site",
    "major": false,
    "title": "ゲーム一覧にお気に入り機能を追加",
    "changes": [
      "星で保存して絞り込み・おすすめ表示と連動"
    ],
    "commit": "4bea107af28b04e097029416de4a576a660af4c4"
  },
  {
    "date": "2026-10-10",
    "datetime": "2026-10-10T22:06:46.000+09:00",
    "category": "link",
    "major": true,
    "title": "リンクバーストの1人用を実装",
    "changes": [
      "同色4個消しと連鎖を楽しめるパズルを追加"
    ],
    "commit": "a3e7d3c1b61992f2215896f0ee3e4a6b59cf0520"
  },
  {
    "date": "2026-10-10",
    "datetime": "2026-10-10T22:03:37.000+09:00",
    "category": "link",
    "major": false,
    "title": "7作目「リンクバースト！」制作開始",
    "changes": [
      "落ちものパズル専用ページの土台を用意"
    ],
    "commit": "f8c960ef350a0b72bccaaab90e82656d209e243b"
  },
  {
    "date": "2026-10-10",
    "datetime": "2026-10-10T09:07:36.000+09:00",
    "category": "site",
    "major": true,
    "title": "共通プレイヤー記録を追加",
    "changes": [
      "参加・勝敗などをメンバー別に保存しトップから確認"
    ],
    "commit": "975329f57a39044cbbd2482e640a397a4a7b35f9"
  },
  {
    "date": "2026-10-10",
    "datetime": "2026-10-10T08:39:07.000+09:00",
    "category": "site",
    "major": true,
    "title": "途中でやめたゲームの再開に対応",
    "changes": [
      "保存した進行状況から続きに戻る仕組みを順次追加"
    ],
    "commit": "ace239586886c52b37ec2bb4e229ecbc1c95f814"
  },
  {
    "date": "2026-10-10",
    "datetime": "2026-10-10T08:30:49.000+09:00",
    "category": "site",
    "major": true,
    "title": "共通設定を全ゲームへ導入",
    "changes": [
      "設定画面を全ページから利用できるように"
    ],
    "commit": "d453596a2c7d14b218d4865817f6f73a3f658fdd"
  },
  {
    "date": "2026-10-10",
    "datetime": "2026-10-10T00:47:08.000+09:00",
    "category": "pita",
    "major": false,
    "title": "ピタ止めに「かんたん」モード追加",
    "changes": [
      "遊びやすい難易度と別ランキングに対応"
    ],
    "commit": "716df4965b3a34d3be78bf6a2c5cfbbe1f9c322c"
  },
  {
    "date": "2026-10-09",
    "datetime": "2026-10-09T23:54:29.000+09:00",
    "category": "pita",
    "major": false,
    "title": "ピタ止めにコンボ・ランキングを追加",
    "changes": [
      "変化ギミックとコンボボーナス・ランキングに対応"
    ],
    "commit": "52152370f8e30d43e5f787a3fa9301ce1e5f402b"
  },
  {
    "date": "2026-10-09",
    "datetime": "2026-10-09T23:28:19.000+09:00",
    "category": "pita",
    "major": true,
    "title": "「ピタ止めチャレンジ」を追加",
    "changes": [
      "メーターを狙った数字で止める10ラウンド",
      "エンドレスを実装"
    ],
    "commit": "7b8ac547d02f862c4fdc23287ba932af08bc5ad3"
  },
  {
    "date": "2026-10-09",
    "datetime": "2026-10-09T20:38:33.000+09:00",
    "category": "site",
    "major": true,
    "title": "メンバー登録画面を全ゲームで共通化",
    "changes": [
      "登録・編集デザインを統一しアイコン重複を防止"
    ],
    "commit": "f5146fc5e5d47cfc0e79898d73cba641c96f1dbe"
  },
  {
    "date": "2026-10-09",
    "datetime": "2026-10-09T16:54:10.000+09:00",
    "category": "gesture",
    "major": true,
    "title": "「ジェスチャーバトル」を追加",
    "changes": [
      "2モード・チーム分け・大量お題・ゲーム進行を実装"
    ],
    "commit": "723ab9db281c8e9d0b05f3f874bf777dd6278003"
  },
  {
    "date": "2026-10-09",
    "datetime": "2026-10-09T16:18:02.000+09:00",
    "category": "site",
    "major": true,
    "title": "ゲーム一覧を大幅リニューアル",
    "changes": [
      "おすすめ表示・2列カード・カテゴリーフィルターを導入"
    ],
    "commit": "0c7c6fcc684fec2e604008c4431f2d348e6806cc"
  },
  {
    "date": "2026-10-09",
    "datetime": "2026-10-09T08:52:53.000+09:00",
    "category": "site",
    "major": false,
    "title": "放課後ゲーム部のアプリアイコンを導入",
    "changes": [
      "全ページとWebアプリの設定に共通アイコンを反映"
    ],
    "commit": "392f9256d34a2e2e4334e03f7bd4d979e9d7da28"
  },
  {
    "date": "2026-10-07",
    "datetime": "2026-10-07T09:50:38.000+09:00",
    "category": "tower",
    "major": false,
    "title": "教科書を同じ画面で配置できるように",
    "changes": [
      "選択・配置決定を同じ画面で完結"
    ],
    "commit": "652b863912a88adc7e070349e00971e425847e3b"
  },
  {
    "date": "2026-10-06",
    "datetime": "2026-10-06T21:39:01.000+09:00",
    "category": "tower",
    "major": false,
    "title": "教科書タワーのゲーム進行を実装",
    "changes": [
      "手番ごとに教科書を配置するルールを実装"
    ],
    "commit": "122f382e4c9d1a8ed2f3bf33cfb657f43ca65c2e"
  },
  {
    "date": "2026-10-06",
    "datetime": "2026-10-06T21:38:56.000+09:00",
    "category": "tower",
    "major": true,
    "title": "「教科書タワー」を追加",
    "changes": [
      "教科書を重ねる対戦ゲームのページを追加"
    ],
    "commit": "5ccaeed94208fdf9858b9e1b0931af81d969e31d"
  },
  {
    "date": "2026-10-06",
    "datetime": "2026-10-06T14:45:05.000+09:00",
    "category": "meter",
    "major": false,
    "title": "感覚メーターを完成版として整理",
    "changes": [
      "公開できるゲームとして操作・表示を整備"
    ],
    "commit": "c27a6ad488f1497dd87c192f5a1302c7dbb3d6fe"
  },
  {
    "date": "2026-10-05",
    "datetime": "2026-10-05T19:53:40.000+09:00",
    "category": "meter",
    "major": false,
    "title": "感覚メーターに200題を追加",
    "changes": [
      "幅広いテーマから遊べるように"
    ],
    "commit": "a50a3deff021a541e030d1c0743e89683ae7789e"
  },
  {
    "date": "2026-10-05",
    "datetime": "2026-10-05T19:52:43.000+09:00",
    "category": "meter",
    "major": true,
    "title": "「感覚メーター」基本ゲームを実装",
    "changes": [
      "数字の感覚を合わせるゲームを追加"
    ],
    "commit": "3d3845717092cf565fbb07fbbbf8cfafa453340c"
  },
  {
    "date": "2026-10-05",
    "datetime": "2026-10-05T08:10:10.000+09:00",
    "category": "docchi",
    "major": true,
    "title": "「みんなはどっち？」2モードを実装",
    "changes": [
      "2種類の遊び方・ゲーム進行・結果表示に対応"
    ],
    "commit": "8507142d6afa56719792d9f142fb9cb5a63dbf32"
  },
  {
    "date": "2026-10-05",
    "datetime": "2026-10-05T07:48:09.000+09:00",
    "category": "site",
    "major": false,
    "title": "共通メンバー登録の原型を追加",
    "changes": [
      "複数ゲームで使うメンバー登録を導入"
    ],
    "commit": "b3410d104b9e3030783e731d6aaae497153b01d0"
  },
  {
    "date": "2026-10-05",
    "datetime": "2026-10-05T07:42:17.000+09:00",
    "category": "docchi",
    "major": false,
    "title": "400問の質問ライブラリーを追加",
    "changes": [
      "カテゴリー別の質問と自作質問の準備を追加"
    ],
    "commit": "f11ffc06a0c69cf70d6ba19197ef2abc170ff41c"
  },
  {
    "date": "2026-10-05",
    "datetime": "2026-10-05T00:46:03.000+09:00",
    "category": "docchi",
    "major": false,
    "title": "「みんなはどっち？」を追加",
    "changes": [
      "ゲーム一覧に新作を追加",
      "質問への回答を楽しむゲームを企画"
    ],
    "commit": "ae4cc72eec7923cd61326b59db79b2f22532d91c"
  },
  {
    "date": "2026-10-04",
    "datetime": "2026-10-04T20:57:11.000+09:00",
    "category": "nise",
    "major": false,
    "title": "ニセ転校生に再戦機能を追加",
    "changes": [
      "同じ役職での再戦と役職の選び直しに対応"
    ],
    "commit": "069a0ae9b5138c52cafaa7423eeabe3b58143f80"
  },
  {
    "date": "2026-10-04",
    "datetime": "2026-10-04T13:29:23.000+09:00",
    "category": "nise",
    "major": false,
    "title": "あそびかたを2段階に整理",
    "changes": [
      "簡単ルールと詳しいルールを追加"
    ],
    "commit": "418771d473e6d6852bcc65f0a1e98eb1d32a1d15"
  },
  {
    "date": "2026-10-04",
    "datetime": "2026-10-04T07:46:07.000+09:00",
    "category": "site",
    "major": true,
    "title": "トップとゲーム一覧を分離",
    "changes": [
      "トップをスマホ1画面の構成に",
      "ゲームをえらぶ専用ページを新設"
    ],
    "commit": "b508f8f4103f0f48bf07fb82aa3f0709597f2149"
  },
  {
    "date": "2026-10-04",
    "datetime": "2026-10-04T00:56:58.000+09:00",
    "category": "nise",
    "major": true,
    "title": "「ニセ転校生を探せ！」の基本ゲームを実装",
    "changes": [
      "正体隠匿ゲームの役職・休み時間・投票を実装"
    ],
    "commit": "6bf8f456c582e6ab37af74fbc24773dfdbada1b2"
  },
  {
    "date": "2026-10-03",
    "datetime": "2026-10-03T23:30:31.000+09:00",
    "category": "site",
    "major": true,
    "title": "放課後ゲーム部、制作スタート",
    "changes": [
      "スマホ1台でみんなで遊ぶゲーム集の開発を開始"
    ],
    "commit": "ada0bd401f346546b7801e2311708d4561b30f68"
  }
];
