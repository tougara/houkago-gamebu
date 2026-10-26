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
 const b=g.bottom,options=editable&&selected?(g.choices?.[selected]||[]):[];
 const legal=new Set(options.map(p=>p.level+','+p.x));
 const maxLevel=Math.max(0,b.count-1);
 // Every tier shares the same horizontal origin, even with new left/right
 // candidates. The upper book is half a tile between its two supporters.
 const extend=b.count>0&&b.count<8&&editable&&selected;
 const origin=b.count?b.min-(extend?1:0):0;
 const width=b.count?b.count+(extend?2:0):1;
 const rows=[];
 for(let level=maxLevel;level>=0;level--){
  let min=b.count?b.min:0,max=b.count?b.max-level:0;
  if(level===0&&extend){min--;max++}
  if(max<min)continue;
  let cells='';
  for(let x=min;x<=max;x++){
   const key=level+','+x,sub=data.get(key),valid=legal.has(key);
   const isPreview=!!pending&&pending.level===level&&pending.x===x;
   let element='<span class="tower-empty" aria-hidden="true"></span>';
   if(sub){
    element='<img class="tower-book" src="'+lookup[sub].image+'" alt="'+lookup[sub].name+'">';
   }else if(isPreview&&selected){
    element='<div class="slot preview"><img src="'+lookup[selected].image+'" alt="'+lookup[selected].name+'"><span>ここ</span></div>';
   }else if(valid){
    element='<button class="slot" type="button" data-level="'+level+'" data-x="'+x+'" aria-label="'+lookup[selected].name+'をここに置く"><span aria-hidden="true">＋</span></button>';
   }
   const kind=sub?' book':isPreview?' candidate-preview':valid?' candidate':'';
   cells+='<div class="tower-cell'+kind+'" style="--offset:'+((x-origin)+(level/2))+'">'+element+'</div>';
  }
  rows.push('<div class="tower-row" data-level="'+level+'">'+cells+'</div>');
 }
 if(!b.count&&options.length){
  rows.length=0;
  rows.push('<div class="tower-row"><div class="tower-cell" style="--offset:0">'+
   (pending&&selected?'<div class="slot preview"><img src="'+lookup[selected].image+'" alt="'+lookup[selected].name+'"><span>ここ</span></div>':
   '<button class="slot" data-level="0" data-x="0" type="button" aria-label="最初の本をここに置く"><span aria-hidden="true">＋</span></button>')+
   '</div></div>');
 }
 return '<section class="panel board-panel"><div class="board-head"><strong>'+
 (selected&&editable?esc(lookup[selected].name)+'を置く場所':'教科書タワー')+
 '</strong><span>土台 '+b.count+' / 8冊</span></div>'+
 '<div class="tower-board" data-cols="'+width+'" data-rows="'+rows.length+'" style="--tower-columns:'+width+';--tower-rows:'+rows.length+'">'+
 '<div class="tower-stack">'+rows.join('')+'</div></div></section>';
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
 const entries=subjects.map(sub=>{
  const count=g.myHand[sub.key]||0;
  const can=editable&&count>0&&(g.choices?.[sub.key]||[]).length>0;
  return '<button type="button" class="hand-book'+(count>0?' has-cards':'')+(can?' playable':'')+
   (selected===sub.key?' selected':'')+'" data-subject="'+sub.key+'" '+(!can?'disabled':'')+
   ' aria-pressed="'+String(selected===sub.key)+'">'+
   '<img src="'+sub.image+'" alt="'+sub.name+'"><span>'+sub.name+'</span><b>×'+count+'</b></button>';
 }).join('');
 return '<section class="panel hand-panel'+(pending?' choosing-place':'')+'">'+
 '<div class="hand-heading"><h2>あなたの手札</h2><small>'+
 (editable?(pending?'置く場所を確認中':selected?'光る場所をタップ':'教科書を選ぼう'):'自分の番まで確認できます')+'</small></div>'+
 '<div class="hand-grid">'+entries+'</div>'+
 (editable&&pending&&selected?
 '<div class="place-confirm"><p>'+esc(lookup[selected].name)+'をここに置く？</p>'+
 '<div class="two">'+btn('選び直す','place-cancel')+
 btn('ここに置く','place-ok','primary')+'</div></div>':'')+
 '</section>';
}

