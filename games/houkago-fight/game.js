import {WORLD,FIGHTERS,FIXED_DT,MAX_HP,ROUND_SECONDS,createMatch,startMatch,stepMatch,fighterStatus,MOVES} from './engine.js';
/* Local CPU practice. No online/room support yet. */
const $=id=>document.getElementById(id);
const canvas=$('battle'),ctx=canvas.getContext('2d',{alpha:false});
const menu=$('menu'),pauseButton=$('pauseBtn'),fullButton=$('fullBtn'),effectLabel=$('fxText');
const held=new Set(),pointers=new Map();
const keyMap={KeyA:'left',KeyD:'right',ArrowLeft:'left',ArrowRight:'right',
 KeyJ:'light',KeyK:'heavy',Space:'jump',ShiftLeft:'guard',ShiftRight:'guard'};
let game=createMatch(),paused=false,last=performance.now(),lag=0,flash=0,shake=0,fx=[];
let ai={nextHit:0,nextJump:0,guardUntil:0};
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
function resetInput(){held.clear();pointers.clear();document.querySelectorAll('[data-key]').forEach(b=>b.classList.remove('pressed'))}
for(const type of ['keydown','keyup'])document.addEventListener(type,e=>{
 const key=keyMap[e.code];if(!key||e.altKey||e.ctrlKey||e.metaKey)return;
 e.preventDefault();if(type==='keydown')held.add(key);else held.delete(key);
});
window.addEventListener('blur',resetInput);
document.addEventListener('visibilitychange',()=>{if(document.hidden){resetInput();if(game.phase==='playing'&&!paused)pauseGame(true)}});
document.querySelectorAll('[data-key]').forEach(button=>{
 button.addEventListener('pointerdown',e=>{
  if(e.button!==0)return;e.preventDefault();
  try{button.setPointerCapture?.(e.pointerId)}catch{}
  pointers.set(e.pointerId,button.dataset.key);held.add(button.dataset.key);button.classList.add('pressed');
 });
 const release=e=>{
  const key=pointers.get(e.pointerId);if(!key)return;
  pointers.delete(e.pointerId);
  if(![...pointers.values()].includes(key))held.delete(key);
  button.classList.remove('pressed');
 };
 for(const type of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(type,release);
});
$('portraitProceed').addEventListener('click',()=>$('rotateNotice').classList.add('hide'));
fullButton.addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await $('fightApp').requestFullscreen?.()}catch{}});
function overlay(html){menu.innerHTML='<div class="fight-menu-card">'+html+'</div>';menu.hidden=false}
const picker=()=>'<div class="menu-overline">NEW MATCH / CPU BATTLE</div><h1>放課後ファイト！</h1>'+
 '<p class="menu-lead">100HPを削ってKO！</p><p class="menu-sub">60秒×2ラウンド先取・画面端では落ちない</p>'+
 '<fieldset class="fighter-picker"><legend>自分のキャラ</legend>'+
 '<label class="pick"><input type="radio" name="fighter" value="speed" checked><span><b>アオ</b><small>スピード型</small></span></label>'+
 '<label class="pick"><input type="radio" name="fighter" value="power"><span><b>アカ</b><small>パワー型</small></span></label></fieldset>'+
 '<button id="startBtn" class="primary-btn">CPUと対戦する</button><p class="menu-hint">操作6ボタン：← → 移動／弱・強・ジャンプ・ガード。弱→弱→強のヒットコンボ！</p>';
