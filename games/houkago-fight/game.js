import {WORLD,FIGHTERS,FIXED_DT,createMatch,startMatch,stepMatch} from './engine.js';
/* Phase 1: local CPU practice. Online matchmaking and live rooms come later. */
const $=id=>document.getElementById(id);
const canvas=$('battle'),ctx=canvas.getContext('2d',{alpha:false});
const menu=$('menu'),pauseButton=$('pauseBtn'),fullButton=$('fullBtn'),effectLabel=$('fxText');
const hud={p1:$('p1Damage'),p2:$('p2Damage'),s1:$('p1Stocks'),s2:$('p2Stocks'),n1:$('p1Name'),n2:$('p2Name'),clock:$('fightClock'),round:$('fightRound')};
const held=new Set(),pointers=new Map(),keyMap={KeyA:'left',KeyD:'right',KeyW:'up',KeyS:'down',ArrowLeft:'left',ArrowRight:'right',ArrowUp:'up',ArrowDown:'down',KeyJ:'attack',KeyK:'special',KeyL:'smash',Space:'jump',ShiftLeft:'guard',ShiftRight:'guard'};
let game=createMatch(),paused=false,last=performance.now(),lag=0,flash=0,shake=0,fx=[],ai={hit:.5,special:1.1,smashUntil:0,jump:0};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function resetInput(){held.clear();pointers.clear();document.querySelectorAll('[data-key]').forEach(b=>b.classList.remove('pressed'))}
for(const event of ['keydown','keyup'])document.addEventListener(event,e=>{
 const key=keyMap[e.code];if(!key||e.altKey||e.ctrlKey||e.metaKey)return;
 e.preventDefault();if(event==='keydown')held.add(key);else held.delete(key);
});
window.addEventListener('blur',resetInput);
document.addEventListener('visibilitychange',()=>{if(document.hidden){resetInput();if(game.phase==='playing'&&!paused)pauseGame(true)}});
document.querySelectorAll('[data-key]').forEach(button=>{
 button.addEventListener('pointerdown',e=>{
  if(e.button!==0)return;e.preventDefault();
  try{button.setPointerCapture?.(e.pointerId)}catch{/* synthetic events and old browsers may not expose capture */}
  pointers.set(e.pointerId,button.dataset.key);held.add(button.dataset.key);button.classList.add('pressed');
 });
 const release=e=>{
  const key=pointers.get(e.pointerId);if(!key)return;
  pointers.delete(e.pointerId);if(![...pointers.values()].includes(key))held.delete(key);
  button.classList.remove('pressed');
 };
 for(const type of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(type,release);
});
$('portraitProceed').addEventListener('click',()=>$('rotateNotice').classList.add('hide'));
fullButton.addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await $('fightApp').requestFullscreen?.()}catch{/* optional */}});
function overlay(html){menu.innerHTML='<div class="fight-menu-card">'+html+'</div>';menu.hidden=false}
function start(){
 const chosen=menu.querySelector('input[name=fighter]:checked')?.value||'speed';
 game=createMatch({p1:chosen,p2:chosen==='speed'?'power':'speed'});
 startMatch(game);resetInput();paused=false;lag=0;fx=[];
 ai={hit:.5,special:1.1,smashUntil:0,jump:0};
 hud.n1.textContent=FIGHTERS[chosen].name+'（あなた）';
 hud.n2.textContent=FIGHTERS[game.fighters[1].type].name+'（CPU）';
 menu.hidden=true;pauseButton.disabled=false;pauseButton.textContent='Ⅱ';
 updateHUD();announce('FIGHT!');
}
function pauseGame(value){
 if(game.phase!=='playing')return;
 paused=!!value;resetInput();
 pauseButton.textContent=paused?'▶':'Ⅱ';
 if(paused)overlay('<h2>一時停止</h2><p>CPU対戦を一時停止中</p><button class="primary-btn" data-menu="resume">再開する</button><button class="fight-back" data-menu="restart">最初から</button>');
 else menu.hidden=true;
}
pauseButton.addEventListener('click',()=>pauseGame(!paused));
menu.addEventListener('click',e=>{
 const b=e.target.closest('button');if(!b)return;
 if(b.id==='startBtn'){start();return}
 if(b.dataset.menu==='resume'){pauseGame(false);return}
 if(b.dataset.menu==='restart'){
  game=createMatch();paused=false;pauseButton.disabled=true;resetInput();
  overlay('<div class="menu-overline">RESTART MATCH</div><h1>放課後ファイト！</h1><p>キャラクターを選んで再戦！</p>'+
   '<fieldset class="fighter-picker"><legend>自分のキャラ</legend>'+
   '<label class="pick"><input type="radio" name="fighter" value="speed" checked><span><b>アオ</b><small>スピード型</small></span></label>'+
   '<label class="pick"><input type="radio" name="fighter" value="power"><span><b>アカ</b><small>パワー型</small></span></label></fieldset>'+
   '<button id="startBtn" class="primary-btn">CPUと対戦する</button>');
 }
});
function announce(text){effectLabel.textContent=text;effectLabel.classList.remove('show');void effectLabel.offsetWidth;effectLabel.classList.add('show')}
function consumeEvents(){
 for(const ev of game.events){
  if(ev.type==='hit'){
   fx.push({kind:'hit',x:ev.x,y:ev.y,life:.4,max:.4,label:'+'+Math.round(ev.damage),heavy:ev.heavy});
   flash=ev.heavy?.2:.06;shake=ev.heavy?8:3;
  }else if(ev.type==='ko'){
   fx.push({kind:'ko',x:480,y:190,life:.9,max:.9});announce('K.O.!');shake=12;flash=.4;
  }else if(ev.type==='break')announce('シールドブレイク!');
  else if(ev.type==='suddenDeath')announce('SUDDEN DEATH!');
 }
}
function cpuControls(){
 const me=game.fighters[0],cpu=game.fighters[1],t=game.elapsed,keys={};
 if(cpu.respawn>0||cpu.stocks<=0)return keys;
 const dx=me.x-cpu.x,dist=Math.abs(dx),danger=cpu.x<WORLD.edgeL+35||cpu.x>WORLD.edgeR-35;
 const desired=danger?480-cpu.x:dx;
 if(Math.abs(desired)>65)keys[desired<0?'left':'right']=true;
 if(cpu.stun>.01)return keys;
 if(danger&&!cpu.grounded&&t-ai.jump>.25){keys.jump=true;ai.jump=t}
 if(cpu.grounded&&dist>160&&Math.sin(t*3)>.94&&t-ai.jump>.6){keys.jump=true;ai.jump=t}
 if(dist<112&&Math.abs(cpu.y-me.y)<82&&cpu.cooldown<=0){
  if(cpu.damage>85&&t>ai.hit+1.1&&!cpu.charging){ai.smashUntil=t+.45;ai.hit=t+1.05}
  else if(t>=ai.hit){keys.attack=true;if(me.y<cpu.y-40)keys.up=true;ai.hit=t+.57}
 }
 if(ai.smashUntil>t)keys.smash=true;
 if(dist>155&&dist<470&&t>ai.special){keys.special=true;ai.special=t+2}
 if(cpu.damage>115&&dist<95&&Math.sin(t*9)>.78)keys.guard=true;
 return keys;
}
function updateHUD(){
 const [me,cpu]=game.fighters;
 for(const [d,s,f] of [[hud.p1,hud.s1,me],[hud.p2,hud.s2,cpu]]){
  d.textContent=Math.round(f.damage)+'%';d.classList.toggle('is-danger',f.damage>=100);
  s.textContent=('● '.repeat(f.stocks)).trim()||'0';
 }
 const secs=Math.max(0,Math.ceil(game.clock)),mins=Math.floor(secs/60);
 hud.clock.textContent=mins+':'+String(secs%60).padStart(2,'0');
 hud.round.textContent=game.suddenDeath?'SUDDEN DEATH':'2 STOCKS';
}
function finish(){
 const title=game.winner==='p1'?'YOU WIN!':game.winner==='p2'?'YOU LOSE':'DRAW';
 const jp=game.winner==='p1'?'CPUに勝利！':game.winner==='p2'?'CPUの勝利！':'引き分け！';
 overlay('<div class="menu-overline">GAME OVER / RESULT</div><h1>'+title+'</h1>'+
 '<p class="menu-lead">'+jp+'</p><p class="menu-sub">あなた '+Math.round(game.fighters[0].damage)+
 '% ／ CPU '+Math.round(game.fighters[1].damage)+'%</p>'+
 '<button class="primary-btn" data-menu="restart">もう一度対戦する</button>');
 pauseButton.disabled=true;
}
function rounded(x,y,w,h,r,color){ctx.fillStyle=color;ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill()}
const stars=Array.from({length:90},(_,i)=>({x:(i*177+33)%960,y:(i*109+71)%375,r:i%8===0?2:1}));
function background(){
 const sky=ctx.createLinearGradient(0,0,0,540);
 sky.addColorStop(0,'#09162b');sky.addColorStop(.65,'#2a405b');sky.addColorStop(1,'#0e1c33');
 ctx.fillStyle=sky;ctx.fillRect(0,0,960,540);
 for(const star of stars){ctx.fillStyle=star.r===2?'#94daff':'#7389a3';ctx.fillRect(star.x,star.y,star.r,star.r)}
 ctx.fillStyle='#243d55';ctx.beginPath();ctx.moveTo(0,322);ctx.lineTo(74,291);ctx.lineTo(181,311);ctx.lineTo(289,257);ctx.lineTo(402,327);ctx.lineTo(512,277);ctx.lineTo(630,306);ctx.lineTo(777,264);ctx.lineTo(867,317);ctx.lineTo(960,286);ctx.lineTo(960,540);ctx.lineTo(0,540);ctx.fill();
 ctx.shadowColor='#63e6ff';ctx.shadowBlur=20;
 rounded(WORLD.edgeL,354,WORLD.edgeR-WORLD.edgeL,12,5,'#69c9e4');
 ctx.shadowBlur=0;
 rounded(WORLD.edgeL+7,366,WORLD.edgeR-WORLD.edgeL-14,27,5,'#38516b');
 ctx.fillStyle='#142840';ctx.fillRect(0,437,960,103);
 ctx.fillStyle='#fa7185';ctx.fillRect(WORLD.edgeL-4,350,4,25);ctx.fillRect(WORLD.edgeR,350,4,25);
 ctx.strokeStyle='#98d6f522';ctx.beginPath();ctx.moveTo(0,437);ctx.lineTo(960,437);ctx.stroke();
}
function fighter(f,t){
 if(f.stocks<=0||f.respawn>0)return;
 const cfg=FIGHTERS[f.type],walking=f.grounded&&Math.abs(f.vx)>24,bob=walking?Math.sin(t*15)*2:Math.sin(t*3);
 ctx.save();ctx.translate(f.x,f.y+bob);ctx.scale(f.facing,1);
 if(f.invincible>.2&&Math.floor(t*12)%2===0)ctx.globalAlpha=.5;
 ctx.fillStyle='#020b18a0';ctx.beginPath();ctx.ellipse(0,3,25,6,0,0,Math.PI*2);ctx.fill();
 ctx.strokeStyle='#11273d';ctx.lineCap='round';ctx.lineWidth=11;
 const stride=walking?Math.sin(t*16)*8:0;
 ctx.beginPath();ctx.moveTo(-9,-29);ctx.lineTo(-11+stride,-3);ctx.moveTo(8,-29);ctx.lineTo(9-stride,-3);ctx.stroke();
 ctx.fillStyle=cfg.color;ctx.strokeStyle='#142b42';ctx.lineWidth=4;ctx.beginPath();ctx.roundRect(-17,-56,34,33,11);ctx.fill();ctx.stroke();
 ctx.fillStyle='#efffff';ctx.textAlign='center';ctx.font='bold 17px system-ui';ctx.fillText(f.type==='speed'?'✦':'◆',0,-33);
 ctx.fillStyle='#ffdfbd';ctx.strokeStyle='#22394e';ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,-71,18,0,Math.PI*2);ctx.fill();ctx.stroke();
 ctx.fillStyle=cfg.hair;ctx.beginPath();ctx.arc(0,-77,18,Math.PI,Math.PI*2);ctx.lineTo(16,-65);ctx.lineTo(10,-78);ctx.lineTo(-6,-71);ctx.lineTo(-12,-64);ctx.fill();
 ctx.fillStyle='#17354a';ctx.beginPath();ctx.arc(7,-70,2.1,0,Math.PI*2);ctx.fill();
 ctx.strokeStyle='#ffdfbd';ctx.lineWidth=9;ctx.beginPath();ctx.moveTo(-16,-45);ctx.lineTo(-25,-29);
 ctx.moveTo(15,-46);ctx.lineTo(f.attack?42:24,f.attack?-52:-29);ctx.stroke();
 if(f.attack){ctx.strokeStyle=f.attack.kind==='smash'?'#ffe4a1':'#9ef1fa';ctx.lineWidth=f.attack.kind==='smash'?10:6;ctx.beginPath();ctx.arc(22,-42,f.attack.kind==='smash'?40:27,-1.15,.65);ctx.stroke()}
 if(f.charging){ctx.strokeStyle='#ffe193';ctx.lineWidth=4;ctx.shadowColor='#f9cf64';ctx.shadowBlur=18;ctx.beginPath();ctx.arc(0,-48,30+f.charging*13,0,Math.PI*2*(f.charging/.8));ctx.stroke();ctx.shadowBlur=0}
 if(f.prev.guard&&f.shield>0&&!f.stun){ctx.globalAlpha=.22+f.shield/300;ctx.fillStyle='#77d9fc';ctx.beginPath();ctx.ellipse(0,-46,41,57,0,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;ctx.strokeStyle='#8ae9ff';ctx.lineWidth=2;ctx.stroke()}
 ctx.restore();
}
function drawEffects(dt){
 fx=fx.filter(x=>x.life>0);
 for(const e of fx){
  e.life-=dt;const fade=clamp(e.life/e.max,0,1);
  ctx.save();ctx.globalAlpha=fade;
  if(e.kind==='hit'){
   ctx.strokeStyle=e.heavy?'#ffe5ac':'#8bf4ff';ctx.lineWidth=e.heavy?9:5;
   ctx.beginPath();ctx.arc(e.x,e.y,12+60*(1-fade),0,Math.PI*2);ctx.stroke();
   ctx.fillStyle='#fffbeb';ctx.textAlign='center';ctx.font='bold 22px system-ui';ctx.fillText(e.label,e.x,e.y-20-25*(1-fade));
  }else{ctx.textAlign='center';ctx.font='1000 90px system-ui';ctx.fillStyle='#fff5d8';ctx.shadowColor='#fdb595';ctx.shadowBlur=25;ctx.fillText('K.O.!',480,220)}
  ctx.restore();
 }
}
function render(dt){
 ctx.save();
 if(shake>0){ctx.translate(Math.sin(game.elapsed*121)*shake,Math.cos(game.elapsed*133)*shake*.55);shake=Math.max(0,shake-35*dt)}
 background();
 for(const p of game.projectiles){ctx.save();ctx.shadowBlur=18;ctx.shadowColor='#b2faff';ctx.fillStyle='#d9fdff';ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fill();ctx.restore()}
 fighter(game.fighters[0],game.elapsed);fighter(game.fighters[1],game.elapsed);
 drawEffects(dt);
 if(flash>0){ctx.fillStyle='rgba(245,249,255,'+clamp(flash,0,.36)+')';ctx.fillRect(0,0,960,540);flash=Math.max(0,flash-dt*2.2)}
 ctx.restore();
}
let frames=0;
function tick(now){
 const dt=Math.min((now-last)/1000,.095);last=now;
 if(game.phase==='playing'&&!paused){
  lag+=dt;let steps=0;
  while(lag>=FIXED_DT&&steps<5){
   const me={};for(const key of held)me[key]=true;
   stepMatch(game,{p1:me,p2:cpuControls()},FIXED_DT);consumeEvents();
   lag-=FIXED_DT;steps++;
   if(game.phase==='finished'){finish();lag=0;break}
  }
 }else lag=0;
 render(dt);if(++frames%5===0)updateHUD();
 requestAnimationFrame(tick);
}
requestAnimationFrame(t=>{last=t;requestAnimationFrame(tick)});
