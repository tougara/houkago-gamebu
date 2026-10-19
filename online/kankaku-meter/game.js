/* 感覚メーター ONLINE / オフラインのルールをスマホ個別操作に最適化 */
(()=>{
'use strict';
const $=id=>document.getElementById(id);
const STORE='houkago-online-session-v1';
const base=String(window.HOUKAGO_ONLINE_API_URL||'').replace(/\/$/,'');
const requested=new URLSearchParams(location.search).get('room')||'';
const onlineUI=window.HoukagoOnlineUI;
let session=null,room=null,socket=null,retry=0,retryTimer=null,leaving=false;
let customOpen=false,composeOpen=false,showHelp=false;
try{session=JSON.parse(sessionStorage.getItem(STORE)||'null')}catch{}
// 試遊時だけ共通プレビューの仮セッションを使用。本物の保存データは変更しない。
if(window.HoukagoOfflinePreview)session=window.HoukagoOfflinePreview.session;
if(!window.HoukagoOfflinePreview&&(!session||!/^[A-Z2-9]{8}$/.test(session.code)||!/^[a-f0-9]{64}$/.test(session.token)||
 (requested&&requested!==session.code)||!/^https:\/\/[a-z0-9.-]+$/i.test(base))){
 location.replace('../'+(requested?'?room='+encodeURIComponent(requested):''));return;
}
const esc=x=>onlineUI.escapeHTML(x);
const host=()=>room?.hostId===session.id;
const game=()=>room?.meter||null;
const member=id=>game()?.members.find(m=>m.id===id)||{name:'プレイヤー',icon:'？'};
const name=id=>{const m=member(id);return esc((m.icon||'？')+' '+m.name)};
const btn=(label,key,style='')=>'<button type="button" class="btn '+style+'" data-action="'+key+'">'+esc(label)+'</button>';
const notice=(message,ok=false)=>onlineUI.notice('notice',message,ok);
const send=(type,data={})=>{
 if(socket?.readyState!==WebSocket.OPEN){notice('通信が切れているよ。接続を確認してね。');return false}
 socket.send(JSON.stringify({type,...data}));return true;
};
function lobby(clear=false){
 leaving=true;clearTimeout(retryTimer);
 if(clear)sessionStorage.removeItem(STORE);
 if(socket){socket.onclose=null;socket.close();socket=null}
 location.replace('../'+(clear?'':'?room='+encodeURIComponent(session.code)));
}
function top(g,label){
 return '<div class="progress-top"><span class="step">'+esc(label)+'</span><span class="round-count">ROUND '+g.round+' / '+g.settings.roundCount+'</span></div>';
}
function question(g){
 const q=g.topic;
 if(!q)return '';
 return '<div class="topic-card"><span class="topic-category">'+esc(q.category)+'</span>'+
 '<div class="topic-question">'+esc(q.q)+'</div>'+
 '<div class="range"><div class="range-edge"><b>1</b><span>'+esc(q.low)+'</span></div>'+
 '<div class="range-arrow">→</div>'+
 '<div class="range-edge"><b>100</b><span>'+esc(q.high)+'</span></div></div></div>';
}
function roster(g){return onlineUI.roster(g.members,{hostId:room.hostId});}
function topicInputs(prefix){
 return '<div class="text-fields"><label>お題<input id="'+prefix+'-q" maxlength="60" autocomplete="off" placeholder="例：休みの日に行きたい場所"></label>'+
 '<div class="two-col"><label>1のイメージ<input id="'+prefix+'-low" maxlength="30" autocomplete="off" placeholder="行きたくない"></label>'+
 '<label>100のイメージ<input id="'+prefix+'-high" maxlength="30" autocomplete="off" placeholder="絶対行きたい"></label></div></div>';
}
function topicData(prefix){
 const item={q:$(prefix+'-q')?.value.trim(),low:$(prefix+'-low')?.value.trim(),high:$(prefix+'-high')?.value.trim()};
 if(!item.q||!item.low||!item.high){notice('お題と「1」「100」のイメージを全部入力してね');return null}
 return item;
}
function setup(g){
 if(!host())return '<section class="panel center"><h1>ゲームの準備中</h1>'+
 '<p>ホストが難易度・ジャンル・ラウンド数を選んでいるよ。</p>'+
 '<div class="notice-wait">設定が終わるまで待ってね</div></section>'+roster(g);
 const s=g.settings;
 return '<section class="panel"><h1>感覚メーターの設定</h1>'+
 '<p class="hint center">みんなで協力して、5ラウンドの高得点を目指そう！</p>'+
 '<h2>難易度</h2><div class="mode-grid">'+
 [['easy','かんたん','数字が離れやすい'],['normal','ふつう','ランダム'],['hard','むずかしい','数字が近い']].map(([key,title,sub])=>
 '<button class="mode'+(s.difficulty===key?' selected':'')+'" data-difficulty="'+key+'">'+title+'<small>'+sub+'</small></button>').join('')+
 '</div><div class="row-label" style="margin-top:16px"><span>ラウンド数</span><span class="muted small">1ラウンド最大100点</span></div>'+
 '<div class="round-options">'+[3,5,7,10].map(count=>
 '<button class="'+(s.roundCount===count?'selected':'')+'" data-rounds="'+count+'">'+count+'回</button>').join('')+'</div>'+
 '<div class="row-label" style="margin-top:15px"><span>お題ジャンル</span><span class="muted small">'+s.categories.length+' / '+g.categories.length+'</span></div>'+
 '<div class="pill-grid">'+g.categories.map(c=>'<button class="pill'+(s.categories.includes(c)?' selected':'')+'" data-category="'+esc(c)+'">'+esc(c)+'</button>').join('')+'</div>'+
 '<p class="hint">1ジャンル以上を選んでね。現在 '+g.poolCount+' 問から出題。</p>'+
 '</section>'+
 '<section class="panel"><div class="row-label"><span>マイお題（オンラインルーム限定）</span>'+
 '<span class="muted small">'+(g.customTopics||[]).length+' / 20</span></div>'+
 btn(customOpen?'入力を閉じる':'マイお題を追加する','custom-toggle','outline')+
 (customOpen?'<div style="margin-top:10px">'+topicInputs('setup')+
 '<div class="button-row">'+btn('このお題を登録','custom-add','purple')+'</div></div>':'')+
 (g.customTopics||[]).map((t,i)=>'<div class="custom-item"><strong>'+esc(t.q)+'</strong>'+
 '<button data-delete="'+i+'">削除</button></div>').join('')+
 '</section><section class="panel"><h2>遊び方</h2>'+
 '<p class="hint">①お題を見る → ②自分だけの数字を確認 → ③別の通話アプリで答えを話す → ④ホストが順番を並べる → ⑤みんなで数字と得点を公開。<strong>自分の数字は言わないでね！</strong></p>'+
 '<div class="button-row">'+btn('この設定でスタート','begin','primary')+
 btn('ゲームをやめてロビーへ','stop-game','danger')+'</div></section>'+roster(g);
}
function preview(g){
 return '<section class="panel">'+top(g,'STEP 1 / お題を確認')+
 '<h1>今回のお題</h1>'+question(g)+
 '<p class="hint center">「1」と「100」の基準を確認してから、秘密の数字を配るよ。</p>'+
 (host()?'<div class="button-row">'+btn('このお題で数字を配る','deal','primary')+
 btn('別のお題にする','change-topic','outline')+
 btn(composeOpen?'自分たちのお題を閉じる':'このラウンドのお題を作る','compose-toggle')+
 (composeOpen?topicInputs('preview')+btn('このお題に変更','use-topic','purple'):'')+'</div>':
 '<div class="notice-wait">ホストがこのお題で始めるのを待ってね</div>')+
 '</section>'+roster(g);
}
function reveal(g){
 return '<section class="panel">'+top(g,'STEP 2 / 自分の数字を確認')+
 '<h1>自分だけの数字</h1>'+question(g)+
 (!g.mySeen?'<div class="secret-card"><div class="personal">'+name(session.id)+' さんの秘密の数字</div>'+
 '<div class="secret-number">'+esc(g.myNumber)+'</div><div class="secret-scale">1 ←────→ 100</div></div>'+
 '<p class="hint center">この数字の大きさを、数字を使わず言葉で伝えよう。<br>自分のスマホだけに表示されているよ。</p>'+
 '<div class="button-row">'+btn('数字を覚えた！','seen','primary')+'</div>':
 '<div class="notice-wait">数字の確認完了！<br>ほかのメンバーを待とう</div>')+
 onlineUI.progress('数字を確認済み',g.seenCount,g.members.length)+
 '</section>'+roster(g);
}
function orderRows(g,readonly=false){
 return '<div class="order-list">'+g.order.map((id,i)=>
 '<div class="order-item"><span class="order-position">'+(i+1)+'</span>'+
 '<span class="order-member">'+name(id)+(id===session.id?'（自分）':'')+'</span>'+
 (readonly?'<span class="muted small">相談中</span>':
 '<div class="move-controls"><button aria-label="'+name(id)+'を上へ" data-index="'+i+'" data-direction="-1" '+(!i?'disabled':'')+'>↑</button>'+
 '<button aria-label="'+name(id)+'を下へ" data-index="'+i+'" data-direction="1" '+(i===g.order.length-1?'disabled':'')+'>↓</button></div>')+'</div>').join('')+'</div>';
}
function arrange(g){
 return '<section class="panel">'+top(g,'STEP 3 / みんなで相談')+'<h1>順番を決めよう！</h1>'+question(g)+
 '<div class="mini-secret"><span>自分だけの数字（他の人には非表示）</span><strong>'+esc(g.myNumber)+'</strong></div>'+
 '<p class="hint center">別の通話アプリで一人ずつ答えを伝えてね。数字を直接言うのは禁止！</p>'+
 '<p class="order-note">上は100に近い人　↑　下は1に近い人</p>'+
 orderRows(g,!host())+
 (host()?'<div class="bottom-actions">'+btn('この順番で結果発表へ','confirm-order','primary')+'</div>':
 '<p class="notice-wait">ホストが順番を並べ替えているよ</p>')+
 '</section>'+roster(g);
}
function result(g){
 const done=g.shown.length===g.members.length;
 return '<section class="panel">'+top(g,'STEP 4 / 結果発表')+
 '<h1>みんなの数字を公開！</h1>'+question(g)+
 (done?'<div class="score-box"><strong>'+g.roundScore+'</strong><small> / 100点</small>'+
 '<p>'+ (g.roundScore===100?'PERFECT！ 全員の感覚がつながった！':g.roundScore>=80?'かなり合ってる！':g.roundScore>=55?'いい感じ！':'次はもっと合わせよう！')+'</p></div>':
 onlineUI.progress('数字を公開',g.shown.length,g.members.length))+
 '<h2 style="margin-top:15px">みんなが予想した順番</h2>'+
 '<p class="order-note">↑ 100に近い予想　／　↓ 1に近い予想</p>'+
 g.order.map((id,i)=>'<div class="result-row"><span class="position">'+(i+1)+'</span>'+
 '<strong>'+name(id)+'</strong>'+
 (Object.hasOwn(g.shownNumbers||{},id)?'<span class="number-result">'+g.shownNumbers[id]+'</span>':
 host()?'<button data-show="'+esc(id)+'">公開</button>':'<span class="number-result">？</span>')+
 '</div>').join('')+
 (done?'<h2 style="margin-top:15px">正しい順番</h2>'+
 g.correctOrder.map((id,i)=>'<div class="order-view"><b>'+(i+1)+'</b><span>'+name(id)+'</span></div>').join('')+
 '<div class="button-row">'+(host()?btn(g.round===g.settings.roundCount?'最終結果を見る':'次のラウンドへ','next','primary'):
 '<div class="notice-wait">ホストが次に進めるよ</div>')+'</div>':
 '<p class="hint center">全員の数字を公開すると得点が表示されるよ。</p>')+
 '</section>'+roster(g);
}
function finished(g){
 const pct=Math.round((g.totalScore/(g.settings.roundCount*100))*100);
 const title=pct>=90?'感覚シンクロ部！':pct>=75?'かなり通じ合ってる！':pct>=55?'いいチーム！':'もっと知り合えるかも！';
 return '<section class="panel center">'+top(g,'ゲーム終了')+
 '<h1>'+title+'</h1><div class="final-score">'+g.totalScore+
 '<small> / '+(g.settings.roundCount*100)+'点</small></div>'+
 '<p class="hint center">数字を言わずに、ここまで合わせられたね！</p>'+
 '<h2 style="margin-top:17px">ラウンド別の得点</h2>'+
 '<div class="score-history">'+g.scores.map((s,i)=>'<span>第'+(i+1)+'回 '+s+'点</span>').join('')+'</div>'+
 '<div class="button-row">'+(host()?btn('ロビーに戻ってもう一度','stop-game','primary'):
 '<div class="notice-wait">ホストがロビーに戻すのを待ってね</div>')+'</div></section>'+roster(g);
}
function render(){
 const g=game();
 if(!g){$('game-root').innerHTML='<section class="panel">ロビーへ戻ります…</section>';return}
 $('game-root').innerHTML=({
  setup,preview,reveal,arrange,result,finished
 }[g.stage]||setup)(g);
}
const config=patch=>{
 const g=game();if(!host()||g?.stage!=='setup')return;
 send('meter-config',{settings:{...g.settings,...patch}});
};
$('game-root').addEventListener('click',event=>{
 const el=event.target.closest('button');if(!el)return;
 const g=game();if(!g)return;
 if(el.hasAttribute('data-difficulty')){config({difficulty:el.dataset.difficulty});return}
 if(el.hasAttribute('data-rounds')){config({roundCount:Number(el.dataset.rounds)});return}
 if(el.hasAttribute('data-category')){
  const category=el.dataset.category;
  const selected=g.settings.categories.includes(category);
  if(selected&&g.settings.categories.length===1){notice('1ジャンル以上選んでね');return}
  config({categories:selected?g.settings.categories.filter(x=>x!==category):[...g.settings.categories,category]});return;
 }
 if(el.hasAttribute('data-delete')){
  if(confirm('このマイお題を削除する？'))send('meter-delete-topic',{index:Number(el.dataset.delete)});
  return;
 }
 if(el.hasAttribute('data-index')){
  send('meter-swap',{index:Number(el.dataset.index),direction:Number(el.dataset.direction)});return;
 }
 if(el.hasAttribute('data-show')){send('meter-show',{memberId:el.dataset.show});return}
 switch(el.dataset.action){
  case 'custom-toggle':customOpen=!customOpen;render();break;
  case 'custom-add':{
   const topic=topicData('setup');if(topic){customOpen=false;send('meter-add-topic',{topic})}break;
  }
  case 'begin':send('meter-begin');break;
  case 'change-topic':composeOpen=false;send('meter-change-topic');break;
  case 'compose-toggle':composeOpen=!composeOpen;render();break;
  case 'use-topic':{
   const topic=topicData('preview');if(topic){composeOpen=false;send('meter-use-topic',{topic})}break;
  }
  case 'deal':send('meter-deal');break;
  case 'seen':send('meter-seen');break;
  case 'confirm-order':
   if(confirm('この順番で決定して数字を公開する？'))send('meter-finalize');break;
  case 'next':composeOpen=false;send('meter-next');break;
  case 'stop-game':
   if(confirm('ゲームを終了し、全員ロビーに戻す？'))send('meter-stop');break;
 }
});
function connect(){
 if(leaving)return;
 clearTimeout(retryTimer);
 if(socket){socket.onclose=null;socket.close()}
 onlineUI.connection('connection','connecting');
 const url=base.replace(/^http/,'ws')+'/api/rooms/'+session.code+'/ws?token='+encodeURIComponent(session.token);
 const ws=new WebSocket(url);socket=ws;
 ws.onopen=()=>{if(socket!==ws)return;retry=0;onlineUI.connection('connection','connected');notice('オンライン接続中',true)};
 ws.onmessage=event=>{
  if(socket!==ws)return;
  let data;try{data=JSON.parse(event.data)}catch{return}
  if(data.type==='left'){lobby(true);return}
  if(data.type==='error'){notice(data.error||'通信を確認してね');return}
  if(data.type!=='welcome'&&data.type!=='room')return;
  room=data.room;
   window.dispatchEvent(new CustomEvent('houkago-online-room-state',{detail:room}));
  if(room.phase!=='meter'){lobby();return}
  render();
 };
 ws.onclose=event=>{
  if(socket!==ws||leaving)return;
  socket=null;onlineUI.connection('connection','reconnecting');
  if([4000,4002,4003].includes(event.code)){lobby(true);return}
  retry=Math.min(retry+1,6);
  retryTimer=setTimeout(connect,Math.min(1500*2**(retry-1),15000));
 };
 ws.onerror=()=>{};
}
connect();
})();