function start(){
 const chosen=menu.querySelector('input[name=fighter]:checked')?.value||'speed';
 game=createMatch({p1:chosen,p2:chosen==='speed'?'power':'speed'});startMatch(game);
 resetInput();paused=false;lag=0;fx=[];ai={nextHit:0,nextJump:0,guardUntil:0};
 $('p1Name').textContent=FIGHTERS[chosen].name+'（あなた）';
 $('p2Name').textContent=FIGHTERS[game.fighters[1].type].name+'（CPU）';
 menu.hidden=true;pauseButton.disabled=false;pauseButton.textContent='Ⅱ';
 updateHUD();announce('ROUND 1  FIGHT!');
}
function pauseGame(value){
 if(game.phase!=='playing'&&game.phase!=='roundOver')return;
 paused=!!value;resetInput();pauseButton.textContent=paused?'▶':'Ⅱ';
 if(paused)overlay('<h2>一時停止</h2><p class="menu-sub">対戦を停止中</p><button class="primary-btn" data-menu="resume">再開する</button><button class="fight-back" data-menu="restart">タイトルへ</button>');
 else menu.hidden=true;
}
pauseButton.addEventListener('click',()=>pauseGame(!paused));
menu.addEventListener('click',e=>{
 const b=e.target.closest('button');if(!b)return;
 if(b.id==='startBtn'){start();return}
 if(b.dataset.menu==='resume'){pauseGame(false);return}
 if(b.dataset.menu==='restart'){game=createMatch();resetInput();paused=false;pauseButton.disabled=true;overlay(picker())}
});
function announce(text){effectLabel.textContent=text;effectLabel.classList.remove('show');void effectLabel.offsetWidth;effectLabel.classList.add('show')}
function consumeEvents(){
 for(const ev of game.events){
  if(ev.type==='hit'){
   fx.push({kind:'hit',x:ev.x,y:ev.y,life:.34,max:.34,label:'−'+ev.damage,heavy:ev.heavy});
   flash=ev.heavy?.15:.05;shake=ev.heavy?5:2;
   if(ev.hits>1)announce(ev.hits+' HIT COMBO');
   if(ev.id==='p2')$('comboHint').textContent=ev.hits>1?ev.hits+' HIT!  弱→弱→強':'命中！ 弱→弱→強でつながる';
  }else if(ev.type==='guard'){
   fx.push({kind:'guard',x:ev.x,y:ev.y,life:.3,max:.3,label:'GUARD'});
  }else if(ev.type==='roundEnd'){
   shake=7;flash=.24;
   announce(ev.winner==='draw'?'DRAW':ev.winner==='p1'?'ROUND WIN!':'ROUND LOSE');
   $('comboHint').textContent='ラウンド終了・次はHP100で再開';
  }else if(ev.type==='roundStart'){
   announce('ROUND '+ev.round+' FIGHT!');
   $('comboHint').textContent='弱 → 弱 → 強　命中すればコンボ！';
  }else if(ev.type==='finish')announce('K.O.!');
 }
}
function cpuControls(){
 const me=game.fighters[0],cpu=game.fighters[1],time=game.elapsed;
 const controls={},dx=me.x-cpu.x,dist=Math.abs(dx);
 if(cpu.stun>0||cpu.guardStun>0)return controls;
 if(!cpu.attack&&dist>80){controls[dx<0?'left':'right']=true}
 else if(!cpu.attack&&dist<52)controls[dx<0?'right':'left']=true;
 // At medium range, occasional guard gives a readable opening without perfect CPU defense.
 if(me.attack&&dist<125&&cpu.grounded&&cpu.hp<65&&Math.sin(time*2.1)>.65){
  controls.guard=true;ai.guardUntil=time+.18;
 }
 if(time<ai.guardUntil&&dist<128)controls.guard=true;
 if(!cpu.attack&&dist<118&&time>=ai.nextHit&&!controls.guard){
  const useHeavy=Math.sin(time*1.8+.5)>.49;
  controls[useHeavy?'heavy':'light']=true;
  ai.nextHit=time+(useHeavy?.92:.55);
 }
 if(cpu.attack?.hit&&cpu.attack.kind==='light'&&cpu.attack.time>=.12&&!cpu.prev.light&&time>ai.nextHit-.36){
  controls.light=cpu.attack.stage===1;
  controls.heavy=cpu.attack.stage===2;
 }
 if(cpu.grounded&&dist>185&&dist<300&&time>=ai.nextJump&&Math.sin(time*3)>.9){
  controls.jump=true;ai.nextJump=time+2.6;
 }
 return controls;
}
function updateHUD(){
 for(const f of game.fighters){
  const n=f.id==='p1'?'1':'2';
  $(`p${n}Damage`).textContent=String(Math.ceil(f.hp));
  const bar=$( `p${n}HpFill` ),track=$( `p${n}HpTrack` );
  bar.style.width=(f.hp/MAX_HP*100)+'%';
  track.setAttribute('aria-valuenow',String(Math.ceil(f.hp)));
  track.classList.toggle('danger',f.hp<=25);
  const wins=game.rounds[f.id];
  $(`p${n}Stocks`).textContent='● '.repeat(wins)+'○ '.repeat(2-wins);
  const status=fighterStatus(f),label=$( `p${n}State` );
  label.textContent=status.label+(status.seconds>.02?' '+status.seconds.toFixed(1)+'秒':'');
  label.className='action-state '+status.tone;
 }
 $('fightClock').textContent=String(Math.max(0,Math.ceil(game.clock)));
 $('fightRound').textContent='ROUND '+game.round+' / 2先取';
 const me=game.fighters[0],state=fighterStatus(me);
 let hint='弱 → 弱 → 強　命中すればコンボ！';
 if(game.phase==='roundOver')hint='ラウンド終了。次のラウンドはHP100で再開';
 else if(game.phase==='playing'){
  if(me.stun>.02)hint='被弾中！ 約'+me.stun.toFixed(1)+'秒は操作できない';
  else if(me.guardStun>.02)hint='ガード硬直中！ 約'+me.guardStun.toFixed(1)+'秒は反撃できない';
  else if(me.attack?.kind==='light'&&me.attack.hit&&me.attack.stage===2)hint='2 HIT！ 次は「強」で3段コンボ';
  else if(me.attack?.kind==='light'&&me.attack.hit&&me.attack.stage===1)hint='命中！ 次は「弱」か「強」を押そう';
  else if(state.tone==='recovery')hint='硬直 '+state.seconds.toFixed(1)+'秒：移動・攻撃・ガード不可';
  else if(me.guarding)hint='ガード中：離すと攻撃できる';
 }
 $('comboHint').textContent=hint;
}
function finish(){
 const title=game.winner==='p1'?'YOU WIN!':game.winner==='p2'?'YOU LOSE':'DRAW';
 overlay('<div class="menu-overline">MATCH OVER</div><h1>'+title+'</h1><p class="menu-lead">'+
 (game.winner==='p1'?'あなたの勝利！':'CPUの勝利！')+'</p><p class="menu-sub">獲得ラウンド あなた '+game.rounds.p1+' / CPU '+game.rounds.p2+'</p>'+
 '<button class="primary-btn" data-menu="restart">もう一度対戦する</button>');
 pauseButton.disabled=true;
}
function rounded(x,y,w,h,r,color){ctx.fillStyle=color;ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill()}
const stars=Array.from({length:55},(_,i)=>({x:(i*177+33)%960,y:(i*109+71)%370,r:i%8===0?2:1}));
function background(){
 const sky=ctx.createLinearGradient(0,0,0,540);
 sky.addColorStop(0,'#0a1b2d');sky.addColorStop(.67,'#31495c');sky.addColorStop(1,'#101a29');
 ctx.fillStyle=sky;ctx.fillRect(0,0,960,540);
 for(const s of stars){ctx.fillStyle=s.r===2?'#94daff':'#7389a3';ctx.fillRect(s.x,s.y,s.r,s.r)}
 ctx.fillStyle='#253f4e';ctx.beginPath();
 ctx.moveTo(0,352);ctx.lineTo(89,335);ctx.lineTo(180,350);ctx.lineTo(292,314);ctx.lineTo(404,366);
 ctx.lineTo(519,331);ctx.lineTo(634,361);ctx.lineTo(790,315);ctx.lineTo(900,353);ctx.lineTo(960,340);
 ctx.lineTo(960,540);ctx.lineTo(0,540);ctx.fill();
 ctx.shadowColor='#60dce4';ctx.shadowBlur=10;rounded(WORLD.edgeL,WORLD.groundY,WORLD.edgeR-WORLD.edgeL,11,4,'#74d3da');ctx.shadowBlur=0;
 rounded(0,WORLD.groundY+11,960,155,0,'#122738');
 ctx.fillStyle='#1c4851';for(let x=0;x<960;x+=36)ctx.fillRect(x,WORLD.groundY+11,2,155);
 ctx.fillStyle='#8ad1cf55';ctx.fillRect(WORLD.edgeL,WORLD.groundY+11,3,30);ctx.fillRect(WORLD.edgeR-3,WORLD.groundY+11,3,30);
}
function fighter(f,t){
 const cfg=FIGHTERS[f.type],walk=f.grounded&&Math.abs(f.vx)>24,bob=walk?Math.sin(t*16)*1.6:Math.sin(t*3)*.9;
 const state=fighterStatus(f);
 ctx.save();ctx.translate(f.x,f.y+bob);ctx.scale(f.facing,1);
 ctx.fillStyle='#020b18a0';ctx.beginPath();ctx.ellipse(0,4,27,6,0,0,Math.PI*2);ctx.fill();
 ctx.strokeStyle='#142638';ctx.lineCap='round';ctx.lineWidth=11;
 const stride=walk?Math.sin(t*14)*7:0;
 ctx.beginPath();ctx.moveTo(-9,-29);ctx.lineTo(-10+stride,-3);ctx.moveTo(8,-29);ctx.lineTo(10-stride,-3);ctx.stroke();
 ctx.fillStyle=cfg.color;ctx.strokeStyle='#142b42';ctx.lineWidth=4;ctx.beginPath();ctx.roundRect(-17,-56,34,33,11);ctx.fill();ctx.stroke();
 ctx.fillStyle='#efffff';ctx.textAlign='center';ctx.font='bold 17px system-ui';ctx.fillText(f.type==='speed'?'✦':'◆',0,-33);
 ctx.fillStyle='#ffdfbd';ctx.strokeStyle='#22394e';ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,-71,18,0,Math.PI*2);ctx.fill();ctx.stroke();
 ctx.fillStyle=cfg.hair;ctx.beginPath();ctx.arc(0,-77,18,Math.PI,Math.PI*2);ctx.lineTo(16,-65);ctx.lineTo(10,-78);ctx.lineTo(-6,-71);ctx.lineTo(-12,-64);ctx.fill();
 ctx.fillStyle='#17354a';ctx.beginPath();ctx.arc(7,-70,2.1,0,Math.PI*2);ctx.fill();
 ctx.strokeStyle='#ffdfbd';ctx.lineWidth=9;ctx.beginPath();ctx.moveTo(-16,-45);ctx.lineTo(-24,-28);
 const isHeavy=f.attack?.kind==='heavy',swing=f.attack&&state.label!=='空振り硬直'&&state.label!=='攻撃後の硬直';
 ctx.moveTo(15,-46);ctx.lineTo(swing?40:24,swing?-49:-29);ctx.stroke();
 if(swing){ctx.strokeStyle=isHeavy?'#fbe1a1':'#93ecfa';ctx.lineWidth=isHeavy?10:6;ctx.beginPath();ctx.arc(22,-43,isHeavy?40:29,-1.15,.67);ctx.stroke()}
 if(f.guarding||f.guardStun>0){ctx.fillStyle='#77d9fc44';ctx.beginPath();ctx.ellipse(0,-45,38,54,0,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#a1c9fd';ctx.lineWidth=2;ctx.stroke()}
 if(f.stun>.06){ctx.fillStyle='#ffe0a5';ctx.font='bold 15px system-ui';ctx.fillText('!',0,-104)}
 ctx.restore();
}
function drawEffects(dt){
 fx=fx.filter(e=>e.life>0);
 for(const e of fx){
  e.life-=dt;const fade=clamp(e.life/e.max,0,1);
  ctx.save();ctx.globalAlpha=fade;
  if(e.kind==='hit'||e.kind==='guard'){
   ctx.strokeStyle=e.kind==='guard'?'#bcd8ff':e.heavy?'#ffe5ac':'#8bf4ff';
   ctx.lineWidth=e.heavy?9:5;ctx.beginPath();ctx.arc(e.x,e.y,12+48*(1-fade),0,Math.PI*2);ctx.stroke();
   ctx.fillStyle='#fffcef';ctx.font='bold 19px system-ui';ctx.textAlign='center';ctx.fillText(e.label,e.x,e.y-22-19*(1-fade));
  }
  ctx.restore();
 }
}
function render(dt){
 ctx.save();
 if(shake>0){ctx.translate(Math.sin(game.elapsed*121)*shake,Math.cos(game.elapsed*133)*shake*.55);shake=Math.max(0,shake-36*dt)}
 background();fighter(game.fighters[0],game.elapsed);fighter(game.fighters[1],game.elapsed);drawEffects(dt);
 if(flash>0){ctx.fillStyle='rgba(245,249,255,'+clamp(flash,0,.35)+')';ctx.fillRect(0,0,960,540);flash=Math.max(0,flash-dt*2.2)}
 ctx.restore();
}
let frameCount=0;
function tick(now){
 const dt=Math.min((now-last)/1000,.09);last=now;
 if((game.phase==='playing'||game.phase==='roundOver')&&!paused){
  lag+=dt;let steps=0;
  while(lag>=FIXED_DT&&steps<5){
   const controls={};for(const key of held)controls[key]=true;
   stepMatch(game,{p1:controls,p2:cpuControls()},FIXED_DT);consumeEvents();
   lag-=FIXED_DT;steps++;
   if(game.phase==='finished'){finish();lag=0;break}
  }
 }else lag=0;
 render(dt);if(++frameCount%4===0)updateHUD();
 requestAnimationFrame(tick);
}
window.FightDebug=Object.freeze({
 get snapshot(){return JSON.parse(JSON.stringify(game))},
 get input(){return [...held]},
 get ai(){return {...ai}}
});
requestAnimationFrame(t=>{last=t;requestAnimationFrame(tick)});