function setup(g){
 return '<section class="panel tower-setup-panel"><h1>みんなで教科書タワー！</h1>'+
 '<p class="hint center">順番に教科書を置こう。置けなくなったら残り冊数がペナルティ！</p>'+
 '<div class="tower-quick-rules"><span>1. 本を選ぶ</span><span>2. 光る場所を選ぶ</span><span>3. ここに置く</span></div>'+
 '<p class="hint center">ペナルティが少ない人の勝ち。タワーと点数は全員に共有されるよ。</p>'+
 '<details class="tower-rule-details"><summary>詳しいルールを見る</summary><ol class="rules">'+
 '<li>36冊を全員に配る。5人なら土台に最初から1冊</li>'+
 '<li>教科書を選んで、光っている場所に置く</li>'+
 '<li>土台は最大8冊。上段は下の2冊のどちらかと同じ教科だけ置ける</li>'+
 '<li>置けなくなったら、残り手札1冊につき＋1点</li>'+
 '<li>手札を使い切ると累積ペナルティから最大−2点</li>'+
 '<li>人数と同じ数のラウンドを行い、最もペナルティが少ない人が優勝</li>'+
 '</ol></details>'+
 (host()?'<div class="actions">'+btn('教科書を配って始める','begin','primary')+
 btn('対戦を終了してロビーへ','stop','danger')+'</div>':
 '<div class="notice">ホストのスタートを待ってね</div>')+
 '<details class="tower-rule-details"><summary>参加メンバーを見る（'+g.members.length+'人）</summary>'+members(g)+'</details>'+
 '</section>';
}
function intro(g){
 const five=g.members.length===5;
 return '<section class="panel tower-intro-panel">'+status(g)+
 '<h1>ラウンドの準備完了！</h1>'+
 '<div class="turn-banner">最初のプレイヤー<strong>'+pname(g.startId)+'</strong></div>'+
 (five?'<p class="hint center">5人なので土台に最初から1冊あるよ。</p>':'')+
 (host()?'<div class="actions">'+btn('ラウンドを始める','round-start','primary')+'</div>':
 '<div class="notice">ホストのスタートを待ってね</div>')+
 '</section>'+board(g)+
 '<details class="panel tower-intro-hand"><summary>配られた自分の手札を見る</summary>'+hand(g,false)+'</details>';
}

function playedEvent(g){
 const e=g.lastEvent;if(!e)return '';
 if(e.kind==='stuck')return '<div class="notice">'+pname(e.id)+'：置ける本がないため残り'+e.remaining+'冊がペナルティ</div>';
 const s=lookup[e.subject];
 return '<div class="notice">'+pname(e.id)+'が'+(s?s.name:'教科書')+'を置いたよ'+(e.cleared?'（手札を使い切った！）':'')+'</div>';
}
function playing(g){
 const editable=g.myTurn,turn=person(g.currentId);
 const people=members(g);
 const compactEvent=g.lastEvent?playedEvent(g):'';
 const summary='<header class="tower-play-head">'+
 '<div class="tower-round-label"><small>ROUND '+g.round+' / '+g.totalRounds+'</small>'+
 '<strong>'+(editable?'あなたの番！':pname(g.currentId)+' の番')+'</strong>'+
 '<span>残り '+turn.cards+'冊</span></div>'+
 '<details class="tower-more"><summary>順位・詳細</summary><div class="tower-more-popover">'+
 '<h3>現在のペナルティ</h3>'+people+
 '<p class="hint">点数が少ない人ほど有利だよ。</p>'+compactEvent+
 '<div class="top-stats"><span>配置 '+g.movesMade+'冊</span><span>土台 '+g.bottom.count+' / 8</span></div>'+
 '</div></details></header>';
 return '<div class="tower-play-screen'+(editable?' is-my-turn':' is-waiting')+'">'+
 summary+board(g,editable)+hand(g,editable)+'</div>';
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
function fitTowerBoard(){
 const panel=document.querySelector('.tower-play-screen .board-panel');
 const board=panel?.querySelector('.tower-board');
 if(!board)return;
 const width=board.clientWidth;
 const height=board.clientHeight;
 const columns=Math.max(1,Number(board.dataset.cols)||1);
 const rows=Math.max(1,Number(board.dataset.rows)||1);
 if(width<20||height<20)return;
 // A slot is always smaller than its parent tile; adapt to short phones and
 // 8-tier towers while keeping room for up to 10 possible foundation spaces.
 const tile=Math.max(14,Math.floor(Math.min(51,width/(columns+.20),height/(rows+.12))));
 board.style.setProperty('--tile',tile+'px');
}
if(typeof ResizeObserver==='function'){
 const observer=new ResizeObserver(fitTowerBoard);
 observer.observe($('game-root'));
}
window.addEventListener('resize',fitTowerBoard);
function render(){
 const g=game();if(!g){$('game-root').innerHTML='<section class="panel">ロビーへ戻ります…</section>';return}
 const stamp=g.round+':'+g.stage+':'+g.currentId+':'+g.movesMade;
 if(stamp!==turnStamp){selected=null;pending=null;turnStamp=stamp}
 if(!g.myTurn){selected=null;pending=null}
 if(selected&&!(g.choices?.[selected]||[]).length){selected=null;pending=null}
 document.querySelector('.tower-online')?.setAttribute('data-stage',g.stage);
 $('game-root').innerHTML=({setup,intro:()=>intro(g),roundIntro:()=>intro(g),playing:()=>playing(g),roundResult:()=>result(g),finished:()=>finished(g)}[g.stage]||setup)(g);
 fitTowerBoard();
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
 ws.onopen=()=>{if(socket!==ws)return;retry=0;ui.connection('connection','connected');$('notice').hidden=true};
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