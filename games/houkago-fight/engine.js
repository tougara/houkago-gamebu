/* 放課後ファイト！: compact, deterministic 1vCPU traditional health-bar fighter.
 * 60 fps; no falling, no percent damage, no stocks. Lightweight online-ready simulation.
 * 100 HP, 60 sec rounds, first to two rounds. Inputs: left/right/jump/light/heavy/guard.
 * The only cancel route is hit-confirmed light -> light -> heavy. */
export const WORLD=Object.freeze({width:960,height:540,groundY:374,edgeL:76,edgeR:884,gravity:1620});
export const FIGHTERS=Object.freeze({
 speed:{name:'アオ',label:'スピード',speed:310,jump:620,damage:1,color:'#56e2f0',hair:'#183e6b'},
 power:{name:'アカ',label:'パワー',speed:253,jump:575,damage:1.12,color:'#fd8294',hair:'#58334f'}
});
export const FIXED_DT=1/60;
export const ROUND_SECONDS=60;
export const MAX_HP=100;
export const ROUNDS_TO_WIN=2;
// startup, active and recovery are seconds; recovery cannot be interrupted except on a confirmed light hit.
export const MOVES=Object.freeze({
 light:Object.freeze({startup:5/60,active:5/60,recovery:12/60,damage:7,range:86,hitstun:23/60,blockstun:10/60}),
 heavy:Object.freeze({startup:10/60,active:5/60,recovery:18/60,damage:16,range:110,hitstun:28/60,blockstun:17/60})
});
const clamp=(n,low,high)=>Math.max(low,Math.min(high,n));
const total=move=>move.startup+move.active+move.recovery;
const fighter=(id,type,x,facing)=>({id,type,x,y:WORLD.groundY,vx:0,vy:0,grounded:true,facing,
 hp:MAX_HP,stun:0,guardStun:0,guarding:false,attack:null,buffer:null,
 comboChain:0,comboWindow:0,hitsTaken:0,hitsWindow:0,lastHitBy:null,prev:{},jumped:false});
