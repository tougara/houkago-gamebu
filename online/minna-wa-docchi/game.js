/* 放課後ゲーム部 / みんなはどっち？ ONLINE ひみつ投票 */
(()=>{
'use strict';
const $=id=>document.getElementById(id);
const STORE='houkago-online-session-v1';
const CUSTOM_STORE='houkago_docchi_custom_v1';
const base=String(window.HOUKAGO_ONLINE_API_URL||'').replace(/\/$/,'');
const params=new URLSearchParams(location.search),requested=params.get('room')||'';
let session=null,room=null,ws=null,voted=false,retry=0,timer=null,exiting=false;
try{session=JSON.parse(sessionStorage.getItem(STORE)||'null')}catch{}
if(!session||!/^[A-Z2-9]{8}$/.test(session.code)||!/^[a-f0-9]{64}$/.test(session.token)||
 (requested&&requested!==session.code)||!/^https:\/\/[a-z0-9.-]+$/i.test(base)){
 location.replace('../'+(requested?'?room='+encodeURIComponent(requested):''));
 return;
}
const host=()=>room?.hostId===session.id;
function storedQuestions(){
 try{
  const items=JSON.parse(localStorage.getItem(CUSTOM_STORE)||'[]');
  return Array.isArray(items)?items.filter(q=>q&&typeof q.q==='string'&&typeof q.a==='string'&&typeof q.b==='string'):[];
 }catch{return []}
}
function rememberQuestion(q){
 try{
  const items=storedQuestions();
  if(!items.some(x=>x.q===q.q&&x.a===q.a&&x.b===q.b)){
   items.push(q);localStorage.setItem(CUSTOM_STORE,JSON.stringify(items.slice(-100)));
  }
 }catch{}
}
const socketReady=()=>ws?.readyState===WebSocket.OPEN;
const say=(message,ok=false)=>{const el=$('notice');el.hidden=!message;el.textContent=message||'';el.classList.toggle('ok',ok)};
const send=message=>{if(socketReady()){ws.send(JSON.stringify(message));return true}say('通信が切れているよ。再接続まで待ってね。');return false};
function goLobby(clear=false){
 if(clear)sessionStorage.removeItem(STORE);
 if(ws){ws.onclose=null;ws.onerror=null;ws.close();ws=null}
 location.replace('../'+(clear?'':'?room='+encodeURIComponent(session.code)));
}
function addText(tag,text,cls){
 const e=document.createElement(tag);e.textContent=text;if(cls)e.className=cls;return e;
}
function setSections(stage){
 for(const id of ['setup-stage','vote-stage','all-answered-stage','result-stage','finished-stage'])
  $(id).hidden=id!==stage+'-stage';
}
function renderCategories(g){
 const list=$('category-options');
 list.replaceChildren();
 const selected=g.selectedCategories||[];
 for(const category of g.categories||[]){
  const button=addText('button',category,'option-btn'+(selected.includes(category)?' selected':''));
  button.type='button';button.disabled=!socketReady();
  button.addEventListener('click',()=>{
   const updated=selected.includes(category)?selected.filter(c=>c!==category):[...selected,category];
   send({type:'secret-config',categories:updated,roundCount:g.roundCount,includeCustom:g.includeCustom});
  });
  list.append(button);
 }
}
function renderRounds(g){
 const list=$('round-options');list.replaceChildren();
 for(const count of [3,5,7,10]){
  const button=addText('button',count+'問',count===g.roundCount?'selected':'');
  button.type='button';button.disabled=!socketReady();
  button.addEventListener('click',()=>send({type:'secret-config',categories:g.selectedCategories,
    roundCount:count,includeCustom:g.includeCustom}));
  list.append(button);
 }
}
function renderCustom(g){
 const list=$('custom-list');list.replaceChildren();
 (g.customQuestions||[]).forEach((q,i)=>{
  const row=addText('div','','custom-item');
  const label=addText('span',q.q+'　A：'+q.a+' ／ B：'+q.b);
  const remove=addText('button','削除');remove.type='button';remove.disabled=!socketReady();
  remove.addEventListener('click',()=>send({type:'secret-custom-delete',index:i}));
  row.append(label,remove);list.append(row);
 });
 $('question-total').textContent='選択中：'+(g.selectedCategories||[]).length+'ジャンル · マイお題 '+(g.customQuestions||[]).length+'問（最大20問）';
 const stored=storedQuestions();
 $('import-saved').disabled=!socketReady()||stored.length===0||(g.customQuestions||[]).length>=20;
 $('import-saved').textContent='保存済みのお題を読み込む（'+stored.length+'問）';
 const hasBuiltin=(g.selectedCategories||[]).length>0;
 const hasCustom=g.includeCustom&&(g.customQuestions||[]).length>=g.roundCount;
 $('begin').disabled=!socketReady()||(!hasBuiltin&&!hasCustom);
}
function draw(){
 if(!room)return;
 if(room.phase!=='secret'){goLobby();return}
 const g=room.secret||{},myHost=host(),stage=g.stage||'setup';
 $('game-shell').hidden=false;
 $('member-panel').hidden=false;
 $('room-brief').textContent='招待コード '+room.code+' ／ '+room.members.length+'人で参加中';
 $('stage-label').textContent=stage==='setup'?'ゲームの準備':stage==='voting'?'回答中':stage==='allAnswered'?'全員回答完了':stage==='result'?'結果発表':stage==='finished'?'ゲーム終了':'準備中';
 $('round-info').textContent=stage==='setup'?'':g.round+' / '+g.roundCount+'問';
 $('member-count').textContent=room.members.length+'人';
 const memberList=$('member-list');memberList.replaceChildren();
 for(const m of room.members){
  memberList.append(addText('span',(m.icon||'')+' '+m.name+(m.id===room.hostId?'［ホスト］':''),'member-chip'));
 }
 for(const id of ['setup-stage','vote-stage','all-answered-stage','result-stage','finished-stage'])$(id).hidden=true;
 // Worker protocol sends "voting", while the DOM section is "vote-stage".
 // Keep an explicit mapping so a valid phase can never silently blank the screen.
 const sectionByStage={setup:'setup-stage',voting:'vote-stage',allAnswered:'all-answered-stage',
  result:'result-stage',finished:'finished-stage'};
 const active=sectionByStage[stage];
 if(active&&$(active))$(active).hidden=false;
 else say('画面の読み込み状態が一致しません。再接続を待ってね。');
 if(stage==='setup'){
  $('host-setup').hidden=!myHost;$('guest-setup').hidden=myHost;
  if(myHost){
   renderCategories(g);renderRounds(g);renderCustom(g);
   $('include-custom').checked=!!g.includeCustom;
   $('include-custom').disabled=!socketReady();
   $('custom-q').disabled=!socketReady();$('custom-a').disabled=!socketReady();$('custom-b').disabled=!socketReady();
   $('custom-form').querySelector('button').disabled=!socketReady()||(g.customQuestions||[]).length>=20;
  }else $('guest-setup').textContent='ホストがジャンルやお題を設定中。設定が終わると全員同時にゲームが始まるよ。';
 }
 if(stage==='voting'){
  const q=g.question||{};
  $('question-category').textContent=q.category||'お題';
  $('question-text').textContent=q.q||'読み込み中';
  $('vote-a-label').textContent=q.a||'A';
  $('vote-b-label').textContent=q.b||'B';
  $('vote-a').disabled=$('vote-b').disabled=voted||!socketReady();
  $('vote-status').textContent=voted?
    '投票完了！ ほかの人の回答を待ってね。（'+g.answered+' / '+g.total+'人）':
    '自分の答えを選んでね。（回答済み '+g.answered+' / '+g.total+'人）';
 }
 if(stage==='allAnswered'){
  $('reveal').hidden=!myHost;$('reveal').disabled=!socketReady();
  $('reveal-wait').hidden=myHost;
 }
 if(stage==='result'){
  const q=g.question||{},c=g.counts||{a:0,b:0},total=Math.max(1,(c.a||0)+(c.b||0));
  $('result-question').textContent=q.q||'';
  $('result-a-text').textContent='A：'+(q.a||'');
  $('result-b-text').textContent='B：'+(q.b||'');
  $('result-a-count').textContent=(c.a||0)+'人';
  $('result-b-count').textContent=(c.b||0)+'人';
  $('result-a-bar').style.width=(100*(c.a||0)/total)+'%';
  $('result-b-bar').style.width=(100*(c.b||0)/total)+'%';
  $('next-round').hidden=!myHost;$('next-round').disabled=!socketReady();
  $('next-round').textContent=g.round>=g.roundCount?'最終結果へ':'次のお題へ';
  $('next-wait').hidden=myHost;
 }
 if(stage==='finished'){
  $('finish-return').hidden=!myHost;
  $('finish-return').disabled=!socketReady();
  $('finish-wait').hidden=myHost;
 }
 $('leave-room').textContent=myHost?'ゲームを中止して全員をロビーへ戻す':'部屋から退出する';
}
function connect(){
 if(!session)return;
 clearTimeout(timer);
 const url=base.replace(/^http/,'ws')+'/api/rooms/'+session.code+'/ws?token='+session.token;
 const current=new WebSocket(url);ws=current;
 $('connection').textContent='接続中…';
 current.onopen=()=>{if(current!==ws)return;retry=0;$('connection').textContent='接続中';$('connection').classList.add('connected');say('');draw()};
 current.onmessage=event=>{
  if(current!==ws)return;
  let data;try{data=JSON.parse(event.data)}catch{return}
  if(data.type==='welcome'||data.type==='room'){room=data.room;voted=!!data.voted;draw()}
  else if(data.type==='left')goLobby(true);
  else if(data.type==='error')say(data.error||'エラーが発生したよ');
 };
 current.onclose=event=>{
  if(current!==ws||exiting)return;
  ws=null;$('connection').textContent='再接続中…';$('connection').classList.remove('connected');
  if([4000,4002,4003].includes(event.code)){goLobby(true);return}
  retry=Math.min(7,retry+1);
  timer=setTimeout(connect,Math.min(1500*2**(retry-1),15000));
  draw();
 };
 current.onerror=()=>{};
}
$('lobby-link').addEventListener('click',e=>{
 e.preventDefault();
 if(room?.phase!=='secret'){goLobby();return}
 if(host()){
  if(confirm('オンラインゲームを中止して、全員でルームに戻る？'))send({type:'secret-stop'});
 }else if(confirm('ゲームを抜けて、オンラインルームから退出する？')){exiting=true;send({type:'leave'});setTimeout(()=>goLobby(true),500)}
});
$('leave-room').addEventListener('click',()=>{
 if(host()){
  if(confirm('ゲームを中断して、全員でオンラインルームに戻る？'))send({type:'secret-stop'});
 }else if(confirm('部屋から退出する？')){exiting=true;send({type:'leave'});setTimeout(()=>goLobby(true),500)}
});
$('custom-form').addEventListener('submit',e=>{
 e.preventDefault();
 if(!host()||room?.secret?.stage!=='setup')return;
 const question={q:$('custom-q').value.trim(),a:$('custom-a').value.trim(),b:$('custom-b').value.trim()};
 if(!question.q||!question.a||!question.b){say('質問とA・Bの答えをすべて入力してね');return}
 if(send({type:'secret-custom-add',question})){
  rememberQuestion(question);
  $('custom-q').value='';$('custom-a').value='';$('custom-b').value='';
 }
});
$('import-saved').addEventListener('click',()=>{
 if(!host()||room?.secret?.stage!=='setup'||!socketReady())return;
 const existing=room.secret.customQuestions||[];
 const seen=new Set(existing.map(q=>[q.q,q.a,q.b].join('|')));
 let count=0;
 for(const q of storedQuestions()){
  const key=[q.q,q.a,q.b].join('|');
  if(seen.has(key)||count+existing.length>=20)continue;
  if(q.q.length>70||q.a.length>30||q.b.length>30||!q.q.trim()||!q.a.trim()||!q.b.trim())continue;
  if(send({type:'secret-custom-add',question:{q:q.q,a:q.a,b:q.b}})){count++;seen.add(key)}
 }
 say(count?'保存済みから'+count+'問を読み込んだよ':'追加できるお題はなかったよ',count>0);
});
$('include-custom').addEventListener('change',()=>{
 const g=room?.secret;if(!g||!host())return;
 send({type:'secret-config',categories:g.selectedCategories,roundCount:g.roundCount,
  includeCustom:$('include-custom').checked});
});
$('begin').addEventListener('click',()=>send({type:'secret-begin'}));
for(const choice of ['a','b'])$('vote-'+choice).addEventListener('click',()=>{
 if(room?.secret?.stage!=='voting'||voted||!socketReady())return;
 voted=true;draw();send({type:'secret-vote',choice});
});
$('reveal').addEventListener('click',()=>send({type:'secret-reveal'}));
$('next-round').addEventListener('click',()=>send({type:'secret-next'}));
$('finish-return').addEventListener('click',()=>send({type:'secret-stop'}));
window.addEventListener('pageshow',()=>{if(!ws&&session&&!exiting)connect()});
connect();
})();