(()=>{
const app=document.getElementById('app');
const DB=window.DOCCHI_QUESTIONS;
const playersApi=window.HoukagoPlayers;
const CUSTOM_KEY='houkago_docchi_custom_v1';
const SENSITIVE_SECRET=new Set(['恋バナ','ちょっとディープ']);
const LONG_PRESS_MS=550;

const state={
  screen:'title',
  mode:null,
  playerCount:playersApi?.load?.().activeCount||4,
  players:[],
  roundCount:5,
  selectedCategories:new Set(),
  includeCustom:false,
  questions:[],
  round:0,
  currentQuestion:null,
  usedKeys:new Set(),
  voter:0,
  answers:[],
  predictions:[],
  secretCounts:{a:0,b:0},
  scores:[],
  roundResult:null,
  history:[],
  gameStarted:false
};

function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function loadPlayers(){
  const d=playersApi?.load?.();
  if(d){
    state.playerCount=d.activeCount;
    state.players=d.players.slice(0,d.activeCount).map(x=>({...x}));
  }else{
    state.players=Array.from({length:state.playerCount},(_,i)=>({name:'プレイヤー'+(i+1),icon:'🙂'}));
  }
}
function customItems(){
  try{
    const arr=JSON.parse(localStorage.getItem(CUSTOM_KEY)||'[]');
    return Array.isArray(arr)?arr.filter(x=>x&&x.q&&x.a&&x.b):[];
  }catch(e){return[]}
}
function saveCustom(items){
  localStorage.setItem(CUSTOM_KEY,JSON.stringify(items.slice(-100)));
}
function categoriesForMode(){return Object.keys(DB?.[state.mode]||{})}
function defaultCategories(){
  const cats=categoriesForMode();
  state.selectedCategories=new Set(state.mode==='secret'?cats.filter(c=>!SENSITIVE_SECRET.has(c)):cats);
}
function questionKey(q){return [q.category,q.q,q.a,q.b].join('|')}
function questionPool(){
  const built=[...state.selectedCategories].flatMap(cat=>(DB[state.mode]?.[cat]||[]).map(q=>({...q,category:cat})));
  const custom=state.includeCustom?customItems().map(q=>({...q,category:'マイお題',custom:true})):[];
  return [...built,...custom];
}
function availablePool(){
  let pool=questionPool().filter(q=>!state.usedKeys.has(questionKey(q)));
  if(!pool.length){
    state.usedKeys.clear();
    pool=questionPool();
  }
  return pool;
}
function drawQuestion(){
  const pool=availablePool();
  if(!pool.length)return null;
  return pool[Math.floor(Math.random()*pool.length)];
}
function topNav(){
  if(state.screen==='title')return '';
  return '<nav class="top-nav"><button type="button" class="nav-pill" data-nav-back>← 戻る</button><button type="button" class="nav-pill" data-nav-home>ゲーム一覧</button></nav>';
}
function logo(){return '<img class="game-logo" src="../../minna_wa_docchi_logo.png" alt="みんなはどっち？">'}
function heading(title,sub=''){return '<header class="screen-heading"><h1>'+esc(title)+'</h1>'+(sub?'<p>'+esc(sub)+'</p>':'')+'</header>'}
function avatarChip(p){return '<span class="member-chip">'+esc(p.icon)+' '+esc(p.name)+'</span>'}
function modeLabel(){return state.mode==='battle'?'よみあいバトル':'ひみつ投票'}

function titleScreen(){
  return '<section class="title-card">'+
    '<div class="title-shade"></div><div class="title-content">'+logo()+
    '<p class="title-copy">みんなの答え、読めるかな？</p>'+
    '<div class="stack">'+
      '<button class="btn yellow full" data-go-mode>ゲームをはじめる</button>'+
      '<button class="btn glass full" data-go-rules>あそびかた</button>'+
      '<button class="btn glass full" data-go-custom>マイお題</button>'+
    '</div></div></section>';
}
function modeScreen(){
  return topNav()+logo()+heading('モードをえらぶ','遊び方がちがう2つのモード')+
  '<div class="mode-grid">'+
    '<section class="mode-card battle"><span class="mode-kicker">MODE 1</span><h2>よみあいバトル</h2><p>自分の答えが「多数派」か「少数派」か予想してポイント勝負！</p><div class="mini-flow"><span>A/Bに回答</span><b>→</b><span>多数派？少数派？</span><b>→</b><span>当たれば1点</span></div><button class="mode-start-btn battle" data-mode="battle">よみあいバトルで遊ぶ</button></section>'+
    '<section class="mode-card secret"><span class="mode-kicker">MODE 2</span><h2>ひみつ投票</h2><p>誰がどっちを選んだかは最後まで秘密。人数だけ見て盛り上がろう！</p><div class="mini-flow"><span>匿名で回答</span><b>→</b><span>A○人 / B○人</span><b>→</b><span>正体は秘密</span></div><button class="mode-start-btn secret" data-mode="secret">ひみつ投票で遊ぶ</button></section>'+
  '</div>';
}
function setupScreen(){
  loadPlayers();
  return topNav()+logo()+heading(modeLabel()+'の設定','まずはメンバーと問題数を決めよう')+
  '<section class="card setup-section setup-members"><div class="section-row"><div><h2>参加メンバー</h2><p>'+state.playerCount+'人で遊びます</p></div><button class="small-btn" data-edit-members>変更</button></div><div class="member-chips">'+state.players.map(avatarChip).join('')+'</div></section>'+
  '<section class="card setup-section setup-rounds"><h2>何問遊ぶ？</h2><div class="choice-row">'+[3,5,7,10].map(n=>'<button class="choice-chip '+(state.roundCount===n?'selected':'')+'" data-round-count="'+n+'">'+n+'問</button>').join('')+'</div></section>'+
  '<button class="btn full" data-next-options>ジャンル・お題設定へ</button>';
}
function optionsScreen(){
  const cats=categoriesForMode();
  const customN=customItems().length;
  const activePool=questionPool().length;
  return topNav()+heading('ジャンル・お題','遊びたいジャンルとオリジナル質問を設定')+
  '<section class="card options-card"><div class="section-row compact"><div><h2>ジャンル</h2><p>複数選べます</p></div><button class="small-btn compact" data-select-all>全部</button></div>'+
    '<div class="category-grid compact">'+cats.map(cat=>'<button class="category-chip '+(state.selectedCategories.has(cat)?'selected':'')+' '+(SENSITIVE_SECRET.has(cat)?'deep':'')+'" data-category="'+esc(cat)+'">'+esc(cat)+(SENSITIVE_SECRET.has(cat)?'<small>任意</small>':'')+'</button>').join('')+'</div>'+
    (state.mode==='secret'?'<p class="deep-note compact">「恋バナ」「ちょっとディープ」は最初はOFF</p>':'')+
  '</section>'+
  '<section class="card options-card custom-quick"><div class="section-row compact"><div><h2>問題を考える</h2><p>保存中 <span data-custom-count>'+customN+'</span>問</p></div><button class="small-btn compact" data-go-custom>一覧</button></div>'+
    '<div class="quick-question-form"><input id="customQ" maxlength="70" placeholder="質問を書く"><div><input id="customA" maxlength="30" placeholder="A"><input id="customB" maxlength="30" placeholder="B"><button type="button" class="quick-add-btn" data-add-custom>追加</button></div></div>'+
    '<label class="switch-row compact '+(!customN?'disabled':'')+'"><input type="checkbox" data-custom-toggle '+(state.includeCustom&&customN?'checked':'')+' '+(!customN?'disabled':'')+'><span>マイお題も混ぜる</span></label>'+
  '</section>'+
  '<div class="options-footer"><div class="pool-count">この設定で出るお題：<strong data-pool-count>'+activePool+'問</strong></div><button class="btn full" data-start-game '+(activePool?'':'disabled')+'>この設定でスタート</button></div>';
}
function membersScreen(){
  loadPlayers();
  const icons=playersApi?.ICONS||['🐶','🐱','🐰','🐼','🦊','🐸','🐧','🐯','🐨','🐵','🦁','🐹'];
  return topNav()+heading('参加メンバー','ここで変えると他のゲームにも反映されます')+
  '<section class="card"><h2>人数</h2><div class="count-grid">'+Array.from({length:8},(_,i)=>i+3).map(n=>'<button class="choice-chip '+(state.playerCount===n?'selected':'')+'" data-member-count="'+n+'">'+n+'人</button>').join('')+'</div></section>'+
  '<div class="member-edit-list">'+state.players.map((p,i)=>'<section class="card member-edit"><div class="member-line"><div class="member-avatar">'+esc(p.icon)+'</div><label>'+(i+1)+'人目<input maxlength="12" value="'+esc(p.name)+'" data-member-name="'+i+'"></label></div><div class="icon-grid">'+icons.map(ic=>'<button class="icon-choice '+(p.icon===ic?'selected':'')+'" data-member-icon="'+i+'" data-icon="'+ic+'">'+ic+'</button>').join('')+'</div></section>').join('')+'</div>'+
  '<button class="btn full" data-members-done>このメンバーでOK</button>';
}
function customScreen(){
  const items=customItems();
  return topNav()+heading('マイお題','自分たちだけの2択を作ろう')+
  '<section class="card custom-form"><label>質問<input id="customQ" maxlength="70" placeholder="例：放課後に行くなら？"></label><div class="custom-two"><label>A<input id="customA" maxlength="30" placeholder="公園"></label><label>B<input id="customB" maxlength="30" placeholder="友達の家"></label></div><button class="btn full" data-add-custom>マイお題に追加</button></section>'+
  '<section class="card"><div class="section-row"><div><h2>保存したお題</h2><p>'+items.length+'問</p></div>'+(items.length?'<button class="small-btn danger-text" data-clear-custom>全部消す</button>':'')+'</div>'+
    (items.length?'<div class="custom-list">'+items.map((x,i)=>'<div class="custom-item"><div><strong>'+esc(x.q)+'</strong><span>'+esc(x.a)+' / '+esc(x.b)+'</span></div><button data-delete-custom="'+i+'">削除</button></div>').join('')+'</div>':'<p class="empty-text">まだマイお題はありません。</p>')+
  '</section>';
}
function rulesScreen(){
  return topNav()+logo()+heading('あそびかた','どちらもスマホ1台を順番に回して遊びます')+
  '<section class="card rule-card"><span class="mode-kicker">MODE 1</span><h2>よみあいバトル</h2><div class="rule-step"><b>1</b><span>全員でお題を見る</span></div><div class="rule-step"><b>2</b><span>1人ずつA/Bに秘密で回答</span></div><div class="rule-step"><b>3</b><span>自分の答えが多数派か少数派か予想</span></div><div class="rule-step"><b>4</b><span>予想が当たれば1点。同数は全員0点</span></div></section>'+
  '<section class="card rule-card secret"><span class="mode-kicker">MODE 2</span><h2>ひみつ投票</h2><div class="rule-step"><b>1</b><span>全員でお題を見る</span></div><div class="rule-step"><b>2</b><span>1人ずつ匿名でA/Bに回答</span></div><div class="rule-step"><b>3</b><span>結果は「A○人 / B○人」だけ発表</span></div><div class="rule-step"><b>4</b><span>誰がどちらを選んだかはゲーム内で記録・表示しない</span></div></section>';
}
function questionScreen(){
  const q=state.currentQuestion;
  const sensitive=state.mode==='secret'&&SENSITIVE_SECRET.has(q.category);
  return topNav()+heading((state.round+1)+' / '+state.roundCount+'問','まずは全員でお題を確認')+
  '<section class="question-card"><span class="question-category '+(sensitive?'deep':'')+'">'+esc(q.category)+'</span><h2>'+esc(q.q)+'</h2><div class="answer-preview"><div><small>A</small><strong>'+esc(q.a)+'</strong></div><b>VS</b><div><small>B</small><strong>'+esc(q.b)+'</strong></div></div></section>'+
  (sensitive?'<p class="sensitive-note">少し踏み込んだお題です。答えにくければ別のお題に変えてOK。</p>':'')+
  '<div class="stack"><button class="btn full" data-accept-question>このお題でいく</button><button class="btn secondary full" data-change-question>別のお題にする</button></div>';
}
function passScreen(){
  const p=state.players[state.voter];
  return topNav()+heading((state.voter+1)+' / '+state.playerCount+'人目','回答はほかの人に見せないでね')+
  '<section class="privacy-card"><div class="member-avatar large">'+esc(p.icon)+'</div><h2>'+esc(p.name)+'さんに<br>スマホを渡してください</h2><p>ほかの人は画面を見ないでね。</p><button class="btn yellow hold-btn" data-hold-answer><span>長押しして回答</span><i></i></button></section>';
}
function answerScreen(){
  const q=state.currentQuestion,p=state.players[state.voter];
  return topNav()+heading(esc(p.name)+'さんの回答','どちらか1つを選んでね')+
  '<section class="answer-card"><span class="question-category">'+esc(q.category)+'</span><h2>'+esc(q.q)+'</h2><div class="big-answers"><button data-answer="a"><small>A</small><strong>'+esc(q.a)+'</strong></button><button data-answer="b"><small>B</small><strong>'+esc(q.b)+'</strong></button></div></section>';
}
function predictScreen(){
  const q=state.currentQuestion;
  const ans=state.answers[state.voter];
  const choice=ans==='a'?q.a:q.b;
  return topNav()+heading('みんなの答えを予想','あなたが選んだのは「'+choice+'」')+
  '<section class="predict-card"><h2>この答えはみんなの中で……</h2><div class="predict-grid"><button data-predict="majority"><strong>多数派</strong><span>多い方だと思う</span></button><button data-predict="minority"><strong>少数派</strong><span>少ない方だと思う</span></button></div></section>';
}
function coverScreen(){
  return '<section class="cover-screen"><div class="checkmark">✓</div><h1>回答しました</h1><p>今の答えはもう表示されません。</p><button class="btn yellow full" data-next-voter>'+((state.voter+1)>=state.playerCount?'全員の回答完了へ':'画面を伏せて次の人へ')+'</button></section>';
}
function allAnsweredScreen(){
  return '<section class="all-answered-screen"><div class="all-done-icon">✓</div><span class="all-done-kicker">ALL ANSWERED</span><h1>全員の回答が<br>終わりました！</h1><p>ここからはみんなで画面を見てOK。<br>結果を確認しましょう。</p><button class="btn yellow full" data-show-result>結果を見る</button></section>';
}
function battleResultScreen(){
  const r=state.roundResult,q=state.currentQuestion;
  return topNav()+heading((state.round+1)+'問目の結果',q.q)+
  '<div class="tally-grid"><div class="a"><small>A</small><span>'+esc(q.a)+'</span><strong>'+r.a+'人</strong></div><div class="b"><small>B</small><span>'+esc(q.b)+'</span><strong>'+r.b+'人</strong></div></div>'+
  (r.tie?'<div class="tie-note"><strong>同数！</strong><span>今回は多数派・少数派なし。全員0点。</span></div>':'')+
  '<section class="card"><h2>みんなの回答</h2><div class="battle-result-list">'+state.players.map((p,i)=>'<div class="battle-result-row"><span>'+esc(p.icon)+' '+esc(p.name)+'</span><strong>'+esc(state.answers[i]==='a'?q.a:q.b)+'</strong><em>'+esc(state.predictions[i]==='majority'?'多数派予想':'少数派予想')+'</em><b>'+(r.gains[i]?'+1点':'0点')+'</b></div>').join('')+'</div></section>'+
  '<button class="btn full" data-next-round>'+(state.round+1>=state.roundCount?'最終結果を見る':'次のお題へ')+'</button>';
}
function secretResultScreen(){
  const r=state.roundResult,q=state.currentQuestion;
  return topNav()+heading((state.round+1)+'問目の結果',q.q)+
  '<div class="anonymous-banner">誰がどっちを選んだかは秘密</div>'+
  '<div class="tally-grid"><div class="a"><small>A</small><span>'+esc(q.a)+'</span><strong>'+r.a+'人</strong></div><div class="b"><small>B</small><span>'+esc(q.b)+'</span><strong>'+r.b+'人</strong></div></div>'+
  '<section class="talk-card"><h2>誰だろう？</h2><p>「意外！」「誰がA？」など、答えを明かさず自由に話してみよう。</p><small>答えを言いたくない人は最後まで秘密でOK。</small></section>'+
  '<button class="btn full" data-next-round>'+(state.round+1>=state.roundCount?'おわる':'次のお題へ')+'</button>';
}
function finalScreen(){
  if(state.mode==='secret'){
    return topNav()+heading('ひみつ投票 おわり！',state.roundCount+'問遊びました')+
    '<section class="final-card"><div class="checkmark">✓</div><h2>最後まで匿名のまま終了</h2><p>誰がどちらを選んだかは保存・表示していません。</p></section>'+
    '<div class="stack"><button class="btn full" data-replay>同じ設定でもう一度</button><button class="btn secondary full" data-go-mode>モードを選び直す</button></div>';
  }
  const ranking=state.players.map((p,i)=>({p,score:state.scores[i]})).sort((x,y)=>y.score-x.score);
  return topNav()+heading('最終結果','みんなの読み合いはどうだった？')+
  '<section class="ranking-card">'+ranking.map((x,i)=>'<div class="rank-row rank-'+(i+1)+'"><b>'+(i+1)+'位</b><span>'+esc(x.p.icon)+' '+esc(x.p.name)+'</span><strong>'+x.score+'点</strong></div>').join('')+'</section>'+
  '<div class="stack"><button class="btn full" data-replay>同じ設定でもう一度</button><button class="btn secondary full" data-go-mode>モードを選び直す</button></div>';
}

function screenHtml(){
  return ({
    title:titleScreen,mode:modeScreen,setup:setupScreen,options:optionsScreen,members:membersScreen,custom:customScreen,rules:rulesScreen,
    question:questionScreen,pass:passScreen,answer:answerScreen,predict:predictScreen,cover:coverScreen,allAnswered:allAnsweredScreen,
    result:()=>state.mode==='battle'?battleResultScreen():secretResultScreen(),final:finalScreen
  }[state.screen]||titleScreen)();
}
function render(){
  app.className='docchi-app screen-'+state.screen;
  app.innerHTML=screenHtml();
  bind();
  window.scrollTo({top:0,behavior:'auto'});
}
function go(screen,{push=true}={}){
  if(push&&state.screen!==screen)state.history.push(state.screen);
  state.screen=screen;
  render();
}
function safeBack(){
  if(state.gameStarted&&['pass','answer','predict','cover','allAnswered','result'].includes(state.screen)){
    alert('秘密回答が始まったあとは、前の画面には戻れません。');
    return;
  }
  if(state.gameStarted&&state.screen==='question'&&!confirm('ゲーム設定にもどりますか？'))return;
  if(state.history.length){state.screen=state.history.pop();render();}
  else{state.screen='title';render();}
}
function goGameList(){
  if(state.gameStarted&&!confirm('ゲームを途中でやめて、ゲーム一覧にもどりますか？'))return;
  window.location.href='../';
}
function chooseMode(mode){
  state.mode=mode;
  defaultCategories();
  state.includeCustom=false;
  go('setup');
}
function startGame(){
  loadPlayers();
  state.usedKeys.clear();
  state.round=0;
  state.scores=Array(state.playerCount).fill(0);
  state.gameStarted=true;
  newRound();
}
function newRound(){
  state.voter=0;
  state.answers=[];
  state.predictions=[];
  state.secretCounts={a:0,b:0};
  state.roundResult=null;
  state.currentQuestion=drawQuestion();
  if(!state.currentQuestion){alert('選んだジャンルにお題がありません。設定を見直してください。');state.gameStarted=false;go('options');return;}
  go('question',{push:false});
}
function acceptQuestion(){
  state.usedKeys.add(questionKey(state.currentQuestion));
  state.voter=0;
  go('pass');
}
function changeQuestion(){
  state.usedKeys.add(questionKey(state.currentQuestion));
  const q=drawQuestion();
  if(q)state.currentQuestion=q;
  render();
}
function answer(choice){
  if(state.mode==='battle'){
    state.answers[state.voter]=choice;
    go('predict');
  }else{
    state.secretCounts[choice]++;
    go('cover');
  }
}
function predict(pred){
  state.predictions[state.voter]=pred;
  go('cover');
}
function nextVoter(){
  state.voter++;
  if(state.voter>=state.playerCount){
    finalizeRound();
    go('allAnswered',{push:false});
  }else{
    go('pass',{push:false});
  }
}
function finalizeRound(){
  if(state.mode==='secret'){
    state.roundResult={a:state.secretCounts.a,b:state.secretCounts.b};
    return;
  }
  const a=state.answers.filter(x=>x==='a').length;
  const b=state.answers.filter(x=>x==='b').length;
  const tie=a===b;
  const majority=tie?null:(a>b?'a':'b');
  const gains=state.answers.map((ans,i)=>{
    if(tie)return 0;
    const actual=ans===majority?'majority':'minority';
    return state.predictions[i]===actual?1:0;
  });
  gains.forEach((g,i)=>state.scores[i]+=g);
  state.roundResult={a,b,tie,gains,majority};
}
function nextRound(){
  if(state.round+1>=state.roundCount){state.gameStarted=false;go('final');return;}
  state.round++;
  newRound();
}
function replay(){
  state.history=[];
  startGame();
}
function refreshOptionsSummary(){
  const pool=questionPool().length;
  const count=document.querySelector('[data-pool-count]');
  if(count)count.textContent=pool+'問';
  const start=document.querySelector('[data-start-game]');
  if(start)start.disabled=pool===0;
}
function addCustom(){
  const q=document.getElementById('customQ')?.value.trim();
  const a=document.getElementById('customA')?.value.trim();
  const b=document.getElementById('customB')?.value.trim();
  if(!q||!a||!b){alert('質問・A・Bを全部入力してください。');return;}
  const items=customItems();
  items.push({q,a,b,category:'マイお題'});
  saveCustom(items);
  if(state.screen==='options')state.includeCustom=true;
  render();
}
function editMemberCount(n){
  playersApi?.setActiveCount?.(n);
  loadPlayers();
  render();
}
function updateMember(i,patch){
  playersApi?.setPlayer?.(i,patch);
  loadPlayers();
}
function bindHold(btn,fn){
  if(!btn)return;
  let timer=null;
  const start=()=>{
    btn.classList.add('holding');
    timer=setTimeout(()=>{timer=null;btn.classList.remove('holding');fn();},LONG_PRESS_MS);
  };
  const cancel=()=>{if(timer)clearTimeout(timer);timer=null;btn.classList.remove('holding');};
  btn.addEventListener('pointerdown',start);
  btn.addEventListener('pointerup',cancel);
  btn.addEventListener('pointerleave',cancel);
  btn.addEventListener('pointercancel',cancel);
  btn.addEventListener('contextmenu',e=>e.preventDefault());
}
function bind(){
  document.querySelector('[data-nav-back]')?.addEventListener('click',safeBack);
  document.querySelector('[data-nav-home]')?.addEventListener('click',goGameList);
  document.querySelectorAll('[data-go-mode]').forEach(b=>b.addEventListener('click',()=>{state.gameStarted=false;state.history=[];go('mode',{push:false})}));
  document.querySelectorAll('[data-go-rules]').forEach(b=>b.addEventListener('click',()=>go('rules')));
  document.querySelectorAll('[data-go-custom]').forEach(b=>b.addEventListener('click',()=>go('custom')));
  document.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>chooseMode(b.dataset.mode)));
  document.querySelector('[data-edit-members]')?.addEventListener('click',()=>go('members'));
  document.querySelectorAll('[data-round-count]').forEach(b=>b.addEventListener('click',()=>{state.roundCount=Number(b.dataset.roundCount);render()}));
  document.querySelector('[data-next-options]')?.addEventListener('click',()=>go('options'));
  document.querySelectorAll('[data-category]').forEach(b=>b.addEventListener('click',()=>{
    const c=b.dataset.category;
    if(state.selectedCategories.has(c))state.selectedCategories.delete(c);else state.selectedCategories.add(c);
    b.classList.toggle('selected',state.selectedCategories.has(c));
    refreshOptionsSummary();
  }));
  document.querySelector('[data-select-all]')?.addEventListener('click',()=>{
    const cats=categoriesForMode();
    const allOn=cats.every(c=>state.selectedCategories.has(c));
    state.selectedCategories=allOn?new Set():new Set(cats);
    document.querySelectorAll('[data-category]').forEach(b=>b.classList.toggle('selected',state.selectedCategories.has(b.dataset.category)));
    refreshOptionsSummary();
  });
  document.querySelector('[data-custom-toggle]')?.addEventListener('change',e=>{state.includeCustom=e.target.checked;refreshOptionsSummary()});
  document.querySelector('[data-start-game]')?.addEventListener('click',startGame);
  document.querySelectorAll('[data-member-count]').forEach(b=>b.addEventListener('click',()=>editMemberCount(Number(b.dataset.memberCount))));
  document.querySelectorAll('[data-member-name]').forEach(input=>input.addEventListener('change',()=>{const i=Number(input.dataset.memberName);updateMember(i,{name:input.value||('プレイヤー'+(i+1))});render()}));
  document.querySelectorAll('[data-member-icon]').forEach(b=>b.addEventListener('click',()=>{updateMember(Number(b.dataset.memberIcon),{icon:b.dataset.icon});render()}));
  document.querySelector('[data-members-done]')?.addEventListener('click',()=>{loadPlayers();go('setup')});
  document.querySelector('[data-add-custom]')?.addEventListener('click',addCustom);
  document.querySelectorAll('[data-delete-custom]').forEach(b=>b.addEventListener('click',()=>{const items=customItems();items.splice(Number(b.dataset.deleteCustom),1);saveCustom(items);render()}));
  document.querySelector('[data-clear-custom]')?.addEventListener('click',()=>{if(confirm('マイお題を全部消しますか？')){saveCustom([]);render()}});
  document.querySelector('[data-accept-question]')?.addEventListener('click',acceptQuestion);
  document.querySelector('[data-change-question]')?.addEventListener('click',changeQuestion);
  bindHold(document.querySelector('[data-hold-answer]'),()=>go('answer'));
  document.querySelectorAll('[data-answer]').forEach(b=>b.addEventListener('click',()=>answer(b.dataset.answer)));
  document.querySelectorAll('[data-predict]').forEach(b=>b.addEventListener('click',()=>predict(b.dataset.predict)));
  document.querySelector('[data-next-voter]')?.addEventListener('click',nextVoter);
  document.querySelector('[data-show-result]')?.addEventListener('click',()=>go('result',{push:false}));
  document.querySelector('[data-next-round]')?.addEventListener('click',nextRound);
  document.querySelector('[data-replay]')?.addEventListener('click',replay);
}
loadPlayers();
render();
})();