/* 放課後ゲーム部 / みんなはどっち？ ONLINE 2モード */
(()=>{
'use strict';
const $=id=>document.getElementById(id);
const STORE='houkago-online-session-v1';
const CUSTOM_STORE='houkago_docchi_custom_v1';
const base=String(window.HOUKAGO_ONLINE_API_URL||'').replace(/\/$/,'');
const params=new URLSearchParams(location.search),requested=params.get('room')||'';
let session=null,room=null,ws=null,voted=false,myChoice=null,predicted=false,retry=0,timer=null,exiting=false,composing=false,lastScreenKey='';
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
function renderCategories(g){
 const list=$('category-options');
 list.replaceChildren();
 const selected=g.selectedCategories||[];
 for(const category of g.categories||[]){
  const special=['恋バナ','ちょっとディープ'].includes(category);
   const button=addText('button',category,'category-chip'+(selected.includes(category)?' selected':'')+(special?' deep':''));
   if(special)button.append(addText('small',' 任意'));
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
  const button=addText('button',count+'問','choice-chip'+(count===g.roundCount?' selected':''));
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
 const available=Number(g.poolCount)||0;
 $('question-total').replaceChildren(document.createTextNode('この設定で出るお題：'));
 $('question-total').append(addText('strong',available+'問'));
 $('custom-count').textContent='保存中 '+storedQuestions().length+'問';
 const stored=storedQuestions();
 $('import-saved').disabled=!socketReady()||stored.length===0||(g.customQuestions||[]).length>=20;
 $('import-saved').textContent='保存済みのお題を読み込む（'+stored.length+'問）';
 $('begin').disabled=!socketReady()||available<g.roundCount;
}
function draw(){
 if(!room)return;
 if(room.phase!=='secret'){goLobby();return}
 window.HoukagoBackGuard?.setActive?.(true);
 const g=room.secret||{},myHost=host(),stage=g.stage||'setup';
 $('game-shell').hidden=false;
 $('member-panel').hidden=false;
 const titles={setup:'ジャンル・お題',preview:'お題の確認',voting:'自分の回答',allAnswered:'全員の回答が完了',
  result:g.round+'問目の結果',finished:'ひみつ投票 おわり！'};
 const displayStage=stage==='preview'&&composing&&myHost?'compose':stage;
 if(stage!=='preview')composing=false;
 $('page-heading').textContent=stage==='preview'&&displayStage!=='compose'?
   g.round+' / '+g.roundCount+'問':
   displayStage==='compose'?'お題を考える':titles[stage]||'みんなはどっち？';
 document.querySelector('.online-docchi').className='docchi-app online-docchi screen-'+
   (stage==='setup'?'options':stage==='voting'?'answer':displayStage);
 const screenKey=stage+':'+g.round+':'+(g.question?.q||'')+':'+(displayStage==='compose'?'compose':'');
 if(lastScreenKey!==screenKey){
   lastScreenKey=screenKey;
   if(typeof window.scrollTo==='function')window.scrollTo({top:0,behavior:'instant'});
 }
 $('progress-header').hidden=stage==='setup'||stage==='preview';
 $('room-brief').textContent=stage==='preview'&&displayStage!=='compose'?
   'まずは全員でお題を確認':
   'オンライン · ひみつ投票 ／ '+room.members.length+'人参加 · 招待コード '+room.code;
 $('stage-label').textContent=stage==='setup'?'ゲームの準備':stage==='preview'?'お題確認中':stage==='voting'?'回答中':stage==='allAnswered'?'全員回答完了':stage==='result'?'結果発表':stage==='finished'?'ゲーム終了':'準備中';
 $('round-info').textContent=stage==='setup'?'':g.round+' / '+g.roundCount+'問';
 $('member-count').textContent=room.members.length+'人';
 const memberList=$('member-list');memberList.replaceChildren();
 for(const m of room.members){
  memberList.append(addText('span',(m.icon||'')+' '+m.name+(m.id===room.hostId?'［ホスト］':''),'member-chip'));
 }
 for(const id of ['setup-stage','question-stage','compose-stage','vote-stage','all-answered-stage','result-stage','finished-stage'])$(id).hidden=true;
 // Worker protocol sends "voting", while the DOM section is "vote-stage".
 // Keep an explicit mapping so a valid phase can never silently blank the screen.
 const sectionByStage={setup:'setup-stage',preview:displayStage==='compose'?'compose-stage':'question-stage',
  voting:'vote-stage',allAnswered:'all-answered-stage',result:'result-stage',finished:'finished-stage'};
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
 if(stage==='preview'){
   const q=g.question||{},sensitive=['恋バナ','ちょっとディープ'].includes(q.category);
   $('preview-category').textContent=q.category||'お題';
   $('preview-category').classList.toggle('deep',sensitive);
   $('preview-question').textContent=q.q||'お題を準備しています…';
   $('preview-a').textContent=q.a||'A';
   $('preview-b').textContent=q.b||'B';
   $('preview-sensitive').hidden=!sensitive||displayStage==='compose';
   $('preview-host-controls').hidden=!myHost;
   $('preview-guest-wait').hidden=myHost;
   $('accept-question').disabled=!socketReady()||!q.q;
   $('change-question').disabled=!socketReady()||!g.alternatives;
   $('change-question').textContent=g.alternatives?'別のお題にする':'別のお題がありません';
   $('compose-question').disabled=!socketReady();
   $('use-round-question').disabled=!socketReady();
 }
 if(stage==='voting'){
  const q=g.question||{};
  $('question-category').textContent=q.category||'お題';
  $('question-category').classList.toggle('deep',['恋バナ','ちょっとディープ'].includes(q.category));
  $('question-text').textContent=q.q||'お題を確認しています…';
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
  const q=g.question||{},c=g.counts||{a:0,b:0};
  $('result-question').textContent=q.q||'';
  $('result-a-text').textContent=q.a||'';
  $('result-b-text').textContent=q.b||'';
  $('result-a-count').textContent=(c.a||0)+'人';
  $('result-b-count').textContent=(c.b||0)+'人';
  $('next-round').hidden=!myHost;$('next-round').disabled=!socketReady();
  $('next-round').textContent=g.round>=g.roundCount?'おわる':'次のお題へ';
  $('next-wait').hidden=myHost;
 }
 if(stage==='finished'){
  $('finish-return').hidden=!myHost;
  $('finish-return').disabled=!socketReady();
  $('finish-wait').hidden=myHost;
 }
 $('leave-room').textContent=myHost?'ゲームを中止して全員をロビーへ戻す':'部屋から退出する';
}
// Preserve the existing secret-vote rendering, then layer battle-only stages on top.
const baseDraw=draw;
let rosterLayout='';
draw=function(){
 baseDraw();
 if(!room||room.phase!=='secret')return;
 const g=room.secret||{},isHost=host(),battle=g.mode==='battle',stage=g.stage;
 const pending=stage==='setup'&&!g.modeSelected;
 const root=document.querySelector('.online-docchi');
 root.classList.toggle('online-mode-select',pending);
 root.classList.toggle('online-setup-select',stage==='setup'&&!pending);
 const layout=stage==='setup'?'setup':'playing';
 if(rosterLayout!==layout){$('member-panel').open=layout==='playing';rosterLayout=layout;}
 $('mode-stage').hidden=!pending;
 $('mode-host').hidden=!isHost;
 $('mode-guest').hidden=isHost;
 $('choose-battle').disabled=$('choose-secret').disabled=!socketReady();
 if(pending){
   $('setup-stage').hidden=true;
   $('page-heading').textContent='モードをえらぶ';
   $('progress-header').hidden=true;
 }
 if(stage==='setup'){
   $('setup-stage').hidden=pending;
   if(!pending)$('secret-genre-note').hidden=battle;
 }
 if(stage==='voting'&&battle){
   $('vote-stage').hidden=!!myChoice;
   $('predict-stage').hidden=!myChoice||predicted;
   $('prediction-wait-stage').hidden=!myChoice||!predicted;
   $('page-heading').textContent=myChoice?(predicted?'回答しました':'みんなの答えを予想'):'自分の回答';
   const q=g.question||{};
   $('predict-selected').textContent='あなたが選んだのは「'+(myChoice==='a'?q.a:q.b)+'」';
   $('predict-majority').disabled=$('predict-minority').disabled=!socketReady()||predicted;
   $('prediction-wait-status').textContent='回答完了 '+g.answered+' / '+g.total+'人';
   const privacy=document.querySelector('.online-privacy-hint');if(privacy)privacy.hidden=true;
 }
 if(stage==='result'){
   $('anonymous-banner').hidden=battle;
   $('secret-talk').hidden=battle;
   $('battle-result-details').hidden=!battle;
   $('next-round').textContent=g.round>=g.roundCount?(battle?'最終結果を見る':'おわる'):'次のお題へ';
   const list=$('battle-result-list');list.replaceChildren();
   if(battle&&g.battleResult){
     list.append(addText('p',g.battleResult.tie?'同数！ 全員0点。':'予想が当たったら1点！','online-battle-note'));
     const q=g.question||{};
     for(const p of g.battleResult.players||[]){
       const row=addText('div','','battle-result-row');
       row.append(addText('span',(p.icon||'')+' '+p.name),
         addText('strong',p.answer==='a'?q.a:q.b),
         addText('em',p.prediction==='majority'?'多数派予想':'少数派予想'),
         addText('b',p.gain?'+1点':'0点'));
       list.append(row);
     }
   }
 }
 if(stage==='finished'){
   $('page-heading').textContent=battle?'最終結果':'ひみつ投票 おわり！';
   $('final-heading').textContent=battle?'よみあいバトル終了！':'ひみつ投票 おわり！';
   $('final-description').textContent=battle?'みんなの読み合いはどうだった？':'誰がどっちを選んだかは、最後まで秘密のまま。';
   const ranking=$('battle-ranking');ranking.hidden=!battle;ranking.replaceChildren();
   if(battle){
     const sorted=[...room.members].sort((a,b)=>(g.scores?.[b.id]||0)-(g.scores?.[a.id]||0));
     let rank=0,last=null;
     sorted.forEach((p,i)=>{
       const score=g.scores?.[p.id]||0;
       if(score!==last){rank=i+1;last=score}
       const row=addText('div','','rank-row rank-'+rank);
       row.append(addText('b',rank+'位'),addText('span',p.icon+' '+p.name),addText('strong',score+'点'));
       ranking.append(row);
     });
   }
 }
 if(stage==='preview'&&battle)$('preview-sensitive').hidden=true;
 $('room-brief').textContent=stage==='preview'?'まずは全員でお題を確認':
   'オンライン · '+(battle?'よみあいバトル':'ひみつ投票')+' ／ '+room.members.length+'人参加 · 招待コード '+room.code;
 if(stage==='setup'){
   $('page-heading').textContent=pending?'モードをえらぶ':(battle?'よみあいバトル':'ひみつ投票')+'の設定';
   $('room-brief').textContent=room.members.length+'人参加 · 招待コード '+room.code;
 }
};
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
  if(data.type==='welcome'||data.type==='room'){
    room=data.room;voted=!!data.voted;myChoice=data.myChoice||null;predicted=!!data.predicted;draw()
   }
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
$('select-all').addEventListener('click',()=>{
 const g=room?.secret;if(!g||!host()||g.stage!=='setup')return;
 const all=g.categories||[],active=g.selectedCategories||[];
 send({type:'secret-config',categories:active.length===all.length?[]:[...all],
  roundCount:g.roundCount,includeCustom:g.includeCustom});
});
$('toggle-custom-list').addEventListener('click',()=>{
 const details=$('custom-details');
 details.hidden=!details.hidden;
 $('toggle-custom-list').textContent=details.hidden?'一覧':'閉じる';
});
$('game-list-link').addEventListener('click',e=>{
 e.preventDefault();
 if(!confirm('オンラインゲームを終了してゲーム一覧に戻る？'))return;
 if(host())send({type:'secret-stop'});else send({type:'leave'});
 exiting=true;
 setTimeout(()=>location.assign('../../games/'),400);
});
$('include-custom').addEventListener('change',()=>{
 const g=room?.secret;if(!g||!host())return;
 send({type:'secret-config',categories:g.selectedCategories,roundCount:g.roundCount,
  includeCustom:$('include-custom').checked});
});
for(const mode of ['battle','secret'])$('choose-'+mode).addEventListener('click',()=>{
 if(room?.secret?.stage!=='setup'||!host())return;
 send({type:'secret-mode',mode});
});
$('back-to-mode').addEventListener('click',()=>{
 if(room?.secret?.stage!=='setup'||!host())return;
 send({type:'secret-mode',mode:null});
});
$('begin').addEventListener('click',()=>send({type:'secret-begin'}));
$('accept-question').addEventListener('click',()=>{
 if(!host()||room?.secret?.stage!=='preview'||composing)return;
 send({type:'secret-accept-question'});
});
$('change-question').addEventListener('click',()=>{
 if(!host()||room?.secret?.stage!=='preview'||composing||!room.secret.alternatives)return;
 send({type:'secret-change-question'});
});
$('compose-question').addEventListener('click',()=>{
 if(!host()||room?.secret?.stage!=='preview')return;
 composing=true;draw();
});
$('back-to-preview').addEventListener('click',()=>{composing=false;draw()});
$('round-question-form').addEventListener('submit',e=>{
 e.preventDefault();
 if(!host()||room?.secret?.stage!=='preview'||!composing)return;
 const question={q:$('round-q').value.trim(),a:$('round-a').value.trim(),b:$('round-b').value.trim()};
 if(!question.q||!question.a||!question.b){say('質問とA・Bをすべて入力してね');return}
 if(send({type:'secret-use-question',question})){
   rememberQuestion(question);
   $('round-q').value='';$('round-a').value='';$('round-b').value='';
   composing=false;draw();
 }
});
for(const choice of ['a','b'])$('vote-'+choice).addEventListener('click',()=>{
 if(room?.secret?.stage!=='voting'||voted||!socketReady())return;
 voted=true;if(room.secret.mode==='battle')myChoice=choice;
 draw();send({type:'secret-vote',choice});
});
for(const prediction of ['majority','minority'])$('predict-'+prediction).addEventListener('click',()=>{
 if(room?.secret?.stage!=='voting'||room.secret.mode!=='battle'||!myChoice||predicted||!socketReady())return;
 predicted=true;draw();send({type:'battle-predict',prediction});
});
$('reveal').addEventListener('click',()=>send({type:'secret-reveal'}));
$('next-round').addEventListener('click',()=>send({type:'secret-next'}));
$('finish-return').addEventListener('click',()=>send({type:'secret-stop'}));
window.addEventListener('pageshow',()=>{if(!ws&&session&&!exiting)connect()});
connect();
})();