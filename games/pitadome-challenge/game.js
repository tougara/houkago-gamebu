(()=>{
const app=document.getElementById('app');
const playersApi=window.HoukagoPlayers;
const RECORD_KEY='houkago_pitadome_records_v1';
const SOLO_KEY='houkago_pitadome_solo_player_v1';

const state={
  screen:'title',history:[],gameStarted:false,mode:null,
  soloIndex:0,player:null,memberReturn:'title',
  round:1,totalRounds:10,score:0,perfects:0,perfectStreak:0,maxPerfectStreak:0,
  lives:3,target:50,value:0,error:0,roundScore:0,comment:'',resultValue:0,
  running:false,countdownId:null,rafId:null,lastTs:0,dir:1,phase:0,speed:42,
  movement:'normal',roundErrors:[],newRecord:false
};

function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
function topNav(){return '<nav class="top-nav"><button class="nav-pill" data-back>← 1個前にもどる</button><button class="nav-pill" data-home>ゲームをえらぶ</button></nav>'}
function heading(t,p=''){return '<header class="screen-heading"><h1>'+esc(t)+'</h1>'+(p?'<p>'+esc(p)+'</p>':'')+'</header>'}
function logo(){return '<img class="title-logo" src="../../pitadome_challenge_logo.png" alt="ピタ止めチャレンジ">'}
function loadPlayer(){
  const d=playersApi?.load?.();
  try{state.soloIndex=Math.max(0,Math.min((d?.players?.length||1)-1,Number(localStorage.getItem(SOLO_KEY))||0))}catch(e){state.soloIndex=0}
  state.player=(d?.players?.[state.soloIndex]||{name:'プレイヤー1',icon:'🐶'});
}
function saveSoloIndex(i){
  state.soloIndex=Math.max(0,Number(i)||0);
  try{localStorage.setItem(SOLO_KEY,String(state.soloIndex))}catch(e){}
  loadPlayer();
}
function loadRecords(){
  try{
    const x=JSON.parse(localStorage.getItem(RECORD_KEY)||'{}');
    return {
      tenBest:Number(x.tenBest)||0,tenPerfects:Number(x.tenPerfects)||0,tenAvgError:Number.isFinite(Number(x.tenAvgError))?Number(x.tenAvgError):null,
      endBest:Number(x.endBest)||0,endRound:Number(x.endRound)||0,endPerfects:Number(x.endPerfects)||0
    };
  }catch(e){return{tenBest:0,tenPerfects:0,tenAvgError:null,endBest:0,endRound:0,endPerfects:0}}
}
function saveRecords(r){try{localStorage.setItem(RECORD_KEY,JSON.stringify(r))}catch(e){}}
function stopMotion(){
  state.running=false;
  if(state.countdownId){clearTimeout(state.countdownId);state.countdownId=null}
  if(state.rafId){cancelAnimationFrame(state.rafId);state.rafId=null}
}
function go(screen,{push=true}={}){
  stopMotion();
  if(push&&state.screen!==screen)state.history.push(state.screen);
  state.screen=screen;render();
}
function doBackOne(){
  stopMotion();
  if(state.gameStarted&&(state.screen==='play'||state.screen==='roundResult')){showLeaveConfirm('back');return}
  if(state.history.length){state.screen=state.history.pop();render();return}
  location.href='../';
}
function goHome(){
  if(state.gameStarted&&(state.screen==='play'||state.screen==='roundResult')){showLeaveConfirm('home');return}
  location.href='../';
}
function showLeaveConfirm(type){
  document.querySelector('.leave-confirm')?.remove();
  const w=document.createElement('div');
  w.className='countdown-overlay leave-confirm';
  w.innerHTML='<div class="card" style="width:min(430px,90%);text-align:center"><h2>ゲームを中断しますか？</h2><p style="margin:8px 0 14px">現在のスコアは保存されません。</p><div class="stack"><button class="btn secondary full" data-leave-cancel>続ける</button><button class="btn full" data-leave-ok>中断する</button></div></div>';
  document.querySelector('.play-wrap')?.appendChild(w) || document.body.appendChild(w);
  w.querySelector('[data-leave-cancel]')?.addEventListener('click',()=>w.remove());
  w.querySelector('[data-leave-ok]')?.addEventListener('click',()=>{state.gameStarted=false;w.remove();if(type==='home')location.href='../';else{state.screen='title';state.history=[];render()}});
}
function titleScreen(){
  loadPlayer();
  return topNav()+'<section class="title-card">'+logo()+
    '<p class="title-copy">静けさの中で、ここだと思う瞬間を止めろ。<br>狙った数字に近いほど高得点。</p>'+
    '<div class="stack"><button class="btn full" data-start-title>ゲームをはじめる</button><button class="btn secondary full" data-rules>あそびかた</button><button class="btn secondary full" data-player-select>プレイヤーを選ぶ</button></div></section>';
}
function modeScreen(){
  const r=loadRecords();
  return topNav()+heading('モードを選ぼう','短く遊ぶか、限界まで挑むか')+
    '<div class="mode-grid">'+
      '<button class="mode-card" data-mode="ten"><div class="mode-badges"><span class="mode-badge">約1〜2分</span><span class="mode-badge">全10ラウンド</span></div><strong>10ラウンドチャレンジ</strong><span>10回の合計点で自己ベストを狙おう。BEST '+r.tenBest+'点</span></button>'+
      '<button class="mode-card" data-mode="endless"><div class="mode-badges"><span class="mode-badge">ENDLESS</span><span class="mode-badge">ライフ3</span></div><strong>エンドレスチャレンジ</strong><span>ミス3回で終了。難易度は少しずつ上がる。BEST '+r.endBest+'点 / ROUND '+r.endRound+'</span></button>'+
    '</div>';
}
function playerSelectScreen(){
  const d=playersApi?.load?.();
  const players=(d?.players||[]).slice(0,d?.activeCount||2);
  return topNav()+heading('プレイヤーを選ぶ','登録済みメンバーから今回遊ぶ人を選べます')+
    '<section class="card solo-list">'+players.map((p,i)=>'<button class="solo-choice '+(i===state.soloIndex?'selected':'')+'" data-solo-player="'+i+'"><span>'+esc(p.icon)+'</span><strong>'+esc(p.name)+'</strong></button>').join('')+'</section>'+
    '<div class="stack"><button class="btn secondary full" data-edit-members>メンバー登録を編集</button><button class="btn full" data-player-done>このプレイヤーで決定</button></div>';
}
function membersScreen(){
  const d=playersApi?.load?.();
  return topNav()+playersApi.renderEditor({
    min:2,max:10,count:d?.activeCount||2,players:d?.players||[],
    title:'参加メンバー',subtitle:'名前とアイコンは放課後ゲーム部の全ゲームで共通です',
    doneLabel:'登録をおわる'
  });
}
function rulesScreen(){
  return topNav()+heading('あそびかた','止めるだけ。近いほど高得点！')+
    '<div class="rules-list">'+
      '<section class="rule-step"><b>1</b><div><strong>目標の数字を見る</strong><span>「73をねらえ！」のように0〜100の目標が出ます。</span></div></section>'+
      '<section class="rule-step"><b>2</b><div><strong>カーソルの動きを見る</strong><span>メーター上をカーソルが左右に動きます。</span></div></section>'+
      '<section class="rule-step"><b>3</b><div><strong>ここだ！でSTOP</strong><span>指が触れた瞬間に止まります。目標に近いほど高得点。</span></div></section>'+
      '<section class="rule-step"><b>4</b><div><strong>ピッタリならPERFECT</strong><span>誤差0なら100点。自己ベスト更新を狙おう！</span></div></section>'+
    '</div>'+
    '<section class="card mode-help"><div><strong>10ラウンド</strong><p>全10回の合計点で勝負。後半ほど難しくなります。</p></div><div><strong>エンドレス</strong><p>誤差11以上でライフ−1。ライフ3つがなくなるまで続きます。</p></div></section>'+
    '<button class="btn secondary full rules-bottom-back" data-rules-back>← もどる</button>';
}
function difficultyForRound(round){
  if(round<=2)return{speed:34,movement:'normal'};
  if(round<=4)return{speed:42,movement:'normal'};
  if(round<=6)return{speed:48,movement:'accel'};
  if(round<=8)return{speed:54,movement:'change'};
  if(round<=10)return{speed:60,movement:'change'};
  if(round<=15)return{speed:62+(round-10)*1.8,movement:'accel'};
  if(round<=25)return{speed:72+(round-15)*1.5,movement:'change'};
  return{speed:87+Math.min(26,(round-25)*1.1),movement:'reverse'};
}
function newTarget(){
  let n=10+Math.floor(Math.random()*81);
  if(Math.abs(n-state.target)<10)n=10+((n+27)%81);
  state.target=n;
}
function prepareRound(){
  const d=difficultyForRound(state.round);
  state.speed=d.speed;state.movement=d.movement;state.value=Math.random()<.5?0:100;state.dir=state.value===0?1:-1;state.phase=Math.random()*Math.PI*2;
  state.lastTs=0;state.error=0;state.roundScore=0;state.comment='';state.resultValue=0;newTarget();
}
function playScreen(){
  const endless=state.mode==='endless';
  const player=state.player||{name:'プレイヤー',icon:'🐶'};
  return topNav()+'<div class="play-wrap"><section class="play-panel">'+
    '<div class="hud"><div class="hud-chip">ROUND '+state.round+(state.mode==='ten'?' / 10':'')+'</div><div class="hud-chip hud-right">SCORE '+state.score+'</div></div>'+
    (endless?'<div class="hud-chip life-row">LIFE '+Array.from({length:3},(_,i)=>i<state.lives?'♥':'♡').join(' ')+'　'+esc(player.icon)+' '+esc(player.name)+'</div>':'')+
    '<div class="target-wrap"><div class="target-label">この数字をねらえ</div><div class="target-number">'+state.target+'<small>をねらえ！</small></div></div>'+
    '<div class="meter-zone"><div class="meter-line-wrap"><div class="meter-line"></div><div class="meter-cursor" id="meterCursor"></div></div><div class="meter-labels"><span>0</span><span>50</span><span>100</span></div></div>'+
    '<button class="stop-btn" data-stop disabled>STOP！</button>'+
    '<div class="countdown-overlay" id="countdownOverlay"><div class="countdown-number" id="countdownNumber">3</div></div>'+
  '</section></div>';
}
function scoreForError(e){
  if(e===0)return 100;
  if(e===1)return 95;
  if(e===2)return 90;
  if(e<=3)return 80;
  if(e<=5)return 70;
  if(e<=8)return 50;
  if(e<=12)return 30;
  return 10;
}
function commentForError(e){
  if(e===0)return'PERFECT！';
  if(e===1)return'おしい！';
  if(e<=3)return'かなり近い！';
  if(e<=5)return'GOOD！';
  if(e<=10)return'セーフ！';
  return'ミス！';
}
function stopRound(){
  if(!state.running)return;
  stopMotion();
  state.resultValue=Math.round(state.value);
  state.error=Math.abs(state.resultValue-state.target);
  state.roundScore=scoreForError(state.error);
  state.score+=state.roundScore;
  state.roundErrors.push(state.error);
  if(state.error===0){state.perfects++;state.perfectStreak++;state.maxPerfectStreak=Math.max(state.maxPerfectStreak,state.perfectStreak)}else state.perfectStreak=0;
  if(state.mode==='endless'&&state.error>10)state.lives--;
  state.comment=commentForError(state.error);
  go('roundResult',{push:false});
}
function roundResultScreen(){
  const perfect=state.error===0;
  const lifeLost=state.mode==='endless'&&state.error>10;
  return topNav()+heading('ラウンド結果',state.mode==='ten'?'10ラウンドの合計点に挑戦':'ライフがなくなるまで続けよう')+
    '<section class="card result-card"><div class="result-kicker">ROUND '+state.round+'</div><div class="result-main '+(perfect?'perfect':'')+'">'+state.roundScore+'<small style="font-size:.28em"> POINT</small></div><div class="result-comment">'+state.comment+'</div>'+
    '<div class="result-stats"><div class="result-stat"><small>目標</small><strong>'+state.target+'</strong></div><div class="result-stat"><small>STOP</small><strong>'+state.resultValue+'</strong></div><div class="result-stat"><small>誤差</small><strong>'+state.error+'</strong></div><div class="result-stat"><small>合計</small><strong>'+state.score+'</strong></div></div>'+
    (lifeLost?'<div class="note">誤差11以上でミス。ライフが1つ減りました。</div>':'')+
    '</section><button class="btn full" data-next-round>'+(isGameOver()?'結果を見る':'次のラウンドへ')+'</button>';
}
function isGameOver(){return state.mode==='ten'?state.round>=10:state.lives<=0}
function finishGame(){
  state.gameStarted=false;state.newRecord=false;
  const r=loadRecords();
  if(state.mode==='ten'){
    const avg=state.roundErrors.length?state.roundErrors.reduce((a,b)=>a+b,0)/state.roundErrors.length:0;
    if(state.score>r.tenBest){r.tenBest=state.score;state.newRecord=true}
    r.tenPerfects=Math.max(r.tenPerfects,state.perfects);
    if(r.tenAvgError===null||avg<r.tenAvgError)r.tenAvgError=Number(avg.toFixed(2));
  }else{
    if(state.score>r.endBest){r.endBest=state.score;state.newRecord=true}
    r.endRound=Math.max(r.endRound,state.round);
    r.endPerfects=Math.max(r.endPerfects,state.perfects);
  }
  saveRecords(r);go('final',{push:false});
}
function finalScreen(){
  const r=loadRecords();
  const avg=state.roundErrors.length?(state.roundErrors.reduce((a,b)=>a+b,0)/state.roundErrors.length).toFixed(1):'0.0';
  return topNav()+heading('チャレンジ終了',state.mode==='ten'?'10ラウンド完走！':'限界まで挑戦しました')+
    '<section class="card final-card">'+(state.newRecord?'<div class="new-record">NEW RECORD！</div>':'')+
    '<div class="result-kicker">TOTAL SCORE</div><div class="final-score">'+state.score+'</div>'+
    '<div class="record-grid">'+
      '<div class="record-box"><small>PERFECT</small><strong>'+state.perfects+'回</strong></div>'+
      '<div class="record-box"><small>平均誤差</small><strong>'+avg+'</strong></div>'+
      (state.mode==='endless'?'<div class="record-box"><small>到達</small><strong>ROUND '+state.round+'</strong></div><div class="record-box"><small>BEST</small><strong>'+r.endBest+'点</strong></div>':'<div class="record-box"><small>BEST</small><strong>'+r.tenBest+'点</strong></div><div class="record-box"><small>最小平均誤差</small><strong>'+(r.tenAvgError??'-')+'</strong></div>')+
    '</div></section>'+
    '<div class="stack"><button class="btn full" data-replay>もう一度！</button><button class="btn secondary full" data-change-mode>モードを変える</button><button class="btn secondary full" data-home>ゲームをえらぶ</button></div>';
}
function screenHtml(){
  return({title:titleScreen,mode:modeScreen,playerSelect:playerSelectScreen,members:membersScreen,rules:rulesScreen,play:playScreen,roundResult:roundResultScreen,final:finalScreen}[state.screen]||titleScreen)();
}
function render(){
  app.className='pitadome-app screen-'+state.screen;
  app.innerHTML=screenHtml();bind();window.scrollTo({top:0,behavior:'auto'});
  if(state.screen==='play')startCountdown();
}
function beginGame(mode=state.mode){
  loadPlayer();state.mode=mode;state.history=[];state.gameStarted=true;state.round=1;state.score=0;state.perfects=0;state.perfectStreak=0;state.maxPerfectStreak=0;state.lives=3;state.roundErrors=[];state.newRecord=false;
  prepareRound();state.screen='play';render();
}
function startCountdown(){
  stopMotion();
  const overlay=document.getElementById('countdownOverlay'),num=document.getElementById('countdownNumber'),stopBtn=document.querySelector('[data-stop]');
  let n=3;if(num)num.textContent=n;
  const tick=()=>{
    if(n>1){n--;if(num)num.textContent=n;state.countdownId=setTimeout(tick,650);return}
    if(num){num.textContent='START!';num.classList.add('start-text')}
    state.countdownId=setTimeout(()=>{overlay?.remove();if(stopBtn)stopBtn.disabled=false;startMotion()},420);
  };
  state.countdownId=setTimeout(tick,650);
}
function startMotion(){
  state.running=true;state.lastTs=0;
  const step=(ts)=>{
    if(!state.running)return;
    if(!state.lastTs)state.lastTs=ts;
    const dt=Math.min(.04,(ts-state.lastTs)/1000);state.lastTs=ts;state.phase+=dt;
    let mult=1;
    if(state.movement==='accel')mult=.82+Math.min(.7,state.phase*.08);
    if(state.movement==='change')mult=.86+.34*(.5+.5*Math.sin(state.phase*2.25));
    if(state.movement==='reverse'&&Math.sin(state.phase*1.55)>0.985)state.dir*=-1;
    state.value+=state.dir*state.speed*mult*dt;
    if(state.value>=100){state.value=100;state.dir=-1}
    if(state.value<=0){state.value=0;state.dir=1}
    const cursor=document.getElementById('meterCursor');
    if(cursor)cursor.style.left='calc(12px + '+state.value+'% * (100% - 24px) / 100)';
    state.rafId=requestAnimationFrame(step);
  };
  state.rafId=requestAnimationFrame(step);
}
function nextRound(){
  if(isGameOver()){finishGame();return}
  state.round++;prepareRound();go('play',{push:false});
}
function bind(){
  document.querySelector('[data-back]')?.addEventListener('click',doBackOne);
  document.querySelectorAll('[data-home]').forEach(b=>b.addEventListener('click',goHome));
  document.querySelector('[data-start-title]')?.addEventListener('click',()=>go('mode'));
  document.querySelector('[data-rules]')?.addEventListener('click',()=>go('rules'));
  document.querySelector('[data-rules-back]')?.addEventListener('click',doBackOne);
  document.querySelector('[data-player-select]')?.addEventListener('click',()=>{state.memberReturn='title';go('playerSelect')});
  document.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>beginGame(b.dataset.mode)));
  document.querySelectorAll('[data-solo-player]').forEach(b=>b.addEventListener('click',()=>{saveSoloIndex(Number(b.dataset.soloPlayer));render()}));
  document.querySelector('[data-edit-members]')?.addEventListener('click',()=>{state.memberReturn='playerSelect';go('members')});
  document.querySelector('[data-player-done]')?.addEventListener('click',()=>{loadPlayer();go(state.memberReturn==='title'?'title':'mode',{push:false})});
  document.querySelectorAll('[data-member-count]').forEach(b=>b.addEventListener('click',()=>{playersApi?.setActiveCount?.(Number(b.dataset.memberCount));render()}));
  document.querySelectorAll('[data-member-name]').forEach(inp=>inp.addEventListener('change',()=>{const i=Number(inp.dataset.memberName);playersApi?.setPlayer?.(i,{name:inp.value||('プレイヤー'+(i+1))});render()}));
  document.querySelectorAll('[data-member-icon]').forEach(b=>b.addEventListener('click',()=>{playersApi?.setPlayer?.(Number(b.dataset.memberIcon),{icon:b.dataset.icon});render()}));
  document.querySelector('[data-members-done]')?.addEventListener('click',()=>go('playerSelect',{push:false}));
  const stopBtn=document.querySelector('[data-stop]');
  stopBtn?.addEventListener('pointerdown',e=>{e.preventDefault();stopRound()},{passive:false});
  document.querySelector('[data-next-round]')?.addEventListener('click',nextRound);
  document.querySelector('[data-replay]')?.addEventListener('click',()=>beginGame(state.mode));
  document.querySelector('[data-change-mode]')?.addEventListener('click',()=>{state.history=[];state.screen='mode';render()});
}
loadPlayer();render();
})();