(()=>{
const app=document.getElementById('app');
const playersApi=window.HoukagoPlayers;
const LONG_PRESS_MS=550;
const SUBJECTS=[
  {key:'japanese',label:'国語',count:8,image:'../../textbook_japanese.png'},
  {key:'math',label:'算数',count:7,image:'../../textbook_math.png'},
  {key:'science',label:'理科',count:7,image:'../../textbook_science.png'},
  {key:'social',label:'社会',count:7,image:'../../textbook_social_studies.png'},
  {key:'english',label:'英語',count:7,image:'../../textbook_english.png'}
];
const SUBJECT_MAP=Object.fromEntries(SUBJECTS.map(x=>[x.key,x]));
const state={
  screen:'title',history:[],gameStarted:false,
  playerCount:4,players:[],penalties:[],
  round:0,totalRounds:4,startPlayer:0,currentPlayer:0,
  hands:[],board:new Map(),active:[],roundOutcomes:[],movesMade:0,
  selectedSubject:null,pendingPlace:null,lastEvent:null,rulePage:0
};
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
const PLAYER_COUNT_KEY='houkago_kyokasho_tower_player_count_v1';
function clampPlayers(n){n=Number(n)||4;return Math.max(2,Math.min(6,Math.round(n)))}
function loadTowerPlayerCount(fallback=4){
  try{
    const saved=localStorage.getItem(PLAYER_COUNT_KEY);
    if(saved!==null)return clampPlayers(saved);
  }catch(e){}
  return clampPlayers(fallback);
}
function saveTowerPlayerCount(n){
  const count=clampPlayers(n);
  try{localStorage.setItem(PLAYER_COUNT_KEY,String(count))}catch(e){}
  return count;
}
function loadPlayers(){
  const d=playersApi?.load?.();
  state.playerCount=loadTowerPlayerCount(d?.activeCount||4);
  if(d)state.players=d.players.slice(0,state.playerCount).map(x=>({...x}));
  else state.players=Array.from({length:state.playerCount},(_,i)=>({name:'プレイヤー'+(i+1),icon:'🙂'}));
  state.totalRounds=state.playerCount;
}
function subject(key){return SUBJECT_MAP[key]}
function topNav(){return '<nav class="top-nav"><button class="nav-pill" data-back>← 1個前にもどる</button><button class="nav-pill" data-home>ゲームをえらぶ</button></nav>'}
function heading(t,p=''){return '<header class="screen-heading"><h1>'+esc(t)+'</h1>'+(p?'<p>'+esc(p)+'</p>':'')+'</header>'}
function logo(){return '<img class="title-logo" src="../../kyokasho_tower_logo.png" alt="教科書タワー">'}
function memberChip(p){return '<span class="member-chip">'+esc(p.icon)+' '+esc(p.name)+'</span>'}
function boardKey(level,x){return level+','+x}
function getCard(level,x){return state.board.get(boardKey(level,x))||null}
function setCard(level,x,key){state.board.set(boardKey(level,x),key)}
function bottomXs(){return [...state.board.keys()].map(k=>k.split(',').map(Number)).filter(v=>v[0]===0).map(v=>v[1]).sort((a,b)=>a-b)}
function bottomBounds(){const xs=bottomXs();return xs.length?{min:xs[0],max:xs[xs.length-1],len:xs.length}:{min:0,max:0,len:0}}
function handTotal(i){return Object.values(state.hands[i]||{}).reduce((a,b)=>a+b,0)}
function makeEmptyHand(){return Object.fromEntries(SUBJECTS.map(s=>[s.key,0]))}
function shuffle(arr){for(let i=arr.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[arr[i],arr[j]]=[arr[j],arr[i]]}return arr}
function makeDeck(){const deck=[];SUBJECTS.forEach(s=>{for(let i=0;i<s.count;i++)deck.push(s.key)});return shuffle(deck)}
function legalPositionsForSubject(key){
  const b=bottomBounds();
  if(!b.len)return[{level:0,x:0,kind:'first'}];
  const out=[];
  if(b.len<8){
    out.push({level:0,x:b.min-1,kind:'left'});
    out.push({level:0,x:b.max+1,kind:'right'});
  }
  for(let level=1;level<8;level++){
    const rowMin=b.min,rowMax=b.max-level;
    if(rowMax<rowMin)break;
    for(let x=rowMin;x<=rowMax;x++){
      if(getCard(level,x))continue;
      const a=getCard(level-1,x),c=getCard(level-1,x+1);
      if(a&&c&&(a===key||c===key))out.push({level,x,kind:'upper'});
    }
  }
  return out;
}
function playerHasMove(i){
  const hand=state.hands[i]||{};
  return SUBJECTS.some(s=>(hand[s.key]||0)>0&&legalPositionsForSubject(s.key).length>0);
}
function nextActiveFrom(i){
  for(let step=1;step<=state.playerCount;step++){
    const j=(i+step)%state.playerCount;
    if(state.active[j])return j;
  }
  return -1;
}
function currentScoresStrip(){
  return '<div class="score-strip">'+state.players.map((p,i)=>'<span class="score-chip">'+esc(p.icon)+' '+esc(p.name)+' '+(state.penalties[i]||0)+'点</span>').join('')+'</div>';
}
function renderBoard(opts={}){
  const key=opts.subjectKey||null;
  const interactive=!!opts.interactive;
  const preview=opts.previewPlace||null;
  const b=bottomBounds();
  const legal=key?legalPositionsForSubject(key):[];
  const legalSet=new Set(legal.map(p=>boardKey(p.level,p.x)));

  if(!b.len){
    let first='<div class="board-empty">まだ教科書はありません。<br>最初の1冊を置こう。</div>';
    if(interactive&&key){
      const d=subject(key);
      const isPreview=preview&&preview.level===0&&preview.x===0;
      first=isPreview
        ? '<div class="tower-row"><div class="tower-cell tower-preview-choice"><span class="inline-preview-here">ここ</span><img class="tower-book" src="'+d.image+'" alt="'+d.label+'"></div></div>'
        : '<div class="tower-row"><div class="tower-cell"><button class="tower-slot first-slot" data-place-level="0" data-place-x="0" aria-label="最初の1冊をここに置く"><span aria-hidden="true">＋</span></button></div></div>';
    }
    return '<section class="card board-card '+(interactive?'board-selecting':'')+'"><div class="board-meta"><span>'+(key?subject(key).label+'を置ける場所':'教科書タワー')+'</span><span>土台 0 / 8冊</span></div><div class="tower-board '+(interactive?'first-placement':'')+'">'+first+'</div></section>';
  }

  const fixed=b.len===8;
  const maxLevel=fixed?7:Math.max(0,b.len-1);
  const rows=[];

  for(let level=maxLevel;level>=0;level--){
    let rowMin=b.min;
    let rowMax=b.max-level;
    if(level===0&&interactive&&!fixed){
      rowMin=b.min-1;
      rowMax=b.max+1;
    }
    if(rowMax<rowMin)continue;

    const cells=[];
    for(let x=rowMin;x<=rowMax;x++){
      const card=getCard(level,x);
      const canPlace=interactive&&legalSet.has(boardKey(level,x));
      const isPreview=interactive&&key&&preview&&preview.level===level&&preview.x===x;
      if(card){
        const d=subject(card);
        cells.push('<div class="tower-cell"><img class="tower-book" src="'+d.image+'" alt="'+d.label+'"></div>');
      }else if(isPreview){
        const d=subject(key);
        cells.push('<div class="tower-cell tower-preview-choice"><span class="inline-preview-here">ここ</span><img class="tower-book" src="'+d.image+'" alt="'+d.label+'"></div>');
      }else if(canPlace){
        cells.push('<div class="tower-cell"><button class="tower-slot" data-place-level="'+level+'" data-place-x="'+x+'" aria-label="ここに置く"><span aria-hidden="true">＋</span></button></div>');
      }else if(level>0||fixed){
        cells.push('<div class="tower-cell"><span class="tower-frame" aria-hidden="true"></span></div>');
      }else{
        cells.push('<div class="tower-cell"><span class="tower-empty"></span></div>');
      }
    }
    rows.push('<div class="tower-row">'+cells.join('')+'</div>');
  }

  return '<section class="card board-card '+(interactive?'board-selecting':'')+'"><div class="board-meta"><span>'+(key?subject(key).label+'を置ける場所':'教科書タワー')+'</span><span>土台 '+b.len+' / 8冊</span></div><div class="tower-board '+(fixed?'tower-fixed':'tower-growing')+'">'+rows.join('')+'</div></section>';
}
function renderPlacementPreview(level,x,key){
  const preview=new Map(state.board);
  preview.set(boardKey(level,x),key);
  const positions=[...preview.keys()].map(k=>k.split(',').map(Number));
  const bottom=positions.filter(v=>v[0]===0).map(v=>v[1]).sort((a,b)=>a-b);
  const min=bottom.length?bottom[0]:x;
  const max=bottom.length?bottom[bottom.length-1]:x;
  const fixed=bottom.length===8;
  const maxLevel=fixed?7:Math.max(0,bottom.length-1);
  const rows=[];

  for(let row=maxLevel;row>=0;row--){
    const maxX=max-row;
    if(maxX<min)continue;
    const cells=[];
    for(let cx=min;cx<=maxX;cx++){
      const k=preview.get(boardKey(row,cx));
      if(k){
        const d=subject(k);
        const chosen=row===level&&cx===x;
        cells.push('<div class="tower-cell '+(chosen?'preview-target':'')+'">'+(chosen?'<span class="preview-here">ここ</span>':'')+'<img class="tower-book" src="'+d.image+'" alt="'+d.label+'"></div>');
      }else{
        cells.push('<div class="tower-cell"><span class="tower-frame" aria-hidden="true"></span></div>');
      }
    }
    rows.push('<div class="tower-row">'+cells.join('')+'</div>');
  }
  return '<div class="place-preview-board"><div class="place-preview-meta"><strong>置いたあとのタワー</strong><span>光っている場所に置きます</span></div><div class="tower-board '+(fixed?'tower-fixed':'tower-growing')+'">'+rows.join('')+'</div></div>';
}
function titleScreen(){
  return topNav()+'<section class="title-card">'+logo()+'<p class="title-copy">5教科を積んで、手札をなくせ！</p><div class="stack"><button class="btn yellow full" data-start-title>ゲームをはじめる</button><button class="btn secondary full" data-rules>あそびかた</button><button class="btn secondary full" data-books>教科書を見る</button></div></section>';
}
function setupScreen(){
  loadPlayers();
  return topNav()+heading('ゲーム設定','2〜6人で教科書タワーを作ろう')+
    '<section class="card"><div class="section-row"><div><h2>参加メンバー</h2><p>'+state.playerCount+'人で遊びます</p></div><button class="small-btn" data-edit-members>変更</button></div><div class="member-chips">'+state.players.map(memberChip).join('')+'</div></section>'+
    '<section class="card"><h2 style="margin:0 0 7px">ラウンド数</h2><p class="setup-note">全員が1回ずつスタートできるよう、人数と同じ回数で遊びます。</p><span class="round-badge">全'+state.playerCount+'ラウンド</span></section>'+
    '<button class="btn yellow full" data-start-game>ゲームをはじめる</button>';
}
function membersScreen(){
  loadPlayers();
  const used=state.players.map(p=>p.icon);
  return topNav()+heading('参加メンバー','名前・アイコンは放課後ゲーム部で共通')+
    '<section class="card"><h2 style="margin-top:0">何人で遊ぶ？</h2><div class="grid2">'+[2,3,4,5,6].map(n=>'<button class="btn '+(state.playerCount===n?'':'secondary')+'" data-member-count="'+n+'">'+n+'人</button>').join('')+'</div></section>'+
    '<div class="stack">'+state.players.map((p,i)=>'<section class="card player-card"><div class="player-line"><div class="avatar">'+esc(p.icon)+'</div><input data-member-name="'+i+'" maxlength="12" value="'+esc(p.name)+'" aria-label="プレイヤー'+(i+1)+'の名前"></div><div class="icon-pick">'+(playersApi?.ICONS||[]).map(ic=>'<button class="icon-btn '+(p.icon===ic?'selected':'')+'" data-member-icon="'+i+'" data-icon="'+ic+'" '+(p.icon!==ic&&used.includes(ic)?'disabled':'')+'>'+ic+'</button>').join('')+'</div></section>').join('')+'</div>'+
    '<button class="btn full" data-members-done>登録をおわる</button>';
}
const RULES=[
  {title:'手札を全部なくそう',text:'自分の番に教科書を1冊置きます。置ける教科書がなくなる前に、手札を全部出し切るのが目標です。',visual:'goal'},
  {title:'土台は左右にのばす',text:'最初の教科書を置いたら、土台は左か右へ追加できます。土台が8冊になった時点でタワーの横位置が決まります。',visual:'base'},
  {title:'上には同じ教科をつなぐ',text:'上の段は、下の2冊のうちどちらかと同じ教科なら置けます。土台が8冊になる前でも、条件を満たせば上に積めます。',visual:'upper'},
  {title:'ペナルティが少ない人の勝ち',text:'置けなくなったら残った手札の枚数がペナルティ。全部出せたら、今までのペナルティを最大2点減らせます。人数と同じラウンド数で勝負します。',visual:'score'}
];
function ruleVisual(kind){
  if(kind==='goal')return '<div class="rule-visual"><div class="mini-books">'+SUBJECTS.map(s=>'<img src="'+s.image+'" alt="'+s.label+'">').join('')+'</div></div>';
  if(kind==='base')return '<div class="rule-visual"><div class="mini-books"><span style="font-size:28px">←</span>'+SUBJECTS.slice(0,4).map(s=>'<img src="'+s.image+'" alt="">').join('')+'<span style="font-size:28px">→</span></div></div>';
  if(kind==='upper')return '<div class="rule-visual"><div style="display:grid;justify-items:center"><img src="../../textbook_math.png" alt="算数"><div style="display:flex;gap:4px"><img style="width:72px;height:72px;object-fit:contain" src="../../textbook_japanese.png" alt="国語"><img style="width:72px;height:72px;object-fit:contain" src="../../textbook_math.png" alt="算数"></div></div></div>';
  return '<div class="rule-visual"><div style="font-size:46px;font-weight:1000;color:#d44">+3</div><div style="font-size:22px;font-weight:950">／</div><div style="font-size:46px;font-weight:1000;color:#26925d">−2</div></div>';
}
function rulesScreen(){
  const r=RULES[state.rulePage];
  return topNav()+heading('あそびかた','4つだけ覚えればOK')+'<div class="rule-progress">'+(state.rulePage+1)+' / '+RULES.length+'</div><section class="card rule-card">'+ruleVisual(r.visual)+'<h2>'+r.title+'</h2><p>'+r.text+'</p></section><div class="grid2"><button class="btn secondary" data-rule-prev '+(state.rulePage===0?'disabled':'')+'>前へ</button><button class="btn" data-rule-next>'+(state.rulePage===RULES.length-1?'ゲーム設定へ':'次へ')+'</button></div>';
}
function booksScreen(){
  return topNav()+heading('教科書','5教科・全部で36冊')+'<section class="card"><div class="book-grid">'+SUBJECTS.map(s=>'<div class="book-info"><img src="'+s.image+'" alt="'+s.label+'"><div><strong>'+s.label+'</strong><span>'+s.count+'冊</span></div></div>').join('')+'</div></section><button class="btn full" data-books-back>もどる</button>';
}
function roundIntroScreen(){
  const p=state.players[state.startPlayer];
  const fiveNote=state.playerCount===5?'<p class="setup-note" style="margin-top:8px">5人プレイでは、余った1冊を最初から土台に置いてスタートします。</p>':'';
  return topNav()+heading((state.round+1)+' / '+state.totalRounds+'ラウンド','教科書を配りました')+currentScoresStrip()+'<section class="card round-hero">'+logo()+'<div class="start-player"><div class="avatar large">'+esc(p.icon)+'</div><span>今回のスタート</span><strong>'+esc(p.name)+'さん</strong></div><p class="setup-note">手札は本人だけが見ます。スマホを順番に回して遊ぼう。</p>'+fiveNote+'</section><button class="btn yellow full" data-begin-round>ラウンドをはじめる</button>';
}
function boardSummary(){
  const b=bottomBounds(),total=state.board.size;
  return '<section class="board-summary"><span>現在のタワー</span><strong>'+total+'冊</strong><em>土台 '+b.len+' / 8冊</em></section>';
}
function passScreen(){
  const p=state.players[state.currentPlayer];
  return topNav()+heading((state.round+1)+' / '+state.totalRounds+'ラウンド','次の人にスマホを渡そう')+currentScoresStrip()+boardSummary()+'<section class="privacy-card"><div><div class="avatar large">'+esc(p.icon)+'</div><h2>'+esc(p.name)+'さんに<br>スマホを渡してください</h2><p>手札は本人だけが見てね。</p><button class="btn yellow hold-btn" data-hold-hand><span>長押しして手札を見る</span><i></i></button></div></section>';
}
function inlinePlaceControls(){
  const key=state.selectedSubject;
  if(!key)return '';
  const d=subject(key);
  if(!state.pendingPlace){
    return '<section class="inline-selection-status"><img src="'+d.image+'" alt="'+d.label+'"><div><strong>'+d.label+'を選択中</strong><span>上のタワーで光っている「＋」を押してね</span></div><button type="button" class="inline-clear" data-clear-subject>やめる</button></section>';
  }
  return '<section class="inline-place-confirm"><div class="inline-place-title"><img src="'+d.image+'" alt="'+d.label+'"><div><strong>ここに置きますか？</strong><span>'+d.label+'を「ここ」の位置に置きます。</span></div></div><div class="inline-place-actions"><button type="button" class="btn secondary" data-place-cancel>場所を選び直す</button><button type="button" class="btn yellow" data-place-ok>ここに置く</button></div></section>';
}
function handScreen(){
  const i=state.currentPlayer,p=state.players[i],hand=state.hands[i];
  const selectedKey=state.selectedSubject;
  const help=selectedKey
    ? (state.pendingPlace?'置き場所を確認して、この画面で決定してね。':'選んだ教科書を置ける場所が、タワー上で光っています。')
    : '教科書を選ぶと、置ける場所がタワー上で光ります。';
  return topNav()+heading(esc(p.name)+'さんの手札','本人だけでタワーと手札を確認してね')+
    renderBoard({interactive:!!selectedKey,subjectKey:selectedKey,previewPlace:state.pendingPlace})+
    inlinePlaceControls()+
    '<section class="card hand-private"><div class="private-head"><div class="avatar large">'+esc(p.icon)+'</div><h2>あなたの手札</h2><p>'+help+'</p></div><div class="hand-grid">'+SUBJECTS.map(s=>{const n=hand[s.key]||0;const playable=n>0&&legalPositionsForSubject(s.key).length>0;const selected=selectedKey===s.key;return '<button class="hand-book '+(playable?'playable ':'')+(selected?'selected':'')+'" data-pick-subject="'+s.key+'" '+(!playable?'disabled':'')+' aria-pressed="'+(selected?'true':'false')+'"><img src="'+s.image+'" alt="'+s.label+'"><strong>'+s.label+'</strong><b>×'+n+'</b><span>'+(n===0?'なし':(selected?'選択中':(playable?'置ける':'置けない')))+'</span></button>'}).join('')+'</div></section>';
}
function boardScreen(){
  const d=subject(state.selectedSubject);
  return topNav()+heading(d.label+'をどこに置く？','＋が出ている場所をタップして置こう')+
    '<div class="subject-selected"><img src="'+d.image+'" alt="'+d.label+'"><div><strong>'+d.label+'</strong><span>選んだ教科書</span></div></div>'+
    renderBoard({interactive:true,subjectKey:d.key})+
    '<button class="btn secondary full" data-reselect>教科書を選び直す</button>';
}
function noMoveScreen(){
  const i=state.currentPlayer,p=state.players[i],remain=handTotal(i);
  return topNav()+heading(esc(p.name)+'さん','置ける教科書がありません')+'<section class="card no-move-card"><div class="avatar large">'+esc(p.icon)+'</div><h2>このラウンドはここまで</h2><p class="setup-note">残った手札がペナルティになります。</p><div class="penalty-big">+'+remain+'点</div><button class="btn danger full" data-drop-out>ラウンドを抜ける</button></section>';
}
function turnEndScreen(){
  const e=state.lastEvent||{};
  const next=nextActiveFrom(state.currentPlayer);
  return topNav()+heading((state.round+1)+' / '+state.totalRounds+'ラウンド','みんなで画面を見てOK')+renderBoard()+'<section class="card turn-event"><div class="event-icon">'+(e.icon||'📚')+'</div><h2>'+esc(e.title||'置きました！')+'</h2><p>'+esc(e.detail||'')+'</p>'+(next>=0?'<div class="next-player">次は '+esc(state.players[next].icon)+' '+esc(state.players[next].name)+'さん</div>':'<div class="next-player">このラウンドは終了です</div>')+'<button class="btn yellow full" data-continue-turn>'+(next>=0?'次の人へ':'ラウンド結果を見る')+'</button></section>';
}
function roundResultScreen(){
  return topNav()+heading((state.round+1)+'ラウンド目の結果','ペナルティが少ないほど有利')+'<section class="card"><div class="result-table">'+state.players.map((p,i)=>{const o=state.roundOutcomes[i]||{kind:'clear',delta:0};let txt='',cls='';if(o.kind==='stuck'){txt='+'+o.remaining+'点';cls='plus'}else{txt=o.returned?('−'+o.returned+'点'):'±0点';cls=o.returned?'minus':''}return '<div class="result-row"><div class="who">'+esc(p.icon)+' '+esc(p.name)+'</div><div class="change '+cls+'">'+txt+'</div><div class="total">'+state.penalties[i]+'点</div></div>'}).join('')+'</div></section><button class="btn yellow full" data-next-round>'+(state.round+1>=state.totalRounds?'最終結果を見る':'次のラウンドへ')+'</button>';
}
function finalScreen(){
  const order=state.players.map((p,i)=>({p,i,score:state.penalties[i]})).sort((a,b)=>a.score-b.score||a.i-b.i);
  const best=order[0].score,winners=order.filter(x=>x.score===best);
  let lastScore=null,lastRank=0;
  const rows=order.map((x,idx)=>{if(x.score!==lastScore){lastRank=idx+1;lastScore=x.score}return '<div class="rank-row"><b>'+lastRank+'位</b><span>'+esc(x.p.icon)+' '+esc(x.p.name)+'</span><strong>'+x.score+'点</strong></div>'}).join('');
  return topNav()+heading('最終結果','全'+state.totalRounds+'ラウンド終了！')+'<section class="card winner-card"><div class="winner-crown">🏆</div><h2>'+winners.map(x=>esc(x.p.name)).join('・')+' 優勝！</h2><p class="setup-note">ペナルティ '+best+'点</p></section><section class="card"><div class="ranking">'+rows+'</div></section><div class="stack"><button class="btn yellow full" data-replay>同じメンバーでもう一度</button><button class="btn secondary full" data-to-title>タイトルへ</button></div>';
}
function screenHtml(){
  return ({title:titleScreen,setup:setupScreen,members:membersScreen,rules:rulesScreen,books:booksScreen,roundIntro:roundIntroScreen,pass:passScreen,hand:handScreen,board:boardScreen,noMove:noMoveScreen,turnEnd:turnEndScreen,roundResult:roundResultScreen,final:finalScreen}[state.screen]||titleScreen)();
}
function render({preserveScroll=false,scrollY=window.scrollY}={}){
  app.className='tower-app screen-'+state.screen;
  app.innerHTML=screenHtml();
  bind();
  if(preserveScroll){
    window.scrollTo({top:scrollY,behavior:'auto'});
    requestAnimationFrame(()=>window.scrollTo({top:scrollY,behavior:'auto'}));
  }else window.scrollTo({top:0,behavior:'auto'});
}
function go(screen,{push=true,preserveScroll=false,scrollY=window.scrollY}={}){
  if(push&&state.screen!==screen)state.history.push(state.screen);
  state.screen=screen;
  render({preserveScroll,scrollY});
}
function doBackOne(){
  if(state.gameStarted){
    if(state.screen==='hand'||state.screen==='board'||state.screen==='noMove'){state.selectedSubject=null;state.pendingPlace=null;state.screen='pass';render();return}
    if(state.screen==='pass'){
      const untouched=state.movesMade===0&&state.currentPlayer===state.startPlayer&&state.roundOutcomes.every(x=>x===null);
      if(untouched){state.screen='roundIntro';render()}
      else alert('前の人の手番には戻れません。今の手番から続けてください。');
      return
    }
    if(state.screen==='roundIntro'){state.gameStarted=false;state.screen='setup';render();return}
    if(state.screen==='turnEnd'||state.screen==='roundResult'){alert('確定した手番や結果は元に戻せません。');return}
  }
  if(state.history.length){state.screen=state.history.pop();render()}
  else location.href='../';
}
function showNavConfirm(type){
  if(!state.gameStarted){if(type==='home')location.href='../';else doBackOne();return}
  document.querySelector('.nav-confirm-backdrop')?.remove();
  const wrap=document.createElement('div');wrap.className='modal-backdrop nav-confirm-backdrop';
  const home=type==='home';
  wrap.innerHTML='<section class="modal"><h2>'+(home?'ゲームをやめますか？':'1個前にもどりますか？')+'</h2><p>'+(home?'今のゲームをやめて、ゲームをえらぶ画面へ戻ります。':'秘密の手札が見えない安全な画面まで戻ります。確定済みの配置は取り消せません。')+'</p><div class="modal-actions"><button class="btn secondary" data-nav-cancel>ゲームにもどる</button><button class="btn danger" data-nav-ok>ほんとにもどる</button></div></section>';
  document.body.appendChild(wrap);
  wrap.querySelector('[data-nav-cancel]').addEventListener('click',()=>wrap.remove());
  wrap.querySelector('[data-nav-ok]').addEventListener('click',()=>{wrap.remove();if(home)location.href='../';else doBackOne()});
  wrap.addEventListener('click',e=>{if(e.target===wrap)wrap.remove()});
}
function editMemberCount(n){
  saveTowerPlayerCount(n);
  loadPlayers();
  render({preserveScroll:true,scrollY:window.scrollY});
}
function updateMember(i,patch){playersApi?.setPlayer?.(i,patch);loadPlayers()}
function startGame(){
  loadPlayers();
  state.penalties=Array(state.playerCount).fill(0);
  state.round=0;state.totalRounds=state.playerCount;state.history=[];state.gameStarted=true;
  startRound();
}
function startRound(){
  state.startPlayer=state.round%state.playerCount;
  state.currentPlayer=state.startPlayer;
  state.board=new Map();
  state.active=Array(state.playerCount).fill(true);
  state.roundOutcomes=Array(state.playerCount).fill(null);
  state.movesMade=0;
  state.selectedSubject=null;state.pendingPlace=null;state.lastEvent=null;
  state.hands=Array.from({length:state.playerCount},()=>makeEmptyHand());
  const deck=makeDeck();
  if(state.playerCount===5){
    const opening=deck.pop();
    setCard(0,0,opening);
  }
  deck.forEach((key,idx)=>{const p=(state.startPlayer+idx)%state.playerCount;state.hands[p][key]++});
  state.screen='roundIntro';render();
}
function beginRound(){state.currentPlayer=state.startPlayer;state.selectedSubject=null;state.pendingPlace=null;go('pass',{push:false})}
function bindHold(btn,fn){
  if(!btn)return;let timer=null;
  const start=()=>{btn.classList.add('holding');timer=setTimeout(()=>{timer=null;btn.classList.remove('holding');fn()},LONG_PRESS_MS)};
  const cancel=()=>{if(timer)clearTimeout(timer);timer=null;btn.classList.remove('holding')};
  btn.addEventListener('pointerdown',start);btn.addEventListener('pointerup',cancel);btn.addEventListener('pointerleave',cancel);btn.addEventListener('pointercancel',cancel);btn.addEventListener('contextmenu',e=>e.preventDefault());
}
function openHand(){
  state.selectedSubject=null;
  state.pendingPlace=null;
  if(playerHasMove(state.currentPlayer))go('hand',{push:false});
  else go('noMove',{push:false});
}
function pickSubject(key){
  const hand=state.hands[state.currentPlayer];
  if(!hand||!hand[key]||!legalPositionsForSubject(key).length)return;
  state.selectedSubject=state.selectedSubject===key?null:key;
  state.pendingPlace=null;
  render({preserveScroll:true,scrollY:window.scrollY});
  if(state.selectedSubject)requestAnimationFrame(()=>document.querySelector('.board-card')?.scrollIntoView({behavior:'smooth',block:'start'}));
}
function showPlaceConfirm(level,x){
  const key=state.selectedSubject;
  if(!key)return;
  const legal=legalPositionsForSubject(key).some(p=>p.level===level&&p.x===x);
  if(!legal)return;
  state.pendingPlace={level,x};
  render({preserveScroll:true,scrollY:window.scrollY});
  requestAnimationFrame(()=>document.querySelector('.inline-place-confirm')?.scrollIntoView({behavior:'smooth',block:'nearest'}));
}
function commitPlace(level,x){
  const key=state.selectedSubject,i=state.currentPlayer,d=subject(key);
  const legal=legalPositionsForSubject(key).some(p=>p.level===level&&p.x===x);
  if(!legal||!state.hands[i][key])return;
  setCard(level,x,key);state.hands[i][key]--;state.movesMade++;state.selectedSubject=null;state.pendingPlace=null;
  let title=d.label+'を置きました！',detail='タワーが1冊高くなりました。',icon='📚';
  if(handTotal(i)===0){
    const returned=Math.min(2,state.penalties[i]);
    state.penalties[i]-=returned;state.active[i]=false;
    state.roundOutcomes[i]={kind:'clear',returned,delta:-returned};
    title='手札を全部出した！';detail=returned?'ペナルティを'+returned+'点減らしました。':'手札クリア！ ペナルティはありません。';icon='✨';
  }
  state.lastEvent={title,detail,icon};go('turnEnd',{push:false});
}
function dropOut(){
  const i=state.currentPlayer,remain=handTotal(i);
  state.penalties[i]+=remain;state.active[i]=false;
  state.roundOutcomes[i]={kind:'stuck',remaining:remain,delta:remain};
  state.lastEvent={title:'このラウンドはここまで',detail:'残り'+remain+'冊で +'+remain+'点のペナルティ。',icon:'📕'};
  go('turnEnd',{push:false});
}
function continueTurn(){
  const next=nextActiveFrom(state.currentPlayer);
  if(next<0){go('roundResult',{push:false});return}
  state.currentPlayer=next;state.selectedSubject=null;state.pendingPlace=null;state.lastEvent=null;go('pass',{push:false});
}
function nextRound(){
  if(state.round+1>=state.totalRounds){state.gameStarted=false;state.screen='final';render();return}
  state.round++;startRound();
}
function replay(){state.penalties=Array(state.playerCount).fill(0);state.round=0;state.totalRounds=state.playerCount;state.gameStarted=true;state.history=[];startRound()}
function bind(){
  document.querySelector('[data-back]')?.addEventListener('click',()=>showNavConfirm('back'));
  document.querySelector('[data-home]')?.addEventListener('click',()=>showNavConfirm('home'));
  document.querySelector('[data-start-title]')?.addEventListener('click',()=>{state.gameStarted=false;state.history=[];go('setup')});
  document.querySelector('[data-rules]')?.addEventListener('click',()=>{state.rulePage=0;go('rules')});
  document.querySelector('[data-books]')?.addEventListener('click',()=>go('books'));
  document.querySelector('[data-edit-members]')?.addEventListener('click',()=>go('members'));
  document.querySelectorAll('[data-member-count]').forEach(b=>b.addEventListener('click',()=>{const y=window.scrollY;saveTowerPlayerCount(Number(b.dataset.memberCount));loadPlayers();render({preserveScroll:true,scrollY:y})}));
  document.querySelectorAll('[data-member-name]').forEach(inp=>inp.addEventListener('change',()=>{const i=Number(inp.dataset.memberName);updateMember(i,{name:inp.value||('プレイヤー'+(i+1))})}));
  document.querySelectorAll('[data-member-icon]').forEach(b=>b.addEventListener('click',()=>{const y=window.scrollY;updateMember(Number(b.dataset.memberIcon),{icon:b.dataset.icon});render({preserveScroll:true,scrollY:y})}));
  document.querySelector('[data-members-done]')?.addEventListener('click',()=>{loadPlayers();go('setup')});
  document.querySelector('[data-start-game]')?.addEventListener('click',startGame);
  document.querySelector('[data-rule-prev]')?.addEventListener('click',()=>{if(state.rulePage>0){state.rulePage--;render({preserveScroll:true,scrollY:window.scrollY})}});
  document.querySelector('[data-rule-next]')?.addEventListener('click',()=>{if(state.rulePage<RULES.length-1){state.rulePage++;render({preserveScroll:true,scrollY:window.scrollY})}else go('setup')});
  document.querySelector('[data-books-back]')?.addEventListener('click',doBackOne);
  document.querySelector('[data-begin-round]')?.addEventListener('click',beginRound);
  bindHold(document.querySelector('[data-hold-hand]'),openHand);
  document.querySelectorAll('[data-pick-subject]').forEach(b=>b.addEventListener('click',()=>pickSubject(b.dataset.pickSubject)));
  document.querySelectorAll('[data-place-level]').forEach(b=>b.addEventListener('click',()=>showPlaceConfirm(Number(b.dataset.placeLevel),Number(b.dataset.placeX))));
  document.querySelector('[data-place-cancel]')?.addEventListener('click',()=>{state.pendingPlace=null;render({preserveScroll:true,scrollY:window.scrollY})});
  document.querySelector('[data-place-ok]')?.addEventListener('click',()=>{const p=state.pendingPlace;if(p)commitPlace(p.level,p.x)});
  document.querySelector('[data-clear-subject]')?.addEventListener('click',()=>{state.selectedSubject=null;state.pendingPlace=null;render({preserveScroll:true,scrollY:window.scrollY})});
  document.querySelector('[data-reselect]')?.addEventListener('click',()=>{state.selectedSubject=null;state.pendingPlace=null;go('hand',{push:false})});
  document.querySelector('[data-drop-out]')?.addEventListener('click',dropOut);
  document.querySelector('[data-continue-turn]')?.addEventListener('click',continueTurn);
  document.querySelector('[data-next-round]')?.addEventListener('click',nextRound);
  document.querySelector('[data-replay]')?.addEventListener('click',replay);
  document.querySelector('[data-to-title]')?.addEventListener('click',()=>{state.gameStarted=false;state.history=[];state.screen='title';render()});
}
loadPlayers();render();
})()