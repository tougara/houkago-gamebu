/* 放課後ファイト！ prototype engine: deterministic fixed-timestep 2D platform fighter.
 * No DOM/network code; suitable for later server-authoritative online simulation. */
export const WORLD=Object.freeze({width:960,height:540,groundY:356,edgeL:174,edgeR:786,
 blastL:-105,blastR:1065,blastTop:-135,blastBottom:700,gravity:1530});
export const FIGHTERS=Object.freeze({
 speed:{name:'アオ',label:'スピード',weight:90,speed:305,jump:600,damage:0.95,color:'#56e2f0',hair:'#183e6b'},
 power:{name:'アカ',label:'パワー',weight:110,speed:236,jump:540,damage:1.13,color:'#fd8294',hair:'#58334f'}
});
export const FIXED_DT=1/60;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const DURATION={jab:.29,tilt:.39,up:.39,down:.37,air:.36,smash:.65,projectile:.48,upSpecial:.62};
export function createMatch({p1='speed',p2='power'}={}){
 if(!FIGHTERS[p1]||!FIGHTERS[p2])throw Error('Unknown fighter');
 const fighter=(id,type,x,facing)=>({
  id,type,x,y:WORLD.groundY,vx:0,vy:0,facing,grounded:true,jumps:0,
  damage:0,stocks:2,invincible:0,stun:0,shield:100,charging:0,
  attack:null,cooldown:0,skillCooldown:0,respawn:0,prev:{},lastMove:0
 });
 return {phase:'ready',clock:180,elapsed:0,round:1,winner:null,
   fighters:[fighter('p1',p1,330,1),fighter('p2',p2,630,-1)],
   projectiles:[],effects:[],events:[],suddenDeath:false};
}
export function startMatch(m){if(m.phase==='ready'){m.phase='playing';return true}return false}
function event(m,type,extra={}){m.events.push({type,...extra})}
function attackDef(kind,charge,stats){
 const p=stats.damage;
 if(kind==='jab')return {damage:3*p,base:6.2,growth:.042,range:68,height:66,length:.29};
 if(kind==='tilt')return {damage:8*p,base:7.5,growth:.060,range:82,height:77,length:.39};
 if(kind==='up')return {damage:7*p,base:7.1,growth:.057,range:64,height:106,length:.39};
 if(kind==='down')return {damage:7*p,base:6.5,growth:.052,range:70,height:40,length:.37};
 if(kind==='air')return {damage:6*p,base:7.0,growth:.054,range:69,height:74,length:.36};
 if(kind==='smash')return {damage:(15+5*charge)*p,base:9.2+1.5*charge,growth:.08+charge*.01,range:97,height:93,length:.65};
 if(kind==='upSpecial')return {damage:7*p,base:7,growth:.056,range:58,height:106,length:.62};
 return {damage:0,base:0,growth:0,range:0,height:0,length:.3};
}
function startAttack(m,f,kind,charge=0){
 const def=attackDef(kind,charge,FIGHTERS[f.type]);
 f.attack={kind,time:0,hit:false,charge,...def};
 f.cooldown=def.length;
 if(kind==='upSpecial'){f.vy=-660;f.grounded=false;f.jumps=2;f.skillCooldown=.85}
 event(m,'attack',{id:f.id,kind});
}
function hit(m,attacker,victim,a,direction){
 if(victim.invincible>0||victim.respawn>0||victim.stocks<=0)return false;
 const fromFront=(attacker.x-victim.x)*victim.facing>0;
 const blocked=victim.prev.guard&&victim.stun<=0&&fromFront;
 if(blocked&&victim.shield>0){
  victim.shield=clamp(victim.shield-a.damage*5.2,0,100);
  event(m,'guard',{id:victim.id,x:victim.x,y:victim.y-34});
  if(victim.shield===0){victim.stun=1.5;event(m,'break',{id:victim.id})}
  return true;
 }
 victim.damage=Math.round((victim.damage+a.damage)*10)/10;
 const sp=(a.base+victim.damage*a.growth)*(100/FIGHTERS[victim.type].weight)*26;
 const lift=direction==='up'?-.94:direction==='down'?.64:-.55;
 const dir=attacker.facing||1;
 victim.vx=sp*dir*(direction==='up'?.28:.85);
 victim.vy=sp*lift;
 victim.grounded=false;
 victim.stun=clamp(.16+sp/1500,.16,.65);
 victim.invincible=.17;
 event(m,'hit',{id:victim.id,by:attacker.id,x:victim.x,y:victim.y-33,damage:a.damage,heavy:a.kind==='smash'});
 return true;
}
function attackConnect(m,f,rival){
 const a=f.attack;
 if(!a||a.hit||a.time<.065||a.time>Math.min(.27,a.length-.055))return;
 const dx=rival.x-f.x,dy=(rival.y-31)-(f.y-31);
 let connect=false,kind='side';
 if(a.kind==='up'||a.kind==='upSpecial'){connect=Math.abs(dx)<58&&dy<24&&dy>-a.height;kind='up'}
 else if(a.kind==='down'){connect=dx*f.facing>-25&&dx*f.facing<a.range&&dy>-24&&dy<54;kind='down'}
 else if(a.kind==='air'){connect=Math.abs(dx)<a.range&&Math.abs(dy)<a.height;kind=dy<0?'up':'side'}
 else connect=dx*f.facing>-20&&dx*f.facing<a.range&&Math.abs(dy)<a.height/2+24;
 if(connect){a.hit=hit(m,f,rival,a,kind)}
}
function fighterStep(m,f,r,controls,dt){
 const cfg=FIGHTERS[f.type],key=controls||{},prev=f.prev||{};
 const pressed=name=>!!key[name]&&!prev[name];
 f.invincible=Math.max(0,f.invincible-dt);
 f.stun=Math.max(0,f.stun-dt);
 f.cooldown=Math.max(0,f.cooldown-dt);
 f.skillCooldown=Math.max(0,f.skillCooldown-dt);
 if(f.respawn>0){f.respawn=Math.max(0,f.respawn-dt);f.prev={...key};return}
 if(pressed('jump')&&f.stun===0&&f.jumps<2){
  f.vy=-cfg.jump*(f.jumps?0.86:1);f.jumps++;
  f.grounded=false;event(m,'jump',{id:f.id});
 }
 const axis=(key.right?1:0)-(key.left?1:0);
 const canAct=f.stun===0;
 const guarding=!!key.guard&&f.grounded&&canAct&&!f.attack&&!f.charging;
 // Horizontal + attack must strike towards the freshly pressed direction.
 if(axis!==0&&f.grounded&&!f.attack&&!f.charging&&canAct)f.facing=axis;
 if(canAct&&!guarding){
  if(f.charging>0){
   f.charging=clamp(f.charging+dt,.001,.8);
   if(!key.smash||f.charging>=.8){startAttack(m,f,'smash',f.charging/.8);f.charging=0}
  }else if(!f.attack&&f.cooldown<=0){
   if(pressed('smash')){f.charging=.001;event(m,'charge',{id:f.id})}
   else if(pressed('attack'))startAttack(m,f,f.grounded?(key.up?'up':key.down?'down':axis?'tilt':'jab'):'air');
   else if(pressed('special')&&f.skillCooldown<=0){
    if(key.up){startAttack(m,f,'upSpecial');}
    else{
     f.skillCooldown=.85;f.cooldown=.39;
     m.projectiles.push({owner:f.id,x:f.x+f.facing*25,y:f.y-35,vx:f.facing*450,time:1.5,r:14,damage:7*cfg.damage});
     event(m,'special',{id:f.id});
    }
   }
  }
 }
 if(!key.guard)f.shield=Math.min(100,f.shield+dt*19);
 // No facing reversal in air; press left/right on ground to face the attack.
 if(f.stun===0&&!f.charging){
  const target=axis*cfg.speed*(f.grounded?1:.82)*(f.attack?.kind==='smash'?.20:1);
  f.vx+=(target-f.vx)*Math.min(1,dt*(f.grounded?22:7));
 }else if(f.stun===0)f.vx*=Math.pow(.75,dt*60);
 if(guarding)f.vx*=Math.pow(.52,dt*60);
 if(f.attack){
  f.attack.time+=dt;
  attackConnect(m,f,r);
  if(f.attack.time>=f.attack.length)f.attack=null;
 }
 const oldY=f.y;
 f.vy+=WORLD.gravity*dt;
 if(key.down&&!f.grounded&&f.vy>0)f.vy+=450*dt;
 f.x+=f.vx*dt;f.y+=f.vy*dt;
 const overPlatform=f.x>WORLD.edgeL-18&&f.x<WORLD.edgeR+18;
 if(f.vy>=0&&oldY<=WORLD.groundY+1&&f.y>=WORLD.groundY&&overPlatform){
  f.y=WORLD.groundY;f.vy=0;f.grounded=true;f.jumps=0;
 }else if(!overPlatform||f.y<WORLD.groundY-2)f.grounded=false;
 f.prev={left:!!key.left,right:!!key.right,up:!!key.up,down:!!key.down,jump:!!key.jump,
  attack:!!key.attack,smash:!!key.smash,special:!!key.special,guard:!!key.guard};
}
function projectileStep(m,dt){
 for(const p of m.projectiles){
  p.x+=p.vx*dt;p.time-=dt;
  const f=m.fighters.find(x=>x.id===p.owner),r=m.fighters.find(x=>x.id!==p.owner);
  if(!f||!r||r.respawn>0||r.stocks<=0)continue;
  if(Math.abs(r.x-p.x)<33&&Math.abs((r.y-35)-p.y)<47){
   if(hit(m,f,r,{damage:p.damage,base:7.0,growth:.048,kind:'projectile'},'side'))p.time=0;
  }
 }
 m.projectiles=m.projectiles.filter(p=>p.time>0&&p.x>-130&&p.x<1090);
}
function stockCheck(m,f){
 if(f.respawn>0||f.stocks<=0)return;
 if(f.x<WORLD.blastL||f.x>WORLD.blastR||f.y<WORLD.blastTop||f.y>WORLD.blastBottom){
  f.stocks--;
  event(m,'ko',{id:f.id,stocks:f.stocks});
  if(f.stocks<=0){m.phase='finished';m.winner=m.fighters.find(x=>x.id!==f.id)?.id||'draw';event(m,'finish',{winner:m.winner});return}
  Object.assign(f,{x:f.id==='p1'?360:600,y:WORLD.groundY-95,vx:0,vy:0,
    grounded:false,jumps:0,damage:m.suddenDeath?150:0,stun:0,cooldown:0,charging:0,attack:null,
    respawn:1.05,invincible:2,shield:100});
 }
}
export function stepMatch(m,controls={},dt=FIXED_DT){
 m.events=[];
 if(m.phase!=='playing')return m;
 dt=clamp(Number(dt)||FIXED_DT,0,1/30);
 m.elapsed+=dt;m.clock=Math.max(0,m.clock-dt);
 const [a,b]=m.fighters;
 fighterStep(m,a,b,controls.p1,dt);
 fighterStep(m,b,a,controls.p2,dt);
 projectileStep(m,dt);
 stockCheck(m,a);if(m.phase==='playing')stockCheck(m,b);
 if(m.phase!=='playing')return m;
 if(m.clock<=0){
  const [x,y]=m.fighters;
  if(x.stocks!==y.stocks)m.winner=x.stocks>y.stocks?'p1':'p2';
  else if(x.damage!==y.damage)m.winner=x.damage<y.damage?'p1':'p2';
  else if(!m.suddenDeath){
   m.suddenDeath=true;m.clock=30;x.damage=y.damage=150;
   event(m,'suddenDeath');return m;
  }else m.winner='draw';
  m.phase='finished';event(m,'finish',{winner:m.winner});
 }
 return m;
}
