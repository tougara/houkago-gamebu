(function(){
 'use strict';
 const root=document.getElementById('versus-match');
 const engine=window.LinkBurstVersusEngine;
 const playersApi=window.HoukagoPlayers;
 const SELECT_KEY='houkago_link_burst_versus_players_v1';
 const resumeApi=window.HoukagoResume;
 const RESUME_ID='link-burst-versus';
 const MATCHUP_KEY='houkago_link_burst_versus_matchups_v1';
 if(!root||!engine)return;
 const match={players:[],games:[],raf:0,last:0,paused:false,ended:false,
   countdown:3500,held:new Map(),keys:new Set(),keyHeld:new Map(),boardSignatures:['',''],result:'',confirmBack:false,pairSequence:[],finishTimer:0,saveAccum:0};
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
         '<div class="v-chain-fx" data-chain-fx="'+i+'" hidden aria-live="off"><strong></strong><span></span><em></em></div>'+ 
         '<div class="v-battle-cue" data-battle-cue="'+i+'" hidden aria-live="off"></div>'+
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
       '<div class="center-mode"><strong>2人で対戦</strong><small data-pressure>JAM14個/回</small><small data-pressure-rate hidden></small></div>'+
       '<div class="center-score p1"><small>1P SCORE</small><strong data-score="0">0</strong></div>'+
       '<div class="center-score p2"><small>2P SCORE</small><strong data-score="1">0</strong></div>'+
       '<button class="match-pause" data-pause type="button" aria-label="2人の対戦を一時停止">Ⅱ<span>PAUSE</span></button>'+
       '<div class="center-link-row">'+
         '<div class="center-link p1"><small>1P MAX LINK</small><strong data-link="0">0</strong></div>'+
         '<div class="center-link p2"><small>2P MAX LINK</small><strong data-link="1">0</strong></div>'+
       '</div>'+
       '<div class="center-jam-stack" aria-label="おじゃまブロックの到着予告">'+
         '<div class="center-jam p1" data-jam-box="0"><span>1P 受信JAM</span><strong data-jam="0">0</strong><small data-jam-forecast="0">次 0</small></div>'+
         '<div class="center-jam p2" data-jam-box="1"><span>2P 受信JAM</span><strong data-jam="1">0</strong><small data-jam-forecast="1">次 0</small></div>'+
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
            '<p class="matchup-record" data-matchup-record aria-live="polite"></p>'+
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
 // Fit large scores into the shared middle console without hiding digits.
 // Run only when the score changes, a new round starts or the window resizes.
 function fitScore(el,value,force){
   const shown=Number(value||0).toLocaleString('ja-JP');
   if(!force&&el.textContent===shown)return;
   el.textContent=shown;
   el.style.fontSize='';
   const width=el.clientWidth;
   if(!width)return;
   let px=parseFloat(window.getComputedStyle(el).fontSize)||24;
   while(el.scrollWidth>width+1&&px>12){
     px-=1;
     el.style.fontSize=px+'px';
   }
 }
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
     const bursting=new Set(st.phase==='burst'?st.burstCells:[]);
     const ghosts=engine.ghost(st);
     let html='';
     for(let row=engine.HIDDEN;row<engine.ROWS;row++)for(let x=0;x<engine.COLS;x++){
       const key=row+':'+x;
       const color=visible.get(key)||st.board[row][x];
       const gh=color?null:ghosts.get(key);
       const value=color||gh;
       html+='<span class="v-cell '+(row<engine.HIDDEN+2?'warning':'')+'">'+
         (value?'<i class="v-block '+value+(gh?' ghost':'')+(charged.has(key)?' charged':'')+(bursting.has(key)?' bursting':'')+'">'+engine.SYMBOL[value]+'</i>':'')+'</span>';
     }
     const board=root.querySelector('[data-board="'+i+'"]');
     if(board)board.innerHTML=html;
   }
   const fx=root.querySelector('[data-chain-fx="'+i+'"]');
   if(fx){
     const active=['charge','burst','gravity','settle'].includes(st.phase)&&(st.groups.length>0||st.link>0);
     fx.hidden=!active;
     if(active){
       const link=st.phase==='charge'?st.link+1:st.link;
       const combo=st.phase==='charge'?st.groups.length:st.currentCombo;
       const key=link+':'+combo;
       if(fx.dataset.step!==key){
         fx.dataset.step=key;
         fx.querySelector('strong').textContent=link+' LINK!';
         fx.querySelector('span').textContent=combo>=2?combo+' COMBO!':'CHAIN!';
         fx.classList.remove('pop');
         void fx.offsetWidth;
         fx.classList.add('pop');
       }
       const predicted=st.phase==='charge'
         ?engine.scoreGain(st.groups.reduce(function(n,g){return n+g.length},0),link,combo)
         :st.lastGain;
       fx.querySelector('em').textContent=st.phase==='charge'?'READY':('+'+predicted.toLocaleString('ja-JP')+' SCORE');
       fx.dataset.phase=st.phase;
       fx.dataset.power=String(Math.min(8,link+Math.max(0,combo-1)));
     }else{delete fx.dataset.step;delete fx.dataset.phase}
   }
   const score=root.querySelector('[data-score="'+i+'"]');
   if(score)fitScore(score,st.score,force);
   const link=root.querySelector('[data-link="'+i+'"]');if(link)link.textContent=String(st.maxLink);
   const incoming=engine.incomingCount(st);
   const jam=root.querySelector('[data-jam="'+i+'"]');if(jam)jam.textContent=String(incoming);
   const jamBox=root.querySelector('[data-jam-box="'+i+'"]');
   if(jamBox){
     jamBox.dataset.pending=incoming>0?'true':'false';
     jamBox.dataset.heavy=incoming>=14?'true':'false';
   }
   const forecast=root.querySelector('[data-jam-forecast="'+i+'"]');
   if(forecast)forecast.textContent=incoming>0
      ?'次 '+Math.min(engine.jamWaveSize(st),incoming)+' ／ 残 '+Math.max(0,incoming-engine.jamWaveSize(st))
      :'次 0';
   const jamNote=root.querySelector('[data-jam-note="'+i+'"]');
   if(jamNote)jamNote.textContent=st.notice||(incoming>0?'相殺チャンス！':'');
   // The landing cue plays only once per new notice, not each animation frame.
   if(st.notice&&st.notice.startsWith('JAM ×')&&st.lastCueNotice!==st.notice){
     st.lastCueNotice=st.notice;
     showBattleCue(i,'着弾 '+st.notice.slice(4)+'個','landing');
   }else if(!st.notice){st.lastCueNotice='';}
   const next=root.querySelector('[data-next="'+i+'"]');
   if(next){const future=st.queue[0],key=future?future.a+':'+future.b:'';
      if(next.dataset.pair!==key){next.dataset.pair=key;next.innerHTML=mini(future)}}
   const next2=root.querySelector('[data-next2="'+i+'"]');
   if(next2){const future2=st.queue[1],key2=future2?future2.a+':'+future2.b:'';
      if(next2.dataset.pair!==key2){next2.dataset.pair=key2;next2.innerHTML=mini(future2)}}
 }
 function draw(force){
   drawArena(0,force);drawArena(1,force);
   const pressure=root.querySelector('[data-pressure]');
   if(pressure&&match.games.length===2){
     const wave=engine.jamWaveSize(match.games[0]);
     const boost=engine.jamPressure(match.games[0]);
     pressure.textContent='JAM'+wave+'個/回';
      const rate=root.querySelector('[data-pressure-rate]');
      if(rate){rate.hidden=boost<=1;rate.textContent=boost>1?'攻撃×'+boost:''}
     const center=pressure.closest('.center-mode');
     if(center)center.dataset.pressure=boost>1?'overtime':wave>14?'rising':'normal';
   }
 }
 function recordMatch(winningSide){
   const playerIds=match.players.map(p=>p.id);
   if(playerIds.length!==2||playerIds[0]===playerIds[1])return null;
   const pairKey=playerIds.slice().sort().join('|');
   let history={};
   try{history=JSON.parse(localStorage.getItem(MATCHUP_KEY)||'{}')||{}}catch(e){}
   if(!history||typeof history!=='object'||Array.isArray(history))history={};
   const prev=history[pairKey]&&typeof history[pairKey]==='object'?history[pairKey]:{};
   const record={
     wins:{},draws:Math.max(0,Number(prev.draws)||0),
     played:Math.max(0,Number(prev.played)||0)+1
   };
   for(const id of playerIds)record.wins[id]=Math.max(0,Number(prev.wins?.[id])||0);
   if(winningSide<0)record.draws++;
   else record.wins[playerIds[winningSide]]++;
   history[pairKey]=record;
   try{localStorage.setItem(MATCHUP_KEY,JSON.stringify(history))}catch(e){}
   if(playersApi?.recordGame){
     const scores={},metrics={};
     match.players.forEach((p,i)=>{
       scores[p.id]=match.games[i].score;
       const st=match.games[i];
       metrics[p.id]={bestLink:st.maxLink,bestCombo:st.maxCombo,
         totalClears:st.clears,totalJamSent:st.sentJam,totalJamCountered:st.counteredJam,
         totalDraws:winningSide<0?1:0};
     });
     playersApi.recordGame({gameId:'link-burst-versus',participants:match.players,
       winners:winningSide<0?[]:[playerIds[winningSide]],scores,metrics});
   }
   return record;
 }
 function finish(){
   if(match.ended)return;
   const p1=match.games[0].over,p2=match.games[1].over;
   if(!p1&&!p2)return;
   // Preserve the simultaneous-KO draw rule and both final boards.
   match.ended=true;stop();releaseAll();resumeApi?.clear?.(RESUME_ID);
   const winningSide=p1&&p2?-1:(p1?1:0);
   const message=winningSide<0?'DRAW!':(winningSide+1)+'P WIN!';
   const winner=winningSide<0?null:match.players[winningSide];
   const record=recordMatch(winningSide);
   root.dataset.finished='true';
   root.querySelectorAll('.arena').forEach(function(arena,i){
     arena.dataset.finish=winningSide<0?'draw':(i===winningSide?'win':'lose');
   });
   const header=root.querySelector('[data-winner]');
   if(header)header.textContent=message;
   const outcome=root.querySelector('[data-outcome]');
   if(outcome)outcome.textContent=winner?winner.icon+' '+winner.name+' の勝利！':'両者同時KO！';
   const matchup=root.querySelector('[data-matchup-record]');
   if(matchup&&record){
     const p1=match.players[0],p2=match.players[1];
     matchup.textContent='通算 '+p1.name+' '+record.wins[p1.id]+'勝 ／ '+p2.name+' '+record.wins[p2.id]+'勝 ／ 引分 '+record.draws+'回';
   }
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
 function showBattleCue(side,message,kind){
   const el=root.querySelector('[data-battle-cue="'+side+'"]');
   if(!el||!message)return;
   if(el.hideTimer)clearTimeout(el.hideTimer);
   el.textContent=message;
   el.dataset.kind=kind||'attack';
   el.hidden=false;
   el.classList.remove('show');
   void el.offsetWidth;
   el.classList.add('show');
   const hiddenAfter=document.documentElement.dataset.hgMotion==='reduced'?700:1100;
   el.hideTimer=setTimeout(function(){
     el.hidden=true;el.classList.remove('show');el.hideTimer=0;
   },hiddenAfter);
 }
 // A quick non-blocking visual makes the send readable right away.
 function launchJamFlight(from,count){
   const target=root.querySelector('[data-jam-flight]');
   if(!target||count<=0)return;
   // A short fast projectile for each send, without discarding a simultaneous
   // counterattack's animation.
   const particle=document.createElement('span');
   particle.className='jam-projectile';
   particle.dataset.from=String(from);
   particle.dataset.power=count>=14?'high':'normal';
   particle.innerHTML='J <small>×'+count+'</small>';
   target.appendChild(particle);
   setTimeout(function(){particle.remove()},300);
 }
 // Resolve both players at the SAME boundary. Each player uses their attack
 // to cancel existing incoming JAM first, then simultaneous new attacks
 // neutralize one another, and only the leftover crosses the arena.
 function resolveAttacks(){
   const ready=match.games.map(function(st){return !st.over&&st.phase==='interturn'});
   if(!ready[0]&&!ready[1])return;
   const attacks=match.games.map(function(st,i){return ready[i]?st.readyAttack:0});
   const cues=[[],[]];
   for(let i=0;i<2;i++)if(ready[i]){
     const result=engine.counterJam(match.games[i],attacks[i]);
     attacks[i]=result.remaining;
     if(result.countered>0)cues[i].push('COUNTER −'+result.countered);
   }
   const mutual=Math.min(attacks[0],attacks[1]);
   if(mutual){
     attacks[0]-=mutual;attacks[1]-=mutual;
     for(let i=0;i<2;i++)if(ready[i]){
       match.games[i].counteredJam+=mutual;
       engine.notice(match.games[i],'COUNTER −'+mutual);
       cues[i].push('相殺 −'+mutual);
     }
   }
   for(let i=0;i<2;i++)if(attacks[i]>0){
     const other=1-i;
     engine.queueJam(match.games[other],attacks[i]);
     launchJamFlight(i,attacks[i]);
     match.games[i].sentJam+=attacks[i];
     engine.notice(match.games[i],'SEND +'+attacks[i]);
     cues[i].push('SEND +'+attacks[i]);
     cues[other].push('受信 +'+attacks[i]);
   }
   for(let i=0;i<2;i++)if(cues[i].length){
     showBattleCue(i,cues[i].join(' / '),cues[i].some(function(x){return x.includes('COUNTER')||x.includes('相殺')})?'counter':'attack');
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
     if(!match.ended){match.saveAccum+=dt;if(match.saveAccum>=1500)persistMatch();}
   }
   updateOverlays();
   if(!match.ended&&!match.paused)match.raf=requestAnimationFrame(frame);
 }
 function continueLoop(){
   updateOverlays();
   if(match.raf||match.paused||match.ended||!landscape()||document.visibilityState==='hidden')return;
   match.last=0;match.raf=requestAnimationFrame(frame);
 }
 function pause(auto,saveNow=true){
   if(match.paused||match.ended)return;
   match.confirmBack=false;match.paused=true;stop();releaseAll();updateOverlays();if(saveNow)persistMatch();
 }
 function resume(){
   if(match.ended)return;
   match.confirmBack=false;match.paused=false;updateOverlays();continueLoop();
 }
  function persistMatch(){
   if(!resumeApi?.save||match.ended||match.games.length!==2)return;
   const games=match.games.map(function(st){const copy=Object.assign({},st);delete copy.pairSource;return copy});
   resumeApi.save(RESUME_ID,{
     title:'リンクバースト！2人対戦',path:'/games/link-burst/versus/play.html',
     summary:match.players.map(p=>p.name).join(' VS ')+' ／ 対戦の続き'
   },{version:1,players:match.players,games,pairSequence:match.pairSequence,countdown:match.countdown});
   match.saveAccum=0;
 }
 function restoreMatch(saved){
   if(!saved||!Array.isArray(saved.games)||saved.games.length!==2||
      !Array.isArray(saved.players)||saved.players.length!==2)return false;
   stop();releaseAll();
   match.players=saved.players;
   match.pairSequence=Array.isArray(saved.pairSequence)?saved.pairSequence:[];
   match.games=saved.games.map(function(st){
     st.pairSource=sharedPair;st.pairIndex=Math.max(0,Number(st.pairIndex)||0);return st;
   });
   match.countdown=Math.max(0,Number(saved.countdown)||0);
   match.ended=false;match.paused=true;match.confirmBack=false;match.result='';
   match.last=0;match.saveAccum=0;match.boardSignatures=['',''];
   shell();draw(true);updateOverlays();
   return true;
 }
function newRound(clearSave=true){
   if(clearSave)resumeApi?.clear?.(RESUME_ID);
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
     resumeApi?.clear?.(RESUME_ID);
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
 window.addEventListener('houkago-back-guard-open',function(){pause(true)});
 window.addEventListener('houkago-back-guard-save',persistMatch);
 window.addEventListener('pagehide',persistMatch);
 window.addEventListener('blur',function(){releaseAll();pause(true)});
 document.addEventListener('visibilitychange',function(){if(document.visibilityState==='hidden')pause(true)});
 window.addEventListener('resize',function(){
   if(!landscape()){stop();releaseAll()}
   updateOverlays();
   if(landscape()){draw(true);continueLoop();}
 });
 window.addEventListener('orientationchange',function(){
   if(!landscape()){stop();releaseAll()}
   updateOverlays();
   if(landscape()){draw(true);continueLoop();}
 });
 match.players=selectPlayers();
 if(match.players.length!==2){
   root.className='match-shell';
   root.innerHTML='<div class="match-overlay"><div class="match-dialog">'+
      '<h2>プレイヤーの確認が必要</h2><p>対戦準備で異なる2人を選んでね。</p>'+
      '<a class="secondary" href="./">2人を選ぶ</a></div></div>';
  }else{
   const saved=resumeApi?.load?.(RESUME_ID);
   newRound(false);
   if(saved?.state){
     pause(true,false);
     setTimeout(function(){
       resumeApi.offer({gameId:RESUME_ID,onResume:restoreMatch,onNew:function(){newRound(true)}});
     },60);
   }
 }
})();
