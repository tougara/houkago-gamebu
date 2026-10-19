/* ピタ止め ONLINE KO BATTLE - 2Pオフラインの判定・操作・演出を継承した2〜10人サバイバル */
(()=>{
'use strict';
const $=id=>document.getElementById(id),STORE='houkago-online-session-v1';
const base=String(window.HOUKAGO_ONLINE_API_URL||'').replace(/\/$/,'');
const requested=new URLSearchParams(location.search).get('room')||'';
const ui=window.HoukagoOnlineUI;
const R=window.PitadomeVersusRules,FX=window.PitadomeEffects;
let session=null,room=null,ws=null,retry=0,retryTimer=null,leaving=false;
let frame=0,simMs=0,motion=null,origin=0,renderKey='',submitting=false,fxTimer=null,fxKey='';
try{session=JSON.parse(sessionStorage.getItem(STORE)||'null')}catch{}
if(window.HoukagoOfflinePreview)session=window.HoukagoOfflinePreview.session;
if(!window.HoukagoOfflinePreview&&(!session||!/^[A-Z2-9]{8}$/.test(session.code)||
 !/^[a-f0-9]{64}$/.test(session.token)||(requested&&requested!==session.code)||
 !/^https:\/\/[a-z0-9.-]+$/i.test(base))){location.replace('../'+(requested?'?room='+encodeURIComponent(requested):''));return}
const esc=ui.escapeHTML,g=()=>room?.pita,host=()=>room?.hostId===session.id;
const person=id=>room?.members?.find(m=>m.id===id)||{name:'プレイヤー',icon:'？'};
const name=id=>esc(person(id).icon+' '+person(id).name);
const myRow=d=>d.members.find(p=>p.id===session.id);
const time=n=>Math.max(0,n).toFixed(1);
const grades={perfect:'PERFECT!',excellent:'EXCELLENT!',great:'GREAT!',good:'GOOD!',safe:'SAFE!',miss:'MISS!'};
const send=message=>{if(ws?.readyState===WebSocket.OPEN){ws.send(JSON.stringify(message));return true}notice('通信が切れているよ。接続を確認してね。');return false};
const notice=(s,ok=false)=>ui.notice('notice',s,ok);
const btn=(label,action,kind='')=>'<button type="button" class="compact-action '+kind+'" data-action="'+action+'">'+esc(label)+'</button>';
function lobby(clear=false){
 leaving=true;clearTimeout(retryTimer);stopFrame();clearFx();
 if(clear&&!window.HoukagoOfflinePreview)sessionStorage.removeItem(STORE);
 if(ws){ws.onclose=null;ws.close();ws=null}
 location.replace('../'+(clear?'':'?room='+encodeURIComponent(session.code)));
}
function remaining(d){return Math.max(0,(d.startedAt+18000-Date.now())/1000)}
function hud(d){
 return '<div class="stage-hud"><span class="round-label">ROUND <span class="gold">'+d.round+'</span> / '+d.maxRounds+'</span>'+
 '<span><span class="live">'+d.activeCount+'人 生存</span> / '+d.members.length+'人</span></div>';
}
function rail(d){
 return '<div class="member-rail" aria-label="参加者のライフ">'+d.members.map(m=>
  '<span class="member-chip'+(m.id===session.id?' me':'')+(m.eliminated?' out':'')+'">'+
  '<span class="person-name">'+esc(m.icon+' '+m.name)+'</span>'+
  '<b class="life-counter">'+(m.eliminated?'KO':'♥ '+m.lives)+'</b></span>').join('')+'</div>';
}
function gauge(d){
 const m=myRow(d),charge=m?.charge||0;
 const limit=d.chargeLimit||350;
 return '<div class="gauge"><span>回復ゲージ</span><span class="gauge-track"><i style="width:'+Math.min(100,100*charge/limit)+'%"></i></span>'+
 '<b>'+charge+' / '+limit+'</b></div>';
}
function stageName(d){return 'LEVEL '+Math.ceil(d.round)+' ・ '+(d.difficulty==='easy'?'かんたん':'通常')+' ・ '+esc((d.profile?.gimmicks||['基本']).join(' / '))}
function playArena(d){
 const p=d.profile||{minValue:0,maxValue:100,barScale:.86,gimmicks:['基本']};
 const range=p.maxValue-p.minValue;
 const refPct=Math.max(0,Math.min(100,((p.refPoint??50)-p.minValue)/range*100));
 const tickLabels=d.difficulty==='easy'
  ?Array.from({length:10},(_,i)=>{const v=(i+1)*10;return '<span class="meter-tick" style="left:'+((v-p.minValue)/range*100)+'%">'+v+'</span>'}).join('')
  :'<span class="meter-start">'+p.minValue+'</span><span class="meter-ref" style="left:'+refPct+'%">'+p.refPoint+'</span><span class="meter-end">'+p.maxValue+'</span>';
 const blind=p.blind?'<span class="blind-zone" style="left:'+p.blindStart+'%;width:'+(p.blindEnd-p.blindStart)+'%"></span>':'';
 return '<section class="card play-arena" aria-label="自分のピタ止めゲーム盤面">'+
 '<div class="arena-head"><span>'+stageName(d)+'</span><b>合格 ±'+(d.safe??10)+(d.pressure?' / 妨害 '+d.pressure:'')+'</b></div>'+
 '<div class="aim"><small>この数字をねらえ！</small><div class="target-number">'+d.target+'</div>'+
 '<span class="aim-label">目標にぴったり止めよう</span></div>'+
 '<div class="meter-container"><div class="meter-shell" style="width:'+Math.round((p.barScale||.86)*100)+'%">'+
 '<div class="meter-track"></div>'+blind+
 '<div class="meter-cursor" id="meterCursor"></div>'+
 '<div class="meter-labels">'+tickLabels+'</div></div></div>'+
 '<div class="arena-footer"><span id="meter-tip">連続成功でCOMBO！</span><b id="time-left">残り 18.0秒</b></div>'+
 '</section>';
}
function setup(d){
 return '<div class="stage-screen setup-view">'+
 '<section class="card setup-hero"><h1>ONLINE KO SURVIVAL</h1>'+
 '<p>オフライン2人対戦の仕組みで、2〜10人が同時にチャレンジ！ 最後の1人を目指せ。</p></section>'+
 '<section class="card setup-rules"><div class="difficulty-panel"><strong>自分のむずかしさを選ぼう</strong>'+
 '<p>2人対戦と同じく、参加者ごとに通常／かんたんを選べるよ。自分のバーと目標で挑戦する。</p>'+
 '<div class="difficulty-grid"><button type="button" class="difficulty-option'+((myRow(d)?.difficulty||'normal')==='normal'?' selected':'')+'" data-difficulty="normal" aria-pressed="'+((myRow(d)?.difficulty||'normal')==='normal')+'"><b>通常</b><small>基準・速度・150／200などの変化あり</small></button>'+
 '<button type="button" class="difficulty-option easy'+(myRow(d)?.difficulty==='easy'?' selected':'')+'" data-difficulty="easy" aria-pressed="'+(myRow(d)?.difficulty==='easy')+'"><b>かんたん</b><small>目盛り10刻み／ゆっくり／隠しも有利に</small></button></div>'+
 '<p class="difficulty-caption">今回の選択：'+d.members.map(m=>esc(m.icon+' '+m.name+'（'+(m.difficulty==='easy'?'かんたん':'通常')+'）')).join(' ・ ')+'</p></div><ul>'+
 '<li>全員同時に挑戦。<strong>自分のモードのバーと目標でSTOP！</strong></li>'+
 '<li>オフライン2人対戦と同じ判定：<strong>誤差0はPERFECT</strong>、誤差1はEXCELLENT、誤差2〜3はGREAT。</li>'+
 '<li>PERFECTまたは<strong>GREAT以上の3連続</strong>でライフ回復と次ラウンドの妨害が自動発動。</li>'+
 '<li>高得点で<strong>回復ゲージ</strong>が満タンになるとライフを回復。</li>'+
 '<li>合格範囲は徐々に狭くなる。合格外はライフ−1。<strong>0になったら脱落！</strong></li>'+
 '<li>全員の結果を一斉に発表。最後の生存者が優勝！ 25ラウンドで決着しない場合は成績で決定。</li>'+
 '</ul></section>'+
 rail(d)+'<div class="setup-footer">'+
 (host()?btn('全員で対戦スタート！','begin'):'<div class="status-card">ホストが開始するのを待ってね</div>')+
 (host()?btn('対戦を終了してロビーへ','stop-game','danger'):'')+
 '</div></div>';
}
function playing(d){
 const mine=myRow(d),spectator=mine?.eliminated,submitted=d.mySubmitted;
 if(spectator||submitted){
  return '<div class="stage-screen">'+hud(d)+rail(d)+
   '<section class="card wait-center"><span class="wait-symbol">'+(spectator?'◇':'✓')+'</span>'+
   '<h2>'+(spectator?'観戦モード':'STOP完了！')+'</h2>'+
   '<p>'+(spectator?'生き残った人を応援しよう！':'全員の記録が揃ったら結果を発表するよ')+'</p>'+
   '<div class="status-card"><b>完了 '+d.submittedCount+' / '+d.activeCount+'</b><span>今回のROUND '+d.round+'</span></div></section>'+
   (host()?btn('未提出者をMISSにして締切（25秒経過後）','close','secondary'):'')+'</div>';
 }
 return '<div class="stage-screen">'+hud(d)+rail(d)+
 '<div class="play-view">'+playArena(d)+
 '<div class="play-bottom">'+
 '<div class="card">'+gauge(d)+
 '<div class="bonus-row"><span>COMBO '+(mine?.combo||0)+'</span><span>GREAT '+(mine?.streak||0)+'/3</span>'+
 '<span>SCORE '+(mine?.score||0)+'</span>'+(d.pressure?'<span class="danger">妨害中</span>':'')+'</div></div>'+
 '<button type="button" class="pita-stop" id="stop" data-action="stop" aria-label="数字をストップ">STOP！</button>'+
 '<div class="play-hint" id="round-progress">全員で同時挑戦　・　STOPしたら結果を待とう</div>'+
 '</div></div></div>';
}
function results(d){
 const self=d.results.find(m=>m.id===session.id),kind=self?.grade||'miss';
 const judge=grades[kind]||'MISS!';
 const hint=self?(self.eliminated?'KO！ ライフが0になった':self.special?'SPECIAL！ 回復＋1 / 次のラウンドに妨害':self.chargeReward?'回復ゲージMAX！ 効果発動':self.damage?'合格範囲外！ ライフ−1':self.heal?'ライフ回復！':'次の勝負に備えよう'):'観戦中';
 const order={perfect:0,excellent:1,great:2,good:3,safe:4,miss:5};
 const sorted=[...d.results].sort((a,b)=>(order[a.grade]??9)-(order[b.grade]??9)||(a.error??1e9)-(b.error??1e9));
 return '<div class="stage-screen review-view">'+hud(d)+
 '<div class="result-focus '+(kind==='perfect'?'perfect':'')+'"><div class="judgement '+kind+'">'+(self?judge:'SPECTATING')+'</div>'+
 (self?'<div class="tiny-stats"><span>目標 <strong>'+d.target+'</strong></span><span>STOP <strong>'+(self.value??'—')+'</strong></span>'+
 '<span>誤差 <strong>'+(self.error??'—')+'</strong></span><span>＋<strong>'+self.points+'</strong>点</span></div>':'')+
 '<div class="fx-note">'+esc(hint)+'</div></div>'+
 '<div class="review-title">全員の判定結果 <small>('+sorted.length+'人)</small></div>'+
 '<div class="results-list">'+sorted.map(row=>{
  const m=person(row.id);
  const grade=grades[row.grade]||'MISS!';
  const detail=row.timedOut?'時間切れ':row.special?'SPECIAL':row.chargeReward?'回復ゲージMAX':row.damage?'ミス':'合格';
  return '<div class="result-entry'+(row.id===session.id?' mine':'')+(row.eliminated?' out':'')+'">'+
   '<span class="entry-name">'+esc(m.icon+' '+m.name)+(row.id===session.id?'（自分）':'')+'</span>'+
   '<span class="entry-grade '+row.grade+'">'+grade+'</span>'+
   '<span class="entry-sub">'+(row.value??'—')+' / 誤差 '+(row.error??'—')+' / ＋'+row.points+'点 · '+detail+'</span>'+
   '<span class="entry-life">♥ '+row.lifeBefore+' → '+row.lifeAfter+(row.eliminated?' KO':'')+'</span>'+
   '</div>';
 }).join('')+'</div>'+
 '<div class="review-footer"><div class="status-card"><span>現在 <b>'+d.activeCount+'人 生存</b></span><span>'+(d.finalRound?'優勝決定へ！':'次も生き残れ！')+'</span></div>'+
 (host()?btn(d.finalRound?'優勝者を発表！':'次のラウンドへ','next'):
 '<div class="play-hint">ホストが次のラウンドを開始するよ</div>')+'</div></div>';
}
function finished(d){
 const winners=d.winnerIds||[],win=winners.includes(session.id);
 const sorted=[...d.members].sort((a,b)=>b.lives-a.lives||b.perfects-a.perfects||b.score-a.score);
 const allEliminated=winners.length===0;
 return '<div class="champ-screen">'+
 '<div class="champ-particles">'+Array.from({length:20},(_,i)=>'<i style="--i:'+i+'"></i>').join('')+'</div>'+
 '<div class="champ-kicker">PITADOME ONLINE · KO SURVIVAL</div>'+
 '<div class="champ-crown" aria-hidden="true">♛</div>'+
 '<h1 class="champ-title">'+(allEliminated?'DRAW！':winners.length>1?'JOINT WINNER！':'CHAMPION！')+'</h1>'+
 '<div class="champ-names"><strong>'+ (winners.length?winners.map(name).join(' ＆ '):'決着は引き分け！')+'</strong>'+
 '<span>'+(win?'あなたが優勝！':allEliminated?'全員KO！':winners.length>1?'同率優勝！':'WINNER 決定！')+'　・　'+d.round+' ROUND</span></div>'+
 '<div class="champ-medal">'+sorted.map((m,i)=>'<span class="rank-badge'+(winners.includes(m.id)?' winner':'')+'">'+
 '<b>'+(winners.includes(m.id)?'★':(i+1)+'位')+'</b> '+esc(m.icon+' '+m.name)+
 '　'+(m.eliminated?'KO':'♥'+m.lives)+'</span>').join('')+'</div>'+
 '<div class="champ-actions">'+(host()?btn('ロビーへ戻ってもう一戦','stop-game'):'<div class="play-hint">ホストがロビーへ戻すまで待ってね</div>')+'</div>'+
 '</div>';
}
function stopFrame(){if(frame){cancelAnimationFrame(frame);frame=0}}
function clearFx(){if(fxTimer){clearTimeout(fxTimer);fxTimer=null}document.getElementById('pita-fx')?.remove()}
function showFx(key,fx,duration=2000){
 if(fxKey===key)return;
 fxKey=key;clearFx();
 if(!FX)return;
 const el=document.createElement('div');el.id='pita-fx';el.innerHTML=FX.cutinHtml({...fx,duration});
 document.querySelector('.pita-online').append(el);
 fxTimer=setTimeout(()=>{el.remove();fxTimer=null},duration);
 if(fx.rank==='perfect'&&navigator.vibrate)navigator.vibrate([20,15,40]);
}
function initClock(d){
 origin=performance.now()+(d.startedAt-Date.now());
 simMs=0;motion=d.initialMotion?{...d.initialMotion}:null;
 if(!motion&&R&&d.profile)motion=R.initialMotion(d.profile,()=>0);
}
// オフライン2Pの3・2・1（各1120ms）とSTART（1500ms）をそのまま再現。
function countdownCue(remaining,timing){
 const step=timing.countdown,start=timing.start;
 if(remaining>start+2*step)return {kind:'countdown',title:'3',duration:remaining-(start+2*step)};
 if(remaining>start+step)return {kind:'countdown',title:'2',duration:remaining-(start+step)};
 if(remaining>start)return {kind:'countdown',title:'1',duration:remaining-start};
 if(remaining>0)return {kind:'start',title:'START！',duration:remaining};
 return null;
}
function tick(){
 const d=g();if(!d||d.stage!=='playing'||d.mySubmitted||myRow(d)?.eliminated||submitting){frame=0;return}
 let elapsed=Math.round(performance.now()-origin);
 const p=d.profile;
 const cursor=$('meterCursor'),counter=$('time-left');
 if(elapsed<0){
  const remaining=-elapsed;
  const cue=countdownCue(remaining,FX?.TIMING||{countdown:1120,start:1500});
  if(counter)counter.textContent=cue?.kind==='start'?'START！':'開始まで '+Math.ceil(remaining/1000)+'秒';
  if(cursor)cursor.style.left='0%';
  if(cue)showFx('countdown:'+d.round+':'+cue.title,
   {kind:cue.kind,title:cue.title,subtitle:cue.kind==='countdown'?'READY':''},
   Math.max(100,Math.ceil(cue.duration)));
 }else{
  // START！のカットインを残さず、バーが動き始めた瞬間に消す。
  if(fxKey==='countdown:'+d.round+':START！'){clearFx();fxKey='started:'+d.round}
  if(p&&motion&&R){
   const targetStep=Math.floor(Math.min(18000,elapsed)/20)*20;
   while(simMs<targetStep){motion=R.advanceMotion(motion,.02,p);simMs+=20}
   const value=Math.max(0,Math.min(100,(motion.value-p.minValue)/(p.maxValue-p.minValue)*100));
   if(cursor){cursor.style.left=value+'%';cursor.classList.toggle('blind',Boolean(p.blind&&value>=p.blindStart&&value<=p.blindEnd))}
  }
  if(counter)counter.textContent='残り '+time(Math.max(0,18000-elapsed)/1000)+'秒';
  const close=document.querySelector('[data-action="close"]');
  if(close)close.disabled=Date.now()-d.startedAt<22500;
  if(elapsed>=18000){stopRound(true);frame=0;return}
 }
 frame=requestAnimationFrame(tick);
}
function render(){
 const d=g();if(!d){stopFrame();renderKey='';$('game-root').innerHTML='<section class="card">ロビーへ戻ります…</section>';return}
 const key=d.stage+':'+d.round+':'+d.startedAt+':'+d.mySubmitted+':'+(myRow(d)?.eliminated||false)+':'+(d.stage==='setup'?d.members.map(m=>m.difficulty).join('-'):'');
 if(key===renderKey&&d.stage==='playing'){
  $('round-progress')?.replaceChildren(document.createTextNode(d.submittedCount+' / '+d.activeCount+'人 STOP完了'));
  return;
 }
 stopFrame();submitting=false;
 if(key!==renderKey&&d.stage==='playing'&&!d.mySubmitted&&!myRow(d)?.eliminated)initClock(d);
 renderKey=key;
 $('game-root').innerHTML=d.stage==='setup'?setup(d):d.stage==='playing'?playing(d):d.stage==='review'?results(d):finished(d);
 if(d.stage==='playing'&&!d.mySubmitted&&!myRow(d)?.eliminated)frame=requestAnimationFrame(tick);
 if(d.stage==='review'){
  const row=d.results.find(p=>p.id===session.id);
  if(row)showFx('review:'+d.round,{kind:'judge',rank:row.grade,
   title:grades[row.grade]||'MISS!',subtitle:row.special?'SPECIAL BONUS！':row.eliminated?'KNOCK OUT!':'ROUND '+d.round},row.grade==='perfect'?2100:1250);
 }else if(d.stage==='finished'){
  const won=d.winnerIds.includes(session.id);
  showFx('finished:'+d.round,{kind:'win',title:d.winnerIds.length>1?'JOINT WIN！':'CHAMPION！',
   subtitle:d.winnerIds.map(id=>person(id).name).join(' ＆ '),kicker:won?'YOU WIN！':'KO SURVIVAL'},2350);
 }
}
function stopRound(timeout=false){
 const d=g();if(!d||d.stage!=='playing'||d.mySubmitted||submitting)return;
 const elapsed=timeout?18000:Math.max(0,performance.now()-origin);
 if(elapsed<100&&!timeout)return;
 const ms=Math.max(100,Math.min(18000,Math.round(elapsed)));
 if(!send({type:'pita-stop',elapsedMs:ms})){stopFrame();return}
 submitting=true;stopFrame();
 const stop=$('stop');if(stop){stop.disabled=true;stop.textContent='STOP！'}
 const status=$('round-progress');if(status)status.textContent='判定待ち…';
}
$('game-root').addEventListener('pointerdown',e=>{
 const b=e.target.closest('[data-action="stop"]');if(!b)return;
 e.preventDefault();stopRound();
});
$('game-root').addEventListener('click',e=>{
 const difficulty=e.target.closest('[data-difficulty]');
 if(difficulty&&g()?.stage==='setup'){
  send({type:'pita-difficulty',difficulty:difficulty.dataset.difficulty});return;
 }
 const button=e.target.closest('[data-action]');if(!button)return;
 const act=button.dataset.action,d=g();if(!d)return;
 if(act==='stop'){stopRound();return}
 if(act==='begin')send({type:'pita-begin'});
 if(act==='next')send({type:'pita-next'});
 if(act==='close'){
  if(Date.now()-d.startedAt<22500)notice('未提出の締切は22.5秒経過後にできるよ。');
  else send({type:'pita-close'});
 }
 if(act==='stop-game'&&confirm('対戦を終了してロビーへ戻す？'))send({type:'pita-stop-game'});
});
function connect(){
 if(leaving)return;clearTimeout(retryTimer);
 if(ws){ws.onclose=null;ws.close()}
 ui.connection('connection','connecting');
 const socket=new WebSocket(base.replace(/^http/,'ws')+'/api/rooms/'+session.code+'/ws?token='+encodeURIComponent(session.token));ws=socket;
 socket.onopen=()=>{if(ws!==socket)return;retry=0;ui.connection('connection','connected');notice('')};
 socket.onmessage=e=>{
  if(ws!==socket)return;let msg;try{msg=JSON.parse(e.data)}catch{return}
  if(msg.type==='left'){lobby(true);return}
  if(msg.type==='error'){notice(msg.error||'通信を確認してね');return}
  if(msg.type!=='room'&&msg.type!=='welcome')return;
  room=msg.room;
  if(room.phase!=='pita'){lobby();return}
  render();
 };
 socket.onclose=e=>{
  if(ws!==socket||leaving)return;ws=null;stopFrame();ui.connection('connection','reconnecting');
  if([4000,4002,4003].includes(e.code)){lobby(true);return}
  retry=Math.min(6,retry+1);retryTimer=setTimeout(connect,Math.min(1500*2**(retry-1),15000));
 };
 socket.onerror=()=>{};
}
document.addEventListener('visibilitychange',()=>{if(document.hidden)stopFrame();else if(g()?.stage==='playing'&&!g()?.mySubmitted&&!frame)frame=requestAnimationFrame(tick)});
addEventListener('pagehide',stopFrame);
connect();
})();