/* ピタ止めチャレンジ オンライン：同時挑戦、全員の結果を一括公開 */
(()=>{
'use strict';
const $=id=>document.getElementById(id);
const STORE='houkago-online-session-v1';
const base=String(window.HOUKAGO_ONLINE_API_URL||'').replace(/\/$/,'');
const requested=new URLSearchParams(location.search).get('room')||'';
const onlineUI=window.HoukagoOnlineUI;
let session=null,room=null,ws=null,retry=0,retryTimer=null,leaving=false;
let localKey='',origin=0,frame=0,choice='attack',submitting=false;
try{session=JSON.parse(sessionStorage.getItem(STORE)||'null')}catch{}
if(!session||!/^[A-Z2-9]{8}$/.test(session.code)||!/^[a-f0-9]{64}$/.test(session.token)||
 (requested&&requested!==session.code)||!/^https:\/\/[a-z0-9.-]+$/i.test(base)){
 location.replace('../'+(requested?'?room='+encodeURIComponent(requested):''));return;
}
const esc=v=>onlineUI.escapeHTML(v);
const game=()=>room?.pita||null;
const host=()=>room?.hostId===session.id;
const person=id=>room?.members?.find(m=>m.id===id)||{name:'プレイヤー',icon:'？'};
const name=id=>{const m=person(id);return esc((m.icon||'？')+' '+m.name)};
const btn=(label,action,extra='')=>'<button type="button" class="btn '+extra+'" data-action="'+action+'">'+esc(label)+'</button>';
const notice=(text,ok=false)=>onlineUI.notice('notice',text,ok);
const send=payload=>{
 if(ws?.readyState!==WebSocket.OPEN){notice('通信が切れているよ。再接続してね。');return false}
 ws.send(JSON.stringify(payload));return true;
};
function lobby(clear=false){
 leaving=true;cancelAnimationFrame(frame);
 if(clear)sessionStorage.removeItem(STORE);
 if(ws){ws.onclose=null;ws.close();ws=null}
 location.replace('../'+(clear?'':'?room='+encodeURIComponent(session.code)));
}
function roster(g){
 return '<div class="roster">'+g.members.map(m=>
  '<div class="person'+(m.eliminated?' dead':'')+'"><span>'+esc(m.icon+' '+m.name)+(m.id===session.id?'（自分）':'')+'</span>'+
  '<strong class="hearts">'+(m.eliminated?'脱落':'♥ '+m.lives)+'</strong></div>').join('')+'</div>';
}
function heading(g,title){
 return '<div class="stat-row"><span class="round">ROUND '+g.round+' / 最大'+g.maxRounds+'</span>'+
  '<span>'+g.activeCount+'人 生存</span></div><h1>'+esc(title)+'</h1>';
}
function setup(g){
 return '<section class="panel"><h1>みんなでピタ止め！</h1>'+
 '<p class="muted center">全員同じ目標と速度で同時にチャレンジ。毎回全員の結果を見てから次へ進むよ。</p>'+
 '<ul class="rules"><li>ライフは<strong>3</strong>からスタート。最大5</li>'+
 '<li>誤差2以内は<strong>PERFECT</strong>：攻撃＋2または回復＋2</li>'+
 '<li>誤差5以内は<strong>EXCELLENT</strong>：攻撃＋1または回復＋1</li>'+
 '<li>誤差10以内は<strong>GREAT</strong>：ダメージなし</li>'+
 '<li>それ以外・制限時間切れは<strong>MISS</strong>：ライフ−1</li>'+
 '<li>攻撃は次の1ラウンド、ほかの生存者の成功幅を狭める（最大3段階）</li>'+
 '<li>3人以上はライフ0で脱落。最後まで残った人が優勝！</li>'+
 '<li>1ラウンド18秒。全員のSTOP後に結果発表。未提出者がいる場合、ホストは25秒経過後に締切可能</li>'+
 '</ul>'+ (host()?btn('全員同時にスタート！','begin','primary'):'<p class="progress">ホストが開始するのを待ってね</p>')+
 '</section><section class="panel"><h2>参加メンバー</h2>'+roster(g)+'</section>'+
 (host()?'<div class="actions">'+btn('対戦を終了してロビーへ','stop-game','danger')+'</div>':'');
}
function position(elapsed,speed){
 const v=((elapsed*speed/1000)%200+200)%200;
 return v<=100?v:200-v;
}
function format(n){return Number(n).toFixed(1)}
function playView(g){
 const mine=g.members.find(m=>m.id===session.id);
 const pressure=g.pressure||0;
 if(mine?.eliminated||g.mySubmitted){
  return '<section class="panel">'+heading(g,mine?.eliminated?'脱落後の観戦':'STOP完了！')+
   '<p class="progress">全員の結果を待っているよ · '+g.submittedCount+' / '+g.activeCount+'人</p>'+
   (mine?.eliminated?'<p class="muted center">次の結果発表まで応援しよう。</p>':'<p class="muted center">結果は全員が止めてから公開されるよ。</p>')+
   '</section><section class="panel"><h2>生存状況</h2>'+roster(g)+'</section>'+
   (host()?'<div class="actions">'+btn('時間切れの人をMISSにして結果発表','close')+'</div>':'');
 }
 return '<div class="play-grid"><section class="panel">'+heading(g,'目標にピタッと止めろ！')+
 '<div class="target"><small>目標の数字</small>'+g.target+'</div>'+
 '<div id="live-value" class="value" aria-label="現在の数字">0.0</div>'+
 '<div class="track" aria-hidden="true"><div class="target-marker" style="left:'+g.target+'%"></div><div id="marker" class="current-marker" style="left:0%"></div></div>'+
 '<div class="clock"><span>判定範囲 ±'+g.limits.great+'</span><span id="live-time">残り 18.0秒</span></div>'+
 '<p class="muted center">'+(pressure?'プレッシャー '+pressure+'段階！ 成功幅が狭いよ':'全員同じ基本条件で挑戦！')+'</p></section>'+
 '<section class="panel"><h2>好成績だったときの行動</h2>'+
 '<div class="choice-grid"><button type="button" data-choice="attack" class="choice'+(choice==='attack'?' selected':'')+'">攻撃<small>次のラウンドで相手を妨害</small></button>'+
 '<button type="button" data-choice="heal" class="choice'+(choice==='heal'?' selected':'')+'">回復<small>自分のライフを増やす</small></button></div>'+
 '<p class="muted center">GREAT・MISSでは効果なし</p>'+
 '<button id="stop" type="button" class="stop" data-action="stop">STOP！</button>'+
 '<p id="round-progress" class="progress">'+g.submittedCount+' / '+g.activeCount+'人 ストップ済み</p>'+
 '</section></div>'+ (host()?'<div class="actions">'+btn('未提出の人をMISSにして締切（25秒後）','close')+'</div>':'');
}
function results(g){
 const sorted=[...g.results].sort((a,b)=>{
  const rank={perfect:0,excellent:1,great:2,miss:3};
  return rank[a.grade]-rank[b.grade]||(a.error??1000)-(b.error??1000);
 });
 return '<section class="panel">'+heading(g,'みんなの結果発表！')+
 '<p class="muted center">全員の記録をまとめて公開。攻撃のプレッシャーは次ラウンドに反映されるよ。</p>'+
 '<div class="results">'+sorted.map(x=>{
  const member=person(x.id),word=x.grade.toUpperCase();
  const effect=x.heal?'回復 ＋'+x.heal:x.attack?'相手に攻撃 ＋'+x.attack:x.grade==='miss'?'ライフ −1':'ダメージなし';
  return '<div class="result"><div class="result-head"><span>'+esc(member.icon+' '+member.name)+'</span>'+
   '<span class="grade '+x.grade+'">'+word+'</span></div>'+
   '<div class="result-details"><span>止めた数字 '+(x.value===null?'—':format(x.value))+'</span>'+
   '<span>誤差 '+(x.error===null?'—':format(x.error))+'</span><span>'+effect+'</span>'+
   '<span>♥ '+x.lifeBefore+' → '+x.lifeAfter+(x.eliminated?'（脱落）':'')+'</span>'+
   (x.pressure?'<span>プレッシャー '+x.pressure+'</span>':'')+
   '</div></div>';
 }).join('')+'</div>'+
 (host()?'<div class="actions">'+btn(g.finalRound?'優勝者を発表！':'次のラウンドへ','next','primary')+'</div>':
 '<p class="progress">ホストが次のラウンドへ進めるよ</p>')+
 '</section><section class="panel"><h2>現在のライフ</h2>'+roster(g)+'</section>'+
 (host()?btn('対戦を終了してロビーへ','stop-game','danger'):'');
}
function finished(g){
 return '<section class="panel"><h1>対戦終了！</h1>'+
 '<div class="winner">'+g.winnerIds.map(name).join(' ＆ ')+' 優勝！</div>'+
 '<p class="muted center">'+g.round+'ラウンドの戦いが終了したよ。</p>'+
 '<h2>最終結果</h2>'+roster(g)+'</section>'+
 (host()?'<div class="actions">'+btn('ロビーに戻ってもう一戦','stop-game','primary')+'</div>':
 '<p class="progress">ホストがロビーに戻すまで待ってね</p>');
}
function stopFrame(){cancelAnimationFrame(frame);frame=0}
function tick(){
 const g=game();
 if(!g||g.stage!=='playing'||g.mySubmitted||g.members.find(m=>m.id===session.id)?.eliminated||submitting)return;
 const elapsed=Math.max(0,performance.now()-origin);
 const current=position(elapsed,g.speed);
 const value=$('live-value'),marker=$('marker'),timer=$('live-time');
 if(value)value.textContent=format(current);
 if(marker)marker.style.left=current+'%';
 if(timer)timer.textContent='残り '+format(Math.max(0,18000-elapsed)/1000)+'秒';
 const closer=document.querySelector('[data-action="close"]');
 if(closer)closer.disabled=Date.now()-g.startedAt<25000;
 if(elapsed>=18000){stopRound(true);return}
 frame=requestAnimationFrame(tick);
}
function render(){
 const g=game();
 if(!g){stopFrame();localKey='';$('game-root').innerHTML='<section class="panel">ルームに戻ります…</section>';return;}
 const key=g.stage+':'+g.round+':'+g.startedAt+':'+g.mySubmitted;
 if(g.stage==='playing'&&!g.mySubmitted&&!g.members.find(m=>m.id===session.id)?.eliminated&&localKey===key){
  const progress=$('round-progress');if(progress)progress.textContent=g.submittedCount+' / '+g.activeCount+'人 ストップ済み';
  if(!frame)frame=requestAnimationFrame(tick);
  return;
 }
 stopFrame();
 if(g.stage==='playing'&&localKey!==key&&!g.mySubmitted)origin=performance.now();
 localKey=key;submitting=false;
 $('game-root').innerHTML=g.stage==='setup'?setup(g):g.stage==='playing'?playView(g):
   g.stage==='review'?results(g):finished(g);
 if(g.stage==='playing'&&!g.mySubmitted&&!g.members.find(m=>m.id===session.id)?.eliminated)frame=requestAnimationFrame(tick);
}
function stopRound(timeout=false){
 const g=game();
 if(!g||g.stage!=='playing'||g.mySubmitted||submitting)return;
 const elapsed=timeout?18000:Math.max(100,Math.min(18000,Math.round(performance.now()-origin)));
 if(!send({type:'pita-stop',elapsedMs:elapsed,choice})){stopFrame();return;}
 submitting=true;stopFrame();
 const stop=$('stop');if(stop){stop.disabled=true;stop.textContent='送信中…'}
 const progress=$('round-progress');if(progress)progress.textContent='送信したよ。全員の結果を待ってね';
}
$('game-root').addEventListener('click',event=>{
 const selected=event.target.closest('[data-choice]');
 if(selected&&game()?.stage==='playing'&&!game()?.mySubmitted&&!submitting){
  choice=selected.dataset.choice;
  document.querySelectorAll('[data-choice]').forEach(b=>b.classList.toggle('selected',b.dataset.choice===choice));
  return;
 }
 const control=event.target.closest('[data-action]');if(!control)return;
 const a=control.dataset.action,g=game();if(!g)return;
 if(a==='stop'){stopRound();return}
 if(a==='begin')send({type:'pita-begin'});
 if(a==='next')send({type:'pita-next'});
 if(a==='close'){
  if(Date.now()-g.startedAt<25000)notice('25秒経過後に締め切れるよ。');
  else send({type:'pita-close'});
 }
 if(a==='stop-game'&&confirm('オンライン対戦を終了してロビーへ戻す？'))send({type:'pita-stop-game'});
});
function connect(){
 if(leaving)return;
 clearTimeout(retryTimer);
 if(ws){ws.onclose=null;ws.close()}
 onlineUI.connection('connection','connecting');
 const endpoint=base.replace(/^http/,'ws')+'/api/rooms/'+session.code+'/ws?token='+encodeURIComponent(session.token);
 const socket=new WebSocket(endpoint);ws=socket;
 socket.onopen=()=>{if(ws!==socket)return;retry=0;onlineUI.connection('connection','connected');notice('オンライン接続中',true)};
 socket.onmessage=event=>{
  if(ws!==socket)return;
  let data;try{data=JSON.parse(event.data)}catch{return}
  if(data.type==='left'){lobby(true);return}
  if(data.type==='error'){notice(data.error||'通信を確認してね');return}
  if(data.type!=='room'&&data.type!=='welcome')return;
  room=data.room;
  if(room.phase!=='pita'){lobby();return}
  render();
 };
 socket.onclose=event=>{
  if(ws!==socket||leaving)return;
  ws=null;onlineUI.connection('connection','reconnecting');
  if([4000,4002,4003].includes(event.code)){lobby(true);return}
  retry=Math.min(retry+1,6);
  retryTimer=setTimeout(connect,Math.min(1500*2**(retry-1),15000));
 };
 socket.onerror=()=>{};
}
connect();
})();