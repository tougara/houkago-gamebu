(function(){
 'use strict';
 const root=document.getElementById('versus-match');
 const engine=window.LinkBurstVersusEngine;
 const playersApi=window.HoukagoPlayers;
 const SELECT_KEY='houkago_link_burst_versus_players_v1';
 if(!root||!engine)return;
 const match={players:[],games:[],raf:0,last:0,paused:false,ended:false,
   countdown:3500,held:new Map(),keys:new Set(),keyHeld:new Map(),boardSignatures:['',''],result:'',confirmBack:false,pairSequence:[],finishTimer:0};
 function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(ch){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]})}
 function landscape(){return window.matchMedia?window.matchMedia('(orientation: landscape)').matches:window.innerWidth>window.innerHeight}
 function selectPlayers(){
   let ids=[];
   try{ids=JSON.parse(localStorage.getItem(SELECT_KEY)||'[]')}catch(e){}
   const data=playersApi&&playersApi.load?playersApi.load():null;
   const roster=data&&Array.isArray(data.roster)?data.roster:[];
   if(!Array.isArray(ids)||ids.length!==2||ids[0]===ids[1])return [];
   const selected=ids.map(function(id){return roster.find(function(p){return p.id===id})});
   return selected.every(Boolean)?selected:[];
 }
 function mini(pair){
   if(!pair)return '';
   return '<div class="v-mini">'+
     '<i class="v-block '+pair.a+'">'+engine.SYMBOL[pair.a]+'</i>'+
     '<i class="v-block '+pair.b+'">'+engine.SYMBOL[pair.b]+'</i></div>';
 }
 function arena(i){
   const p=match.players[i],side=i+1;
   return '<section class="arena" data-side="'+i+'" aria-label="'+side+'P '+esc(p.name)+'の盤面">'+
     '<header class="arena-header">'+
       '<div class="arena-person"><span class="avatar">'+esc(p.icon)+'</span>'+
         '<div class="details"><small>'+side+'P</small><strong>'+esc(p.name)+'</strong></div></div>'+
     '</header>'+
     '<div class="arena-core">'+
       '<div class="arena-controls" aria-label="'+side+'Pの操作ボタン">'+
         '<button class="v-control v-control-rotate" type="button" data-side="'+i+'" data-action="rotate" aria-label="'+side+'P 回転">↻</button>'+
         '<div class="v-control-spacer" aria-hidden="true"></div>'+
         '<div class="v-control-arrows" aria-label="'+side+'Pの左右移動">'+
           '<button class="v-control" type="button" data-side="'+i+'" data-action="left" aria-label="'+side+'P 左へ">←</button>'+
           '<button class="v-control" type="button" data-side="'+i+'" data-action="right" aria-label="'+side+'P 右へ">→</button>'+
         '</div>'+
         '<button class="v-control v-control-down" type="button" data-side="'+i+'" data-action="down" aria-label="'+side+'P 高速落下">↓</button>'+
       '</div>'+
       '<div class="arena-board-stack">'+
         '<div class="arena-field-wrap"><div class="arena-field" data-board="'+i+'" aria-label="'+side+'Pの7列13段盤面"></div></div>'+
       '</div>'+
       '<aside class="arena-next">'+
         '<div class="v-next-entry"><small>NEXT</small><div data-next="'+i+'"></div></div>'+
         '<div class="v-next-entry v-next-second"><small>NEXT2</small><div data-next2="'+i+'"></div></div>'+
       '</aside>'+
     '</div></section>';
 }
 function shell(){
   root.className='match-shell';
   root.innerHTML='<div class="match-arenas">'+
     '<div class="jam-flight-layer" data-jam-flight aria-hidden="true"></div>'+
     arena(0)+
     '<aside class="match-center" aria-label="対戦情報と一時停止">'+
       '<div class="center-mode"><strong>2人で対戦</strong><small>JAM BATTLE</small></div>'+
       '<div class="center-score p1"><small>1P SCORE</small><strong data-score="0">0</strong></div>'+
       '<div class="center-score p2"><small>2P SCORE</small><strong data-score="1">0</strong></div>'+
       '<button class="match-pause" data-pause type="button" aria-label="2人の対戦を一時停止">Ⅱ<span>PAUSE</span></button>'+
       '<div class="center-link-row">'+
         '<div class="center-link p1"><small>1P LINK</small><strong data-link="0">0</strong></div>'+
         '<div class="center-link p2"><small>2P LINK</small><strong data-link="1">0</strong></div>'+
       '</div>'+
       '<div class="center-jam-stack" aria-label="おじゃまブロックの到着予告">'+
         '<div class="center-jam p1" data-jam-box="0"><span>1P JAM</span><strong data-jam="0">0</strong></div>'+
         '<div class="center-jam p2" data-jam-box="1"><span>2P JAM</span><strong data-jam="1">0</strong></div>'+
         '<div class="center-jam-note" data-jam-note="0" aria-live="off"></div>'+
         '<div class="center-jam-note" data-jam-note="1" aria-live="off"></div>'+
       '</div>'+
     '</aside>'+
     arena(1)+'</div>'+
     '<div class="match-countdown" data-countdown role="status" aria-live="polite"><strong data-countdown-text>3</strong><p>READY?</p></div>'+
     '<div class="match-overlay" data-pause-menu hidden><div class="match-dialog" role="dialog" aria-modal="true" aria-label="一時停止">'+
        '<h2>PAUSE</h2><p>2人のゲームは停止中</p>'+
        '<div class="match-dialog-actions"><button type="button" data-resume>対戦に戻る</button>'+
        '<button type="button" class="secondary" data-back-setup>対戦準備に戻る</button>'+
        '<button type="button" data-hg-settings-open>⚙ 共通設定</button></div></div></div>'+
     '<div class="match-overlay" data-back-confirm hidden><div class="match-dialog" role="alertdialog" aria-modal="true" aria-label="対戦準備に戻る確認">'+
        '<h2>対戦を終了しますか？</h2>'+
        '<p>現在の対戦を終了して、対戦準備に戻ります。途中の状態は保存されません。</p>'+
        '<div class="match-dialog-actions">'+
          '<button type="button" data-cancel-back>キャンセルして一時停止に戻る</button>'+
          '<button type="button" class="secondary" data-confirm-back>対戦準備に戻る</button>'+
        '</div></div></div>'+
     '<div class="vs-finale" data-result hidden aria-live="polite">'+
        '<div class="vs-finale-flash" aria-hidden="true"></div>'+
        '<div class="vs-finale-ring" aria-hidden="true"></div>'+
        '<div class="vs-finale-impact" aria-hidden="true">K.O.!</div>'+
        '<div class="vs-finale-actions" data-finale-actions hidden>'+
          '<div class="vs-finale-summary" role="region" aria-label="対戦結果">'+
            '<small>BATTLE RESULT</small><h2 data-winner>勝負あり！</h2><p data-outcome>KOで決着</p>'+
          '</div>'+
          '<div class="vs-finale-buttons">'+
            '<button type="button" data-retry>もう一戦！</button>'+
            '<a href="./">2人を選び直す</a>'+
          '</div>'+
        '</div></div>'+
     '<div class="match-rotate-overlay" data-rotate hidden><div><strong>スマホを横向きにしてね</strong><p>左右の盤面を並べて2人で操作するよ。<br>縦画面ではゲームを停止するよ。</p></div></div>';
 }
 function releasePointer(pointerId){
   const entry=match.held.get(pointerId);
   if(!entry)return;
   match.held.delete(pointerId);
   if(!Array.from(match.held.values()).some(function(h){return h.button===entry.button})){
     entry.button.classList.remove('is-held');
   }
 }
 function releaseAll(){
   for(const id of Array.from(match.held.keys()))releasePointer(id);
   match.keys.clear();
   match.keyHeld.clear();
 }
 function stop(){
   if(match.raf){cancelAnimationFrame(match.raf);match.raf=0}
   match.last=0;
 }
 function updateOverlays(){
   const portrait=root.querySelector('[data-rotate]');
   if(portrait)portrait.hidden=landscape();
   const pause=root.querySelector('[data-pause-menu]');if(pause)pause.hidden=!match.paused||match.confirmBack;
   const confirm=root.querySelector('[data-back-confirm]');if(confirm)confirm.hidden=!match.confirmBack;
   const end=root.querySelector('[data-result]');if(end)end.hidden=!match.ended;
   const count=root.querySelector('[data-countdown]');
   if(count)count.hidden=match.paused||match.ended||match.countdown<=0;
   if(count&&!count.hidden){
     const text=match.countdown>2500?'3':match.countdown>1500?'2':match.countdown>500?'1':'START!';
     const cell=root.querySelector('[data-countdown-text]');
     if(cell&&cell.textContent!==text)cell.textContent=text;
   }
 }
 function playable(){return !match.paused&&!match.ended&&match.countdown<=0&&landscape()&&document.visibilityState!=='hidden'}
 function drawArena(i,force){
   const st=match.games[i];
   const piece=st.piece;
   const signature=st.phase+'|'+st.link+'|'+st.board.map(function(r){return r.join(',')}).join(';')+
      '|'+(piece?[piece.x,piece.y,piece.rot,piece.a,piece.b].join(','):'')+'|'+st.groups.length;
   if(force||match.boardSignatures[i]!==signature){
     match.boardSignatures[i]=signature;
     const visible=new Map();
     if(piece)for(const c of (function(){
       const rot=[[[0,0],[1,0]],[[0,0],[0,1]],[[0,0],[-1,0]],[[0,0],[0,-1]]][piece.rot];
       return rot.map(function(o,n){return {x:piece.x+o[0],y:piece.y+o[1],color:n?piece.b:piece.a}});
     })())if(c.y>=engine.HIDDEN)visible.set(c.y+':'+c.x,c.color);
     const charged=new Set(st.phase==='charge'?st.groups.flat().map(function(v){return v.y+':'+v.x}):[]);
     const ghosts=engine.ghost(st);
     let html='';
     for(let row=engine.HIDDEN;row<engine.ROWS;row++)for(let x=0;x<engine.COLS;x++){
       const key=row+':'+x;
       const color=visible.get(key)||st.board[row][x];
       const gh=color?null:ghosts.get(key);
       const value=color||gh;
       html+='<span class="v-cell '+(row<engine.HIDDEN+2?'warning':'')+'">'+
         (value?'<i class="v-block '+value+(gh?' ghost':'')+(charged.has(key)?' charged':'')+'">'+engine.SYMBOL[value]+'</i>':'')+'</span>';
     }
     const board=root.querySelector('[data-board="'+i+'"]');
     if(board)board.innerHTML=html;
   }
   const score=root.querySelector('[data-score="'+i+'"]');if(score)score.textContent=st.score.toLocaleString('ja-JP');
   const link=root.querySelector('[data-link="'+i+'"]');if(link)link.textContent=String(st.maxLink);
   const incoming=engine.incomingCount(st);
   const jam=root.querySelector('[data-jam="'+i+'"]');if(jam)jam.textContent=String(incoming);
   const jamBox=root.querySelector('[data-jam-box="'+i+'"]');
   if(jamBox)jamBox.dataset.pending=incoming>0?'true':'false';
   const jamNote=root.querySelector('[data-jam-note="'+i+'"]');
   if(jamNote)jamNote.textContent=st.notice||'';
   const next=root.querySelector('[data-next="'+i+'"]');
   if(next){const future=st.queue[0],key=future?future.a+':'+future.b:'';
      if(next.dataset.pair!==key){next.dataset.pair=key;next.innerHTML=mini(future)}}
   const next2=root.querySelector('[data-next2="'+i+'"]');
   if(next2){const future2=st.queue[1],key2=future2?future2.a+':'+future2.b:'';
      if(next2.dataset.pair!==key2){next2.dataset.pair=key2;next2.innerHTML=mini(future2)}}
 }
 function draw(force){drawArena(0,force);drawArena(1,force)}
 function finish(){
   if(match.ended)return;
   const p1=match.games[0].over,p2=match.games[1].over;
   if(!p1&&!p2)return;
   // Preserve the simultaneous-KO draw rule and both final boards.
   match.ended=true;stop();releaseAll();
   const winningSide=p1&&p2?-1:(p1?1:0);
   const message=winningSide<0?'DRAW!':(winningSide+1)+'P WIN!';
   const winner=winningSide<0?null:match.players[winningSide];
   root.dataset.finished='true';
   root.querySelectorAll('.arena').forEach(function(arena,i){
     arena.dataset.finish=winningSide<0?'draw':(i===winningSide?'win':'lose');
   });
   const header=root.querySelector('[data-winner]');
   if(header)header.textContent=message;
   const outcome=root.querySelector('[data-outcome]');
   if(outcome)outcome.textContent=winner?winner.icon+' '+winner.name+' の勝利！':'両者同時KO！';
   updateOverlays();
   if(match.finishTimer)clearTimeout(match.finishTimer);
   const reduced=document.documentElement.dataset.hgMotion==='reduced'||
      (window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches);
   match.finishTimer=setTimeout(function(){
     match.finishTimer=0;
     if(!match.ended)return;
     const actions=root.querySelector('[data-finale-actions]');
     if(actions)actions.hidden=false;
   },reduced?450:2250);
 }
 function repeatActions(dt){
   // Use the same horizontal movement cadence for touch and PC keyboard.
   function repeatHeld(held){
     if(held.action!=='left'&&held.action!=='right')return;
     held.elapsed+=dt;
     let repeatCount=0;
     while(held.elapsed>=held.nextRepeat&&repeatCount++<3){
       engine.move(match.games[held.side],held.action==='left'?-1:1);
       held.nextRepeat+=82;
     }
   }
   for(const held of match.held.values())repeatHeld(held);
   for(const held of match.keyHeld.values())repeatHeld(held);
 }
 // A quick non-blocking visual makes the send readable right away.
 function launchJamFlight(from,count){
   const target=root.querySelector('[data-jam-flight]');
   if(!target||count<=0)return;
   target.innerHTML='<span class="jam-projectile" data-from="'+from+'">J <small>×'+count+'</small></span>';
 }
 // Resolve both players at the SAME boundary. Each player uses their attack
 // to cancel existing incoming JAM first, then simultaneous new attacks
 // neutralize one another, and only the leftover crosses the arena.
 function resolveAttacks(){
   const ready=match.games.map(function(st){return !st.over&&st.phase==='interturn'});
   if(!ready[0]&&!ready[1])return;
   const attacks=match.games.map(function(st,i){return ready[i]?st.readyAttack:0});
   for(let i=0;i<2;i++)if(ready[i]){
     const result=engine.counterJam(match.games[i],attacks[i]);
     attacks[i]=result.remaining;
   }
   const mutual=Math.min(attacks[0],attacks[1]);
   if(mutual){
     attacks[0]-=mutual;attacks[1]-=mutual;
     for(let i=0;i<2;i++)if(ready[i]){
       match.games[i].counteredJam+=mutual;
       engine.notice(match.games[i],'COUNTER −'+mutual);
     }
   }
   for(let i=0;i<2;i++)if(attacks[i]>0){
     const other=1-i;
     engine.queueJam(match.games[other],attacks[i]);
     launchJamFlight(i,attacks[i]);
     match.games[i].sentJam+=attacks[i];
     engine.notice(match.games[i],'SEND +'+attacks[i]);
   }
   for(let i=0;i<2;i++)if(ready[i])engine.finishTurn(match.games[i]);
 }
 function sharedPair(index){
   while(match.pairSequence.length<=index){
     const colors=engine.COLORS;
     match.pairSequence.push({
       a:colors[Math.floor(Math.random()*colors.length)],
       b:colors[Math.floor(Math.random()*colors.length)]
     });
   }
   return match.pairSequence[index];
 }
 function frame(ts){
   match.raf=0;
   if(match.paused||match.ended||!landscape()||document.visibilityState==='hidden')return;
   const dt=match.last?Math.min(50,Math.max(0,ts-match.last)):0;match.last=ts;
   if(match.countdown>0){
     match.countdown=Math.max(0,match.countdown-dt);
   }else{
     repeatActions(dt);
     for(let i=0;i<2;i++){
       const soft=[...match.held.values()].some(function(h){return h.side===i&&h.action==='down'})||
         (i===0?match.keys.has('s'):match.keys.has('arrowdown'));
       engine.tick(match.games[i],dt,soft);
     }
     resolveAttacks();
     draw(false);finish();
   }
   updateOverlays();
   if(!match.ended&&!match.paused)match.raf=requestAnimationFrame(frame);
 }
 function continueLoop(){
   updateOverlays();
   if(match.raf||match.paused||match.ended||!landscape()||document.visibilityState==='hidden')return;
   match.last=0;match.raf=requestAnimationFrame(frame);
 }
 function pause(auto){
   if(match.paused||match.ended)return;
   match.confirmBack=false;match.paused=true;stop();releaseAll();updateOverlays();
 }
 function resume(){
   if(match.ended)return;
   match.confirmBack=false;match.paused=false;updateOverlays();continueLoop();
 }
 function newRound(){
   if(match.finishTimer){clearTimeout(match.finishTimer);match.finishTimer=0}
   stop();releaseAll();
   match.pairSequence=[];
   match.games=match.players.map(function(p){return engine.make(p,sharedPair)});
   match.boardSignatures=['',''];match.paused=false;match.ended=false;match.confirmBack=false;
   match.countdown=3500;match.last=0;
   shell();draw(true);updateOverlays();continueLoop();
 }
 function command(side,action){
   if(!playable())return;
   const st=match.games[side];if(!st)return;
   if(action==='left')engine.move(st,-1);
   if(action==='right')engine.move(st,1);
   if(action==='rotate')engine.rotate(st);
   if(action==='down')engine.down(st);
   drawArena(side,false);
 }
 root.addEventListener('pointerdown',function(e){
   const button=e.target.closest('[data-action]');
   if(!button||!root.contains(button))return;
   e.preventDefault();
   if(!playable()||match.held.has(e.pointerId))return;
   const side=Number(button.dataset.side),action=button.dataset.action;
   if(![0,1].includes(side)||!['left','right','down','rotate'].includes(action))return;
   // Each pointer captures only its own button. Releasing 1P cannot cancel 2P.
   const entry={side:side,action:action,button:button,elapsed:0,nextRepeat:230};
   match.held.set(e.pointerId,entry);
   button.classList.add('is-held');
   try{button.setPointerCapture(e.pointerId)}catch(err){}
   command(side,action);
 });
 function onPointerExit(e){releasePointer(e.pointerId)}
 window.addEventListener('pointerup',onPointerExit);
 window.addEventListener('pointercancel',onPointerExit);
 root.addEventListener('lostpointercapture',onPointerExit);
 root.addEventListener('click',function(e){
   if(e.target.closest('[data-pause]')){pause(false);return}
   if(e.target.closest('[data-resume]')){resume();return}
   if(e.target.closest('[data-back-setup]')){
     if(!match.paused||match.ended)return;
     match.confirmBack=true;
     updateOverlays();
     return;
   }
   if(e.target.closest('[data-cancel-back]')){
     if(!match.confirmBack)return;
     match.confirmBack=false;
     updateOverlays();
     return;
   }
   if(e.target.closest('[data-confirm-back]')){
     if(!match.paused||!match.confirmBack||match.ended)return;
     location.href='./';
     return;
   }
   if(e.target.closest('[data-retry]')){newRound();return}
 });
 // Physical key codes keep the controls stable on different PC keyboard layouts.
 // 1P: A / S / D and Space. 2P: arrows left / down / right and Enter.
 const keyMap={
   KeyA:['a',0,'left'],KeyS:['s',0,'down'],KeyD:['d',0,'right'],Space:['space',0,'rotate'],
   ArrowLeft:['arrowleft',1,'left'],ArrowDown:['arrowdown',1,'down'],
   ArrowRight:['arrowright',1,'right'],Enter:['enter',1,'rotate'],NumpadEnter:['enter',1,'rotate']
 };
 const fallbackKeys={
   a:'KeyA',s:'KeyS',d:'KeyD',' ':'Space',
   arrowleft:'ArrowLeft',arrowdown:'ArrowDown',arrowright:'ArrowRight',enter:'Enter'
 };
 function keyBinding(e){
   const code=keyMap[e.code]?e.code:fallbackKeys[String(e.key||'').toLowerCase()];
   return code?keyMap[code]:null;
 }
 window.addEventListener('keydown',function(e){
   if(e.isComposing)return;
   if(e.key==='Escape'){
     e.preventDefault();
     if(match.confirmBack){match.confirmBack=false;updateOverlays()}
     else if(match.paused)resume();
     else pause(false);
     return;
   }
   const binding=keyBinding(e);
   // Keep normal Enter/Space behavior on pause and result buttons.
   if(!binding||!playable())return;
   e.preventDefault();
   const [id,side,action]=binding;
   if(match.keys.has(id))return;
   match.keys.add(id);
   match.keyHeld.set(id,{side,action,elapsed:0,nextRepeat:230});
   command(side,action);
 });
 window.addEventListener('keyup',function(e){
   const binding=keyBinding(e);if(!binding)return;
   match.keys.delete(binding[0]);
   match.keyHeld.delete(binding[0]);
 });
 window.addEventListener('blur',function(){releaseAll();pause(true)});
 document.addEventListener('visibilitychange',function(){if(document.visibilityState==='hidden')pause(true)});
 window.addEventListener('resize',function(){
   if(!landscape()){stop();releaseAll()}
   updateOverlays();if(landscape())continueLoop();
 });
 window.addEventListener('orientationchange',function(){
   if(!landscape()){stop();releaseAll()}
   updateOverlays();if(landscape())continueLoop();
 });
 match.players=selectPlayers();
 if(match.players.length!==2){
   root.className='match-shell';
   root.innerHTML='<div class="match-overlay"><div class="match-dialog">'+
      '<h2>プレイヤーの確認が必要</h2><p>対戦準備で異なる2人を選んでね。</p>'+
      '<a class="secondary" href="./">2人を選ぶ</a></div></div>';
 }else{
   newRound();
 }
})();
