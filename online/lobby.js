/* 放課後ゲーム部 / 共通オンラインロビー v2 (ゲーム画面は別URL) */
(()=>{
'use strict';
const $=id=>document.getElementById(id);
const icons=window.HoukagoPlayers?.ICONS||['🐶','🐱','🐰','🐼','🦊','🐸','🐧','🐯','🐨','🐵','🦁','🐹','🦍','🦄','👻'];
const names={
 'minna-wa-docchi':'みんなはどっち？','kyokasho-tower':'教科書タワー',
 'kankaku-meter':'感覚メーター','pitadome-challenge':'ピタ止めチャレンジ',
 'link-burst':'リンクバースト！','nise-transfer-student':'ニセ転校生を探せ！',
 'gesture-battle':'ジェスチャーバトル','word-wolf':'ことばのオオカミ','sabotage':'サボタージュ！'
};
const STORE='houkago-online-session-v1';
const base=String(window.HOUKAGO_ONLINE_API_URL||'').replace(/\/$/,'');
const configured=/^https:\/\/[A-Za-z0-9.-]+$/.test(base)||/^http:\/\/localhost:\d+$/.test(base);
let icon=icons[0],session=null,room=null,ws=null,retry=0,timer=null,leaving=false;
const supplied=(new URLSearchParams(location.search).get('room')||'').toUpperCase();
if(/^[A-Z2-9]{8}$/.test(supplied))$('code').value=supplied;
const preferred=new URLSearchParams(location.search).get('game');
if(names[preferred])$('game').value=preferred;
const onlineUI=window.HoukagoOnlineUI;
function notice(text,good=false){onlineUI.notice('notice',text,good)}
function connected(value,phase='reconnecting'){
 onlineUI.connection('connection',value?'connected':phase);
 $('ready').disabled=!value;
}
function busy(value){$('create').disabled=value||!configured;$('join').disabled=value||!configured}
icons.forEach(value=>{
 const b=document.createElement('button');b.type='button';b.className='icon-option'+(value===icon?' selected':'');
 b.textContent=value;b.setAttribute('aria-label',value);
 b.addEventListener('click',()=>{
   icon=value;document.querySelectorAll('.icon-option').forEach(el=>el.classList.toggle('selected',el===b));
 });
 $('icons').append(b);
});
for(const [key,label] of Object.entries(names)){
 const option=document.createElement('option');option.value=key;option.textContent=label;$('game-in-room').append(option);
}
function stopSocket(){
 clearTimeout(timer);timer=null;
 if(ws){const old=ws;ws=null;old.onclose=null;old.onerror=null;try{old.close()}catch{}}
}
function backToEntry(message){
 stopSocket();session=null;room=null;sessionStorage.removeItem(STORE);
 $('entry').hidden=false;$('room-panel').hidden=true;history.replaceState(null,'',location.pathname);
 busy(false);if(message)notice(message);
}
const persist=()=>{if(session)sessionStorage.setItem(STORE,JSON.stringify(session))};
const invite=()=>new URL('?room='+encodeURIComponent(room?.code||''),location.href).href;
async function post(path,body){
 const r=await fetch(base+path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),cache:'no-store'});
 const answer=await r.json().catch(()=>({ok:false,error:'通信を確認してね'}));
 if(!r.ok||!answer.ok)throw Error(answer.error||'接続できませんでした');
 return answer;
}
function nameInput(){
 const name=$('nickname').value.trim().slice(0,16);
 if(!name){notice('名前を入力してね');$('nickname').focus();return null}
 return name;
}
function enter(answer){
 session={code:answer.code,id:answer.id,token:answer.token,name:$('nickname').value.trim().slice(0,16)};
 persist();room=answer.room;$('entry').hidden=true;$('room-panel').hidden=false;
 history.replaceState(null,'','?room='+encodeURIComponent(session.code));
 notice('部屋に入れたよ！',true);connected(false,'connecting');draw();connect();
}
$('create').addEventListener('click',async()=>{
 const name=nameInput();if(!name||!configured)return;
 busy(true);notice('部屋を作成中…',true);
 try{enter(await post('/api/rooms',{name,icon,gameId:$('game').value}))}
 catch(error){notice(error.message);busy(false)}
});
$('join').addEventListener('click',async()=>{
 const name=nameInput(),code=$('code').value.trim().toUpperCase();
 if(!name||!configured)return;
 if(!/^[A-Z2-9]{8}$/.test(code)){notice('招待コードは8文字だよ');return}
 busy(true);notice('部屋を探しているよ…',true);
 try{enter(await post('/api/rooms/'+code+'/join',{name,icon}))}
 catch(error){notice(error.message);busy(false)}
});
const send=command=>{if(ws?.readyState===WebSocket.OPEN)ws.send(JSON.stringify(command))};
function draw(){
 if(!room)return;
 if((room.phase==='secret'||room.phase==='nise'||room.phase==='wolf'||room.phase==='pita'||room.phase==='meter'||room.phase==='tower'||room.phase==='link'||room.phase==='sabotage')&&session?.code){
   stopSocket();
   const page=room.phase==='sabotage'?'sabotage':room.phase==='nise'?'nise-transfer-student':room.phase==='wolf'?'word-wolf':room.phase==='pita'?'pitadome-challenge':room.phase==='meter'?'kankaku-meter':room.phase==='tower'?'kyokasho-tower':room.phase==='link'?'link-burst':'minna-wa-docchi';
   location.replace('./'+page+'/?room='+encodeURIComponent(session.code));
   return;
 }
 $('room-code').textContent=room.code;
 $('game-name').textContent=names[room.gameId]||room.gameId;
 $('game-in-room').value=room.gameId;
 $('member-count').textContent=room.members.length+' / '+(room.maxPlayers||10)+'人';
 const host=room.hostId===session?.id;
 $('change-game').hidden=!host||room.phase!=='lobby';if(!host||room.phase!=='lobby')$('game-change').hidden=true;
 const self=room.members.find(m=>m.id===session?.id);
 $('ready').textContent=self?.ready?'準備完了を取り消す':'準備完了にする';
 $('ready').disabled=ws?.readyState!==WebSocket.OPEN;
 const hostStart=$('start-secret');
 const supported=['minna-wa-docchi','nise-transfer-student','word-wolf','pitadome-challenge','kankaku-meter','kyokasho-tower','link-burst','sabotage'].includes(room.gameId);
 const minimum=['nise-transfer-student','word-wolf'].includes(room.gameId)?3:room.gameId==='sabotage'?4:2;
 const tooMany=(room.gameId==='kyokasho-tower'&&room.members.length>6)||(room.gameId==='link-burst'&&room.members.length>2);
 hostStart.hidden=!host||!supported;
 hostStart.textContent=(names[room.gameId]||room.gameId)+' の画面へ進む';
 hostStart.disabled=!room.allReady||room.members.length<minimum||tooMany||ws?.readyState!==WebSocket.OPEN;
 $('waiting').textContent=tooMany?(room.gameId==='link-burst'?'リンクバースト！は2人専用。ホストが人数を調整してね。':'教科書タワーは最大6人まで。ホストが人数を調整してね。'):room.members.length<minimum&&supported?
   'このゲームは'+minimum+'人以上で遊べるよ。友達を招待してね。':
   room.allReady?(supported?'全員準備OK！ ホストが進むと全員同時に移動するよ。':'このゲームのオンライン版は準備中だよ。'):
   '全員が準備OKになったらホストがゲーム画面に進めるよ。';
 $('members').replaceChildren();
 room.members.forEach(m=>{
  const row=document.createElement('div');row.className='member';
  const avatar=document.createElement('span');avatar.className='member-icon';avatar.textContent=m.icon||'🎮';
  const label=document.createElement('strong');label.textContent=m.name;
  if(m.id===room.hostId){const badge=document.createElement('em');badge.textContent=' ホスト';label.append(badge)}
  if(m.id===session?.id){const badge=document.createElement('em');badge.textContent='（自分）';label.append(badge)}
  const status=document.createElement('span');status.className='member-status'+(m.connected&&m.ready?' ready':'');
  status.textContent=!m.connected?'オフライン':m.ready?'準備OK':'待機中';
  row.append(avatar,label,status);
  if(host&&m.id!==session.id){
   const remove=document.createElement('button');remove.type='button';remove.textContent='退出させる';
   remove.addEventListener('click',()=>{if(confirm(m.name+'を退出させる？'))send({type:'remove',memberId:m.id})});
   row.append(remove);
  }
  $('members').append(row);
 });
}
function connect(){
 if(!session||!configured)return;
 stopSocket();connected(false,'connecting');
 const endpoint=base.replace(/^http/,'ws')+'/api/rooms/'+session.code+'/ws?token='+encodeURIComponent(session.token);
 const current=new WebSocket(endpoint);ws=current;
 current.onopen=()=>{if(ws!==current)return;retry=0;connected(true);notice('オンライン接続できたよ',true);draw()};
 current.onmessage=event=>{
  if(ws!==current)return;
  let msg;try{msg=JSON.parse(event.data)}catch{return}
  if(msg.type==='welcome'||msg.type==='room'){room=msg.room;draw()}
  else if(msg.type==='left'){backToEntry('部屋から退出したよ');leaving=false}
  else if(msg.type==='error')notice(msg.error||'通信エラー');
 };
 current.onclose=event=>{
  if(ws!==current||leaving)return;
  ws=null;connected(false);
  if([4000,4002,4003].includes(event.code)){backToEntry('部屋が終了したか、参加情報が無効だよ');return}
  retry=Math.min(retry+1,6);
  timer=setTimeout(connect,Math.min(1500*(2**(retry-1)),15000));
 };
 current.onerror=()=>{};
}
$('start-secret').addEventListener('click',async()=>{
 if(room?.phase!=='lobby'||!room.allReady)return;
 if(room.gameId==='sabotage'&&room.members.length>=4){
  try{const health=await fetch(base+'/api/health',{cache:'no-store'}).then(r=>r.json());
    if(!health.ok||health.version<10){notice('サボタージュ！のサーバー更新待ちだよ。');return}
  }catch{notice('通信サーバーに接続できないよ。');return}
  send({type:'sabotage-start'});
 }else if(room.gameId==='nise-transfer-student'&&room.members.length>=3){
  // Pagesの更新が先行しても、旧Workerで開始不能な部屋に閉じ込めない。
  try{
   const health=await fetch(base+'/api/health',{cache:'no-store'}).then(r=>r.json());
   if(!health.ok||health.version<4){notice('通信サーバーの更新待ちだよ。更新後にもう一度押してね。');return}
  }catch{notice('通信サーバーを確認できないよ。接続を確認してね。');return}
  send({type:'nise-start'});
  }else if(room.gameId==='word-wolf'&&room.members.length>=3){
  try{
   const health=await fetch(base+'/api/health',{cache:'no-store'}).then(r=>r.json());
   if(!health.ok||health.version<5){notice('ことばのオオカミのサーバー更新待ちだよ。更新後にもう一度押してね。');return}
  }catch{notice('通信サーバーを確認できないよ。接続を確認してね。');return}
  send({type:'wolf-start'});
 }else if(room.gameId==='pitadome-challenge'&&room.members.length>=2){
  try{
   const health=await fetch(base+'/api/health',{cache:'no-store'}).then(r=>r.json());
   if(!health.ok||health.version<6){notice('ピタ止めのサーバー更新待ちだよ。更新後にもう一度押してね。');return}
  }catch{notice('通信サーバーを確認できないよ。接続を確認してね。');return}
  send({type:'pita-start'});
 }else if(room.gameId==='kankaku-meter'&&room.members.length>=2){
  try{
   const health=await fetch(base+'/api/health',{cache:'no-store'}).then(r=>r.json());
   if(!health.ok||health.version<7){notice('感覚メーターのサーバー更新待ちだよ。更新後にもう一度押してね。');return}
  }catch{notice('通信サーバーを確認できないよ。接続を確認してね。');return}
  send({type:'meter-start'});
 }else if(room.gameId==='kyokasho-tower'&&room.members.length>=2&&room.members.length<=6){
  try{
   const health=await fetch(base+'/api/health',{cache:'no-store'}).then(r=>r.json());
   if(!health.ok||health.version<8){notice('教科書タワーのサーバー更新待ちだよ。更新後にもう一度押してね。');return}
  }catch{notice('通信サーバーを確認できないよ。接続を確認してね。');return}
  send({type:'tower-start'});
 }else if(room.gameId==='link-burst'&&room.members.length===2){
  try{
   const health=await fetch(base+'/api/health',{cache:'no-store'}).then(r=>r.json());
   if(!health.ok||health.version<9){notice('リンクバースト！のサーバー更新待ちだよ。');return}
  }catch{notice('通信サーバーを確認できないよ。接続を確認してね。');return}
  send({type:'link-start'});
 }else if(room.gameId==='minna-wa-docchi')send({type:'secret-start'});
});
$('ready').addEventListener('click',()=>{
 const me=room?.members.find(m=>m.id===session?.id);
 if(me)send({type:'ready',ready:!me.ready});
});
$('change-game').addEventListener('click',()=>{$('game-change').hidden=!$('game-change').hidden});
$('apply-game').addEventListener('click',()=>{
 send({type:'game',gameId:$('game-in-room').value});$('game-change').hidden=true;
});
$('copy').addEventListener('click',async()=>{
 try{await navigator.clipboard.writeText(invite());notice('招待URLをコピーしたよ',true)}
 catch{notice('コピーできなかったよ。コードを友達に教えてね')}
});
$('share').addEventListener('click',async()=>{
 if(navigator.share){try{await navigator.share({title:'放課後ゲーム部 オンラインルーム',url:invite()})}catch{}}
 else $('copy').click();
});
$('leave').addEventListener('click',()=>{
 if(!confirm('部屋から退出する？'))return;
 leaving=true;send({type:'leave'});
 timer=setTimeout(()=>{backToEntry('退出したよ');leaving=false},3000);
});
try{
 const saved=JSON.parse(sessionStorage.getItem(STORE)||'null');
 if(saved&&/^[A-Z2-9]{8}$/.test(saved.code)&&/^[a-f0-9]{64}$/.test(saved.token)&&(!supplied||supplied===saved.code)){
  session=saved;$('nickname').value=saved.name||'';
  $('entry').hidden=true;$('room-panel').hidden=false;
  room={code:saved.code,gameId:'minna-wa-docchi',hostId:null,members:[],maxPlayers:10};
  draw();if(configured)connect();
 }
}catch{sessionStorage.removeItem(STORE)}
if(!configured){busy(false);notice('オンラインサーバーの接続設定前です。現在準備中のため、まだ部屋には入れないよ。')}
})();