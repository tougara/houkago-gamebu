/* LINK BURST ONLINE: authoritative WebSocket opponent snapshots + solo-style touch controller */
(()=>{
'use strict';
const root=document.getElementById('game-root'),STORE='houkago-online-session-v1';
const base=String(window.HOUKAGO_ONLINE_API_URL||'').replace(/\/$/,'');
const requested=new URLSearchParams(location.search).get('room')||'';
const ui=window.HoukagoOnlineUI;
let session=null,room=null,ws=null,retries=0,retryTimer=null,leaving=false,lastShell='',lastRound=0;
const held=new Set(),palette={1:['blue','○'],2:['red','△'],3:['yellow','★'],4:['green','◇'],5:['jam','J']};
const rotation=[[[0,0],[1,0]],[[0,0],[0,1]],[[0,0],[-1,0]],[[0,0],[0,-1]]];
try{session=JSON.parse(sessionStorage.getItem(STORE)||'null')}catch{}
// 試遊時だけ共通プレビューの仮セッションを使用。本物の保存データは変更しない。
if(window.HoukagoOfflinePreview)session=window.HoukagoOfflinePreview.session;
if(!window.HoukagoOfflinePreview&&(!session||!/^[A-Z2-9]{8}$/.test(session.code)||!/^[a-f0-9]{64}$/.test(session.token)||
 (requested&&requested!==session.code)||!/^https:\/\/[a-z0-9.-]+$/i.test(base))){
 location.replace('../'+(requested?'?room='+encodeURIComponent(requested):''));return;
}
const esc=ui.escapeHTML,host=()=>room?.hostId===session.id,game=()=>room?.link||null;
const notice=(msg,ok=false)=>ui.notice('notice',msg,ok);
const player=id=>game()?.members?.find(m=>m.id===id)||{name:'相手',icon:'？'};
const label=id=>{const m=player(id);return esc(m.icon+' '+m.name)};
const send=(type,other={})=>{
 if(ws?.readyState!==WebSocket.OPEN){notice('通信が切れているよ。再接続してね。');return false}
 ws.send(JSON.stringify({type,...other}));return true;
};
function lobby(clear=false){
 leaving=true;clearTimeout(retryTimer);releaseAll();
 if(clear)sessionStorage.removeItem(STORE);
 if(ws){ws.onclose=null;ws.close();ws=null}
 location.replace('../'+(clear?'':'?room='+encodeURIComponent(session.code)));
}
function exitGame(){
 if(!confirm(host()?'対戦を終了して全員ロビーに戻る？':'部屋から退出する？ 相手の対戦は一時停止されるよ。'))return;
 if(host())send('link-stop');
 else send('leave');
}
function controls(){
 return '<div class="controls" aria-label="自分の操作ボタン">'+
 '<button type="button" class="control" data-key="left" aria-label="左に移動">←</button>'+
 '<button type="button" class="control" data-key="right" aria-label="右に移動">→</button>'+
 '<button type="button" class="control" data-key="rotate" aria-label="回転">↻</button>'+
 '<button type="button" class="control" data-key="down" aria-label="高速落下">↓</button></div>';
}
function dialog(g){
 if(g.stage==='setup')return '<div class="dialog"><section class="dialog-card">'+
 '<div class="logo">LINK BURST! ONLINE</div><h1>2人でリアルタイム対戦</h1>'+
 '<p>'+label(session.id)+' 対 '+label(g.opponentId)+'</p>'+
 '<ol class="rules"><li>両者に同じ色と順番のブロックが届く</li>'+
 '<li>同じ色を4個以上そろえて消して連鎖</li>'+
 '<li>連鎖やCOMBOで相手へJAMを送り、届いたJAMは自分の連鎖で相殺</li>'+
 '<li>中央に新しいペアを出せなくなったらKO</li>'+
 '<li>縦持ちで、自分の盤面を大きく・右上に相手のミニ盤面を表示</li></ol>'+
 (host()?'<button class="btn" data-action="begin">3・2・1 スタート</button>':
 '<p>ホストのスタートを待ってね</p>')+
 '<button class="btn alt" data-action="return">ロビーへもどる</button></section></div>';
 return null;
}
function shell(){
 return '<div class="match">'+
  '<section class="me-area" aria-label="自分のゲーム盤面"><div class="me-top">'+
  '<div class="me-stats"><div class="stat"><small>得点</small><b id="self-score">0</b></div>'+
  '<div class="stat"><small>LINK</small><b id="self-link">0</b></div>'+
  '<div class="stat"><small>送信JAM</small><b id="self-jam">0</b></div></div>'+
  '<div class="me-board-wrap"><div class="me-label" id="self-name">自分</div>'+
  '<div class="board" id="self-board"></div><div class="phase-banner" id="phase-banner" hidden></div></div>'+
  '</div>'+controls()+'</section>'+
  '<aside class="side" aria-label="対戦相手とNEXTの情報">'+
  '<section class="opponent-card"><div class="opponent-title"><strong id="opponent-name">相手</strong><span id="opponent-state">接続中</span></div>'+
  '<div class="opponent-board"><div class="board" id="opponent-board"></div></div>'+
  '<div class="side-detail"><div class="side-metric"><small>相手JAM</small><b id="opponent-incoming">0</b></div>'+
  '<div class="side-metric"><small>相手得点</small><b id="opponent-score">0</b></div></div>'+
  '<div class="side-state" id="opponent-notice"></div></section>'+
  '<div class="me-rail" aria-label="自分の次のブロックと受信JAM">'+
  '<div class="pair-box"><small>NEXT</small><div class="pair" id="self-next"></div></div>'+
  '<div class="pair-box"><small>NEXT 2</small><div class="pair" id="self-next2"></div></div>'+
  '<div class="jam-pending"><small>受信JAM</small><b id="self-incoming">0</b></div></div>'+
  '<div class="side-metric match-status"><small>対戦ステータス</small><b id="match-state">開始準備</b></div>'+
  '<div class="side-state" id="self-notice"></div>'+
  '<div id="match-actions"></div></aside></div>';
}
function value(id,val){const el=document.getElementById(id);if(el)el.textContent=String(val)}
function blocks(p){
 if(!p)return '';
 const rows=p.board||[],display=rows.map(row=>[...row]);
 if(p.piece){
  const a=p.piece;
  const pair=rotation[a.rot]||rotation[1];
  pair.forEach(([dx,dy],i)=>{
   const x=a.x+dx,y=a.y+dy;
   if(display[y]&&x>=0&&x<7)display[y][x]=i===0?({'blue':'1','red':'2','yellow':'3','green':'4'}[a.a]||'0'):({'blue':'1','red':'2','yellow':'3','green':'4'}[a.b]||'0');
  });
 }
 const active=new Set();
 if(p.piece){const a=p.piece;rotation[a.rot].forEach(([dx,dy])=>active.add((a.y+dy)+':'+(a.x+dx)))}
 const burst=new Set((p.burst||[]).map(pos=>{const [y,x]=pos.split(':');return (Number(y)-2)+':'+x}));
 return display.map((row,y)=>row.map((ch,x)=>{
  const color=palette[ch];return '<div class="block '+(color?color[0]:'')+
  (active.has(y+':'+x)?' active':'')+(burst.has(y+':'+x)?' burst':'')+'">'+
  (color?color[1]:'')+'</div>';
 }).join('')).join('');
}
function pairPiece(piece){
 if(!piece)return '';
 return '<i class="'+esc(piece.a)+'"></i><i class="'+esc(piece.b)+'"></i>';
}
function refresh(g){
 const self=g.self,opp=g.opponent;
 if(!self||!opp)return;
 value('self-name',player(g.meId).name+'（自分）');
 value('opponent-name',player(g.opponentId).name);
 value('self-score',self.score);value('self-link',self.maxLink);
 value('self-jam',self.sent);value('self-incoming',self.incoming);
 value('opponent-score',opp.score);value('opponent-incoming',opp.incoming);
 value('self-notice',self.notice||'');value('opponent-notice',opp.notice||'');
 value('opponent-state',opp.over?'KO':opp.phase==='charge'||opp.phase==='burst'?'連鎖中':opp.phase==='falling'?'プレイ中':'');
 const sb=document.getElementById('self-board'),ob=document.getElementById('opponent-board');
 if(sb){const html=blocks(self);if(sb.innerHTML!==html)sb.innerHTML=html}
 if(ob){const html=blocks(opp);if(ob.innerHTML!==html)ob.innerHTML=html}
 for(const [id,pair] of [['self-next',self.next?.[0]],['self-next2',self.next?.[1]]]){
  const el=document.getElementById(id);if(el)el.innerHTML=pairPiece(pair);
 }
 const actions=document.getElementById('match-actions');
 const banner=document.getElementById('phase-banner');
 if(g.stage==='countdown'){
  value('match-state','開始まで '+Math.ceil(g.countdown/1000));
  if(banner){banner.hidden=false;banner.textContent=g.countdown>500?Math.ceil(g.countdown/1000):'START!'}
  if(actions)actions.innerHTML='<p class="side-state">全員同じ条件で開始</p>';
 }else if(g.stage==='interrupted'){
  releaseAll();
  value('match-state','通信待ち');
  if(banner){banner.hidden=false;banner.textContent='PAUSE'}
  if(actions)actions.innerHTML='<p class="side-state">通信が切断されたため一時停止。両者が戻ってから再開。</p>'+
   (host()?'<button class="btn" data-action="resume">3・2・1 で再開</button>':'')+
   '<button class="btn alt" data-action="return">対戦を終了・退出</button>';
 }else if(g.stage==='finished'){
  releaseAll();
  const won=g.winners.includes(g.meId),draw=g.winners.length===0;
  value('match-state',draw?'DRAW':won?'YOU WIN':'YOU LOSE');
  if(banner){banner.hidden=false;banner.textContent=draw?'DRAW':won?'WIN!':'LOSE'}
  if(actions)actions.innerHTML='<p class="side-state">'+esc(g.reason||'対戦終了')+'</p>'+
   (host()?'<button class="btn" data-action="stop">もう一戦（ロビーへ）</button>':
    '<p class="side-state">ホストがロビーに戻すのを待ってね</p>')+
    '<button class="btn alt" data-action="return">部屋にもどる</button>';
 }else{
  value('match-state','JAM BATTLE');
  if(banner){
   banner.hidden=!(self.phase==='charge'||self.phase==='burst');
   banner.textContent=self.phase==='charge'||self.phase==='burst'?Math.max(1,self.link)+' LINK':'';
  }
  if(actions)actions.innerHTML='';
 }
}
function render(){
 const g=game();if(!g){root.innerHTML='<div class="waiting">部屋にもどります…</div>';return}
 const shellKey=g.stage==='setup'?'setup':'match';
 if(lastShell!==shellKey){
  releaseAll();lastShell=shellKey;
  root.innerHTML=g.stage==='setup'?dialog(g):shell();
 }
 if(shellKey==='match')refresh(g);
}
function input(action,pressed){
 const g=game();if(g?.stage!=='playing')return;
 if(pressed){if(held.has(action))return;held.add(action)}else{
  if(!held.has(action))return;held.delete(action)
 }
 const button=root.querySelector('[data-key="'+action+'"]');
 if(button)button.classList.toggle('pressed',pressed);
 send('link-control',{action,pressed});
}
function releaseAll(){
 const previous=[...held];held.clear();
 for(const action of previous)send('link-control',{action,pressed:false});
 root.querySelectorAll('.control.pressed').forEach(b=>b.classList.remove('pressed'));
}
root.addEventListener('pointerdown',event=>{
 const button=event.target.closest('[data-key]');
 if(!button||game()?.stage!=='playing')return;
 event.preventDefault();
 button.setPointerCapture?.(event.pointerId);
 input(button.dataset.key,true);
});
for(const type of ['pointerup','pointercancel','lostpointercapture']){
 root.addEventListener(type,event=>{
  const button=event.target.closest?.('[data-key]');
  if(button){event.preventDefault();input(button.dataset.key,false)}
 });
}
root.addEventListener('click',event=>{
 const button=event.target.closest('[data-action]');if(!button)return;
 switch(button.dataset.action){
  case 'begin':send('link-begin');break;
  case 'resume':send('link-resume');break;
  case 'stop':if(confirm('対戦を終了してロビーへ戻す？'))send('link-stop');break;
  case 'return':exitGame();break;
 }
});
const keyNames={a:'left',d:'right',s:'down','arrowleft':'left','arrowright':'right','arrowdown':'down',' ':'rotate','enter':'rotate','arrowup':'rotate'};
addEventListener('keydown',e=>{
 const act=keyNames[e.key.toLowerCase()];if(!act)return;
 if(game()?.stage!=='playing')return;
 e.preventDefault();if(e.repeat)return;
 input(act,true);
});
addEventListener('keyup',e=>{const act=keyNames[e.key.toLowerCase()];if(act){e.preventDefault();input(act,false)}});
addEventListener('blur',releaseAll);
document.addEventListener('visibilitychange',()=>{if(document.hidden)releaseAll()});
function connect(){
 if(leaving)return;clearTimeout(retryTimer);
 if(ws){ws.onclose=null;ws.close()}
 ui.connection('connection','connecting');
 const endpoint=base.replace(/^http/,'ws')+'/api/rooms/'+session.code+'/ws?token='+encodeURIComponent(session.token);
 const socket=new WebSocket(endpoint);ws=socket;
 socket.onopen=()=>{if(ws!==socket)return;retries=0;ui.connection('connection','connected');notice('')};
 socket.onmessage=event=>{
  if(ws!==socket)return;
  let msg;try{msg=JSON.parse(event.data)}catch{return}
  if(msg.type==='left'){lobby(true);return}
  if(msg.type==='error'){notice(msg.error||'接続エラー');return}
  if(msg.type!=='welcome'&&msg.type!=='room')return;
  room=msg.room;
   window.dispatchEvent?.(new CustomEvent('houkago-online-room-state',{detail:room}));
  if(room.phase!=='link'){lobby();return}
  render();
 };
 socket.onclose=event=>{
  if(ws!==socket||leaving)return;
  ws=null;releaseAll();ui.connection('connection','reconnecting');
  if([4000,4002,4003].includes(event.code)){lobby(true);return}
  retries=Math.min(retries+1,6);
  retryTimer=setTimeout(connect,Math.min(1500*2**(retries-1),15000));
 };
 socket.onerror=()=>{};
}
document.getElementById('back-lobby')?.addEventListener('click',e=>{if(game()?.stage==='playing'){e.preventDefault();exitGame()}});
connect();
})();