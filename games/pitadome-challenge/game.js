(()=>{
const app=document.getElementById('app');
const playersApi=window.HoukagoPlayers;
const SOLO_KEY='houkago_pitadome_solo_player_v1';
const RANK_KEY='houkago_pitadome_rankings_v1';

const state={
  screen:'title',history:[],gameStarted:false,mode:null,needsOpeningCountdown:true,
  soloIndex:0,player:null,memberReturn:'title',
  round:1,totalRounds:10,score:0,perfects:0,
  lives:3,target:50,value:0,error:0,resultValue:0,
  baseScore:0,roundScore:0,comment:'',tier:'normal',
  running:false,countdownId:null,rafId:null,lastTs:0,dir:1,phase:0,speed:42,reverseBucket:-1,
  movement:'normal',barScale:.86,maxValue:100,refPoint:50,blind:false,blindStart:36,blindEnd:62,
  safeLimit:10,gimmicks:[],stageName:'一ノ境',
  roundErrors:[],newRecord:false,
  combo:0,maxCombo:0,comboMultiplier:1,
  quietGauge:0,mushinReady:false,mushinActive:false,
  charm:0,charmEarnedThisRound:false,lifeProtected:false,
  rankMode:'ten',rankEdit:false
};

function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
function shuffle(arr){const a=[...arr];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function topNav(){return '<nav class="top-nav"><button class="nav-pill" data-back>← 1個前にもどる</button><button class="nav-pill" data-home>ゲームをえらぶ</button></nav>'}
function heading(t,p=''){return '<header class="screen-heading"><h1>'+esc(t)+'</h1>'+(p?'<p>'+esc(p)+'</p>':'')+'</header>'}
function logo(){return '<img class="title-logo" src="../../pitadome_challenge_logo.png" alt="ピタ止めチャレンジ">'}
function loadPlayer(){
  const d=playersApi?.load?.();
  const active=Math.max(1,Number(d?.activeCount)||1);
  try{state.soloIndex=Math.max(0,Math.min(active-1,Number(localStorage.getItem(SOLO_KEY))||0))}catch(e){state.soloIndex=0}
  state.player=(d?.players?.[state.soloIndex]||{name:'プレイヤー1',icon:'🐶'});
}
function saveSoloIndex(i){
  state.soloIndex=Math.max(0,Number(i)||0);
  try{localStorage.setItem(SOLO_KEY,String(state.soloIndex))}catch(e){}
  loadPlayer();
}
function cleanRankEntry(x,i){
  return {
    id:String(x?.id||('legacy_'+i+'_'+Date.now())),
    name:String(x?.name||'プレイヤー').slice(0,12),
    icon:String(x?.icon||'🏅'),
    score:Math.max(0,Number(x?.score)||0),
    round:Math.max(0,Number(x?.round)||0),
    perfects:Math.max(0,Number(x?.perfects)||0),
    avgError:Number.isFinite(Number(x?.avgError))?Number(x.avgError):99,
    at:Number(x?.at)||0
  };
}
function loadRankings(){
  try{
    const raw=JSON.parse(localStorage.getItem(RANK_KEY)||'{}');
    return {
      ten:Array.isArray(raw.ten)?raw.ten.map(cleanRankEntry):[],
      endless:Array.isArray(raw.endless)?raw.endless.map(cleanRankEntry):[]
    };
  }catch(e){return{ten:[],endless:[]}}
}
function sortRanking(mode,arr){
  const a=[...arr];
  if(mode==='ten')a.sort((x,y)=>y.score-x.score||y.perfects-x.perfects||x.avgError-y.avgError||x.at-y.at);
  else a.sort((x,y)=>y.score-x.score||y.round-x.round||y.perfects-x.perfects||x.at-y.at);
  return a.slice(0,10);
}
function saveRankings(r){
  const clean={ten:sortRanking('ten',r.ten||[]),endless:sortRanking('endless',r.endless||[])};
  try{localStorage.setItem(RANK_KEY,JSON.stringify(clean))}catch(e){}
  return clean;
}
function bestScore(mode){
  const r=loadRankings();
  return sortRanking(mode,r[mode]||[])[0]?.score||0;
}
function addRankingEntry(){
  loadPlayer();
  const r=loadRankings();
  const avg=state.roundErrors.length?state.roundErrors.reduce((a,b)=>a+b,0)/state.roundErrors.length:0;
  const entry={
    id:Date.now()+'_'+Math.random().toString(36).slice(2,7),
    name:state.player.name,icon:state.player.icon,score:state.score,
    round:state.round,perfects:state.perfects,avgError:Number(avg.toFixed(2)),at:Date.now()
  };
  const key=state.mode==='ten'?'ten':'endless';
  const before=sortRanking(key,r[key]||[]);
  const oldBest=before[0]?.score||0;
  r[key]=sortRanking(key,[...before,entry]);
  saveRankings(r);
  state.newRecord=state.score>oldBest;
}
function deleteRankEntry(mode,id){
  const r=loadRankings();
  r[mode]=(r[mode]||[]).filter(x=>x.id!==id);
  saveRankings(r);
}
function clearRankings(mode){
  const r=loadRankings();r[mode]=[];saveRankings(r);
}
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
  w.innerHTML='<div class="card" style="width:min(430px,90%);text-align:center"><h2>ゲームを中断しますか？</h2><p style="margin:8px 0 14px">現在のスコアはランキングに保存されません。</p><div class="stack"><button class="btn secondary full" data-leave-cancel>続ける</button><button class="btn full" data-leave-ok>中断する</button></div></div>';
  document.querySelector('.play-wrap')?.appendChild(w) || document.body.appendChild(w);
  w.querySelector('[data-leave-cancel]')?.addEventListener('click',()=>w.remove());
  w.querySelector('[data-leave-ok]')?.addEventListener('click',()=>{state.gameStarted=false;w.remove();if(type==='home')location.href='../';else{state.screen='title';state.history=[];render()}});
}
function titleScreen(){
  loadPlayer();
  return topNav()+'<section class="title-card">'+logo()+
    '<p class="title-copy">静けさの中で、ここだと思う瞬間を止めろ。<br>狙った数字に近いほど高得点。</p>'+
    '<div class="stack"><button class="btn full" data-start-title>ゲームをはじめる</button><button class="btn secondary full" data-rules>あそびかた</button><button class="btn secondary full" data-ranking>ハイスコアランキング</button><button class="btn secondary full" data-player-select>プレイヤーを選ぶ</button></div></section>';
}
function modeScreen(){
  loadPlayer();
  const tenBest=bestScore('ten'),endBest=bestScore('endless');
  return topNav()+heading('モードを選ぼう','短く遊ぶか、限界まで挑むか')+
    '<section class="card player-card"><div class="player-main"><div class="player-avatar">'+esc(state.player.icon)+'</div><div><small style="color:#cbd4df;font-weight:900">今回のプレイヤー</small><strong style="display:block">'+esc(state.player.name)+'</strong></div></div><button class="small-btn" data-change-player>変更</button></section>'+
    '<div class="mode-grid">'+
      '<button class="mode-card" data-mode="ten"><div class="mode-badges"><span class="mode-badge">約1〜2分</span><span class="mode-badge">全10ラウンド</span></div><strong>10ラウンドチャレンジ</strong><span>毎ラウンド条件が変化。10回の合計点で自己ベストを狙おう。BEST '+tenBest+'点</span></button>'+
      '<button class="mode-card" data-mode="endless"><div class="mode-badges"><span class="mode-badge">ENDLESS</span><span class="mode-badge">ライフ3</span></div><strong>エンドレスチャレンジ</strong><span>進むほど速度・視界・合格範囲が厳しくなる。BEST '+endBest+'点</span></button>'+
    '</div><button class="btn secondary full" style="margin-top:12px" data-ranking>ハイスコアランキング</button>';
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
  return topNav()+heading('あそびかた','止めるだけ。でもラウンドごとに条件が変わる！')+
    '<div class="rules-list">'+
      '<section class="rule-step"><b>1</b><div><strong>目標の数字を見る</strong><span>「73をねらえ！」のように0〜100の目標が出ます。</span></div></section>'+
      '<section class="rule-step"><b>2</b><div><strong>カーソルの動きを読む</strong><span>速度変化・短いバー・隠しゾーン・反転・超光速・上限150/200などが登場します。</span></div></section>'+
      '<section class="rule-step"><b>3</b><div><strong>ここだ！でSTOP</strong><span>最初だけ3・2・1で開始。指が触れた瞬間に停止し、次ラウンドからはカウントダウンなしで始まります。</span></div></section>'+
      '<section class="rule-step"><b>4</b><div><strong>近さを連続させてCOMBO</strong><span>誤差3以内が続くほど得点倍率UP。PERFECTはコンボ+2。</span></div></section>'+
    '</div>'+
    '<section class="card mode-help"><div><strong>静ゲージ</strong><p>GREAT以上で増加。満タンになると次の1回が「無心」になり得点×1.5。</p></div><div><strong>エンドレスの護符</strong><p>10コンボ到達で護符を1個獲得。次のミスによるライフ減少を1回だけ防ぎます。</p></div><div><strong>10ラウンド</strong><p>10種類の仕掛けを攻略するスコアアタック。FINALは複数ギミック。</p></div><div><strong>エンドレス</strong><p>進むほど合格範囲が狭くなり、複数ギミックが重なります。</p></div></section>'+
    '<button class="btn secondary full rules-bottom-back" data-rules-back>← もどる</button>';
}
function randomRef(maxValue=100){
  const ratios=[.22,.28,.33,.38,.62,.67,.72,.78];
  return Math.round(maxValue*ratios[Math.floor(Math.random()*ratios.length)]);
}
function randomBlind(){
  const width=18+Math.floor(Math.random()*11);
  const start=14+Math.floor(Math.random()*(72-width));
  return{start,end:start+width};
}
function baseProfile(){
  return{speed:34,movement:'normal',barScale:.86,maxValue:100,refPoint:50,blind:false,blindStart:36,blindEnd:62,safeLimit:10,gimmicks:['基本']};
}
function applyGimmick(p,key){
  if(key==='fast'){p.speed+=14;p.gimmicks.push('高速')}
  if(key==='hyper'){p.speed=Math.max(p.speed,150);p.movement='hyper';p.gimmicks.push('超光速')}
  if(key==='short'){p.barScale=.58;p.gimmicks.push('短尺')}
  if(key==='wide'){p.barScale=1;p.gimmicks.push('長尺')}
  if(key==='range150'){p.maxValue=150;p.gimmicks.push('上限150')}
  if(key==='range200'){p.maxValue=200;p.gimmicks.push('上限200')}
  if(key==='ref'){p.refPoint=randomRef(p.maxValue);p.gimmicks.push('基準変化')}
  if(key==='blind'){const b=randomBlind();p.blind=true;p.blindStart=b.start;p.blindEnd=b.end;p.gimmicks.push('隠し')}
  if(key==='change'){p.movement='change';p.gimmicks.push('変速')}
  if(key==='accel'){p.movement='accel';p.gimmicks.push('加速')}
  if(key==='reverse'){p.movement='reverse';p.gimmicks.push('反転')}
}
function tenProfile(round){
  const p=baseProfile();p.gimmicks=[];
  if(round===1){p.gimmicks=['基本']}
  if(round===2){p.speed=45;p.gimmicks=['速度UP']}
  if(round===3){p.speed=42;applyGimmick(p,'short')}
  if(round===4){p.speed=44;applyGimmick(p,'ref')}
  if(round===5){p.speed=50;applyGimmick(p,'change')}
  if(round===6){p.speed=50;applyGimmick(p,'blind')}
  if(round===7){p.speed=58;applyGimmick(p,'wide');p.gimmicks.unshift('高速')}
  if(round===8){p.speed=60;applyGimmick(p,'range150');applyGimmick(p,'ref')}
  if(round===9){p.speed=150;applyGimmick(p,'hyper')}
  if(round===10){
    p.speed=72;p.gimmicks=['FINAL'];applyGimmick(p,'range200');
    const picks=shuffle(['short','blind','ref','change','reverse']).slice(0,2);
    picks.forEach(k=>applyGimmick(p,k));
  }
  return p;
}
function endlessStage(round){
  if(round<=5)return{stage:'一ノ境',safe:10,count:0,speed:34+(round-1)*2,maxValue:100,hyper:0};
  if(round<=10)return{stage:'二ノ境',safe:9,count:1,speed:45+(round-6)*2,maxValue:round>=8?150:100,hyper:0};
  if(round<=15)return{stage:'三ノ境',safe:8,count:2,speed:56+(round-11)*2,maxValue:150,hyper:0};
  if(round<=20)return{stage:'四ノ境',safe:7,count:2,speed:66+(round-16)*2,maxValue:round>=18?200:150,hyper:0};
  if(round<=30)return{stage:'修羅ノ境',safe:6,count:3,speed:76+Math.min(14,(round-21)*1.5),maxValue:200,hyper:.28};
  return{stage:'極ノ境',safe:5,count:3,speed:92+Math.min(24,(round-31)*1.15),maxValue:200,hyper:.48};
}
function endlessProfile(round){
  const s=endlessStage(round),p=baseProfile();
  p.speed=s.speed;p.safeLimit=s.safe;p.maxValue=s.maxValue;p.gimmicks=[];p.stageName=s.stage;
  if(p.maxValue===150)p.gimmicks.push('上限150');
  if(p.maxValue===200)p.gimmicks.push('上限200');
  if(round<=2){p.gimmicks.push('基本');return p}
  const pool=round<=10?['short','wide','ref','fast']:round<=15?['short','ref','blind','accel','change']:['short','wide','ref','blind','accel','change','reverse','fast'];
  const count=Math.max(1,s.count);
  shuffle(pool).slice(0,count).forEach(k=>applyGimmick(p,k));
  if(round>=11&&p.movement==='normal')applyGimmick(p,round%2?'accel':'change');
  if(s.hyper&&Math.random()<s.hyper)applyGimmick(p,'hyper');
  p.gimmicks=[...new Set(p.gimmicks)];
  return p;
}
function newTarget(){
  const margin=Math.max(10,Math.round(state.maxValue*.08));
  const span=Math.max(1,state.maxValue-margin*2+1);
  let n=margin+Math.floor(Math.random()*span);
  const minGap=Math.max(10,Math.round(state.maxValue*.08));
  if(Math.abs(n-state.target)<minGap)n=margin+((n+Math.round(state.maxValue*.27))%span);
  state.target=clamp(n,margin,state.maxValue-margin);
}
function prepareRound(){
  state.mushinActive=state.mushinReady;state.mushinReady=false;
  const p=state.mode==='ten'?tenProfile(state.round):endlessProfile(state.round);
  state.speed=p.speed;state.movement=p.movement;state.barScale=p.barScale;state.maxValue=p.maxValue||100;state.refPoint=p.refPoint;
  if(state.gimmicks?.includes?.('基準変化')||p.gimmicks.includes('基準変化'))state.refPoint=randomRef(state.maxValue);
  else if(state.refPoint===50&&state.maxValue!==100)state.refPoint=Math.round(state.maxValue/2);
  state.blind=p.blind;state.blindStart=p.blindStart;state.blindEnd=p.blindEnd;state.safeLimit=p.safeLimit;
  state.gimmicks=[...p.gimmicks];state.stageName=p.stageName||'十番勝負';
  if(state.mushinActive)state.gimmicks.push('無心');
  state.value=Math.random()<.5?0:state.maxValue;state.dir=state.value===0?1:-1;state.phase=Math.random()*Math.PI*2;
  state.lastTs=0;state.reverseBucket=-1;state.error=0;state.baseScore=0;state.roundScore=0;state.comment='';state.resultValue=0;
  state.comboMultiplier=1;state.charmEarnedThisRound=false;state.lifeProtected=false;
  newTarget();
}
function stageBreakRound(){
  return state.mode==='endless'&&[1,6,11,16,21,31].includes(state.round);
}
function quietGaugeHtml(){
  return '<div class="quiet-row"><div class="quiet-copy"><span>静ゲージ</span><strong>'+state.quietGauge+'%</strong></div><div class="quiet-track"><i style="width:'+state.quietGauge+'%"></i></div>'+(state.mushinActive?'<span class="mushin-badge">無心 ×1.5</span>':'')+'</div>';
}
function playScreen(){
  const endless=state.mode==='endless';
  const player=state.player||{name:'プレイヤー',icon:'🐶'};
  const blind=state.blind?'<div class="blind-zone" style="left:'+state.blindStart+'%;width:'+(state.blindEnd-state.blindStart)+'%"></div>':'';
  return topNav()+'<div class="play-wrap"><section class="play-panel">'+
    '<div class="hud"><div class="hud-chip">ROUND '+state.round+(state.mode==='ten'?' / 10':'')+'</div><div class="hud-chip hud-right">SCORE '+state.score+'</div></div>'+
    '<div class="sub-hud">'+
      '<div class="hud-chip combo-chip">COMBO <b>'+state.combo+'</b> <small>×'+comboMultiplierFor(state.combo).toFixed(1)+'</small></div>'+
      (endless?'<div class="hud-chip life-row">LIFE '+Array.from({length:3},(_,i)=>i<state.lives?'♥':'♡').join(' ')+'　SAFE ±'+state.safeLimit+(state.charm?'　護符':'')+'</div>':'<div class="hud-chip player-mini">'+esc(player.icon)+' '+esc(player.name)+'</div>')+
    '</div>'+
    quietGaugeHtml()+
    (stageBreakRound()?'<div class="stage-banner"><small>LEVEL UP</small><strong>'+esc(state.stageName)+'</strong></div>':'')+
    '<div class="target-wrap"><div class="target-label">この数字をねらえ</div><div class="target-number">'+state.target+'<small>をねらえ！</small></div><div class="gimmick-row">'+state.gimmicks.map(g=>'<span>'+esc(g)+'</span>').join('')+'</div></div>'+
    '<div class="meter-zone"><div class="meter-shell" style="width:'+Math.round(state.barScale*100)+'%"><div class="meter-track"><div class="meter-line"></div>'+blind+'<div class="meter-cursor" id="meterCursor"></div></div><div class="meter-labels"><span style="left:0%">0</span><span style="left:'+(state.refPoint/state.maxValue*100)+'%">'+state.refPoint+'</span><span style="left:100%">'+state.maxValue+'</span></div></div></div>'+
    '<button class="stop-btn" data-stop '+(state.needsOpeningCountdown?'disabled':'')+'>STOP！</button>'+
    (state.needsOpeningCountdown?'<div class="countdown-overlay" id="countdownOverlay"><div class="countdown-number" id="countdownNumber">3</div></div>':'')+
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
function tierForError(e){
  if(e===0)return'perfect';
  if(e===1)return'excellent';
  if(e<=3)return'great';
  if(e<=5)return'good';
  if(e<=10)return'safe';
  return'miss';
}
function commentForTier(t){
  return({perfect:'PERFECT！',excellent:'EXCELLENT！',great:'GREAT！',good:'GOOD！',safe:'セーフ！',miss:'ミス！'})[t]||'';
}
function comboMultiplierFor(combo){
  if(combo>=10)return 1.5;
  if(combo>=7)return 1.4;
  if(combo>=5)return 1.3;
  if(combo>=3)return 1.2;
  if(combo>=2)return 1.1;
  return 1;
}
function gaugeGainForError(e){
  if(e===0)return 40;
  if(e===1)return 30;
  if(e<=3)return 20;
  return 0;
}
function stopRound(){
  if(!state.running)return;
  stopMotion();
  state.resultValue=Math.round(state.value);
  state.error=Math.abs(state.resultValue-state.target);
  state.tier=tierForError(state.error);state.comment=commentForTier(state.tier);
  state.baseScore=scoreForError(state.error);
  const prevCombo=state.combo;
  if(state.error<=3)state.combo+=state.error===0?2:1;
  else state.combo=0;
  state.maxCombo=Math.max(state.maxCombo,state.combo);
  state.comboMultiplier=comboMultiplierFor(state.combo);
  const mushinMult=state.mushinActive?1.5:1;
  state.roundScore=Math.round(state.baseScore*state.comboMultiplier*mushinMult);
  state.score+=state.roundScore;
  state.roundErrors.push(state.error);
  if(state.error===0)state.perfects++;

  if(!state.mushinActive){
    const gain=gaugeGainForError(state.error);
    if(gain){
      state.quietGauge=Math.min(100,state.quietGauge+gain);
      if(state.quietGauge>=100){state.quietGauge=0;state.mushinReady=true}
    }
  }

  if(state.mode==='endless'){
    if(prevCombo<10&&state.combo>=10&&state.charm===0){state.charm=1;state.charmEarnedThisRound=true}
    if(state.error>state.safeLimit){
      if(state.charm){state.charm=0;state.lifeProtected=true}
      else state.lives--;
    }
  }
  go('roundResult',{push:false});
}
function sparkHtml(){
  if(!['perfect','excellent','great'].includes(state.tier))return'';
  return '<div class="hit-fx"><div class="hit-ring"></div><div class="spark-burst">'+Array.from({length:12},(_,i)=>'<i style="--i:'+i+'"></i>').join('')+'</div></div>';
}
function roundResultScreen(){
  const lifeLost=state.mode==='endless'&&state.error>state.safeLimit&&!state.lifeProtected;
  const bonus=state.roundScore-state.baseScore;
  const comboText=state.combo>1?'<div class="combo-result">'+state.combo+' COMBO <span>×'+state.comboMultiplier.toFixed(1)+'</span></div>':'';
  return topNav()+heading('ラウンド結果',state.mode==='ten'?'10ラウンドの合計点に挑戦':'難易度はまだ上がる')+
    '<section class="card result-card tier-'+state.tier+'">'+sparkHtml()+
      '<div class="result-kicker">ROUND '+state.round+'</div><div class="hit-word">'+state.comment+'</div>'+
      comboText+
      '<div class="result-main '+(state.tier==='perfect'?'perfect':'')+'">'+state.roundScore+'<small> POINT</small></div>'+
      (bonus>0?'<div class="bonus-line">基本 '+state.baseScore+' ＋ BONUS '+bonus+'</div>':'')+
      '<div class="result-stats"><div class="result-stat"><small>目標</small><strong>'+state.target+'</strong></div><div class="result-stat"><small>STOP</small><strong>'+state.resultValue+'</strong></div><div class="result-stat"><small>誤差</small><strong>'+state.error+'</strong></div><div class="result-stat"><small>合計</small><strong>'+state.score+'</strong></div></div>'+
      (state.mushinActive?'<div class="bonus-notice mushin-notice">無心ボーナス ×1.5 発動！</div>':'')+
      (state.mushinReady?'<div class="bonus-notice">静ゲージMAX！ 次のラウンドは「無心」</div>':'')+
      (state.charmEarnedThisRound?'<div class="bonus-notice charm-notice">10 COMBO達成！ 護符を獲得</div>':'')+
      (state.lifeProtected?'<div class="bonus-notice charm-notice">護符がミスを防いだ！</div>':'')+
      (lifeLost?'<div class="note">SAFE ±'+state.safeLimit+'を超えたためライフ−1。</div>':'')+
    '</section><button class="btn full" data-next-round disabled>'+(isGameOver()?'結果を見る':'次のラウンドへ')+'</button>';
}
function isGameOver(){return state.mode==='ten'?state.round>=10:state.lives<=0}
function finishGame(){
  state.gameStarted=false;addRankingEntry();go('final',{push:false});
}
function finalScreen(){
  const avg=state.roundErrors.length?(state.roundErrors.reduce((a,b)=>a+b,0)/state.roundErrors.length).toFixed(1):'0.0';
  const best=bestScore(state.mode==='ten'?'ten':'endless');
  return topNav()+heading('チャレンジ終了',state.mode==='ten'?'10ラウンド完走！':'限界まで挑戦しました')+
    '<section class="card final-card">'+(state.newRecord?'<div class="new-record">NEW RECORD！</div>':'')+
    '<div class="result-kicker">TOTAL SCORE</div><div class="final-score">'+state.score+'</div>'+
    '<div class="record-grid">'+
      '<div class="record-box"><small>PERFECT</small><strong>'+state.perfects+'回</strong></div>'+
      '<div class="record-box"><small>MAX COMBO</small><strong>'+state.maxCombo+'</strong></div>'+
      '<div class="record-box"><small>平均誤差</small><strong>'+avg+'</strong></div>'+
      (state.mode==='endless'?'<div class="record-box"><small>到達</small><strong>ROUND '+state.round+'</strong></div>':'<div class="record-box"><small>モードBEST</small><strong>'+best+'点</strong></div>')+
    '</div></section>'+
    '<div class="stack"><button class="btn full" data-replay>もう一度！</button><button class="btn secondary full" data-ranking>ランキングを見る</button><button class="btn secondary full" data-change-mode>モードを変える</button><button class="btn secondary full" data-home>ゲームをえらぶ</button></div>';
}
function rankingRows(mode){
  const r=loadRankings();
  const rows=sortRanking(mode,r[mode]||[]);
  if(!rows.length)return'<div class="ranking-empty">まだ記録がありません。<br>最初のハイスコアを作ろう！</div>';
  return '<div class="ranking-list">'+rows.map((x,i)=>'<div class="ranking-row '+(i<3?'top top-'+(i+1):'')+'"><div class="rank-no">'+(i+1)+'</div><div class="rank-player"><span>'+esc(x.icon)+'</span><strong>'+esc(x.name)+'</strong></div><div class="rank-score"><strong>'+x.score+'</strong><small>点'+(mode==='endless'?' / R'+x.round:'')+'</small></div>'+(state.rankEdit?'<button class="rank-delete" data-rank-delete="'+esc(x.id)+'">削除</button>':'')+'</div>').join('')+'</div>';
}
function rankingScreen(){
  const mode=state.rankMode;
  return topNav()+heading('ハイスコアランキング','この端末のTOP10')+
    '<div class="rank-tabs"><button class="'+(mode==='ten'?'selected':'')+'" data-rank-mode="ten">10ラウンド</button><button class="'+(mode==='endless'?'selected':'')+'" data-rank-mode="endless">エンドレス</button></div>'+
    '<section class="card ranking-card"><div class="ranking-head"><strong>'+((mode==='ten')?'10ラウンド TOP10':'エンドレス TOP10')+'</strong><button class="small-btn" data-rank-edit>'+(state.rankEdit?'編集をおわる':'記録を編集')+'</button></div>'+rankingRows(mode)+'</section>'+
    (state.rankEdit?'<button class="btn secondary full rank-clear" data-rank-clear>このモードのランキングをすべて削除</button>':'')+
    '<button class="btn secondary full rules-bottom-back" data-rank-back>← もどる</button>';
}
function screenHtml(){
  return({title:titleScreen,mode:modeScreen,playerSelect:playerSelectScreen,members:membersScreen,rules:rulesScreen,play:playScreen,roundResult:roundResultScreen,final:finalScreen,ranking:rankingScreen}[state.screen]||titleScreen)();
}
function render(){
  app.className='pitadome-app screen-'+state.screen;
  app.innerHTML=screenHtml();bind();window.scrollTo({top:0,behavior:'auto'});
  if(state.screen==='play'){
    if(state.needsOpeningCountdown)startCountdown();
    else requestAnimationFrame(()=>startMotion());
  }
}
function beginGame(mode=state.mode){
  loadPlayer();state.mode=mode;state.history=[];state.gameStarted=true;state.round=1;state.score=0;state.perfects=0;state.needsOpeningCountdown=true;
  state.lives=3;state.roundErrors=[];state.newRecord=false;state.combo=0;state.maxCombo=0;state.quietGauge=0;state.mushinReady=false;state.mushinActive=false;state.charm=0;
  prepareRound();state.screen='play';render();
}
function startCountdown(){
  stopMotion();
  const overlay=document.getElementById('countdownOverlay'),num=document.getElementById('countdownNumber'),stopBtn=document.querySelector('[data-stop]');
  let n=3;if(num)num.textContent=n;
  const tick=()=>{
    if(n>1){n--;if(num)num.textContent=n;state.countdownId=setTimeout(tick,650);return}
    if(num){num.textContent='START!';num.classList.add('start-text')}
    state.countdownId=setTimeout(()=>{state.needsOpeningCountdown=false;overlay?.remove();if(stopBtn)stopBtn.disabled=false;startMotion()},420);
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
    if(state.movement==='accel')mult=.78+Math.min(.95,state.phase*.09);
    if(state.movement==='change')mult=.68+.68*(.5+.5*Math.sin(state.phase*2.2));
    if(state.movement==='reverse'){
      const bucket=Math.floor(state.phase/1.9);
      if(bucket!==state.reverseBucket&&bucket>0){state.reverseBucket=bucket;state.dir*=-1}
    }
    const rangeScale=state.maxValue/100;
    state.value+=state.dir*state.speed*rangeScale*mult*dt;
    if(state.value>=state.maxValue){state.value=state.maxValue;state.dir=-1}
    if(state.value<=0){state.value=0;state.dir=1}
    const cursor=document.getElementById('meterCursor');
    if(cursor){
      const pct=(state.value/state.maxValue)*100;
      cursor.style.left=pct+'%';
      cursor.classList.toggle('blind',state.blind&&pct>=state.blindStart&&pct<=state.blindEnd);
    }
    state.rafId=requestAnimationFrame(step);
  };
  state.rafId=requestAnimationFrame(step);
}
function nextRound(){
  if(isGameOver()){finishGame();return}
  state.round++;prepareRound();go('play',{push:false});
}
function openRanking(mode){
  state.rankMode=mode||((state.mode==='endless')?'endless':'ten');state.rankEdit=false;go('ranking');
}
function bind(){
  document.querySelector('[data-back]')?.addEventListener('click',doBackOne);
  document.querySelectorAll('[data-home]').forEach(b=>b.addEventListener('click',goHome));
  document.querySelector('[data-start-title]')?.addEventListener('click',()=>go('mode'));
  document.querySelector('[data-rules]')?.addEventListener('click',()=>go('rules'));
  document.querySelector('[data-rules-back]')?.addEventListener('click',doBackOne);
  document.querySelectorAll('[data-ranking]').forEach(b=>b.addEventListener('click',()=>openRanking()));
  document.querySelector('[data-player-select]')?.addEventListener('click',()=>{state.memberReturn='title';go('playerSelect')});
  document.querySelector('[data-change-player]')?.addEventListener('click',()=>{state.memberReturn='mode';go('playerSelect')});
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
  const nextBtn=document.querySelector('[data-next-round]');
  if(nextBtn){
    setTimeout(()=>{if(nextBtn.isConnected)nextBtn.disabled=false},700);
    nextBtn.addEventListener('click',nextRound);
  }
  document.querySelector('[data-replay]')?.addEventListener('click',()=>beginGame(state.mode));
  document.querySelector('[data-change-mode]')?.addEventListener('click',()=>{state.history=[];state.screen='mode';render()});
  document.querySelectorAll('[data-rank-mode]').forEach(b=>b.addEventListener('click',()=>{state.rankMode=b.dataset.rankMode;state.rankEdit=false;render()}));
  document.querySelector('[data-rank-edit]')?.addEventListener('click',()=>{state.rankEdit=!state.rankEdit;render()});
  document.querySelectorAll('[data-rank-delete]').forEach(b=>b.addEventListener('click',()=>{if(confirm('この記録を削除しますか？')){deleteRankEntry(state.rankMode,b.dataset.rankDelete);render()}}));
  document.querySelector('[data-rank-clear]')?.addEventListener('click',()=>{if(confirm('このモードのランキングをすべて削除しますか？')){clearRankings(state.rankMode);state.rankEdit=false;render()}});
  document.querySelector('[data-rank-back]')?.addEventListener('click',doBackOne);
}
loadPlayer();render();
})();