export function createMatch({p1='speed',p2='power'}={}){
 if(!FIGHTERS[p1]||!FIGHTERS[p2])throw Error('Unknown fighter');
 return {phase:'ready',clock:ROUND_SECONDS,elapsed:0,round:1,rounds:{p1:0,p2:0},
  winner:null,roundWinner:null,roundPause:0,events:[],
  fighters:[fighter('p1',p1,328,1),fighter('p2',p2,632,-1)]};
}
export function startMatch(m){if(m.phase!=='ready')return false;m.phase='playing';return true}
const event=(m,type,other={})=>m.events.push({type,...other});
const canMove=f=>f.stun<=0&&f.guardStun<=0&&!f.attack;
export function fighterStatus(f){
 if(f.stun>0)return {label:'被弾硬直',seconds:f.stun,tone:'danger'};
 if(f.guardStun>0)return {label:'ガード硬直',seconds:f.guardStun,tone:'block'};
 if(f.attack){
  const a=f.attack,move=MOVES[a.kind],end=total(move);
  if(a.time<move.startup)return {label:'攻撃準備',seconds:move.startup-a.time,tone:'attack'};
  if(a.time<move.startup+move.active)return {label:'攻撃中',seconds:move.startup+move.active-a.time,tone:'attack'};
  return {label:a.connected?'攻撃後の硬直':'空振り硬直',seconds:Math.max(0,end-a.time),tone:'recovery'};
 }
 if(f.guarding)return {label:'ガード中',seconds:0,tone:'block'};
 if(!f.grounded)return {label:'ジャンプ中',seconds:0,tone:'neutral'};
 return {label:'操作可能',seconds:0,tone:'ready'};
}
function beginAttack(m,f,kind,stage=0){
 f.attack={kind,time:0,connected:false,hit:false,stage};
 f.buffer=null;f.guarding=false;
 event(m,'attack',{id:f.id,kind,stage});
}
function prepareInput(m,f,key,dt){
 f.stun=Math.max(0,f.stun-dt);
 f.guardStun=Math.max(0,f.guardStun-dt);
 f.comboWindow=Math.max(0,f.comboWindow-dt);
 f.hitsWindow=Math.max(0,f.hitsWindow-dt);
 if(f.hitsWindow===0)f.hitsTaken=0;
 const prev=f.prev||{},press=name=>!!key[name]&&!prev[name];
 // On a light hit, a pressed follow-up may be buffered briefly; no cancel on miss or block.
 const follow=press('heavy')?'heavy':press('light')?'light':null;
 if(f.attack&&follow&&f.attack.kind==='light'&&f.attack.stage<2)f.buffer={kind:follow,ttl:.23};
 if(f.buffer)f.buffer.ttl-=dt;
 if(f.buffer?.ttl<=0)f.buffer=null;
 // Hit-confirmed chain: weak -> weak -> strong. Weak -> strong is also legal.
 if(f.attack?.kind==='light'&&f.attack.hit&&f.buffer&&f.attack.time>=.12){
  const stage=f.attack.stage;
  if((f.buffer.kind==='light'&&stage===1)||f.buffer.kind==='heavy'){
   beginAttack(m,f,f.buffer.kind,f.buffer.kind==='light'?2:3);
   event(m,'cancel',{id:f.id,stage:f.attack.stage});
  }
 }
 if(f.attack){
  f.attack.time+=dt;
  if(f.attack.time>=total(MOVES[f.attack.kind]))f.attack=null;
 }
 f.guarding=!!key.guard&&f.grounded&&f.stun<=0&&f.guardStun<=0&&!f.attack;
 if(f.stun<=0&&f.guardStun<=0&&!f.guarding&&!f.attack){
  if(follow)beginAttack(m,f,follow,follow==='light'?1:0);
  else if(press('jump')&&f.grounded){f.grounded=false;f.vy=-FIGHTERS[f.type].jump;f.jumped=true;event(m,'jump',{id:f.id})}
 }
 const axis=(key.right?1:0)-(key.left?1:0);
 if(f.grounded&&!f.attack&&!f.guarding&&f.stun<=0&&f.guardStun<=0&&axis)f.facing=axis;
 if(canMove(f)&&!f.guarding){
  const speed=FIGHTERS[f.type].speed*(f.grounded?1:.78);
  f.vx+=(axis*speed-f.vx)*Math.min(1,dt*(f.grounded?19:9));
 }else f.vx+=(0-f.vx)*Math.min(1,dt*(f.guarding?25:15));
 f.x=clamp(f.x+f.vx*dt,WORLD.edgeL+21,WORLD.edgeR-21);
 if(!f.grounded){
  f.vy+=WORLD.gravity*dt;f.y+=f.vy*dt;
  if(f.y>=WORLD.groundY){f.y=WORLD.groundY;f.vy=0;f.grounded=true;f.jumped=false}
 }
 f.prev={left:!!key.left,right:!!key.right,jump:!!key.jump,light:!!key.light,heavy:!!key.heavy,guard:!!key.guard};
}
function connect(m,attacker,target){
 const a=attacker.attack;
 if(!a||a.connected||target.hp<=0)return;
 const move=MOVES[a.kind];
 if(a.time<move.startup||a.time>move.startup+move.active)return;
 const dx=(target.x-attacker.x)*attacker.facing;
 const reach=move.range+(a.kind==='heavy'&&a.stage===3?10:0);
 const dy=Math.abs(target.y-attacker.y);
 if(dx<0||dx>reach||dy>(a.kind==='light'?70:83))return;
 a.connected=true;
 const front=(attacker.x-target.x)*target.facing>0;
 if(target.guarding&&front){
  target.guardStun=move.blockstun;target.guarding=false;
  target.vx=0;
  event(m,'guard',{id:target.id,by:attacker.id,x:target.x,y:target.y-40,heavy:a.kind==='heavy'});
  return;
 }
 const dmg=Math.round(move.damage*FIGHTERS[attacker.type].damage);
 target.hp=clamp(target.hp-dmg,0,MAX_HP);
 target.stun=move.hitstun;target.guardStun=0;target.vx=0;
 target.hitsTaken=target.hitsWindow>0&&target.lastHitBy===attacker.id?target.hitsTaken+1:1;
 target.hitsWindow=.62;target.lastHitBy=attacker.id;
 a.hit=true;
 if(a.kind==='light')attacker.comboWindow=.62;
 else attacker.comboWindow=0;
 event(m,'hit',{id:target.id,by:attacker.id,x:target.x,y:target.y-40,damage:dmg,hits:target.hitsTaken,heavy:a.kind==='heavy'});
}
function separate(a,b){
 const dx=b.x-a.x,minimum=53;
 if(Math.abs(dx)<minimum&&Math.abs(a.y-b.y)<65){
  const n=(minimum-Math.abs(dx))/2,dir=dx>=0?1:-1;
  a.x=clamp(a.x-dir*n,WORLD.edgeL+21,WORLD.edgeR-21);
  b.x=clamp(b.x+dir*n,WORLD.edgeL+21,WORLD.edgeR-21);
 }
 for(const [f,r] of [[a,b],[b,a]]){
  if(f.grounded&&canMove(f)&&!f.guarding)f.facing=r.x>=f.x?1:-1;
 }
}
function resetFighters(m){
 const a=m.fighters[0],b=m.fighters[1];
 Object.assign(a,fighter('p1',a.type,328,1));
 Object.assign(b,fighter('p2',b.type,632,-1));
 m.clock=ROUND_SECONDS;m.roundWinner=null;
}
function endRound(m,winner){
 m.roundWinner=winner;
 event(m,'roundEnd',{winner,round:m.round});
 if(winner!=='draw')m.rounds[winner]++;
 if(m.rounds.p1>=ROUNDS_TO_WIN||m.rounds.p2>=ROUNDS_TO_WIN){
  m.phase='finished';m.winner=winner;
  event(m,'finish',{winner});
 }else{
  m.phase='roundOver';m.roundPause=1.65;
 }
}
export function stepMatch(m,controls={},dt=FIXED_DT){
 m.events=[];
 if(m.phase==='roundOver'){
  const delta=clamp(Number(dt)||FIXED_DT,0,1/30);
  m.roundPause=Math.max(0,m.roundPause-delta);
  if(m.roundPause===0){m.round++;resetFighters(m);m.phase='playing';event(m,'roundStart',{round:m.round})}
  return m;
 }
 if(m.phase!=='playing')return m;
 dt=clamp(Number(dt)||FIXED_DT,0,1/30);
 m.elapsed+=dt;m.clock=Math.max(0,m.clock-dt);
 const [a,b]=m.fighters;
 prepareInput(m,a,controls.p1||{},dt);
 prepareInput(m,b,controls.p2||{},dt);
 separate(a,b);
 connect(m,a,b);connect(m,b,a);
 if(a.hp<=0||b.hp<=0){endRound(m,a.hp<=0&&b.hp<=0?'draw':a.hp<=0?'p2':'p1');return m}
 if(m.clock<=0)endRound(m,a.hp===b.hp?'draw':a.hp>b.hp?'p1':'p2');
 return m;
}
