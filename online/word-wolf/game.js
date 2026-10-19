/* ことばのオオカミ オンライン／通話は別アプリ */
(()=>{
'use strict';
const $=id=>document.getElementById(id),STORE='houkago-online-session-v1';
const base=String(window.HOUKAGO_ONLINE_API_URL||'').replace(/\/$/,'');
const requested=new URLSearchParams(location.search).get('room')||'';
let session=null,room=null,socket=null,retry=0,retryTimer=null,leaving=false,lastStage='';
try{session=JSON.parse(sessionStorage.getItem(STORE)||'null')}catch{}
// 試遊時だけ共通プレビューの仮セッションを使用。本物の保存データは変更しない。
if(window.HoukagoOfflinePreview)session=window.HoukagoOfflinePreview.session;
if(!window.HoukagoOfflinePreview&&(!session||!/^[A-Z2-9]{8}$/.test(session.code)||!/^[a-f0-9]{64}$/.test(session.token)||
 (requested&&requested!==session.code)||!/^https:\/\/[a-z0-9.-]+$/i.test(base))){
 location.replace('../'+(requested?'?room='+encodeURIComponent(requested):''));return;
}
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const game=()=>room?.wolf||null;
const host=()=>room?.hostId===session?.id;
const person=id=>room?.members?.find(m=>m.id===id);
const label=id=>{const p=person(id);return (p?.icon||'？')+' '+(p?.name||'不明')};
const btn=(s,k,style='')=>'<button type="button" class="btn '+style+'" data-action="'+k+'">'+esc(s)+'</button>';
const send=(type,rest={})=>{if(socket?.readyState===WebSocket.OPEN){socket.send(JSON.stringify({type,...rest}));return true}notice('通信が切れているよ。再接続を待ってね。');return false};
const onlineUI=window.HoukagoOnlineUI;
function notice(s,good=false){onlineUI.notice('notice',s,good)}
function lobby(clear=false){leaving=true;if(clear)sessionStorage.removeItem(STORE);if(socket){socket.onclose=null;socket.close();socket=null}location.replace('../'+(clear?'':'?room='+encodeURIComponent(session.code)))}
const choice=(s,description,selected,value)=>'<button type="button" class="'+(selected?'selected':'')+'" data-setting="'+value+'"><strong>'+esc(s)+'</strong><small>'+esc(description)+'</small></button>';
const roster=d=>onlineUI.roster(d.members,{authorId:d.authorId});
function setup(d){
 if(!host())return '<section class="panel large-center"><h2>ホストがゲーム設定中</h2><p>ルールとお題を決めているよ。少し待ってね。</p></section>'+roster(d);
 const s=d.settings,custom=s.source==='custom';
 return '<div class="setup-columns">'+
  '<section class="panel"><h2>お題の決め方</h2><div class="choice-grid">'+
   choice('おまかせ','150ペアから自動決定',!custom,'source:auto')+
   choice('自分たちで決める','出題者1人が自由入力',custom,'source:custom')+'</div>'+
   (custom?'<label class="field-label" for="author-choice">お題を決める人（ゲームには不参加）</label><select id="author-choice" class="select">'+d.members.map(m=>'<option value="'+esc(m.id)+'" '+(s.authorId===m.id?'selected':'')+'>'+esc(m.icon+' '+m.name)+'</option>').join('')+'</select><p class="hint">このモードは4人以上必要だよ。</p>':'')+'</section>'+
  '<section class="panel"><h2>勝敗ルール</h2><div class="choice-grid">'+
   choice('シンプル','当てれば市民の勝ち',s.mode==='simple','mode:simple')+
   choice('逆転チャンスあり','オオカミがお題を推理',s.mode==='reverse','mode:reverse')+'</div></section>'+
  '<section class="panel"><h2>話し合い時間</h2><div class="time-row">'+
    [120,180,300,420].map(n=>'<button type="button" class="'+(s.duration===n?'selected':'')+'" data-setting="duration:'+n+'">'+n/60+'分</button>').join('')+
   '</div><p class="hint">話し合い中に10秒・30秒ずつ調整できるよ。</p></section>'+
  (custom?'':'<section class="panel"><h2>お題ジャンル<small>'+s.categories.length+' / '+d.categories.length+'</small></h2><div class="genre-grid">'+
   d.categories.map(cat=>'<button type="button" class="'+(s.categories.includes(cat)?'selected':'')+'" data-category="'+esc(cat)+'">'+esc(cat)+'</button>').join('')+
   '</div><p class="hint">1ジャンル以上を選んでね。</p></section>')+
 '</div><div class="action-foot">'+btn(custom?'出題者にお題を決めてもらう':'この設定でゲーム開始','begin','gold')+'</div>'+roster(d);
}
function customInput(d){
 if(!d.author)return '<section class="panel large-center"><h2>出題者がお題を作っているよ</h2><p>'+esc(label(d.authorId))+' さんの入力を待ってね。<br>入力内容はプレイヤーには表示されないよ。</p></section>';
 return '<section class="panel"><h2>オリジナルのお題を作ろう</h2><p class="hint">あなたは今回は出題者なので投票には参加しないよ。</p>'+
  '<form id="topic-form"><label class="field-label">みんなのお題</label><input id="majority-word" class="field" maxlength="30" placeholder="例：カレー" autocomplete="off" required>'+
  '<label class="field-label">オオカミのお題</label><input id="minority-word" class="field" maxlength="30" placeholder="例：シチュー" autocomplete="off" required>'+
  '<div class="action-foot"><button class="btn gold" type="submit">お題を決定して開始</button></div></form></section>';
}
function reveal(d){
 const status=onlineUI.progress('お題を確認済み',d.revealedCount,d.activeIds.length);
 if(!d.playing)return '<section class="panel large-center"><h2>みんながお題を確認中</h2><p>出題者はここで待っていてね。</p></section>'+status;
 if(d.myRevealed)return '<section class="panel large-center"><h2>確認完了！</h2><p>残りのプレイヤーを待ってね。</p></section>'+status;
 return '<section class="panel"><h2>自分だけのお題</h2><p class="hint">あなたの端末にだけ表示しているよ。お題を覚えたら確認完了を押してね。</p>'+
  '<div class="secret-holder showing online-word-visible" aria-label="あなたのお題"><strong>'+esc(d.myWord||'')+'</strong></div>'+
  '<p class="hint">自分がオオカミかどうかは分からないよ。</p>'+btn('お題を確認した','word-done','gold')+'</section>'+status;
}
const clock=n=>{n=Math.max(0,Math.ceil(n));return String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0')};
const remain=d=>d.paused?d.durationLeft:Math.max(0,Math.ceil((d.deadline-Date.now())/1000));
function discussion(d){
 return '<section class="panel"><h2>みんなで話し合おう</h2><div id="live-clock" class="timer">'+clock(remain(d))+'</div>'+
  '<p class="count-progress">'+(d.paused?'一時停止中':'話し合い中')+' · 別アプリの通話で話そう</p>'+
  (host()?'<div class="timer-controls">'+btn(d.paused?'スタート／再開':'一時停止','toggle','gray')+
   btn('＋30秒','plus30','gray')+btn('−30秒','minus30','gray')+
   btn('＋10秒','plus10','gray')+btn('−10秒','minus10','gray')+btn('リセット','reset','gray')+'</div>':
   '<p class="hint">タイマーはホストが操作するよ。</p>')+'</section>'+roster(d)+
   (host()?'<div class="action-foot">'+btn('話し合いを終えて投票へ','start-vote','gold')+'</div>':'');
}
function vote(d){
 const status=onlineUI.progress('投票済み',d.voteCount,d.activeIds.length);
 if(!d.playing)return '<section class="panel large-center"><h2>投票を待っているよ</h2><p>出題者は投票には参加しないよ。</p></section>'+status;
 if(d.voted)return '<section class="panel large-center"><h2>投票完了！</h2><p>全員が投票するまで結果は秘密だよ。</p></section>'+status;
 return '<section class="panel"><h2>'+(d.runoff?'決選投票':'オオカミは誰？')+'</h2><p class="hint">怪しい人を選んでね。自分への投票は禁止。</p><div class="vote-grid">'+
  (d.runoff?d.candidates:d.activeIds).map(id=>'<button type="button" data-vote="'+esc(id)+'" '+(id===session.id?'disabled':'')+'><span class="avatar">'+esc(person(id)?.icon||'？')+'</span><strong>'+esc(person(id)?.name||'')+'</strong></button>').join('')+'</div></section>'+status;
}
function tally(d,map){return map?d.activeIds.map(id=>'<div class="tally-row"><span>'+esc(label(id))+'</span><b>'+Number(map[id]||0)+'票</b></div>').join(''):''}
function reverse(d){
 if(d.isWolf)return '<section class="panel"><h2>市民のお題は何だった？</h2><p class="hint">回答は1回。正解なら逆転でオオカミの勝利だよ。</p>'+
  '<form id="guess-form"><input id="wolf-guess" class="field" maxlength="40" placeholder="市民のお題を推理して入力" required autocomplete="off"><div class="action-foot"><button type="submit" class="btn gold">この答えで勝負</button></div></form></section>'+
  (host()?btn('回答をスキップする','skip-guess','gray'):'');
 return '<section class="panel large-center"><h2>オオカミが逆転に挑戦！</h2><p>オオカミだけが市民のお題を答えられるよ。結果を待ってね。</p></section>'+
  (host()?btn('回答をスキップする','skip-guess','gray'):'');
}
function result(d){
 const r=d.result||{},reveal=esc(label(r.wolfId));
 return '<section class="panel"><div class="winner '+(r.winner==='human'?'human':'wolf')+'">'+(r.winner==='human'?'市民チームの勝利！':'オオカミの勝利！')+'</div>'+
  '<div class="two-words"><div><small>市民のお題</small><strong>'+esc(r.majority)+'</strong></div><div><small>オオカミのお題</small><strong>'+esc(r.minority)+'</strong></div></div>'+
  '<h2 style="text-align:center;margin-top:14px">オオカミの正体は…</h2><div class="wolf-reveal">'+reveal+'</div>'+
  '<p class="hint" style="text-align:center">'+(r.eliminated===null?'同票で決着！':r.eliminated===r.wolfId?'オオカミを見つけた！':'別の人を選んでしまった！')+'</p>'+
  (r.guess?'<p class="hint">逆転回答：'+esc(r.guess)+'</p>':'')+'</section>'+
  '<section class="panel"><h2>投票結果</h2>'+tally(d,r.firstTally)+
  (r.runoff&&r.finalTally?'<h2 style="margin-top:12px">決選投票</h2>'+tally(d,r.finalTally):'')+'</section>'+
  (host()?'<div class="stack">'+btn('同じメンバーでもう一戦','again','gold')+btn('ルームに戻る','stop','gray')+'</div>':
   '<section class="panel large-center"><p>ホストが次のゲームを準備するまで待ってね。</p></section>');
}
const headings={setup:'ゲーム設定',customInput:'お題を決めよう',reveal:'自分のお題を確認',discussion:'話し合いタイム',voting:'オオカミに投票',voteComplete:'全員の投票完了',runoffReady:'決選投票',reverse:'逆転チャンス！',result:'結果発表'};
function render(){
 const d=game();if(!d)return;
 if(lastStage!==d.stage){lastStage=d.stage;window.scrollTo?.(0,0)}
 $('stage-title').textContent=headings[d.stage]||'ことばのオオカミ';
 $('room-summary').textContent=d.activeIds.length+'人でプレイ · '+room.code+(d.authorId?' · 出題者 '+(person(d.authorId)?.name||''):'');
 const views={
 setup:()=>setup(d),customInput:()=>customInput(d),reveal:()=>reveal(d),discussion:()=>discussion(d),voting:()=>vote(d),
 voteComplete:()=>'<section class="panel large-center"><h2>全員の投票が完了</h2><p>ホストの結果発表まで秘密だよ。</p>'+(host()?btn('結果を発表する','publish','gold'):'')+'</section>',
 runoffReady:()=>'<section class="panel"><h2>同票になった！</h2><p class="hint">最多票の人だけで、決選投票を1回行うよ。再び同票ならオオカミの勝利。</p>'+tally(d,d.firstTally)+'</section>'+
  (host()?btn('決選投票を始める','runoff','gold'):'<p class="count-progress">ホストを待ってね。</p>'),
 reverse:()=>reverse(d),result:()=>result(d)
 };
 $('game-root').innerHTML=(views[d.stage]||(()=>'<section class="panel">読み込み中…</section>'))()+
  (d.stage!=='result'&&host()?'<div class="action-foot">'+btn('ゲームを中止してロビーへ','stop','danger')+'</div>':'');
 refreshTimer();
}
function refreshTimer(){const el=$('live-clock'),d=game();if(el&&d)el.textContent=clock(remain(d))}
setInterval(refreshTimer,250);
$('game-root').addEventListener('click',e=>{
 const el=e.target.closest('button');if(!el)return;const d=game();if(!d)return;
 if(el.dataset.setting){const [key,v]=el.dataset.setting.split(':');send('wolf-config',{settings:{...d.settings,[key]:key==='duration'?Number(v):v}});return}
 if(el.dataset.category){const cat=el.dataset.category;send('wolf-config',{settings:{...d.settings,categories:d.settings.categories.includes(cat)?d.settings.categories.filter(c=>c!==cat):[...d.settings.categories,cat]}});return}
 if(el.dataset.vote){
  if(confirm((person(el.dataset.vote)?.name||'この人')+'に投票する？ 確定後は変更できないよ。'))send('wolf-vote',{target:el.dataset.vote});
  return;
 }
 const actions={begin:['wolf-begin',{}],'word-done':['wolf-word-done',{}],
 toggle:['wolf-timer',{action:'toggle'}],plus30:['wolf-timer',{action:'adjust',seconds:30}],minus30:['wolf-timer',{action:'adjust',seconds:-30}],
 plus10:['wolf-timer',{action:'adjust',seconds:10}],minus10:['wolf-timer',{action:'adjust',seconds:-10}],reset:['wolf-timer',{action:'reset'}],
 'start-vote':['wolf-start-vote',{}],publish:['wolf-publish',{}],runoff:['wolf-runoff',{}],
 'skip-guess':['wolf-skip-guess',{}],again:['wolf-again',{}],stop:['wolf-stop',{}]};
 const command=actions[el.dataset.action];if(!command)return;
 if(['stop','skip-guess'].includes(el.dataset.action)&&!confirm(el.dataset.action==='stop'?'全員でロビーに戻る？':'逆転回答をスキップする？'))return;
 send(...command);
});
$('game-root').addEventListener('change',e=>{if(e.target.id==='author-choice'&&game())send('wolf-config',{settings:{...game().settings,authorId:e.target.value}})});
$('game-root').addEventListener('submit',e=>{
 if(e.target.id==='topic-form'){
  e.preventDefault();const a=$('majority-word').value.trim(),b=$('minority-word').value.trim();
  if(!a||!b||a===b){notice('異なる2つのお題を入力してね');return}
  send('wolf-custom-topics',{a,b});
 }else if(e.target.id==='guess-form'){
  e.preventDefault();const guess=$('wolf-guess').value.trim();
  if(guess&&confirm('「'+guess+'」で回答する？'))send('wolf-guess',{guess});
 }
});
function connect(){
 if(leaving)return;clearTimeout(retryTimer);
 const current=new WebSocket(base.replace(/^http/,'ws')+'/api/rooms/'+session.code+'/ws?token='+encodeURIComponent(session.token));socket=current;
 onlineUI.connection('connection','connecting');
 current.onopen=()=>{if(current!==socket)return;retry=0;onlineUI.connection('connection','connected');notice('')};
 current.onmessage=event=>{
  if(current!==socket)return;let msg;try{msg=JSON.parse(event.data)}catch{return}
  if(msg.type==='room'||msg.type==='welcome'){
   room=msg.room;
   window.dispatchEvent?.(new CustomEvent('houkago-online-room-state',{detail:room}));
   if(room.phase!=='wolf'){lobby();return}notice('');render();
  }else if(msg.type==='left')lobby(true);
  else if(msg.type==='error')notice(msg.error||'通信エラー');
 };
 current.onclose=event=>{
  if(current!==socket||leaving)return;socket=null;onlineUI.connection('connection','reconnecting');
  if([4000,4002,4003].includes(event.code)){lobby(true);return}
  retry=Math.min(7,retry+1);retryTimer=setTimeout(connect,Math.min(1500*2**(retry-1),15000));
 };
 current.onerror=()=>{};
}
$('back-lobby').addEventListener('click',e=>{
 e.preventDefault();if(!confirm(host()?'ゲームを中止して全員でロビーへ戻る？':'部屋から退出する？'))return;
 if(host())send('wolf-stop');else{send('leave');leaving=true;setTimeout(()=>lobby(true),650)}
});
$('back-games').addEventListener('click',e=>{
 e.preventDefault();if(!confirm('ゲームを終了して一覧に戻る？'))return;
 send(host()?'wolf-stop':'leave');leaving=true;setTimeout(()=>location.assign('../../games/'),700);
});
window.addEventListener('pageshow',()=>{if(!socket&&!leaving)connect()});
connect();
})();
