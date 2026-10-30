# 時代のなかの一人 — 完成に向けたゲーム設計書（初版）

更新日: 2026-10-29 / 状態: **Ver.0.2 家族・人間関係・職業システムを追加**
ジャンル: 歴史時代を舞台にした、出生から生涯を体験する人生シミュレーション。

## 目標

1. 日本史・世界史の多時代で「名の知れない普通の人」の人生を実際に体験できる。
2. 出生条件と居住地域は人生の選択可能性を規定するが、人生の価値を単純な成功・失敗で採点しない。
3. 人物には未来の史実を予知できない。プレイヤーが歴史の結末を知っていても、劇中の人物は当時得られる情報から判断する。
4. すべての年代が独立したゲームではなく、社会制度が変化しても同じ人物の年齢・家族・職業が継続する。
5. 一生の結果を家系図・年表・人々との比較として振り返る。

## 歴史研究の品質基準（最優先）

- 「史実」: 年・場所・出来事が資料と照合された内容。独立した \`data/historical-events.jp.json\` から表示。
- 「学術推計」: 研究者の資料による幅・欠損を明示。例: 1600年頃の人口は1,200万人説と1,800万人説がある。
- 「ゲーム用仮定」: 出生家庭の抽選比率、仕事の成否、健康悪化、死亡リスクなど。**現段階では一切を実測確率と称さない**。
- 歴史イベントの年だけで、全住民が巻き込まれたり死亡したりすると判定しない。地域、仕事、年齢、聞き伝えか現場かで違いをつける。
- 近世の身分を「士農工商」4つだけの固定序列にしない。地域・制度・生業は追加研究が必要。
- 世界史へ拡張した際も、現代の国連人口データ1950–2100を中世や古代に直接外挿しない。
- 第三者のゲーム固有のルール記述・イベント文・画像・UIを複製せず、統計データと公共の史実年表から独立制作する。

## 完成に必要な8つの柱

| システム | 内容 | 初版 | 将来 |
|---|---|---|---|
| 出生 | 時代、家柄、地域、資源、性別、出生年代 | 3時代・6地域、ゲーム比率 | 史料に基づく地域・時代別分布 |
| 年ごとの行動 | 働く、学ぶ、家族、休息、挑戦 | 5行動＋幼少期 | 年齢・身分・制度に応じて変化 |
| 社会 | 職業、社会制度、資産、身分・階層 | 仕事内容と転機 | 土地・税・移住・婚姻・教育・役所 |
| 家族 | 親、配偶者、子ども、友人関係 | 簡易年次イベント | 人物ごとに年齢・性格・運命を保持 |
| 歴史 | 戦争、飢饉、火災、改革 | 史実年表35件＋地域連動 | 地域別の状態、政策と暮らしの変化 |
| 偶然 | 能力や財産が結果の可能性を変える | 乱数付きの人生選択 | 統計検証済みのリスクモデル |
| 人生記録 | 年表、死亡、再開、比較 | 一生・年表・3スロット | 4人比較、生涯地図、家族史 |
| 継承 | 子として生きる、世界史 | 未実装 | 世代システム・文明の変化 |

## Ver.0.1 実装済みの定義

- \`scenarios.js\`: ゲーム内出生年代・6地域・家柄・時代別の職業の定義。人口比・歴史的な家柄確率ではなく均等な試作抽選。
- \`engine.js\`: シード付き疑似乱数による再現可能な人生状態遷移。出生、年次行動、節目の選択、地域と出典に連動した史実イベント、家族、死亡、結果を扱う。
- \`app.js\`: 表示、毎年の行動入力、イベント選択、最大5年進行、年表、ローカル3スロット保存・続きから。
- \`data/historical-events.jp.json\`: 独立調査による戦国〜明治の35史実イベント。
- 人口の参照推計: data/historical-population.jp.json。幕末1847〜1870年の全国人口（単位：千人、森田優三1944年の推定値をIPSS2024から引用）。死亡率・出生確率の代用禁止。
- \`data/data-sources.json\`: 公的・学術資料等17出典、調査用途と利用条件の注意。
- \`tests/history-life-engine.test.mjs\` と \`tests/history-life-browser.test.mjs\`: ロジック・スマホ画面・保存再開を検証。

これは**実装初版の試作**であり、史実人口の分布や実測死亡確率を持つ学術的な歴史人口シミュレーターではない。

## 制作ロードマップ

### Phase 0 — 技術実証（Ver.0.1）

- [x] 出生・成長・基本の職業、健康、財産・人間関係
- [x] 年ごとの5種類の行動、20〜70代の人生の節目
- [x] 史実イベントと地域の距離、史料へのリンク
- [x] 死亡・年表・3スロット、独立URL
- [x] シード付き再現可能なロジック、検証テスト
- [ ] 実プレイでの面白さ調整、年間イベントの密度向上

### Phase 1 — 戦国の一生を完成

- [ ] 尾張・京・関東などの地理、領主や地域の変化を年代ごとに反映
- [ ] 庶民の生活: 食糧・年貢・土地・家計・住居・病気・仕事の選択
- [ ] 幼少期から高齢期までのイベント100本以上と条件分岐
- [ ] 家庭の構成員を個別キャラクター化。家族が歳をとり、別れや子育てに影響
- [ ] 結婚・移住・職業転換と家柄ごとの現実的な制約
- [ ] 保存時の互換性と統計推計の検証

### Phase 2 — 江戸・幕末〜明治の時代差を完成

- [ ] 江戸の生業・地域差・火事・飢饉・奉公・町や村の暮らし
- [ ] 明治への制度移行、教育・職業機会と地域差
- [ ] 史実発生年と本人が知る時期を区別
- [ ] 社会制度テーブルと移住したときの地域変更
- [ ] 教育・寿命・生活条件の利用可能な資料を追加

### Phase 3 — 完成体験と長期リプレイ

- [ ] 4人並行人生比較、人生地図・生存曲線
- [ ] 子孫への引継ぎ、家系図、多世代人生
- [ ] 自動運転（イベントごとに停止・選択）とゲームスピード
- [ ] 特定の歴史的背景から始めるシナリオモード
- [ ] エンディング・複数人の人生記録・実績

### Phase 4 — 世界史と精密モデル

- [ ] 古代ローマ、中世欧州、産業革命期、近代世界など時代モジュール
- [ ] 言語・宗教・移動制約・法律・人口比の資料調査
- [ ] 年齢別生命表がない年代では不確実性幅を明示したモデル検証
- [ ] 専門家レビュー、出典監査、ゲーム確率の妥当性検証

## 面白さの評価基準

1. 「その家に生まれた」ことが選択肢や話に影響しているか。
2. 良い選択でも失敗し得るが、理不尽すぎて無意味に感じないか。
3. 史実の出来事が全員に同じ文章・同じ被害で出ていないか。
4. 5年遊んだときに、親・仕事・家族や知識の変化があるか。
5. 1人生15〜30分を目標にしているか（未測定）。
6. 何も成し遂げなかった人にも人間としての物語があるか。
7. 死後の年表を読んで、別の出生条件で再挑戦したくなるか。

## 開発上の重要リスク

- 当時の死亡率・家柄確率などの数値を推測のまま「実際の統計」と誤認させること。
- 年間数十回の選択が単調になること。今後は連続性ある人物・家族イベントが必要。
- 史実と個人への影響を混同すること。歴史イベントは政治の出来事と個人の生活への波及を別レイヤーにすること。
- 時代を追加するたびに \`engine.js\` を大幅改造すること。イベント・制度・職業はデータ側へ分離すること。
- 外部作品のUIやイベント文をコピーすること。独自の歴史データ・演出に限定すること。


## Ver.0.2 — 個人が生きる社会の土台

- 人物ID、名前、出生年、性格、関係の役割、親密度、存命状態を持つ家族・知人オブジェクト（social.js）。
- 父母・一部のきょうだいから誕生。11歳で友人に出会う。伴侶や子は一人ずつ人物として追加。
- 人物も毎年1歳ずつ年齢が進む。高齢時には別れが起こるが、これは **ゲーム用の仮定** であり当時の死亡統計ではない。
- 年に1回、特定人物と話す・手伝う・贈り物・仲直りする交流が可能。親密度と年表に残る。
- 仕事は時代別の職業表（careers.js）で選択可能。家業とのつながり、知識、技能により応募条件・採用確率が変わる。
- キャリア技能が年ごとに成長。見習い→一人前→熟練。所得は架空の0〜100生活余裕指標に反映。
- 転職は年に一度の挑戦。成功/失敗ともに年表に残り、失敗しても元の職業は維持。
- Ver.0.1の3スロット保存を \`upgradeSave()\` で移行。旧イベント・年齢・乱数状態を維持。
- 生存、婚姻、職業採用・収入の数値は **史実ではないゲーム調整値**。近世の制度を現代的な自由転職・婚姻と同一と断定しない。
- 依然として本人と他人物の関係イベントは簡易型。実際の地域別史料の調査と人物同士の連続した物語はVer.0.3以降に拡充。

## まだ必要な改善

- 伴侶・子の教育/相続/家の構成と社会的な制約、親族同士の交流。
- キャリア制限は現在ゲーム的な簡易条件であり、各藩/年代/身分に固有の制度とは切り離す。
- 世帯別生計・扶養費・病気/怪我と医療機会を、史料のある範囲で時代別に再設計。
- NPCごとの性格に沿った会話と選択の連鎖を増やす。


## Ver.0.3 — 本家の時間・人生イベント・家計設計を研究した独立実装

調査原典： https://1in8b.life/ja/ / https://1in8b.life/en/about/ 。
本家では30・60・90分、一時停止、最大16倍速、年ごとの重点、転機での停止が公式に確認できる。所得は国別の統計に基づく。
以下の内容は**本家のコードやイベント文章の複製ではなく独自の設計**。

### 時間
- 通常は9秒で1年進む短時間モード。停止状態からプレイヤーが▶を押して自動開始。1/2/4/8/16倍速。
- 人生の節目・史実イベント・人物イベントで自動停止。選択後に勝手に再開しない。
- 「次の出来事まで」はイベントか死亡まで安全に進め、最大110年で停止する。
- スマホバックグラウンド中は停止し、経過時間をまとめて飛ばさない。
- もとの「重点ボタンを押すと1年進む」操作は引き続き可能。自動進行時の重点は前回の選択を引き継ぐ。
- 毎回の行動で違いが分かるように、年表・状態・収支を毎年更新。

### 家計
- 全時代共通の架空単位 **生活点** を用いる。円・文・両・石・購買力平価ドルではない。比較を意図した数値ではない。
- 手元・貯蓄・借入を分け、年ごとの収入、生活費、扶養と特別な買い物、返済を家計台帳に記録。
- 仕事による収入・転職やイベントによる収支は財産状態に反映。幼少期は家の収入で支えられる。
- 家族の人数と職業で生活費・収入が変わる。支出超過は手元→貯蓄→借入の順に補う。借入限度60点・年4%の負担はゲーム用の**架空のルール**。
- 食料・道具・学び・家族のための特別支出は年1回。家計の状況と健康・知恵・幸福がつながる。
- 財産の0–100は暮らしの余裕の指標として残し、絶対額と区別する。現時点で歴史的な税・俸禄・通貨の再現はない。
- 旧Ver.0.1/0.2セーブは時代・人物・年齢・イベント・乱数を維持してVer.0.3へ移行する。

### 次に必要な追加
- 史料に基づく年貢・諸役・地域別穀物収量、災害時の価格変動、貨幣制度の年代別マッピング。
- イベントを人物の履歴や家計状態により複数年持続させる物語構造。
- 生活点は暫定のゲーム内指数であり、**歴史上の生活水準の正確な統計とはみなさない**。


### Ver.0.3 追加：条件付き人生イベント12種類

- 既存の歴史35件と年齢固定・6年ごとの人生節目は維持。さらに日常の独自条件付きイベントを追加。
- 家計の借入、健康、職業（農業/商売/手仕事）、家族、関係の深い人物を条件に内容を変える。
- 例: 暮らしの道具が壊れる、体調不良、仕事の誘い、貧困、学び、親しい人からの誘い、
  子どもの将来、収穫の見通し、客との縁、難しい注文、近所の助け合い、季節の変化。
- 毎年必ず事件が起こるわけではない。16歳以降を対象に抽選し、定期的な既存イベントと重なる年は抑制。
- 選択肢ごとに健康・知識・人間関係・収支を変化させ、仕事の成果などは確率判定。
- **事件の個人的な物語、選択肢、リスクや確率はすべて架空のゲームイベント**であり、史料に基づく人口統計や実際の歴史の特定個人の記録ではない。

- 自動進行中に重点ボタンを押した場合は、年を追加で進めずに次年の重点だけ変更し、選択状態を表示する。

- URLの `?seed=19` のような正の整数シードを指定すると、同一の出生条件を使ったときの乱数列を再現できる（試作テスト用、任意）。


## Ver.0.3.1 — Original-like pacing and historical-unit display (2026-10-29)

### Tempo
- Original 1in8b.life official settings: 30 / 60 / 90 minutes, with 40–60s per year at the ~60-minute setting. https://1in8b.life/ja/
- This original game's standard is **45 seconds/year (1x)**; 30 min preset = 22.5s/year, 90 min preset = 67.5s/year.
- Play/pause, 1–16x speed, event interruption, skip to next milestone, and manual year advancement remain. Settings saved in separate localStorage preference and can be changed in-game without changing a life save or RNG state.
- Preset refers to a hypothetical ~80-year life, not a guaranteed real-time play length (death and paused events change that).

### Historic currency and current-yen *reference* values
- Currency presentation \`currency.js\` changes with **actual year**, including the 1871 New Currency Act transition.
- Sengoku (pre-1601): mon and kanmon (1 kanmon = 1000 mon); indicative rice-price reference **1 mon ≈ ¥80** using the 1591 Kyoto 833 mon per koku and rice price of the reference's 2014 example. *Not a 2026 consumer-price index.*
  - https://crd.ndl.go.jp/reference/entry/reference/show?asc=desc&dtltbs=1&fi=5_%E5%80%8B%E4%BA%BA&id=1000170301&ldtl=1&mcmd=25&ndc1=337&ndc_lk=1&page=ref_view&st=update
- Edo 1601–1699: 1 ryo ≈ ¥100k rice-price basis and 1 ryo:4000 mon model.
- Edo 1700–1841: 1 ryo ≈ ¥40k–60k and 1 ryo:4000 mon model.
- Late Edo 1842–1870: 1 ryo ≈ ¥4k–10k and 1 ryo:6500 mon model. **Actual gold/copper exchange floated; historical official rate is not exact day-to-day reality.**
  - https://www.imes.boj.or.jp/cm/history/edojidaino1ryowa/index.html
- Meiji after 1871: yen/sen. Approximate yen comparisons refer to published examples:
  - 1871–1892: 1 yen ≈ ¥20k–40k *based on an 1886 salary example*, approximate application to nearby years **not historically verified**;
  - 1893–1906: 1 yen ≈ ¥6600 from 1893 rice-price example, approximate application to nearby years;
  - 1907 onward: 1 yen ≈ ¥2569 from 1912 rice-price example, approximate application to nearby years.
  - https://crd.ndl.go.jp/reference/entry/index.php?id=1000341363&page=ref_view
- **Most important limitation**: internal money remains fictional \`money.js\` points for compatible saves, and coins are a UI accounting conversion (Sengoku 100 mon/point, Edo 500 mon/point, Meiji 25 sen/point). These *gameplay design parameters are NOT observed period wages, historical exchange rates, or a scientifically meaningful year-to-year asset price series.* In particular, **wealth displayed before/after 1871 is not historically exchanged at an actual conversion rate**. Users see both historical denomination and approximate modern yen from source-specific comparison methods; labels explain uncertainty.
- No modifications to formal game catalog.


## Ver.0.4 — comparison, meaning and post-life features

Official source: https://1in8b.life/ja/ (checked 2026-10-29). Official product reports full auto-play, peers born in the same second, reflections at 5/15/30/50/70, a one-year-per-square life map, a **real life-table survival curve**, previous-life replay and export/import via its own service. This game uses original code and unique historical content.

Implemented independently:
- Auto decisions use the current stats, profession, age, family and focus priorities; all decisions are still recorded with their original effects. Can toggle off.
- Age 5/15/30/50/70 reflection questions, optional 140-character notes stored alongside save. These do not forcibly stop time, unlike the original.
- A one-square-per-year life map (health, joy, work, historic incidents), saved incrementally. Pre-existing saves only show years captured after migration; no historical trajectory is invented.
- Three alternative persons born the **same year but different Japanese regions**: each is an independent, deterministic fictional life simulated with the same game system. This is **not** census-backed or an actual historical survival cohort.
- Local archive browser, recorded life cards, JSON save transfer. No account, shared public memorial, public API or external storage.
- **Not yet implemented**: observed historical life-table survival curve, historically calibrated unequal birth odds, 100+ deeply connected stories, social sharing as image, formal classroom/accessible content modes, rigorous period economy and legal institutions.


### Historic event follow-through (v0.4)

After a history event choice, the game stores what the player decided and shows a follow-up dilemma **two years later** if that character survives. A farm worker hears different concerns from a merchant or craftsperson. The follow-up is explicitly a **fictional consequence** based on a real historic backdrop, not proof that any specific person was affected. A single-year event is not allowed to erase other same-year choices; the existing decision queue handles collisions. 1560 Okehazama -> 1562 follow-up has a regression test.


## Ver.0.5 — 歴史の中を数世代にわたって生きる

公式サイト v0.8.82 の再調査を踏まえた、競合比較・機能の優先順位は
\`COMPETITIVE_REVIEW.md\` を参照。

- 家族が続く人生という独自の価値を追加：死亡→存命の子どもを選ぶ→その年齢から人生を再開。
- 世代ID、人物の生没年・仕事、故人の親・存命の親・きょうだい・祖父母を保持する。
- 前世代は従来のローカルアーカイブに保存し、同じスロットでは子の続きを進める。
- 現存する子どもの人数で正味財産を均等配分するのは歴史的事実ではなく**仮のゲームルール**。
- 1603年、1853年で社会背景の時代モジュールを変更（本当の制度変更は段階的）。
- 同時代比較人物について正確な出生年を守る。従来の出生年ウィンドウに強制移動させない。
- 旧保存データはそのまま利用可能。家系は初回表示時に作成する。

未実装：史実の相続法や家庭ごとの制度、年齢別の学術的な生存リスク、家系を木構造で表示する図版、人物関係の数世代を跨ぐ深いイベント。


## Ver.0.5 P0-1 — 史料付き制度表示（2026-10-30）

- 社会制度をゲームロジックから分けた `institutions.js` に、9つの年代別表示レコードと7件の一次機関・公的機関の参照リンクを追加。
- 年代に応じて年貢・運上・冥加、寺子屋・藩校、1872学制、1873地租改正、1879教育令、1886小学校令、1900・1907年改正を示す。
- 独立画面の「その年の制度と暮らし」に折りたたみ表示し、人物の年齢・子ども・職業との関連を**未判定であることを明示しながら**説明する。
- 年号は制度の開始・改正を参照するための**表示用区間**。実際の地域別施行年・就学可能性・土地所有・税負担の判定は行わない。
- 現行の年次進行・能力変化・架空家計・乱数・セーブ仕様は変更しない。制度の数値効果を推測で足さない。
- 新規テスト: `tests/history-life-institutions.test.mjs`。境界年、資料URL、状態非破壊を検証し、スマホ画面テストも追加。

**次に行うこと**: 地域・家の土地所有・家族の年齢などの条件を、実史料と「未検証／ゲーム用仮定」の区別を維持してデータ化する。出典が確かになるまで具体的な税率・通学確率などの自動適用はしない。


## Ver.0.5.1 — コンパクトHUDと操作性改善（2026-10-30）

- 公式「80億分の1」では年齢・時間・再生/停止・速度・次の決断が主要操作にまとまる点を参考に、歴史版の独自デザインで再構成した。
- スマホでは画面上部に「年号・年齢 → 時間操作・次年進行バー → 5能力値 → 主人公の現在の物語・選択肢」を配置。
- 健康・知恵・関係・幸福・余裕の5指標を横1列の小型カードにし、元の数値・意味（0〜100）は変えず、旧右カラムにあった大きな棒グラフを廃止。
- 年内時間バーは太さ13px、100%幅、進行率パーセント・残り秒数を表示。スマホでは時間操作をスクロール時に上部固定。
- 時間設定（30/60/90分）と「決断もおまかせ」は折りたたみ。停止→再開しても経過中の進行率は維持（メニュー・転機・別人生への移動では従来の停止・リセット処理）。
- 詳細欄は5タブ（家族／仕事／お金／記録・時代／人物）に整理。ページの情報量は維持し、通常プレイで不要な縦積みを隠す。
- 変更はゲーム表示のHTML/CSS/操作UIのみ。ゲーム内能力・収支、時間倍率・イベント・保存データスキーマは変更しない。
- モバイル幅で能力値5件・進行バー幅と高さ・横はみ出し・タブ切替・一時停止後の進行率維持をPlaywrightテストで検証する。
- 公開サイト・実端末での直接目視確認はCIブラウザテストとは別。見え方の調整は実機確認後に実施する。


## Ver.0.5.2 — 誕生・人生記録・人生終了のプレイ体験（2026-10-30）

### 目的
本家80億分の1のユーザー提供スクリーンショットから、**年齢と時間進行の視認性／出生時の人物像／日々の人生の記録／終了時の余韻**という情報設計の良い点を分析し、歴史版固有の時代・家族・職業ルールに合わせて独自に実装。文章・ロゴ・配色・画面構成の複製は避ける。

### 実装
- 新規開始時のみ「出生」専用画面。出生年、時代、地域、氏名、性別、家柄、両親（既存NPC名と年齢）を表示。ゲーム用抽選であり実史料の出生率ではないことを明記。「この人生を生きる」で進行画面へ。
- セーブからの再開・子孫への継承では誕生画面を再表示しない。出生画面の表示・閉鎖はゲーム状態や乱数を変更しない。
- 年号・年齢・名前と、太い進行バー・進行操作をひとつのヘッダーにまとめ、スマホでスクロールしても表示。主要能力値のコンパクト表示と本文・選択肢をその下に配置。
- 年度の記録を新しい順3件だけ主画面に常時表示。「すべて見る」では従来の年表モーダルを利用。
- 人生終了時に暗い色調の終幕カードを表示し、出生年〜没年、享年、出身・最終職業・子ども・史実との接点を表示。もともとの後継者選択・人生記録閲覧・やり直しはそのまま残す。
- UIとテストだけの変更。エンジン、出生確率、寿命判定、通貨、継承規則、セーブスキーマは不変。

### 検証
- 自動ブラウザテストで出生・通常進行・記録・終了・家系継承、年齢と時間操作の固定表示を確認。
- Cloudflare Pages上の実端末での画面確認はGitHubテストとは別の工程。


## Ver.0.5.3 — 同時出生ルーレット（2026-10-30）

- 新規人生開始時、「時代」と「出生地」を**同じ画面内で同時に高速切り替え**する演出を追加。時代→出生地と順番には切り替えない。
- ランダム指定の項目は最初速く、約2.1秒で徐々に減速。最終的に両方の結果を同時確定し、少し表示してから出生紹介画面へ。
- 時代と出生地をそれぞれ個別に指定できる仕様は維持。固定項目は最初から「指定」として止まり、ランダム項目のみ切り替わる。両方固定の場合は即座に確定表示する。
- 「演出をスキップ」で即座に既存の出生紹介画面へ。端末の視覚効果を減らす設定にも対応する。
- **人生の抽選結果は演出開始より前に一度だけ生成**する。画面内の切り替えは表示専用で、実際の時代・地域・能力・寿命・乱数・セーブデータを変更しない。
- 続きからの再開と子孫への継承で抽選演出は再生しない。既存のロジックと保存形式は変更しない。
- Playwrightで双方同時表示・自動確定・指定値維持・スキップ・再開・スマホ幅・抽選結果非変更を検証する。
