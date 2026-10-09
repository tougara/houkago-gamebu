(()=>{
const app=document.getElementById('app');
const playersApi=window.HoukagoPlayers;

const DB=[];
let promptId=0;
function add(category,level,items){items.forEach(word=>DB.push({id:promptId++,category,level,word}))}

add('動物','easy',[
'ゴリラ','ゾウ','キリン','ネコ','イヌ','ウサギ','カンガルー','ペンギン','サル','ライオン','カメ','カエル','ニワトリ','ヘビ','ワニ','クマ','パンダ','リス','ハムスター','コアラ'
]);
add('動物','normal',[
'フラミンゴ','ナマケモノ','カニ','タコ','クラゲ','イルカ','サメ','アザラシ','カバ','サイ','ラクダ','ヤギ','ヒツジ','ウマ','クジャク','フクロウ','コウモリ','カメレオン','ダチョウ','ラッコ'
]);

add('スポーツ','easy',[
'サッカー','野球','バスケットボール','バレーボール','テニス','卓球','水泳','ボウリング','ゴルフ','スキー','スノーボード','縄跳び','腕相撲','相撲','マラソン','サイクリング','バドミントン','ボクシング','体操','ドッジボール'
]);
add('スポーツ','normal',[
'ラグビー','アーチェリー','フェンシング','サーフィン','スケートボード','スケート','カーリング','ハードル走','砲丸投げ','走り幅跳び','高跳び','剣道','柔道','空手','ダンス','チアリーディング','綱引き','リレー','トランポリン','ヨガ'
]);

add('日常','easy',[
'歯みがき','顔を洗う','寝る','起きる','ご飯を食べる','水を飲む','着替える','靴を履く','電話する','写真を撮る','テレビを見る','本を読む','掃除する','洗濯する','料理する','買い物する','傘をさす','髪をとかす','ドアを開ける','手を洗う'
]);
add('日常','normal',[
'寝坊する','忘れ物に気づく','道に迷う','待ち合わせをする','くしゃみをする','あくびをする','びっくりする','転びそうになる','重い荷物を持つ','熱いものを食べる','蚊に刺される','雨にぬれる','電車に乗り遅れる','鍵をなくす','プレゼントを開ける','部屋を片づける','目覚ましを止める','財布を探す','鏡を見る','ゲームで勝つ'
]);

add('学校','easy',[
'勉強する','黒板に書く','消しゴムを使う','ノートを取る','教科書を読む','手を挙げる','給食を食べる','掃除当番','ランドセルを背負う','テストを受ける','鉛筆を削る','体育をする','本を借りる','宿題をする','チャイムが鳴る','先生に質問する','席に座る','机を運ぶ','プリントを配る','校庭を走る'
]);
add('学校','normal',[
'居眠りする','忘れ物をする','遅刻する','テストで悩む','発表する','音読する','理科の実験','合唱する','絵を描く','習字をする','給食をおかわりする','廊下を急いで歩く','体育館で整列する','図書室で静かにする','答案を返される','友達にノートを見せる','先生に注意される','消しゴムを落とす','机の中を探す','掃除でほうきを使う'
]);

add('職業','easy',[
'先生','警察官','消防士','医者','看護師','料理人','美容師','運転手','カメラマン','大工','店員','歌手','野球選手','サッカー選手','漁師','農家','パイロット','歯医者','配達員','パン屋'
]);
add('職業','normal',[
'獣医','宇宙飛行士','ニュースキャスター','漫画家','画家','ダンサー','指揮者','研究者','寿司職人','保育士','救急隊員','警備員','駅員','バスガイド','庭師','マジシャン','審判','探偵','映画監督','整備士'
]);

add('食べ物','easy',[
'ラーメン','カレー','おにぎり','寿司','ピザ','ハンバーガー','アイスクリーム','ケーキ','バナナ','りんご','スイカ','とうもろこし','焼きそば','うどん','パン','ポテト','たこ焼き','餃子','オムライス','かき氷'
]);
add('食べ物','normal',[
'そば','焼き魚','ステーキ','鍋料理','おでん','パフェ','ホットドッグ','クレープ','プリン','シュークリーム','枝豆','焼きいも','サンドイッチ','目玉焼き','焼肉','しゃぶしゃぶ','チョコレート','ポップコーン','みかん','ぶどう'
]);

add('もの','easy',[
'スマートフォン','傘','時計','メガネ','カメラ','リュック','ハサミ','ほうき','扇風機','ドライヤー','掃除機','自転車','イス','机','テレビ','ゲーム機','ペットボトル','鉛筆','ランドセル','ボール'
]);
add('もの','normal',[
'双眼鏡','虫めがね','懐中電灯','体重計','温度計','望遠鏡','フライパン','やかん','アイロン','ギター','ピアノ','太鼓','ヘッドホン','スーツケース','脚立','じょうろ','釣りざお','ローラースケート','寝袋','ラケット'
]);

add('動き','easy',[
'走る','ジャンプする','泳ぐ','踊る','拍手する','手を振る','しゃがむ','背伸びする','投げる','蹴る','押す','引っぱる','持ち上げる','転がす','登る','すべる','回る','隠れる','追いかける','逃げる'
]);
add('動き','normal',[
'忍び足で歩く','綱を引く','穴を掘る','釣りをする','風船をふくらませる','ロープを登る','バランスを取る','大きく深呼吸する','寒くて震える','暑くてあおぐ','強風に耐える','重い扉を開ける','小さな虫を追う','高い所からのぞく','箱をそっと運ぶ','急ブレーキをかける','ボールをよける','水たまりを飛び越える','何かをこっそり隠す','遠くを指さす'
]);

const CATEGORY_ORDER=['動物','スポーツ','日常','学校','職業','食べ物','もの','動き'];
const state={
  screen:'title',history:[],gameStarted:false,mode:null,memberReturn:'flow',
  playerCount:4,players:[],memberIconTarget:null,
  teams:{orange:[],lime:[]},timeLimit:60,difficulty:'mix',
  selectedCategories:new Set(CATEGORY_ORDER),
  queue:[],turnIndex:0,scores:[],teamScores:{orange:0,lime:0},
  currentPrompt:null,usedPromptIds:new Set(),turnScore:0,passes:0,
  playing:false,timeLeft:60,timerId:null,countdownId:null,lastTurnScore:0,
  extraTurnPlayer:null
};

function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function shuffle(arr){const a=[...arr];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function stopTimers(){if(state.timerId){clearInterval(state.timerId);state.timerId=null}if(state.countdownId){clearInterval(state.countdownId);state.countdownId=null}}
function loadPlayers(){
  const d=playersApi?.load?.();
  state.playerCount=Math.max(2,Math.min(10,Number(d?.activeCount)||4));
  state.players=(d?.players||[]).slice(0,state.playerCount).map(x=>({...x}));
  while(state.players.length<state.playerCount)state.players.push({name:'プレイヤー'+(state.players.length+1),icon:'🙂'});
}
function logo(){return '<img class="title-logo" src="../../gesture_battle_logo.png" alt="ジェスチャーバトル">'}
function topNav(){return '<nav class="top-nav"><button class="nav-pill" data-back>← 1個前にもどる</button><button class="nav-pill" data-home>ゲームをえらぶ</button></nav>'}
function heading(t,p=''){return '<header class="screen-heading"><h1>'+esc(t)+'</h1>'+(p?'<p>'+esc(p)+'</p>':'')+'</header>'}
function memberChip(p){return '<span class="member-chip">'+esc(p.icon)+' '+esc(p.name)+'</span>'}
function currentPlayerIndex(){return state.queue[state.turnIndex]?.player ?? 0}
function currentTeam(){return state.queue[state.turnIndex]?.team || null}
function currentPlayer(){return state.players[currentPlayerIndex()]||{name:'プレイヤー',icon:'🙂'}}
function teamName(t){return t==='orange'?'オレンジチーム':'ライムチーム'}
function minPlayers(){return state.mode==='team'?4:2}

function titleScreen(){
  return topNav()+'<section class="title-card">'+logo()+'<p class="title-copy">声を使わず、動きだけで伝えよう！<br>正解したらすぐ次のお題へ！</p><div class="stack"><button class="btn yellow full" data-start-title>ゲームをはじめる</button><button class="btn secondary full" data-rules>あそびかた</button><button class="btn secondary full" data-members-direct>メンバーを選ぶ</button></div></section>';
}
function modeScreen(){
  return topNav()+heading('モードを選ぼう','遊び方に合わせて2つのモードから選べます')+
  '<div class="mode-grid">'+
    '<button class="mode-card free" data-mode="free"><div class="mode-badge-row"><span class="mode-badge">勝敗なし</span><span class="mode-players">2〜10人</span></div><strong>みんなでジェスチャー</strong><span>全員が順番に挑戦。みんなで何問正解できるか楽しもう！</span></button>'+
    '<button class="mode-card team" data-mode="team"><div class="mode-badge-row"><span class="mode-badge">2チーム対戦</span><span class="mode-players">4〜10人</span></div><strong>チームバトル</strong><span>2チームに分かれて、制限時間内の合計正解数で勝負！</span></button>'+
  '</div>';
}
function membersScreen(){
  loadPlayers();
  const nums=[];for(let n=minPlayers();n<=10;n++)nums.push(n);
  const used=state.players.map(p=>p.icon);
  return topNav()+heading('メンバーを選ぶ',state.mode==='team'?'チームバトルは4〜10人':'みんなでジェスチャーは2〜10人')+
    '<section class="card"><h2>何人で遊ぶ？</h2><div class="count-grid">'+nums.map(n=>'<button class="choice-btn '+(state.playerCount===n?'selected':'')+'" data-member-count="'+n+'">'+n+'人</button>').join('')+'</div></section>'+
    '<div class="member-edit-list">'+state.players.map((p,i)=>'<section class="member-edit-card"><button class="member-avatar-btn" data-member-avatar="'+i+'" aria-label="'+esc(p.name)+'のアイコンを変更">'+esc(p.icon)+'</button><div class="member-edit-main"><label>プレイヤー'+(i+1)+'<input data-member-name="'+i+'" maxlength="12" value="'+esc(p.name)+'"></label><div class="member-icon-picker '+(state.memberIconTarget===i?'open':'')+'">'+(playersApi?.ICONS||[]).map(ic=>'<button class="member-icon-choice '+(p.icon===ic?'selected':'')+'" data-member-icon="'+i+'" data-icon="'+ic+'" '+(p.icon!==ic&&used.includes(ic)?'disabled':'')+'>'+ic+'</button>').join('')+'</div></div></section>').join('')+'</div>'+
    '<button class="btn full" data-members-done>このメンバーで決定</button>';
}
function setupTeamsBalanced(){
  const ids=shuffle([...Array(state.playerCount).keys()]);
  state.teams={orange:[],lime:[]};
  ids.forEach((id,i)=>(i%2===0?state.teams.orange:state.teams.lime).push(id));
}
function teamsValid(){
  const a=state.teams.orange.length,b=state.teams.lime.length;
  return a>=2&&b>=2&&Math.abs(a-b)<=1&&a+b===state.playerCount;
}
function teamScreen(){
  if(state.teams.orange.length+state.teams.lime.length!==state.playerCount)setupTeamsBalanced();
  const renderTeam=(key)=>'<section class="team-column '+key+'"><h2>'+(key==='orange'?'オレンジ':'ライム')+'チーム '+state.teams[key].length+'人</h2><div class="team-list">'+state.teams[key].map(i=>'<button class="team-member" data-move-team="'+key+'" data-player="'+i+'">'+esc(state.players[i].icon)+' '+esc(state.players[i].name)+'</button>').join('')+'</div></section>';
  const odd=state.playerCount%2===1?'<div class="fairness-note">奇数人数のときは、人数が少ないチームから1人がもう1回ジェスチャーして、両チームの手番数をそろえます。</div>':'';
  return topNav()+heading('チームを決めよう','名前をタップすると反対のチームへ移動できます')+odd+
    '<div class="team-board">'+renderTeam('orange')+renderTeam('lime')+'</div>'+
    '<div class="team-actions"><button class="btn secondary" data-shuffle-teams>ランダムで分ける</button><button class="btn" data-team-done '+(!teamsValid()?'disabled':'')+'>このチームで決定</button></div>'+
    (!teamsValid()?'<p class="team-note">各チーム2人以上、人数差は1人までにしてください。</p>':'');
}
function settings1Screen(){
  return topNav()+heading('ゲーム設定','1 / 2　参加メンバーと制限時間')+
    '<div class="settings-progress"><span class="active"></span><span></span></div>'+
    '<section class="card"><div class="section-row"><div><h2>参加メンバー</h2><p>'+state.playerCount+'人で遊びます</p></div><button class="small-btn" data-edit-members>変更</button></div><div class="member-chips">'+state.players.map(memberChip).join('')+'</div></section>'+
    '<section class="card"><h2>制限時間</h2><p>1人のジェスチャー時間</p><div class="setting-row"><div class="segmented">'+[30,45,60].map(n=>'<button class="seg-btn '+(state.timeLimit===n?'selected':'')+'" data-time="'+n+'" aria-pressed="'+(state.timeLimit===n?'true':'false')+'">'+n+'秒</button>').join('')+'</div></div></section>'+
    '<button class="btn yellow full" data-settings-next>'+(state.mode==='team'?'次へ　チームを決める':'次へ　お題を設定')+'</button>';
}
function settings2Screen(){
  const poolCount=filteredPool().length;
  return topNav()+heading('お題設定','2 / 2　難しさとジャンル')+
    '<div class="settings-progress"><span class="active"></span><span class="active"></span></div>'+
    '<section class="card"><h2>お題の難しさ</h2><div class="setting-row"><div class="segmented">'+
      '<button class="seg-btn '+(state.difficulty==='easy'?'selected':'')+'" data-difficulty="easy" aria-pressed="'+(state.difficulty==='easy'?'true':'false')+'">やさしい</button>'+
      '<button class="seg-btn '+(state.difficulty==='normal'?'selected':'')+'" data-difficulty="normal" aria-pressed="'+(state.difficulty==='normal'?'true':'false')+'">ふつう</button>'+
      '<button class="seg-btn '+(state.difficulty==='mix'?'selected':'')+'" data-difficulty="mix" aria-pressed="'+(state.difficulty==='mix'?'true':'false')+'">ごちゃまぜ</button>'+
    '</div></div></section>'+
    '<section class="card"><div class="section-row"><div><h2>お題ジャンル</h2><p data-pool-count>'+poolCount+'問から出題</p></div><button class="small-btn" data-toggle-all aria-pressed="'+(CATEGORY_ORDER.every(c=>state.selectedCategories.has(c))?'true':'false')+'">全部</button></div><div class="category-grid" style="margin-top:10px">'+CATEGORY_ORDER.map(c=>'<button class="category-btn '+(state.selectedCategories.has(c)?'selected':'')+'" data-category="'+c+'" aria-pressed="'+(state.selectedCategories.has(c)?'true':'false')+'">'+c+'</button>').join('')+'</div></section>'+
    '<div class="settings-bottom-actions"><button class="btn secondary" data-settings-prev>前へ</button><button class="btn yellow" data-begin '+(poolCount<10?'disabled':'')+'>ゲームスタート</button></div>';
}
function updateSettingsUI(){
  document.querySelectorAll('[data-time]').forEach(b=>{
    const on=Number(b.dataset.time)===state.timeLimit;
    b.classList.toggle('selected',on);b.setAttribute('aria-pressed',String(on));
  });
  document.querySelectorAll('[data-difficulty]').forEach(b=>{
    const on=b.dataset.difficulty===state.difficulty;
    b.classList.toggle('selected',on);b.setAttribute('aria-pressed',String(on));
  });
  document.querySelectorAll('[data-category]').forEach(b=>{
    const on=state.selectedCategories.has(b.dataset.category);
    b.classList.toggle('selected',on);b.setAttribute('aria-pressed',String(on));
  });
  const poolCount=filteredPool().length;
  const countEl=document.querySelector('[data-pool-count]');
  if(countEl)countEl.textContent=poolCount+'問から出題';
  const begin=document.querySelector('[data-begin]');
  if(begin)begin.disabled=poolCount<10;
  const allBtn=document.querySelector('[data-toggle-all]');
  if(allBtn)allBtn.setAttribute('aria-pressed',String(CATEGORY_ORDER.every(c=>state.selectedCategories.has(c))));
}
function rulesScreen(){
  return topNav()+heading('あそびかた','動きだけでお題を伝えよう！')+
    '<div class="rules-list">'+
      '<section class="rule-step"><b>1</b><div><strong>出題者だけお題を見る</strong><span>スマホに1つずつお題が表示されます。</span></div></section>'+
      '<section class="rule-step"><b>2</b><div><strong>ジェスチャーで伝える</strong><span>声を出したり、文字を書いたりせず、動きだけで表現します。</span></div></section>'+
      '<section class="rule-step"><b>3</b><div><strong>当たったら「正解！」</strong><span>出題者が正解ボタンを押すと+1点。そのまま次のお題が出ます。</span></div></section>'+
      '<section class="rule-step"><b>4</b><div><strong>難しかったら「パス」</strong><span>得点なしで次のお題へ。制限時間内にどんどん進めよう！</span></div></section>'+
    '</div>'+
    '<section class="rule-ban">NG：しゃべる・口パクする・文字を書く・指で文字や数字を形作る。<br>小道具は使わず、体の動きだけで表現しよう。</section>'+
    '<section class="card"><h2>2つのモード</h2><p><strong>みんなでジェスチャー：</strong>全員で正解数を積み上げます。<br><strong>チームバトル：</strong>2チームの合計正解数で勝負します。</p></section>'+
    '<button class="btn secondary full rules-bottom-back" data-rules-back>← もどる</button>';
}
function scoreStrip(){
  if(state.mode==='team')return '<div class="score-strip"><span class="score-chip orange">オレンジ '+state.teamScores.orange+'点</span><span class="score-chip lime">ライム '+state.teamScores.lime+'点</span></div>';
  const total=state.scores.reduce((a,b)=>a+b,0);
  return '<div class="score-strip"><span class="score-chip">みんなの合計 '+total+'問</span></div>';
}
function handoffScreen(){
  const p=currentPlayer(),t=currentTeam();
  return topNav()+'<div class="turn-status"><strong>'+(state.turnIndex+1)+' / '+state.queue.length+'人目</strong><span>次の出題者</span></div>'+scoreStrip()+
    '<section class="handoff-card">'+(t?'<span class="team-label '+t+'">'+teamName(t)+'</span>':'')+
    '<div class="big-avatar">'+esc(p.icon)+'</div><h1>'+esc(p.name)+'さんの番！</h1><p>スマホを'+esc(p.name)+'さんに渡してください。<br>次のお題は本人だけが見てね。</p><button class="btn yellow full" data-show-topic>お題を見る</button></section>';
}
function topicScreen(){
  const p=currentPlayer(),t=currentTeam();
  if(!state.currentPrompt)state.currentPrompt=drawPrompt();
  return topNav()+'<div class="turn-status"><strong>'+(state.turnIndex+1)+' / '+state.queue.length+'人目</strong><span>'+esc(p.name)+'さん</span></div>'+scoreStrip()+
    '<section class="ready-topic-card">'+(t?'<span class="team-label '+t+'">'+teamName(t)+'</span>':'')+
    '<div class="topic-preview"><small>最初のお題</small><strong>'+esc(state.currentPrompt.word)+'</strong></div>'+
    '<p class="ready-tip">お題を確認したらスマホを持ったままジェスチャー開始！<br>正解・パスを押すたび次のお題に変わります。</p>'+
    '<button class="btn yellow full" data-start-turn>スタート！</button></section>';
}
function playScreen(){
  const p=currentPlayer(),t=currentTeam(),q=state.currentPrompt||drawPrompt();
  state.currentPrompt=q;
  const len=[...q.word].length;
  const promptSizeClass=len>=11?' very-long':len>=7?' long':'';
  return topNav()+'<section class="play-screen">'+
    '<div class="play-top"><div class="left">'+(t?'<span>'+teamName(t)+'</span>':'<span>みんなでジェスチャー</span>')+'<strong>'+esc(p.icon)+' '+esc(p.name)+'</strong></div><div class="timer-wrap"><small>のこり</small><span class="timer" id="timerValue">'+state.timeLeft+'</span></div><div class="right"><span>正解</span><strong><span id="turnScore">'+state.turnScore+'</span>問</strong></div></div>'+
    scoreStrip()+
    '<div class="prompt-stage prompt-concealed" id="promptStage"><small>ジェスチャーで伝えよう！</small><div class="prompt-word'+promptSizeClass+'" id="promptWord">'+esc(q.word)+'</div><span class="prompt-category" id="promptCategory">'+esc(q.category)+'</span></div>'+
    '<div class="play-actions"><button class="play-btn pass" data-pass>パス</button><button class="play-btn correct" data-correct>正解！ +1</button></div>'+
    '<div class="countdown-overlay" id="countdownOverlay"><div class="countdown-number" id="countdownNumber">3</div></div>'+
  '</section>';
}
function turnResultScreen(){
  const p=currentPlayer(),t=currentTeam();
  const next=state.turnIndex+1<state.queue.length?state.players[state.queue[state.turnIndex+1].player]:null;
  return topNav()+scoreStrip()+'<section class="result-card">'+
    '<div class="big-avatar" style="color:#17213b;background:#eef4fa;border-color:#dce5ef">'+esc(p.icon)+'</div>'+
    '<h1>'+esc(p.name)+'さんの結果</h1><div class="turn-score">'+state.lastTurnScore+'<small> 問正解</small></div>'+
    (t?'<div class="score-change">'+teamName(t)+'に +'+state.lastTurnScore+'点</div>':'<div class="score-change">みんなの合計に +'+state.lastTurnScore+'問</div>')+
    '<p>パス '+state.passes+'問'+(next?'<br>次は '+esc(next.icon)+' '+esc(next.name)+'さん':'')+'</p>'+
    '<button class="btn full" data-next-turn>'+(next?'次の人へ':'最終結果を見る')+'</button></section>';
}
function rankingRows(){
  return state.players.map((p,i)=>({i,p,score:state.scores[i]||0})).sort((a,b)=>b.score-a.score).map((x,rank)=>'<div class="rank-row"><b>'+(rank+1)+'</b><span>'+esc(x.p.icon)+' '+esc(x.p.name)+'</span><strong>'+x.score+'問</strong></div>').join('');
}
function finalScreen(){
  const maxScore=Math.max(...state.scores,0);
  const mvp=state.players.map((p,i)=>({p,score:state.scores[i]||0})).filter(x=>x.score===maxScore);
  if(state.mode==='team'){
    const a=state.teamScores.orange,b=state.teamScores.lime;
    const winner=a===b?'引き分け！':(a>b?'オレンジチーム WIN！':'ライムチーム WIN！');
    return topNav()+'<div class="final-wrap"><section class="winner-card"><div class="winner-crown">🏆</div><h1>'+winner+'</h1><div class="team-total-board"><div class="team-total orange"><span>オレンジ</span><strong>'+a+'</strong><span>点</span></div><div class="team-total lime"><span>ライム</span><strong>'+b+'</strong><span>点</span></div></div><p>全員の結果は下で確認できます。</p></section><section class="card"><h2>個人スコア</h2><div class="ranking">'+rankingRows()+'</div></section><div class="stack"><button class="btn yellow full" data-replay>同じチームでもう一度</button><button class="btn secondary full" data-change-team>チームを変えて再戦</button><button class="btn secondary full" data-title>タイトルへ</button></div></div>';
  }
  const total=state.scores.reduce((a,b)=>a+b,0);
  return topNav()+'<div class="final-wrap"><section class="total-highlight"><span>みんなで正解した数</span><strong>'+total+'</strong><span>問！</span></section><section class="card"><h2>みんなの結果</h2><div class="ranking">'+rankingRows()+'</div><p style="text-align:center;margin-top:10px">MVP：'+mvp.map(x=>esc(x.p.icon)+' '+esc(x.p.name)+' '+x.score+'問').join(' / ')+'</p></section><div class="stack"><button class="btn yellow full" data-replay>同じ設定でもう一度</button><button class="btn secondary full" data-title>タイトルへ</button></div></div>';
}

function filteredPool(){
  return DB.filter(q=>state.selectedCategories.has(q.category)&&(state.difficulty==='mix'||q.level===state.difficulty));
}
function drawPrompt(){
  let pool=filteredPool().filter(q=>!state.usedPromptIds.has(q.id));
  if(!pool.length){state.usedPromptIds.clear();pool=filteredPool()}
  if(!pool.length)return {id:-1,category:'お題',word:'ジェスチャー'};
  const q=pool[Math.floor(Math.random()*pool.length)];
  state.usedPromptIds.add(q.id);
  return q;
}
function buildQueue(){
  state.extraTurnPlayer=null;
  if(state.mode==='free'){
    state.queue=shuffle([...Array(state.playerCount).keys()]).map(player=>({player,team:null}));
    return;
  }
  let orange=shuffle(state.teams.orange),lime=shuffle(state.teams.lime);
  if(orange.length!==lime.length){
    const smaller=orange.length<lime.length?orange:lime;
    const extra=smaller[Math.floor(Math.random()*smaller.length)];
    state.extraTurnPlayer=extra;
    if(orange.length<lime.length)orange=[...orange,extra];else lime=[...lime,extra];
  }
  const count=Math.max(orange.length,lime.length);
  const q=[];
  for(let i=0;i<count;i++){if(orange[i]!=null)q.push({player:orange[i],team:'orange'});if(lime[i]!=null)q.push({player:lime[i],team:'lime'})}
  state.queue=q;
}
function beginGame(){
  stopTimers();loadPlayers();
  state.scores=Array(state.playerCount).fill(0);state.teamScores={orange:0,lime:0};state.usedPromptIds.clear();
  state.turnIndex=0;state.turnScore=0;state.passes=0;state.lastTurnScore=0;state.currentPrompt=null;state.gameStarted=true;
  buildQueue();go('handoff',{push:false});
}
function startTurn(){
  stopTimers();state.turnScore=0;state.passes=0;state.timeLeft=state.timeLimit;state.currentPrompt=state.currentPrompt||drawPrompt();state.playing=false;
  go('play',{push:false});
  let n=3;
  const num=document.getElementById('countdownNumber');
  const overlay=document.getElementById('countdownOverlay');
  if(num)num.textContent=n;
  state.countdownId=setInterval(()=>{
    n--;
    if(n>0){if(num)num.textContent=n;return}
    clearInterval(state.countdownId);state.countdownId=null;
    if(num)num.textContent='START!';
    setTimeout(()=>{
      if(overlay)overlay.remove();
      document.getElementById('promptStage')?.classList.remove('prompt-concealed');
      startClock();
    },350);
  },700);
}
function startClock(){
  state.playing=true;
  state.timerId=setInterval(()=>{
    state.timeLeft--;
    const el=document.getElementById('timerValue');
    if(el){el.textContent=state.timeLeft;el.classList.toggle('danger',state.timeLeft<=10)}
    if(state.timeLeft<=0)finishTurn();
  },1000);
}
function nextPrompt(correct){
  if(!state.playing)return;
  if(correct){state.turnScore++;const s=document.getElementById('turnScore');if(s)s.textContent=state.turnScore}else state.passes++;
  state.currentPrompt=drawPrompt();
  const w=document.getElementById('promptWord'),c=document.getElementById('promptCategory');
  if(w){
    w.textContent=state.currentPrompt.word;
    const len=[...state.currentPrompt.word].length;
    w.classList.toggle('long',len>=7&&len<11);
    w.classList.toggle('very-long',len>=11);
  }
  if(c)c.textContent=state.currentPrompt.category;
}
function finishTurn(){
  if(!state.playing&&state.timeLeft>0)return;
  stopTimers();state.playing=false;
  state.lastTurnScore=state.turnScore;
  const pi=currentPlayerIndex();state.scores[pi]=(state.scores[pi]||0)+state.turnScore;
  const t=currentTeam();if(t)state.teamScores[t]+=state.turnScore;
  go('turnResult',{push:false});
}
function advanceTurn(){
  if(state.turnIndex+1>=state.queue.length){state.gameStarted=false;go('final',{push:false});return}
  state.turnIndex++;state.currentPrompt=null;state.turnScore=0;state.passes=0;go('handoff',{push:false});
}
function replaySame(){
  state.history=[];beginGame();
}

function screenHtml(){
  return ({
    title:titleScreen,mode:modeScreen,members:membersScreen,teams:teamScreen,settings1:settings1Screen,settings2:settings2Screen,
    rules:rulesScreen,handoff:handoffScreen,topic:topicScreen,play:playScreen,turnResult:turnResultScreen,final:finalScreen
  }[state.screen]||titleScreen)();
}
function render(){stopTimers();app.className='gesture-app screen-'+state.screen;app.innerHTML=screenHtml();bind();window.scrollTo({top:0,behavior:'auto'})}
function go(s,{push=true}={}){if(push&&state.screen!==s)state.history.push(state.screen);state.screen=s;render()}
function doBackOne(){
  stopTimers();
  if(state.screen==='play'){state.screen='topic';render();return}
  if(state.history.length){state.screen=state.history.pop();render();return}
  location.href='../';
}
function navConfirm(type){
  if(!state.gameStarted){if(type==='home')location.href='../';else doBackOne();return}
  document.querySelector('.recheck-backdrop')?.remove();
  const wrap=document.createElement('div');wrap.className='recheck-backdrop';
  wrap.innerHTML='<section class="recheck-modal"><span class="warning">ゲームの途中です</span><h2>'+(type==='home'?'ゲームをやめますか？':'1個前にもどりますか？')+'</h2><p>'+(type==='home'?'今のゲームを終了して、ゲーム一覧へ戻ります。':'今の手番の進行はリセットされます。')+'</p><div class="recheck-actions"><button class="btn secondary" data-cancel>ゲームにもどる</button><button class="btn danger" data-ok>ほんとにもどる</button></div></section>';
  document.body.appendChild(wrap);
  wrap.querySelector('[data-cancel]').addEventListener('click',()=>wrap.remove());
  wrap.querySelector('[data-ok]').addEventListener('click',()=>{stopTimers();wrap.remove();if(type==='home'){state.gameStarted=false;location.href='../'}else doBackOne()});
}
function afterMembers(){
  loadPlayers();
  if(state.memberReturn==='title'){
    state.memberReturn='flow';
    state.history=[];
    go('title',{push:false});
    return;
  }
  if(state.memberReturn==='settings1'){
    state.memberReturn='flow';
    if(state.mode==='team'&&!teamsValid())setupTeamsBalanced();
    if(state.history[state.history.length-1]==='settings1')state.history.pop();
    go('settings1',{push:false});
    return;
  }
  if(state.mode==='team'){
    if(state.playerCount<4){alert('チームバトルは4人以上で遊んでください。');return}
    setupTeamsBalanced();go('teams');
  }else go('settings1');
}
function moveTeam(player,from){
  const to=from==='orange'?'lime':'orange';
  state.teams[from]=state.teams[from].filter(x=>x!==player);
  if(!state.teams[to].includes(player))state.teams[to].push(player);
  render();
}
function bind(){
  document.querySelector('[data-back]')?.addEventListener('click',()=>navConfirm('back'));
  document.querySelector('[data-home]')?.addEventListener('click',()=>navConfirm('home'));
  document.querySelector('[data-start-title]')?.addEventListener('click',()=>{state.history=[];go('mode',{push:false})});
  document.querySelector('[data-rules]')?.addEventListener('click',()=>go('rules'));
  document.querySelector('[data-rules-back]')?.addEventListener('click',doBackOne);
  document.querySelector('[data-members-direct]')?.addEventListener('click',()=>{state.mode=state.mode||'free';state.memberReturn='title';state.memberIconTarget=null;go('members')});
  document.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>{state.mode=b.dataset.mode;state.memberReturn='flow';loadPlayers();if(state.mode==='team'&&state.playerCount<4){playersApi?.setActiveCount?.(4);loadPlayers()}state.teams={orange:[],lime:[]};state.memberIconTarget=null;go('settings1')}));
  document.querySelectorAll('[data-member-count]').forEach(b=>b.addEventListener('click',()=>{playersApi?.setActiveCount?.(Number(b.dataset.memberCount));state.memberIconTarget=null;loadPlayers();render()}));
  document.querySelectorAll('[data-member-avatar]').forEach(b=>b.addEventListener('click',()=>{const i=Number(b.dataset.memberAvatar);state.memberIconTarget=state.memberIconTarget===i?null:i;render()}));
  document.querySelectorAll('[data-member-icon]').forEach(b=>b.addEventListener('click',()=>{const i=Number(b.dataset.memberIcon);playersApi?.setPlayer?.(i,{icon:b.dataset.icon});state.memberIconTarget=null;loadPlayers();render()}));
  document.querySelectorAll('[data-member-name]').forEach(input=>input.addEventListener('input',()=>{const i=Number(input.dataset.memberName);playersApi?.setPlayer?.(i,{name:input.value||('プレイヤー'+(i+1))});loadPlayers()}));
  document.querySelector('[data-members-done]')?.addEventListener('click',afterMembers);
  document.querySelectorAll('[data-move-team]').forEach(b=>b.addEventListener('click',()=>moveTeam(Number(b.dataset.player),b.dataset.moveTeam)));
  document.querySelector('[data-shuffle-teams]')?.addEventListener('click',()=>{setupTeamsBalanced();render()});
  document.querySelector('[data-team-done]')?.addEventListener('click',()=>{if(teamsValid())go('settings2')});
  document.querySelectorAll('[data-time]').forEach(b=>b.addEventListener('click',()=>{state.timeLimit=Number(b.dataset.time);updateSettingsUI()}));
  document.querySelectorAll('[data-difficulty]').forEach(b=>b.addEventListener('click',()=>{state.difficulty=b.dataset.difficulty;updateSettingsUI()}));
  document.querySelectorAll('[data-category]').forEach(b=>b.addEventListener('click',()=>{
    const cat=b.dataset.category;
    if(state.selectedCategories.has(cat)){if(state.selectedCategories.size>1)state.selectedCategories.delete(cat)}
    else state.selectedCategories.add(cat);
    updateSettingsUI();
  }));
  document.querySelector('[data-toggle-all]')?.addEventListener('click',()=>{
    state.selectedCategories=new Set(CATEGORY_ORDER);
    updateSettingsUI();
  });
  document.querySelector('[data-edit-members]')?.addEventListener('click',()=>{state.memberReturn='settings1';state.memberIconTarget=null;go('members')});
  document.querySelector('[data-settings-next]')?.addEventListener('click',()=>{if(state.mode==='team'){setupTeamsBalanced();go('teams')}else go('settings2')});
  document.querySelector('[data-settings-prev]')?.addEventListener('click',doBackOne);
  document.querySelector('[data-begin]')?.addEventListener('click',beginGame);
  document.querySelector('[data-show-topic]')?.addEventListener('click',()=>{state.currentPrompt=drawPrompt();go('topic',{push:false})});
  document.querySelector('[data-start-turn]')?.addEventListener('click',startTurn);
  document.querySelector('[data-correct]')?.addEventListener('click',()=>nextPrompt(true));
  document.querySelector('[data-pass]')?.addEventListener('click',()=>nextPrompt(false));
  document.querySelector('[data-next-turn]')?.addEventListener('click',advanceTurn);
  document.querySelector('[data-replay]')?.addEventListener('click',replaySame);
  document.querySelector('[data-change-team]')?.addEventListener('click',()=>{state.gameStarted=false;setupTeamsBalanced();go('teams',{push:false})});
  document.querySelector('[data-title]')?.addEventListener('click',()=>{state.gameStarted=false;state.history=[];go('title',{push:false})});
}
loadPlayers();render();
})();