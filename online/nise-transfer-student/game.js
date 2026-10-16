/* ニセ転校生を探せ！ オンライン / オフラインのUIを共用 */
(()=>{
'use strict';
const $=id=>document.getElementById(id);
const STORE='houkago-online-session-v1';
const base=String(window.HOUKAGO_ONLINE_API_URL||'').replace(/\/$/,'');
const query=new URLSearchParams(location.search);
const roomCode=(query.get('room')||'').toUpperCase();
const roleDefs={
 classmate:{name:'クラスメイト',side:'real',image:'role_classmate.png',desc:'特別な能力なし。話し合いでニセ転校生を探そう。'},
 fake:{name:'ニセ転校生',side:'fake',image:'role_fake_transfer_student.png',desc:'ほかのニセ転校生がいれば確認できるよ。'},
 president:{name:'学級委員',side:'real',image:'role_class_representative.png',desc:'参加者1人の役職か、おやすみ2枚を確認。'},
 dayDuty:{name:'日直',side:'real',image:'role_day_duty.png',desc:'おやすみの役職カードを1枚確認。'},
 observer:{name:'観察係',side:'real',image:'role_observer.png',desc:'参加者2人の陣営が同じかどうかを確認。'},
 swapper:{name:'席替え係',side:'real',image:'role_seat_changer.png',desc:'自分と相手の役職を交換できるよ。'},
 collaborator:{name:'秘密の協力者',side:'fake',image:'role_secret_collaborator.png',desc:'ニセモノ側。ニセ転校生の正体は分からない。'},
 trickster:{name:'いたずらっ子',side:'trick',image:'role_trickster.png',desc:'最多票で選ばれると、クセモノサイドの単独勝利。'}
};
const roleOrder=['classmate','fake','president','swapper','observer','dayDuty','collaborator','trickster'];
const baseRoles=['classmate','fake','president','swapper'];
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const roleImg=key=>'../../'+roleDefs[key].image;
let session=null,room=null,ws=null,retry=0,retryHandle=null,stopped=false,stageKey='',exitToList=false;
let peeked=false,hold=false,selected=[],votePick='',lastStage='',countdownHandle=null,roleTab='basic',chatOpen=false;
try{session=JSON.parse(sessionStorage.getItem(STORE)||'null')}catch{}
if(!session||!/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{8}$/.test(session.code)||
 !/^[a-f0-9]{64}$/.test(session.token)||roomCode&&roomCode!==session.code||
 !/^https:\/\/[a-z0-9.-]+$/i.test(base)){
 location.replace('../'+(roomCode?'?room='+encodeURIComponent(roomCode):''));return;
}
const myId=()=>session.id;
const g=()=>room?.nise;
const isHost=()=>room?.hostId===myId();
const me=()=>room?.members?.find(m=>m.id===myId())||{name:session.name||'あなた',icon:'🎮'};
const member=id=>room?.members?.find(m=>m.id===id)||{name:'プレイヤー',icon:'🎮'};
const nameOf=id=>{const m=member(id);return esc(m.icon||'')+' '+esc(m.name)};
function notice(s,good=false){const el=$('notice');el.hidden=!s;el.textContent=s||'';el.classList.toggle('ok',good)}
function connected(){return ws?.readyState===WebSocket.OPEN}
function send(obj){
 if(!connected()){notice('通信が切れています。自動再接続まで待ってね。');return false}
 ws.send(JSON.stringify(obj));return true;
}
function button(text,attr='',extra=''){
 return '<button type="button" class="btn '+extra+'" '+attr+'>'+esc(text)+'</button>';
}
function cardBack(label,attrs='',extra=''){
 return '<div class="table-card-wrap '+extra+(attrs?' table-card-selectable':'')+'" '+(attrs?'role="button" tabindex="0" ':'')+attrs+
 '><div class="table-card table-card-back"><div class="table-card-mark">?</div></div><div class="table-card-name">'+esc(label)+'</div></div>';
}
function cardFace(role,label,extra=''){
 const d=roleDefs[role];if(!d)return cardBack(label);
 return '<div class="table-card-wrap '+extra+'"><div class="table-card table-card-face"><img src="'+roleImg(role)+'" alt="'+esc(d.name)+'"></div>'+
 '<div class="table-card-name">'+esc(label)+'</div><div class="table-card-role">'+esc(d.name)+'</div></div>';
}
function board({face={},rest=[],targets=[],restTargets=[],expelled=[]}={}){
 const n=g()?.count||3,cols=n<=5?n:n===6?3:n<=8?4:5;
 const density=n>=9?' board-very-dense':n>=7?' board-dense':n>=5?' board-medium':'';
 const restHtml=[0,1].map(i=>rest[i]?cardFace(rest[i],'おやすみ'+(i+1)):
  cardBack('おやすみ'+(i+1),restTargets.includes(i)?'data-rest="'+i+'"':'')).join('');
 const items=(g()?.members||[]).map(p=>{
  const chosen=selected.includes(p.id)?' selected':'',out=expelled.includes(p.id)?' table-card-expelled':'';
  return face[p.id]?cardFace(face[p.id],p.name,out+' table-card-current'):
   cardBack(p.name,targets.includes(p.id)?'data-target="'+esc(p.id)+'"':'',chosen+out);
 }).join('');
 return '<div class="table-board'+density+'" style="--player-cols:'+cols+'">'+
  '<div class="table-zone"><div class="table-zone-title">おやすみ</div><div class="table-card-row table-rest-row">'+restHtml+'</div></div>'+
  '<div class="table-zone"><div class="table-zone-title">参加者</div><div class="table-card-row table-player-row">'+items+'</div></div></div>';
}
function heading(a,b=''){return '<h1 class="title">'+esc(a)+'</h1>'+(b?'<p class="subtitle">'+esc(b)+'</p>':'')}
function tags(){return '<div class="online-role-legend"><span>ルーム '+esc(room.code)+'</span><span>'+g().count+'人参加</span><span>'+esc(me().icon)+' '+esc(me().name)+'</span></div>'}
function timerLeft(){
 const state=g();if(!state)return 0;
 return state.deadline?Math.max(0,Math.ceil((state.deadline-Date.now())/1000)):state.timerRemaining;
}
function timeText(n){n=Math.max(0,Math.ceil(n));return String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0')}
function setupScreen(){
 const game=g(),total=Object.values(game.counts).reduce((a,b)=>a+b,0),required=game.count+2;
 const valid=total===required;
 const roleRow=k=>{
  const r=roleDefs[k],n=game.counts[k],locked=k==='classmate';
  const max=k==='fake'?(game.count>=6?3:2):k==='classmate'?10:1;
  const min=k==='fake'?2:0;
  return '<div class="role-row"><span class="role-thumb-button"><img class="role-thumb" src="'+roleImg(k)+'" alt=""></span>'+
   '<div class="role-info"><div class="role-title">'+r.name+'</div><span class="side-tag '+r.side+'">'+
   (r.side==='fake'?'ニセモノ':r.side==='trick'?'クセモノ':'ホンモノ')+'</span></div>'+
   '<div class="role-count-controls">'+
   button('−','data-role="'+k+'" data-delta="-1" '+(!isHost()||locked||n<=min?'disabled':''),'secondary role-step')+
   '<span class="count">'+n+'</span>'+
   button('＋','data-role="'+k+'" data-delta="1" '+(!isHost()||locked||n>=max||game.counts.classmate<1?'disabled':''),'secondary role-step')+
   '</div></div>';
 };
 const titles={basic:'基本レギュ',advanced:'応用レギュ'};
 const keys=roleTab==='advanced'?roleOrder.filter(k=>!baseRoles.includes(k)):baseRoles;
 return heading('使用する役職','人数＋おやすみ2枚ぶんのカード')+
 '<div class="online-setup-members"><details><summary>参加メンバー <strong>'+game.count+'人</strong> <span>確認する</span></summary>'+
 '<div class="online-member-list">'+game.members.map(p=>'<span>'+esc(p.icon)+' '+esc(p.name)+'</span>').join('')+'</div></details></div>'+
 '<div class="card role-select-card">'+
 '<div class="note '+(valid?'success':'warning')+'"><strong>カード '+total+' / '+required+'枚</strong><span>ニセ転校生は2枚から。クラスメイトは自動調整。</span></div>'+
 '<div class="nise-role-tabs" role="group" aria-label="役職の種類">'+
 ['basic','advanced'].map(tab=>button(titles[tab],'data-role-tab="'+tab+'" aria-pressed="'+(roleTab===tab)+'" ',roleTab===tab?'selected':'secondary')).join('')+
 '</div>'+
 '<div class="role-reg-group '+roleTab+'"><div class="role-reg-heading"><div><strong>'+titles[roleTab]+'</strong><span>'+(roleTab==='basic'?'まずはここから':'慣れてきたら追加')+'</span></div><span class="role-reg-badge">'+(roleTab==='basic'?'おすすめ':'アレンジ')+'</span></div>'+
 keys.map(roleRow).join('')+'</div></div>'+
 '<div class="online-setup-bottom"><div class="online-duration"><span>話し合い時間</span><div class="online-duration-options">'+
 [120,180,300,420].map(n=>button(n/60+'分','data-duration="'+n+'" aria-pressed="'+(game.duration===n)+'" '+(!isHost()?'disabled':''),game.duration===n?'selected':'secondary')).join('')+
 '</div></div>'+
 (isHost()?button('役職を配る','data-game-begin '+(!connected()||!valid?'disabled':''),'yellow full'):
 '<p class="online-host-hint">ホストが設定中。役職が配られるまで待ってね。</p>')+'</div>';
}

function privateCard(role){
 if(!role)return '';
 const d=roleDefs[role];return '<div class="online-secret-info"><img class="role-card-large" src="'+roleImg(role)+'" alt="'+esc(d.name)+'"><h2 class="night-role '+d.side+'">'+esc(d.name)+'</h2><p class="role-desc">'+esc(d.desc)+'</p></div>';
}
function revealScreen(){
 const game=g(),done=(game.myRevealed||false);
 return heading('自分の役職を確認','ほかの人に見せずに確認してね')+tags()+
 (done?'<div class="card online-wait">役職を確認したよ。<br>ほかの人の確認が終わるまで待ってね。</div>':
 '<div class="card online-role-private '+(hold?'revealed':'')+'"><p class="online-note">下のボタンを長押ししている間だけ、自分の役職を表示するよ。</p>'+
 privateCard(game.myRole)+button('長押しして役職を見る','data-hold-secret','secondary full online-secret-hold')+
 button('役職を確認した','data-reveal-done '+(!peeked?'disabled':''),'yellow full')+'</div>')+
 '<p class="online-progress-bar">'+game.revealedCount+' / '+game.count+'人が確認済み</p>'+board();
}
function nightScreen(){
 const game=g(),role=game.myRole;
 if(!game.nightIsMyTurn)return heading('休み時間','順番に自分の行動を確認中')+tags()+board()+
  '<div class="card online-wait">ほかの人が休み時間の行動中。<br>あなたの番になったら、この画面で操作できるよ。</div>';
 let face={},targets=[],restTargets=[],detail='';
 face[myId()]=role;
 if(role==='fake'){
  for(const p of game.partners||[])face[p.id]='fake';
  detail='<p>ほかのニセ転校生：'+((game.partners||[]).length?(game.partners||[]).map(p=>esc(p.icon)+' '+esc(p.name)).join('、'):'いません')+'</p>';
 }else if(role==='president'&&!game.myIntel){
  targets=game.members.filter(p=>p.id!==myId()).map(p=>p.id);
  restTargets=[0,1];detail='<p>参加者1人の役職か、おやすみ2枚を確認しよう。カードをタップしてね。</p>';
 }else if(role==='dayDuty'&&!game.myIntel){
  restTargets=[0,1];detail='<p>おやすみカード1枚をタップして確認しよう。</p>';
 }else if(role==='observer'&&!game.myIntel){
  targets=game.members.filter(p=>p.id!==myId()).map(p=>p.id);
  detail='<p>参加者2人を選んで、同じ陣営かどうかを調べよう。</p><p class="online-count">'+selected.length+' / 2人選択中</p>'+
  button('2人を確認する','data-observe '+(selected.length!==2?'disabled':''),'yellow full');
 }else if(role==='swapper'&&!game.myIntel){
  targets=game.members.filter(p=>p.id!==myId()).map(p=>p.id);
  detail='<p>交換したい参加者のカードをタップしよう。交換せずに進んでもOK。</p>'+
  button('交換しない','data-skip-swap','secondary full');
 }else if(!['fake','classmate','collaborator','trickster'].includes(role))detail='<p>調査が終わったよ。</p>';
 const intel=game.myIntel;
 let info='';
 if(intel){
  if(intel.kind==='player')info='<p>'+nameOf(intel.target)+' さんの役職</p>'+privateCardResult(intel.role);
  else if(intel.kind==='rest')info='<p>おやすみカードの結果</p>'+intel.roles.map(privateCardResult).join('');
  else if(intel.kind==='compare')info='<p>'+intel.targets.map(nameOf).join(' と ')+' は<strong>'+(intel.same?'同じ陣営':'違う陣営')+'</strong></p>';
  else if(intel.kind==='swap')info='<p>'+nameOf(intel.target)+' さんと交換しました。<br>あなたの新しい役職は…</p>'+privateCardResult(intel.role);
  else if(intel.kind==='skip')info='<p>今回は交換しませんでした。</p>'+privateCardResult(intel.role);
 }
 const canFinish=!!intel||['fake','classmate','collaborator','trickster'].includes(role);
 return heading('休み時間の行動',esc(me().name)+' さんの番')+tags()+
 board({face,targets,restTargets})+
 '<div class="card online-day-result"><h2>'+esc(roleDefs[role].name)+'</h2>'+detail+info+
 (canFinish?button('確認した！ 次へ','data-night-done','yellow full'):'')+'</div>';
}
function privateCardResult(role){
 if(!roleDefs[role])return '';
 return '<div class="online-research"><img class="role-card-large" src="'+roleImg(role)+'" alt="'+esc(roleDefs[role].name)+'"><strong>'+esc(roleDefs[role].name)+'</strong></div>';
}
function chatScreen(){
 const msgs=(g()?.chat||[]).map(m=>
  '<div class="online-chat-line'+(m.id===myId()?' own':'')+'"><strong>'+nameOf(m.id)+'</strong><span>'+esc(m.text)+'</span></div>'
 ).join('');
 return '<details class="online-chat-panel" '+(chatOpen?'open':'')+'><summary>オンラインチャット <span>'+((g()?.chat||[]).length)+'件</span></summary>'+
 '<div class="online-chat-inner"><p class="online-note">話し合い中だけ使えるよ。個人情報は書かずに楽しく話そう。</p>'+
 '<div class="online-chat-list" id="chat-log" role="log" aria-label="話し合いの会話">'+(msgs||'<p class="online-note">まずはあいさつしてみよう！</p>')+'</div>'+
 '<form class="online-chat-form" data-chat-form><input id="chat-input" name="chat" type="text" maxlength="120" autocomplete="off" placeholder="メッセージを入力" aria-label="チャットメッセージ" required>'+
 '<button class="btn" type="submit">送信</button></form></div></details>';
}

function discussionScreen(){
 const game=g(),running=!!game.deadline;
 return heading('話し合い','ニセ転校生は誰？')+tags()+board()+
 '<div class="card online-timer-panel"><div class="timer-main-row"><div class="timer timer-large" data-timer>'+timeText(timerLeft())+'</div>'+
 button(running?'一時停止':'スタート','data-timer-action="toggle" '+(!isHost()?'disabled':''),'timer-main-toggle')+'</div>'+
 '<div class="timer-adjust-grid">'+[[-60,'−1分'],[60,'＋1分'],[-10,'−10秒'],[10,'＋10秒']].map(([n,title])=>button(title,'data-timer-adjust="'+n+'" '+(!isHost()?'disabled':''),'secondary')).join('')+'</div>'+
 '<p class="online-note">時間が0でも自動で投票には進まないよ。</p></div>'+
 (isHost()?button('投票へ','data-start-vote','danger full online-primary-action'):
 '<p class="online-progress-bar">ホストが投票画面へ進めるよ</p>')+
 '<details class="online-private-check"><summary>自分の役職をもう一度確認</summary>'+
 '<div class="online-role-private '+(hold?'revealed':'')+'">'+privateCard(game.myRole)+
 button('長押しして役職を見る','data-hold-secret','secondary full online-secret-hold')+'</div></details>'+
 chatScreen();
}

function votingScreen(){
 const game=g(),others=game.members.filter(m=>m.id!==myId()).map(m=>m.id);
 const details=game.myVoted?'<div class="online-vote-wait">投票したよ。<br>ほかの人が投票を終えるまで待ってね。</div>':
 (votePick?'<div class="card online-vote-confirm"><h2>'+nameOf(votePick)+' さんに投票する？</h2>'+
 button('この人に投票する','data-confirm-vote','yellow full')+
 button('選び直す','data-clear-vote','secondary full')+'</div>':'<div class="card"><p>怪しい人のカードをタップしてね。自分には投票できないよ。</p></div>');
 return heading('ニセ転校生を探そう','1人だけ選んで秘密投票')+tags()+
 board({targets:game.myVoted?[]:others})+details+
 '<p class="online-progress-bar">'+game.votedCount+' / '+game.count+'人が投票済み</p>';
}
function resultScreen(){
 const game=g(),r=game.result;
 if(!r)return '<div class="card online-wait">投票結果を集計しています…</div>';
 const logos={real:'result_honmono_side_win.png',fake:'result_nisemono_side_win.png',trick:'result_kusemono_side_win.png',peace:'result_peaceful_class.png'};
 const names=r.expelled.length?r.expelled.map(id=>member(id).name).join('、'):'だれも選ばれませんでした';
 const rows=game.members.map(m=>'<div><span>'+esc(m.icon)+' '+esc(m.name)+' → '+nameOf(r.votes[m.id])+'</span><strong>'+r.tally[m.id]+'票</strong></div>').join('');
 return '<div class="card result-hero result-'+r.kind+'"><img class="result-logo" src="../../'+logos[r.kind]+'" alt="'+esc(r.winner)+'">'+
 '<p class="result-reason">最多 '+r.max+'票：'+esc(names)+'</p></div>'+
 board({face:r.final,rest:r.rest,expelled:r.expelled})+
 '<div class="online-result-actions">'+
 '<details class="nise-result-details"><summary>投票結果・内訳を見る</summary><div class="nise-result-detail-body">'+
 '<div class="online-results-votes">'+rows+'</div>'+
 '<p class="online-note">役職は席替え後の状態です。</p></div></details>'+
 (isHost()?button('もう一回遊ぶ','data-rematch','yellow full')+
 button('役職を選び直す','data-roles-again','secondary full')+
 button('部屋にもどる','data-stop','secondary full'):
 '<p class="online-progress-bar">ホストが次のゲームを準備しているよ</p>')+
 '</div>';
}

function fitBoardCards(){
 const frame=$('game-root')?.querySelector('.nise-play-board');
 const boardEl=frame?.querySelector('.table-board');
 if(!frame||!boardEl)return;
 const n=g()?.count||3,cols=n<=5?n:n===6?3:n<=8?4:5;
 const width=frame.clientWidth||window.innerWidth-30;
 const height=frame.clientHeight||Math.max(190,window.innerHeight*.38);
 const rows=Math.ceil(n/cols);
 const byWidth=Math.floor((width-22-(cols-1)*4)/cols);
 const byHeight=Math.floor((height-50)/(rows===1?2.9:4.55));
 const size=Math.max(28,Math.min(90,byWidth,byHeight));
 boardEl.style.setProperty('--card-size',size+'px');
}
function onlineLayout(stage){
 const root=$('game-root');
 root.className=stage==='setup'?'nise-online-setup':'nise-play-shell';
 $('app').classList.toggle('nise-online-playing',stage!=='setup');
 $('app').classList.toggle('nise-online-setting',stage==='setup');
 if(stage==='setup')return;
 const head=document.createElement('header');head.className='nise-play-head';
 const boardArea=document.createElement('section');boardArea.className='nise-play-board';boardArea.setAttribute('aria-label','おやすみと参加者のカード');
 const actions=document.createElement('section');actions.className='nise-play-actions';actions.setAttribute('aria-label','この画面の操作');
 const elems=[...root.children];
 for(const elem of elems){
  if(elem.classList.contains('table-board'))boardArea.appendChild(elem);
  else if(['title','subtitle','online-role-legend','result-hero'].some(x=>elem.classList.contains(x)))head.appendChild(elem);
  else actions.appendChild(elem);
 }
 root.append(head,boardArea,actions);
 fitBoardCards();
}
function render(){
 if(!room||!g())return;
 const game=g(),key=game.stage+':'+(game.nightIsMyTurn?'active':'wait')+':'+game.myRole;
 if(key!==lastStage){lastStage=key;selected=[];votePick='';peeked=false;hold=false;chatOpen=false;window.scrollTo?.({top:0,behavior:'instant'})}
 const html={setup:setupScreen,reveal:revealScreen,night:nightScreen,discussion:discussionScreen,voting:votingScreen,result:resultScreen}[game.stage];
 const draftBefore=$('chat-input'),draft=draftBefore?.value||'';
 const hadFocus=document.activeElement===draftBefore&&!!draftBefore;
 const actionsScroll=$('game-root').querySelector('.nise-play-actions')?.scrollTop||0;
 $('game-root').innerHTML=html?html():'<div class="card online-wait">画面を準備しています…</div>';
 onlineLayout(game.stage);
 if(game.stage!=='setup'){
  const area=$('game-root').querySelector('.nise-play-actions');
  if(area)area.scrollTop=actionsScroll;
 }
 if(game.stage==='discussion'){
  updateTimer();
  const input=$('chat-input');if(input){input.value=draft;if(hadFocus)input.focus({preventScroll:true})}
  const log=$('chat-log');if(log)log.scrollTop=log.scrollHeight;
 }
}

function updateTimer(){
 const t=document.querySelector('[data-timer]');
 if(t)t.textContent=timeText(timerLeft());
}
function moveLobby(){
 stopped=true;if(ws){ws.onclose=null;ws.close();ws=null}
 location.replace('../?room='+encodeURIComponent(session.code));
}
function connect(){
 if(stopped)return;
 if(ws){const old=ws;ws=null;old.onclose=null;try{old.close()}catch{}}
 $('connection').textContent='接続中…';$('connection').classList.remove('connected');
 const url=base.replace(/^http/,'ws')+'/api/rooms/'+session.code+'/ws?token='+encodeURIComponent(session.token);
 const current=new WebSocket(url);ws=current;
 current.onopen=()=>{if(ws!==current)return;retry=0;$('connection').textContent='接続中';$('connection').classList.add('connected');notice('')};
 current.onmessage=e=>{
  if(ws!==current)return;
  let packet;try{packet=JSON.parse(e.data)}catch{return}
  if(['welcome','room'].includes(packet.type)){
   room=packet.room;
   if(room.phase!=='nise'){moveLobby();return}
   render();
  }else if(packet.type==='left'){sessionStorage.removeItem(STORE);stopped=true;location.replace(exitToList?'../../games/':'../');}
  else if(packet.type==='error')notice(packet.error||'操作に失敗しました');
 };
 current.onclose=e=>{
  if(ws!==current||stopped)return;
  ws=null;$('connection').textContent='再接続中';$('connection').classList.remove('connected');
  if([4000,4002,4003].includes(e.code)){sessionStorage.removeItem(STORE);stopped=true;location.replace('../');return}
  retry=Math.min(retry+1,6);
  retryHandle=setTimeout(connect,Math.min(1000*2**(retry-1),15000));
 };
 current.onerror=()=>{};
}
function action(event){
 const b=event.target.closest('button,[data-target],[data-rest]');if(!b||b.disabled||!connected()||!g())return;
 const game=g();
 if(b.hasAttribute('data-role-tab')&&game.stage==='setup'){roleTab=b.dataset.roleTab==='advanced'?'advanced':'basic';render();return}
 if(b.hasAttribute('data-role')&&isHost()&&game.stage==='setup'){
  const k=b.dataset.role,n=Number(b.dataset.delta),counts={...game.counts};
  if(k==='classmate'||!roleDefs[k]||![-1,1].includes(n))return;
  const max=k==='fake'?(game.count>=6?3:2):1,min=k==='fake'?2:0;
  if(counts[k]+n<min||counts[k]+n>max||counts.classmate-n<0)return;
  counts[k]+=n;counts.classmate-=n;send({type:'nise-config',counts});return;
 }
 if(b.dataset.duration&&isHost()&&game.stage==='setup'){send({type:'nise-config',duration:Number(b.dataset.duration)});return}
 if(b.hasAttribute('data-game-begin')&&isHost()){send({type:'nise-begin'});return}
 if(b.hasAttribute('data-reveal-done')&&game.stage==='reveal'&&peeked){send({type:'nise-reveal-done'});return}
 if(b.hasAttribute('data-night-done')&&game.nightIsMyTurn){send({type:'nise-night-done'});return}
 if(b.hasAttribute('data-observe')&&game.nightIsMyTurn&&selected.length===2){
  send({type:'nise-night-action',kind:'compare',targets:selected});return;
 }
 if(b.hasAttribute('data-skip-swap')&&game.nightIsMyTurn){send({type:'nise-night-action',kind:'skip'});return}
 if(b.hasAttribute('data-target')){
  const target=b.dataset.target;
  if(game.stage==='night'&&game.nightIsMyTurn&&!game.myIntel){
   const role=game.myRole;
   if(role==='observer'){
    selected=selected.includes(target)?selected.filter(x=>x!==target):selected.length<2?[...selected,target]:[selected[1],target];
    render();return;
   }
   if(role==='president'){
    if(window.confirm(nameOf(target).replace(/&#39;/g,"'")+' さんの役職を見る？'))
      send({type:'nise-night-action',kind:'player',target});return;
   }
   if(role==='swapper'){
    if(window.confirm('本当に役職を交換する？\n席替え後は変更できないよ。'))
      send({type:'nise-night-action',kind:'swap',target});return;
   }
  }
  if(game.stage==='voting'&&!game.myVoted&&target!==myId()){votePick=target;render();return}
 }
 if(b.hasAttribute('data-rest')&&game.stage==='night'&&game.nightIsMyTurn&&!game.myIntel){
  if(!window.confirm('このおやすみカードを確認する？'))return;
  const role=game.myRole;
  if(role==='president')send({type:'nise-night-action',kind:'rest'});
  else if(role==='dayDuty')send({type:'nise-night-action',kind:'rest',index:Number(b.dataset.rest)});
  return;
 }
 if(b.hasAttribute('data-clear-vote')){votePick='';render();return}
 if(b.hasAttribute('data-confirm-vote')&&game.stage==='voting'&&votePick!==myId()){send({type:'nise-vote',target:votePick});return}
 if(b.hasAttribute('data-timer-action')&&isHost()&&game.stage==='discussion'){send({type:'nise-timer',kind:'toggle'});return}
 if(b.hasAttribute('data-timer-adjust')&&isHost()&&game.stage==='discussion'){
  send({type:'nise-timer',kind:'adjust',amount:Number(b.dataset.timerAdjust)});return;
 }
 if(b.hasAttribute('data-start-vote')&&isHost()&&game.stage==='discussion'){
  if(window.confirm('話し合いを終了して、全員の秘密投票を始める？'))send({type:'nise-start-vote'});return;
 }
 if(b.hasAttribute('data-rematch')&&isHost()&&game.stage==='result'){send({type:'nise-rematch'});return}
 if(b.hasAttribute('data-roles-again')&&isHost()&&game.stage==='result'){send({type:'nise-rematch',resetRoles:true});return}
 if(b.hasAttribute('data-stop')&&isHost())send({type:'nise-stop'});
}
$('game-root').addEventListener('click',action);
$('game-root').addEventListener('keydown',e=>{
 const card=e.target.closest('[data-target],[data-rest]');
 if(!card||!['Enter',' '].includes(e.key))return;
 e.preventDefault();card.click();
});
$('game-root').addEventListener('toggle',event=>{
 if(event.target.matches('.online-chat-panel'))chatOpen=event.target.open;
},true);
window.addEventListener('resize',fitBoardCards);
window.visualViewport?.addEventListener('resize',fitBoardCards);
$('game-root').addEventListener('submit',event=>{
 if(!event.target.matches('[data-chat-form]'))return;
 event.preventDefault();
 const input=event.target.elements.chat;
 const text=String(input?.value||'').trim().slice(0,120);
 if(text&&send({type:'nise-chat',text}))input.value='';
});

function holdStart(e){
 const button=e.target.closest('[data-hold-secret]');
 if(!button)return;
 e.preventDefault();
 try{button.setPointerCapture(e.pointerId)}catch{}
 hold=true;peeked=true;
 button.closest('.online-role-private')?.classList.add('revealed');
 const done=$('game-root').querySelector('[data-reveal-done]');if(done)done.disabled=false;
}
function holdEnd(e){
 if(!hold)return;
 hold=false;
 $('game-root').querySelectorAll('.online-role-private').forEach(node=>node.classList.remove('revealed'));
}
$('game-root').addEventListener('pointerdown',holdStart);
for(const event of ['pointerup','pointercancel','pointerleave','lostpointercapture'])$('game-root').addEventListener(event,holdEnd);
$('game-root').addEventListener('keydown',e=>{if(e.target.closest('[data-hold-secret]')&&['Enter',' '].includes(e.key)){e.preventDefault();holdStart({target:e.target,preventDefault(){},pointerId:-1})}});
$('game-root').addEventListener('keyup',e=>{if(['Enter',' '].includes(e.key))holdEnd()});
window.addEventListener('blur',holdEnd);
document.addEventListener('visibilitychange',()=>{if(document.hidden)holdEnd()});
$('game-list-link').addEventListener('click',e=>{
 if(room?.phase==='nise'){
  e.preventDefault();
  if(!window.confirm('ゲームを抜けて、ゲーム一覧へ移動する？\nプレイ中なら部屋の試合は終了するよ。'))return;
  exitToList=true;
  if(!send({type:'leave'}))location.href='../../games/';
 }
});
$('return-lobby').addEventListener('click',e=>{
 if(room?.phase==='nise'){
  e.preventDefault();
  if(!window.confirm('ゲームを終了して部屋に戻る？\nホストが終了すると全員ロビーへ戻るよ。'))return;
  if(isHost())send({type:'nise-stop'});
  else send({type:'leave'});
 }
});
countdownHandle=setInterval(updateTimer,500);
connect();
})();
