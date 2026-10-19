/* 教科書タワー ONLINE: 共有タワーを見ながら本人だけの手札で交代プレイ */
(()=>{
'use strict';
const $=id=>document.getElementById(id),STORE='houkago-online-session-v1';
const base=String(window.HOUKAGO_ONLINE_API_URL||'').replace(/\/$/,'');
const requested=new URLSearchParams(location.search).get('room')||'';
const ui=window.HoukagoOnlineUI;
let session=null,room=null,socket=null,retry=0,retryTimer=null,leaving=false;
let selected=null,pending=null,turnStamp='';
try{session=JSON.parse(sessionStorage.getItem(STORE)||'null')}catch{}
// 試遊時だけ共通プレビューの仮セッションを使用。本物の保存データは変更しない。
if(window.HoukagoOfflinePreview)session=window.HoukagoOfflinePreview.session;
if(!window.HoukagoOfflinePreview&&(!session||!/^[A-Z2-9]{8}$/.test(session.code)||!/^[a-f0-9]{64}$/.test(session.token)||
 (requested&&requested!==session.code)||!/^https:\/\/[a-z0-9.-]+$/i.test(base))){
 location.replace('../'+(requested?'?room='+encodeURIComponent(requested):''));return;
}
const subjects=[
 {key:'japanese',name:'国語',image:'../../textbook_japanese.png'},
 {key:'math',name:'算数',image:'../../textbook_math.png'},
 {key:'science',name:'理科',image:'../../textbook_science.png'},
 {key:'social',name:'社会',image:'../../textbook_social_studies.png'},
 {key:'english',name:'英語',image:'../../textbook_english.png'}
];
const lookup=Object.fromEntries(subjects.map(s=>[s.key,s]));
const esc=ui.escapeHTML,game=()=>room?.tower||null,host=()=>room?.hostId===session.id;
const person=id=>game()?.members.find(m=>m.id===id)||{icon:'？',name:'不明',score:0,cards:0};
const pname=id=>{const p=person(id);return esc((p.icon||'？')+' '+p.name)};
const btn=(label,action,kind='')=>'<button type="button" class="btn '+kind+'" data-action="'+action+'">'+esc(label)+'</button>';
const notice=(text,ok=false)=>ui.notice('notice',text,ok);
const send=(type,data={})=>{
 if(socket?.readyState!==WebSocket.OPEN){notice('接続が切れているよ。再接続を確認してね。');return false}
 socket.send(JSON.stringify({type,...data}));return true;
};
function lobby(clear=false){
 leaving=true;clearTimeout(retryTimer);
 if(clear)sessionStorage.removeItem(STORE);
 if(socket){socket.onclose=null;socket.close();socket=null}
 location.replace('../'+(clear?'':'?room='+encodeURIComponent(session.code)));
}
function status(g){
 return '<div class="top-stats"><span>ROUND '+g.round+' / '+g.totalRounds+'</span>'+
 '<span>配置 '+g.movesMade+' 冊</span><span>土台 '+g.bottom.count+' / 8</span></div>';
}
function scores(g){
 return '<div class="scores">'+g.members.map(p=>
 '<span class="score-chip'+(p.id===g.currentId?' current':'')+'">'+esc(p.icon+' '+p.name)+'　'+p.score+'点</span>').join('')+'</div>';
}
function board(g,editable=false){
 const data=new Map(g.board.map(p=>[p.level+','+p.x,p.subject]));
 const b=g.bottom;
 const options=editable&&selected?(g.choices?.[selected]||[]):[];
 const legal=new Set(options.map(p=>p.level+','+p.x));
 const isAvailable=options.length>0;
 let rows='';
 const maxLevel=Math.max(0,b.count-1);
 for(let level=maxLevel;level>=0;level--){
  let min=b.count?b.min:0,max=b.count?b.max-level:0;
  if(level===0&&b.count<8&&b.count){
   if(editable&&selected){min--;max++}
  }
  let row='';
  for(let x=min;x<=max;x++){
   const key=level+','+x;
   const sub=data.get(key),valid=legal.has(key),isPreview=pending&&pending.level===level&&pending.x===x;
   if(sub)row+='<div class="tower-cell book"><img src="'+lookup[sub].image+'" alt="'+lookup[sub].name+'"></div>';
   else if(isPreview&&selected)row+='<div class="tower-cell"><div class="slot preview"><img src="'+lookup[selected].image+'" alt="'+lookup[selected].name+'"></div></div>';
   else if(valid)row+='<div class="tower-cell"><button class="slot" data-level="'+level+'" data-x="'+x+'" aria-label="'+lookup[selected].name+'をここに置く">＋</button></div>';
   else row+='<div class="tower-cell"><div class="tower-empty"></div></div>';
  }
  rows+='<div class="tower-row" data-level="'+level+'">'+row+'</div>';
 }
 if(!b.count&&isAvailable){
  rows='<div class="tower-row"><div class="tower-cell">'+
   (pending?'<div class="slot preview"><img src="'+lookup[selected].image+'" alt="'+lookup[selected].name+'"></div>':
   '<button class="slot" data-level="0" data-x="0" aria-label="最初の本をここへ置く">＋</button>')+
   '</div></div>';
 }
 return '<section class="panel board-panel"><div class="board-head"><span>'+
 (selected&&editable?esc(lookup[selected].name)+'：光る場所を選んでね':'全員共通のタワー')+
 '</span><span>'+g.board.length+'冊</span></div>'+
 '<div class="tower-board">'+rows+'</div>'+
 '</section>';
}
function members(g){
 return '<div class="member-list">'+g.members.map(m=>
 '<div class="member'+(m.id===g.currentId?' current':'')+'">'+
 '<b>'+esc(m.icon+' '+m.name)+(m.id===session.id?'（自分）':'')+'</b>'+
 '<span><small>'+(!m.active&&['playing','roundResult'].includes(g.stage)?'ラウンド終了':'残り '+(m.cards??'—')+'冊')+'</small>　'+m.score+'点</span>'+
 '</div>').join('')+'</div>';
}
function hand(g,editable){
 if(!g.myHand)return '';
 const entries=subjects.map(s=>{
  const count=g.myHand[s.key]||0,can=editable&&count>0&&(g.choices?.[s.key]||[]).length>0;
  return '<button type="button" class="hand-book'+(can?' playable':'')+(selected===s.key?' selected':'')+
   '" data-subject="'+s.key+'" '+(!can?'disabled':'')+' aria-pressed="'+String(selected===s.key)+'">'+
   '<img src="'+s.image+'" alt="'+s.name+'"><span>'+s.name+'</span><b>×'+count+'</b></button>';
 }).join('');
 return '<section class="panel hand-panel"><h2>あなたの手札</h2>'+
 '<p class="hand-label">'+(editable?(selected?'選んだ教科書をタワーの光る場所に置こう':'置きたい教科書を押そう'):
 '自分の手札だけ表示中。ほかの人には教科ごとの枚数は見えないよ。')+'</p>'+
 '<div class="hand-grid">'+entries+'</div>'+
 (editable&&selected&&!pending?'<div class="actions">'+btn('教科書を選び直す','clear','outline')+'</div>':'')+
 '</section>';
}
function setup(g){
 return '<section class="panel"><h1>みんなで教科書タワー！</h1>'+
 '<p class="hint center">2〜6人の順番対戦。手札は本人の端末だけ、タワーは全員にリアルタイムで見えるよ。</p>'+
 '<ol class="rules"><li>36冊を全員に配る。5人なら最初から土台に1冊</li>'+
 '<li>自分の番になったら教科書を選び、置ける場所に配置</li>'+
 '<li>土台は最大<strong>8冊</strong>。上段は下の2冊のどちらかと同じ教科だけ置ける</li>'+
 '<li>置けなくなったら残り手札1冊につき<strong>＋1点</strong></li>'+
 '<li>手札を使い切れたら累積ペナルティから<strong>最大−2点</strong></li>'+
 '<li>人数と同じ回数のラウンドで、<strong>最もペナルティが少ない人</strong>の勝ち</li></ol>'+
 '<div class="notice">通話は別アプリで。配置や得点はゲーム内で自動共有！</div>'+
 (host()?'<div class="actions">'+btn('教科書を配る','begin','primary')+
 btn('対戦を終了してロビーへ','stop','danger')+'</div>':
 '<div class="notice">ホストが始めるのを待ってね</div>')+
 '</section><section class="panel"><h2>参加メンバー</h2>'+members(g)+'</section>';
}
function intro(g){
 const five=g.members.length===5;
 return '<section class="panel">'+status(g)+'<h1>教科書を配ったよ！</h1>'+
 '<div class="turn-banner">今回のスタート<strong>'+pname(g.startId)+'</strong></div>'+
 (five?'<p class="hint center">5人プレイなので、タワーの土台に教科書を1冊置いてあるよ。</p>':'')+
 board(g)+hand(g,false)+
 (host()?'<div class="actions">'+btn('第'+g.round+'ラウンドを始める','round-start','primary')+'</div>':
 '<div class="notice">ホストのスタート操作を待ってね</div>')+
 '</section><section class="panel"><h2>現在のペナルティ</h2>'+scores(g)+'</section>';
}
function playedEvent(g){
 const e=g.lastEvent;if(!e)return '';
 if(e.kind==='stuck')return '<div class="notice">'+pname(e.id)+'：置ける本がないため残り'+e.remaining+'冊がペナルティ</div>';
 const s=lookup[e.subject];
 return '<div class="notice">'+pname(e.id)+'が'+(s?s.name:'教科書')+'を置いたよ'+(e.cleared?'（手札を使い切った！）':'')+'</div>';
}
function playing(g){
 const editable=g.myTurn;
 const turn=person(g.currentId);
 return '<div class="panel">'+status(g)+scores(g)+
 '<div class="turn-banner'+(editable?'':' wait')+'">'+
 (editable?'あなたの番！':'いまの手番')+'<strong>'+pname(g.currentId)+'</strong>'+
 '<span style="font-size:12px">残り '+turn.cards+'冊</span></div>'+
 playedEvent(g)+'</div>'+
 board(g,editable)+
 (editable?hand(g,true):hand(g,false))+
 (editable&&pending&&selected?'<div class="place-confirm"><p>'+esc(lookup[selected].name)+'を光っている場所に置く？</p>'+
 '<div class="two">'+btn('場所を選び直す','place-cancel')+
 btn('ここに置く','place-ok','primary')+'</div></div>':'')+
 (!editable?'<section class="panel"><p class="hint center">タワーの配置が決まると自動で次の人へ進むよ。<br>自分の番になったら手札の本が押せるようになるよ。</p></section>':'')+
 '<section class="panel"><h2>残り枚数とペナルティ</h2>'+members(g)+'</section>';
}
function result(g){
 return '<section class="panel">'+status(g)+'<h1>ラウンド結果</h1>'+
 '<p class="hint center">手札を置けなくなったら＋残り冊数。全部置けたら最大−2点！</p>'+
 '<div class="result-grid">'+g.members.map(m=>{
  const o=g.outcomes?.[m.id],delta=o?.kind==='stuck'?'＋'+o.remaining:o?.returned?'−'+o.returned:'±0';
  return '<div class="result-row"><span>'+esc(m.icon+' '+m.name)+'</span>'+
  '<strong>'+delta+'点</strong><em>累計 '+m.score+'点</em></div>';
 }).join('')+'</div>'+
 '<div class="actions">'+(host()?btn(g.round===g.totalRounds?'最終結果を見る':'次のラウンドへ','next','primary'):
 '<div class="notice">ホストが次へ進めるよ</div>')+'</div></section>'+
 board(g);
}
function finished(g){
 const people=g.rankings,first=people[0].score;
 let lastScore=null,rank=0;
 return '<section class="panel"><h1>ゲーム終了！</h1>'+
 '<div class="winner">'+people.filter(m=>m.score===first).map(m=>esc(m.icon+' '+m.name)).join(' ＆ ')+' 優勝！</div>'+
 '<p class="hint center">全'+g.totalRounds+'ラウンドの総合結果。ペナルティが少ないほど上位だよ。</p>'+
 '<div class="ranking">'+people.map((m,i)=>{
  if(lastScore!==m.score){rank=i+1;lastScore=m.score}
  return '<div class="rank-row"><span>'+rank+'位　'+esc(m.icon+' '+m.name)+'</span><strong>'+m.score+'点</strong></div>';
 }).join('')+'</div>'+
 (host()?'<div class="actions">'+btn('ロビーに戻ってもう一戦','stop','primary')+'</div>':
 '<div class="notice">ホストがロビーに戻すのを待ってね</div>')+'</section>';
}
function render(){
 const g=game();if(!g){$('game-root').innerHTML='<section class="panel">ロビーへ戻ります…</section>';return}
 const stamp=g.round+':'+g.stage+':'+g.currentId+':'+g.movesMade;
 if(stamp!==turnStamp){selected=null;pending=null;turnStamp=stamp}
 if(!g.myTurn){selected=null;pending=null}
 if(selected&&!(g.choices?.[selected]||[]).length){selected=null;pending=null}
 $('game-root').innerHTML=({setup,intro:()=>intro(g),roundIntro:()=>intro(g),playing:()=>playing(g),roundResult:()=>result(g),finished:()=>finished(g)}[g.stage]||setup)(g);
}
$('game-root').addEventListener('click',event=>{
 const target=event.target.closest('button');if(!target)return;
 const g=game();if(!g)return;
 if(target.hasAttribute('data-subject')&&g.myTurn){
  const subject=target.dataset.subject;
  if(!(g.choices?.[subject]||[]).length)return;
  selected=selected===subject?null:subject;pending=null;render();return;
 }
 if(target.hasAttribute('data-level')&&selected&&g.myTurn){
  const level=Number(target.dataset.level),x=Number(target.dataset.x);
  if((g.choices?.[selected]||[]).some(p=>p.level===level&&p.x===x)){
   pending={level,x};render();
  }
  return;
 }
 switch(target.dataset.action){
  case 'begin':send('tower-begin');break;
  case 'round-start':send('tower-round-start');break;
  case 'clear':selected=null;pending=null;render();break;
  case 'place-cancel':pending=null;render();break;
  case 'place-ok':
   if(g.myTurn&&selected&&pending){
    const subject=selected,location=pending;
    if(send('tower-place',{subject,level:location.level,x:location.x})){
     selected=null;pending=null;target.disabled=true;target.textContent='配置中…';
    }
   }break;
  case 'next':send('tower-next');break;
  case 'stop':
   if(confirm('オンライン対戦を終了して全員ロビーへ戻す？'))send('tower-stop');
   break;
 }
});
function connect(){
 if(leaving)return;
 clearTimeout(retryTimer);
 if(socket){socket.onclose=null;socket.close()}
 ui.connection('connection','connecting');
 const endpoint=base.replace(/^http/,'ws')+'/api/rooms/'+session.code+'/ws?token='+encodeURIComponent(session.token);
 const ws=new WebSocket(endpoint);socket=ws;
 ws.onopen=()=>{if(socket!==ws)return;retry=0;ui.connection('connection','connected');notice('オンライン接続中',true)};
 ws.onmessage=event=>{
  if(socket!==ws)return;
  let message;try{message=JSON.parse(event.data)}catch{return}
  if(message.type==='left'){lobby(true);return}
  if(message.type==='error'){notice(message.error||'接続状況を確認してね');return}
  if(message.type!=='welcome'&&message.type!=='room')return;
  room=message.room;
   window.dispatchEvent?.(new CustomEvent('houkago-online-room-state',{detail:room}));
  if(room.phase!=='tower'){lobby();return}
  render();
 };
 ws.onclose=event=>{
  if(socket!==ws||leaving)return;
  socket=null;ui.connection('connection','reconnecting');
  if([4000,4002,4003].includes(event.code)){lobby(true);return}
  retry=Math.min(retry+1,6);
  retryTimer=setTimeout(connect,Math.min(1500*2**(retry-1),15000));
 };
 ws.onerror=()=>{};
}
connect();
})();