import {createSabotage,sabotageView,sabotageAction,sabotageRevealPhase} from '../../games/sabotage/engine.js?v=20261024-noreaction1';
import {sabotageRevealBody} from '../../games/sabotage/reveal-ui.js?v=20261024-noreaction1';
import {sabotageBadges,sabotageSlots,sabotageSlotLegend,sabotageVictory,sabotageRoleCard,sabotageCutConfirm} from '../../games/sabotage/visuals.js?v=20261024-noreaction1';
const $=id=>document.getElementById(id),root=$('game-root'),esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const base=String(window.HOUKAGO_ONLINE_API_URL||'').replace(/\/$/,'');
const q=new URLSearchParams(location.search),demo=q.get('testPlay')==='1';
const STORE='houkago-online-session-v1';let session=null,room=null,ws=null,retry=0,closed=false,secretOpen=false,panel='',target='',wire=-1,lastPhase='',demoGame=null,demoSelf='',revealTimer=null;
const demoPeople=[{id:'demo1',name:'あなた',icon:'🐱'},{id:'demo2',name:'ゆい',icon:'🐶'},{id:'demo3',name:'けん',icon:'🦊'},{id:'demo4',name:'みお',icon:'🐧'}];
if(!demo){try{session=JSON.parse(sessionStorage.getItem(STORE)||'null')}catch{}
 if(!session||!/^[A-Z2-9]{8}$/.test(session.code)||!/^[a-f0-9]{64}$/.test(session.token)||!/^https:\/\/[a-z0-9.-]+$/i.test(base)||q.get('room')&&q.get('room')!==session.code){location.replace('../');}
}else{
 demoGame=createSabotage(demoPeople);demoSelf='demo1';demoGame.currentId=demoSelf;session={id:demoSelf,code:'DEMO',token:''};
 room={phase:'sabotage',hostId:'demo1',members:demoPeople,sabotage:sabotageView(demoGame,demoSelf)};
}
const nRole={crew:'クルーメイト',impostor:'インポスター',jackal:'ジャッカル'};
const nWire={repair:'解除コード',error:'爆弾（BOMB）',dummy:'反応なし'};
const quick=['解除コードがある！','爆弾があるかも','誰を信じよう？','この人のコードを選んで','別の人にしよう','ちょっと待って！','怪しいと思う','信じる！'];
const person=id=>room?.members?.find(x=>x.id===id)||{name:'不明',icon:'？'};
const data=()=>room?.sabotage;
const me=()=>demo?demoSelf:session?.id;
const host=()=>demo||room?.hostId===session?.id;
const btn=(s,key,style='',disabled=false)=>'<button type="button" class="sab-btn '+style+'" data-action="'+key+'" '+(disabled?'disabled':'')+'>'+esc(s)+'</button>';
function notify(s){$('notice').hidden=!s;if(s)$('notice').textContent=s}
function send(type,args={}){
 if(demo){
  const ok=sabotageAction(demoGame,demoSelf,{type,...args});
  if(ok){
   // Trial mode always represents ONE player's own device. Simulate other devices silently.
   if(type==='sabotage-seen'||type==='sabotage-role-seen'){
    for(const p of demoGame.players){
     if(p.id!==demoSelf)sabotageAction(demoGame,p.id,{type});
    }
   }
   room.sabotage=sabotageView(demoGame,demoSelf);
   // Do not close an open chat or reset its scroll position when a message is sent.
   if(type!=='sabotage-chat'){target='';wire=-1;secretOpen=false}
   render();
  }
  return ok;
 }
 if(!ws||ws.readyState!==WebSocket.OPEN){notify('通信が切れています。再接続します。');return false}
 ws.send(JSON.stringify({type,...args}));return true;
}
function simulateOtherDevice(){
 if(!demo||demoGame.stage!=='playing'||demoGame.currentId===demoSelf)return;
 const operator=demoGame.currentId;
 const target=demoGame.players.find(p=>p.id===demoSelf&&p.hand.length)||demoGame.players.find(p=>p.id!==operator&&p.hand.length);
 if(!target||target.id===operator)return;
 const available=(target.slots||[]).map((slot,i)=>slot.state==='closed'?i:-1).filter(i=>i>=0);
 const index=available[Math.floor(Math.random()*available.length)];
 if(index===undefined)return;
 if(sabotageAction(demoGame,operator,{type:'sabotage-cut',targetId:target.id,index})){
  room.sabotage=sabotageView(demoGame,demoSelf);
  render();
 }
}
function status(d){
 return '<section class="sab-panel sab-status-panel"><div class="sab-status">'+
 '<strong class="sab-round">ROUND '+d.round+' <span>/ 4</span></strong><span>解除 '+d.repaired+' / '+d.required+'</span></div>'+
 sabotageBadges(d.required,d.repaired)+'</section>';
}
function rules(){return '<details class="sab-more"><summary>遊び方・勝利条件</summary><div class="sab-more-content">自分の役職とコードの内訳を確認し、他の人のコードを1本選びます。選ばれた人が次の選択者。全解除でクルーメイト勝利、爆弾を選ぶとインポスター勝利。4ラウンド終了ならジャッカルがいればジャッカル、いなければインポスター勝利。自分のコードは選べません。嘘の申告は自由です。</div></details>'}
function briefing(d){
 const roleStage=d.stage==='roles',count=d.myCounts||{repair:0,error:0,dummy:0};
 if(d.mySeen)return '<section class="sab-panel sab-center sab-brief"><p class="sab-kicker">'+(roleStage?'ROLE REVEAL':'ROUND '+d.round+' / 4')+'</p>'+
 '<h2>秘密の確認が完了</h2><p class="sab-sub">ほかの人の確認を待機中</p><strong>'+d.seenCount+' / '+d.members.length+'人</strong></section>'+rules();
 return '<section class="sab-panel sab-center sab-brief"><p class="sab-kicker">'+(roleStage?'ROLE REVEAL':'ROUND '+d.round+' / 4 · SECRET')+'</p>'+
 '<h2>'+(roleStage?'あなたの役職':'あなたのコード内訳')+'</h2>'+
 '<p class="sab-sub">この端末の持ち主だけが確認できます</p>'+
 (secretOpen?((roleStage?sabotageRoleCard(d.myRole):sabotageRoleCard(d.myRole,count))+
 '<p class="sab-sub">確認したら秘密を隠そう</p>'+btn(roleStage?'役職を確認した':'内訳を覚えた・確認完了','seen')):btn(roleStage?'自分の役職を見る':'自分の内訳を見る','show'))+
 '<p class="sab-sub">'+d.seenCount+' / '+d.members.length+'人が確認済み</p></section>'+rules();
}
function roster(d){
 return '<div class="sab-roster">'+d.members.map(p=>
 '<button type="button" class="sab-player '+(d.currentId===p.id?'active':'')+'" data-target="'+esc(p.id)+'" '+(d.currentId!==me()||p.id===d.currentId?'disabled':'')+'>'+
 '<span class="meta"><span class="name">'+esc(p.icon)+' '+esc(p.name)+'</span><small>残り'+p.cards+'本</small></span>'+
 sabotageSlots(p.slots)+'</button>').join('')+'</div>';
}
function playing(d){
 const turn=person(d.currentId),own=d.currentId===me();
 return '<section class="sab-play">'+status(d)+(demo?'<p class="sab-trial-note">あなたの端末を試遊中（ほかの3人は仮想参加者）</p>':'')+
 '<div class="sab-current"><small>現在の選択者</small><strong>'+esc(turn.icon)+' '+esc(turn.name)+'</strong>'+
 '<small>残り '+(d.totalCuts-d.cuts)+' 回 / '+(own?'あなたの番：相手を選ぼう':'ほかのプレイヤーの操作を待機中')+'</small></div>'+
 roster(d)+sabotageSlotLegend()+'<div class="sab-stack">'+
 (demo&&!own?'<div class="sab-demo-other">'+btn('ほかの端末の操作を再現','demo-turn','secondary')+'</div>':'')+
 '<div class="sab-online-help">'+btn('自分の秘密','private','secondary')+btn('通信チャット','chat','secondary')+btn('公開履歴','history','secondary')+'</div>'+rules()+'</div></section>';
}
function picker(d){
 const p=d.members.find(x=>x.id===target);
 return '<section class="sab-panel sab-center sab-wait"><p class="sab-kicker">CODE SELECT</p>'+
 '<h2>'+esc(p?.icon)+' '+esc(p?.name)+' のコード</h2><p class="sab-sub">公開された位置は表向きのまま残るよ。</p>'+
 sabotageSlots(p?.slots,true,wire)+
 '<div class="sab-actions" style="margin-top:16px">'+btn('このコードを公開する','cut','',wire<0)+
 btn('自分の役職・内訳を確認','private','secondary')+btn('選び直す','cancel','secondary')+'</div></section>';
}
function reveal(d){
 const x=d.lastCut,p=person(x.targetId),phase=sabotageRevealPhase(x);
 return '<section class="sab-panel sab-center sab-wait sab-reveal-scene">'+
  '<p class="sab-kicker">CODE REVEAL / ROUND '+d.round+'</p>'+
  '<h2>'+esc(p.icon)+' '+esc(p.name)+' のコード</h2>'+
  sabotageRevealBody(x.type,phase.stage,d.repaired,d.required)+
  (phase.stage==='ready'?
   (host()?btn(d.winner?'最終結果を見る':'次へ進む','next'):'<p class="sab-sub">ホストが次へ進むまで待ってね</p>'):
   '<p class="sab-reveal-pause" aria-label="演出中">……</p>')+
  '</section>';
}
function chatLines(d){return d.chat?.length?d.chat.slice(-12).map(x=>'<div class="sab-chat-line"><strong>'+esc(person(x.id).name)+'</strong> '+esc(x.text)+'</div>').join(''):'<p class="sab-sub">まだ発言はありません</p>'}
function chat(d){return '<section class="sab-panel sab-chat-panel" data-chat-view><div class="sab-chat-head"><div><h2>通信チャット</h2><p>タップして発言。通話は別アプリ。</p></div>'+btn('閉じる','cancel','secondary')+'</div><div class="sab-chat-messages" data-chat-log role="log" aria-live="polite">'+chatLines(d)+'</div><div class="sab-quick-grid">'+quick.map((x,i)=>'<button class="sab-btn secondary" type="button" data-chat="'+i+'">'+esc(x)+'</button>').join('')+'</div></section>'}
function updateChatLog(d){
 const log=root.querySelector('[data-chat-log]');if(!log)return false;
 // Keep the chat panel and its buttons mounted. Only replace public messages.
 const old=log.innerHTML,next=chatLines(d);
 if(old!==next){const stick=log.scrollHeight-log.scrollTop-log.clientHeight<75;log.innerHTML=next;if(stick)log.scrollTop=log.scrollHeight;}
 return true;
}
function history(d){return '<section class="sab-panel sab-wait"><h2>公開履歴</h2><div class="sab-chat-messages">'+(d.history.length?d.history.map(x=>'<div class="sab-chat-line">R'+x.round+'：'+esc(person(x.targetId).name)+' → '+nWire[x.type]+'</div>').join(''):'<p>まだありません</p>')+'</div></section>'+btn('盤面へ戻る','cancel')}
function result(d){
 return sabotageVictory(d.winner,d.myRole)+
 '<section class="sab-panel sab-victory-list"><h3>全員の正体</h3>'+
 d.members.map(p=>'<p>'+esc(p.icon)+' '+esc(p.name)+'：<b class="sab-role '+p.role+'" style="font-size:14px">'+nRole[p.role]+'</b></p>').join('')+
 '</section>'+(demo?btn('もう一度試遊する','demo-restart'):(host()?btn('部屋に戻って再戦','stop'):'<p class="sab-sub sab-center">ホストがロビーへ戻すまで待機</p>'))+
 btn('公開されたコードの履歴','history','secondary');
}
function privatePeek(d){
 const node=document.createElement('div');node.className='sab-private-overlay';node.setAttribute('role','dialog');node.setAttribute('aria-modal','true');
 node.innerHTML='<section class="sab-panel sab-center"><h2>あなただけの秘密</h2>'+sabotageRoleCard(d.myRole,d.myCounts)+
 '<p class="sab-sub">今のラウンドの未公開コード内訳</p>'+
 '<button class="sab-btn" type="button" data-private-close>秘密を隠す</button></section>';
 node.addEventListener('click',e=>{if(e.target===node||e.target.closest('[data-private-close]'))node.remove()});
 document.body.appendChild(node);node.querySelector('button')?.focus();
}
function render(){
 if(!room?.sabotage)return;const d=data();if(!d)return;
 const phase=d.round+':'+d.stage;
 if(lastPhase!==phase){secretOpen=false;panel='';target='';wire=-1;lastPhase=phase}
 else if(panel==='chat'&&d.stage==='playing'&&updateChatLog(d))return;
 clearTimeout(revealTimer);revealTimer=null;
 let h='';
 if(d.stage==='briefing'||d.stage==='roles')h=briefing(d);
 else if(d.stage==='playing'){h=panel==='chat'?chat(d):panel==='history'?history(d):target?picker(d):playing(d)}
 else if(d.stage==='reveal')h=reveal(d);
 else if(d.stage==='finished')h=panel==='history'?history(d):result(d);
 root.innerHTML=h;
 if(d.stage==='reveal'){
  const phase=sabotageRevealPhase(d.lastCut);
  if(phase.waitMs>0)revealTimer=setTimeout(()=>{if(data()?.stage==='reveal'&&data()?.lastCut?.startedAt===d.lastCut?.startedAt)render()},Math.ceil(phase.waitMs)+30);
 }
}
root.addEventListener('click',e=>{
 const b=e.target.closest('button');if(!b||!data())return;
 if(b.dataset.confirmCancel!==undefined){b.closest('.sab-confirm-overlay')?.remove();return}
 if(b.dataset.confirmOk!==undefined){b.closest('.sab-confirm-overlay')?.remove();b.dataset.action='confirm-cut'}
 const d=data();
 if(b.dataset.target!==undefined){if(d.stage!=='playing'||d.currentId!==me()||b.dataset.target===d.currentId)return;target=b.dataset.target;wire=-1;panel='';render();return}
 if(b.dataset.wire!==undefined){wire=Number(b.dataset.wire);render();return}
 if(b.dataset.chat!==undefined){send('sabotage-chat',{key:Number(b.dataset.chat)});return}
 switch(b.dataset.action){
 case 'show':secretOpen=true;render();break;
 case 'seen':send(d.stage==='roles'?'sabotage-role-seen':'sabotage-seen');secretOpen=false;break;
 case 'cut':if(wire<0||!target)return;
  if(d.members.find(x=>x.id===target)?.slots?.[wire]?.state!=='closed')return;
  root.insertAdjacentHTML('beforeend',sabotageCutConfirm(person(target).name,wire));break;
 case 'confirm-cut':send('sabotage-cut',{targetId:target,index:wire});target='';wire=-1;break;
 case 'private':privatePeek(d);break;
 case 'cancel':panel='';target='';wire=-1;render();break;
 case 'chat':panel='chat';render();break;
 case 'history':panel='history';render();break;
 case 'demo-turn':simulateOtherDevice();break;
 case 'next':send('sabotage-next');break;
 case 'demo-restart':if(!demo)return;demoGame=createSabotage(demoPeople);demoGame.currentId=demoSelf;room.sabotage=sabotageView(demoGame,demoSelf);lastPhase='';panel='';target='';wire=-1;secretOpen=false;render();break;
 case 'stop':if(confirm('ゲームを終えて全員でロビーへ戻る？'))send('sabotage-stop');break;
 }
});
function lobby(clear=false){closed=true;if(clear)sessionStorage.removeItem(STORE);if(ws){ws.onclose=null;ws.close();ws=null}location.replace('../'+(!clear&&session.code!=='DEMO'?'?room='+encodeURIComponent(session.code):''))}
function connect(){
 if(demo||closed)return;
 const current=new WebSocket(base.replace(/^http/,'ws')+'/api/rooms/'+session.code+'/ws?token='+encodeURIComponent(session.token));ws=current;
 $('connection').textContent='接続中';
 current.onopen=()=>{if(ws!==current)return;retry=0;$('connection').textContent='接続中';notify('')};
 current.onmessage=e=>{
  if(current!==ws)return;let msg;try{msg=JSON.parse(e.data)}catch{return}
  if(msg.type==='room'||msg.type==='welcome'){
   room=msg.room;
   window.dispatchEvent(new CustomEvent('houkago-online-room-state',{detail:room}));
   if(room.phase!=='sabotage'){lobby();return}
   $('connection').textContent='オンライン';notify('');render();
  }else if(msg.type==='left')lobby(true);
  else if(msg.type==='error')notify(msg.error||'通信エラー');
 };
 current.onclose=event=>{
  if(ws!==current||closed)return;ws=null;$('connection').textContent='再接続中';
  if([4000,4002,4003].includes(event.code)){lobby(true);return}
  retry=Math.min(7,retry+1);setTimeout(connect,Math.min(1500*2**(retry-1),15000));
 };
}
$('back-lobby').addEventListener('click',e=>{e.preventDefault();
 if(demo){location.href='../preview/';return}
 if(!confirm(host()?'ゲームを終了して全員でロビーへ戻る？':'部屋から退出する？'))return;
 if(host()){send('sabotage-stop');return}
 send('leave');closed=true;setTimeout(()=>lobby(true),400);
});
if(demo){$('connection').textContent='試遊';render()}else connect();
