import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {WORLD,FIGHTERS,FIXED_DT,createMatch,startMatch,stepMatch} from '../games/houkago-fight/engine.js';
const frames=(m,n,input={})=>{for(let i=0;i<n;i++)stepMatch(m,input,FIXED_DT);return m};
test('match starts with 2 stocks, 3 minute clock and selectable opposite archetypes',()=>{
 const m=createMatch();assert.equal(m.phase,'ready');assert.equal(m.clock,180);
 assert.equal(m.fighters.length,2);
 assert.deepEqual(m.fighters.map(x=>x.stocks),[2,2]);
 assert.equal(m.fighters[0].type,'speed');assert.equal(m.fighters[1].type,'power');
 assert.ok(FIGHTERS.power.weight>FIGHTERS.speed.weight);
 assert.ok(FIGHTERS.speed.speed>FIGHTERS.power.speed);
 assert.equal(startMatch(m),true);assert.equal(startMatch(m),false);
 assert.equal(m.phase,'playing');assert.throws(()=>createMatch({p1:'unknown'}));
});
test('fixed-step movement and direction: left/right and face changes',()=>{
 const m=createMatch();startMatch(m);
 const x=m.fighters[0].x;
 frames(m,18,{p1:{right:true}});
 assert.ok(m.fighters[0].x>x+35);
 assert.equal(m.fighters[0].facing,1);
 frames(m,18,{p1:{left:true}});
 assert.ok(m.fighters[0].vx<0);
 assert.equal(m.fighters[0].facing,-1);
});
test('jump + double jump; cannot triple jump before landing',()=>{
 const m=createMatch();startMatch(m);
 frames(m,1,{p1:{jump:true}});
 assert.equal(m.fighters[0].jumps,1);assert.ok(m.fighters[0].vy<0);
 frames(m,2);frames(m,1,{p1:{jump:true}});
 assert.equal(m.fighters[0].jumps,2);
 frames(m,2);const vy=m.fighters[0].vy;
 frames(m,1,{p1:{jump:true}});
 assert.equal(m.fighters[0].jumps,2);
 assert.ok(m.fighters[0].vy>vy,'third input must not relaunch');
 frames(m,150);
 assert.equal(m.fighters[0].grounded,true);
 assert.equal(m.fighters[0].jumps,0);
});
test('regular attack applies percentage damage without instantly reducing stocks',()=>{
 const m=createMatch();startMatch(m);
 const [a,b]=m.fighters;a.x=400;b.x=457;a.facing=1;b.facing=-1;
 frames(m,1,{p1:{attack:true}});
 frames(m,13);
 assert.ok(b.damage>=2.7,'jab should connect');
 assert.equal(b.stocks,2);
 assert.ok(b.vx>0,'target knocked to the right');
});
test('directional normal attacks select up and down variants',()=>{
 for(const [axis,type] of [['up','up'],['down','down']]){
  const m=createMatch();startMatch(m);
  frames(m,1,{p1:{attack:true,[axis]:true}});
  assert.equal(m.fighters[0].attack.kind,type);
 }
});
test('smash button charges and releases; capped charge auto attacks',()=>{
 const m=createMatch();startMatch(m);
 frames(m,1,{p1:{smash:true}});
 frames(m,20,{p1:{smash:true}});
 assert.ok(m.fighters[0].charging>.20);
 frames(m,1);
 assert.equal(m.fighters[0].attack?.kind,'smash');
 assert.ok(m.fighters[0].attack.charge>.25);
 const n=createMatch();startMatch(n);
 frames(n,54,{p1:{smash:true}});
 assert.equal(n.fighters[0].attack?.kind,'smash','charge auto-executes at .8 seconds');
});
test('guarding blocks frontal strikes and reduces shield instead of health',()=>{
 const m=createMatch();startMatch(m);
 const [a,b]=m.fighters;a.x=400;b.x=455;a.facing=1;b.facing=-1;
 frames(m,1,{p1:{attack:true},p2:{guard:true}});
 frames(m,10,{p2:{guard:true}});
 assert.equal(b.damage,0);
 assert.ok(b.shield<100);
});
test('projectile special travels and deals damage; up-special launches fighter',()=>{
 const m=createMatch();startMatch(m);
 const [a,b]=m.fighters;a.x=350;b.x=560;a.facing=1;
 frames(m,1,{p1:{special:true}});
 assert.equal(m.projectiles.length,1);
 frames(m,35);
 assert.ok(b.damage>0,'B projectile should hit');
 const n=createMatch();startMatch(n);
 frames(n,1,{p1:{up:true,special:true}});
 assert.equal(n.fighters[0].attack.kind,'upSpecial');
 assert.ok(n.fighters[0].vy<0);
});
test('blast-zone KO removes one stock, respawns with 0% and invulnerability',()=>{
 const m=createMatch();startMatch(m);
 const a=m.fighters[0];
 a.damage=120;a.x=WORLD.blastL-10;
 stepMatch(m);
 assert.equal(a.stocks,1);assert.equal(a.damage,0);
 assert.ok(a.respawn>0);assert.ok(a.invincible>0);
 frames(m,75);
 assert.ok(a.respawn===0);
 a.x=WORLD.blastL-10;
 stepMatch(m);
 assert.equal(a.stocks,0);assert.equal(m.phase,'finished');assert.equal(m.winner,'p2');
});
test('match timer breaks tie by stocks then damage; equal values use 30 second sudden death',()=>{
 const a=createMatch();startMatch(a);a.clock=.005;a.fighters[0].stocks=1;
 stepMatch(a);assert.equal(a.phase,'finished');assert.equal(a.winner,'p2');
 const b=createMatch();startMatch(b);b.clock=.005;b.fighters[1].damage=30;
 stepMatch(b);assert.equal(b.winner,'p1');
 const c=createMatch();startMatch(c);c.clock=.005;
 stepMatch(c);assert.equal(c.phase,'playing');assert.equal(c.suddenDeath,true);
 assert.equal(c.clock,30);assert.ok(c.fighters.every(x=>x.damage===150));
 c.clock=.005;stepMatch(c);assert.equal(c.phase,'finished');assert.equal(c.winner,'draw');
});
test('past KO no new inputs or game simulation can change winner',()=>{
 const m=createMatch();startMatch(m);
 m.fighters[0].x=-200;m.fighters[0].stocks=1;stepMatch(m);
 const winner=m.winner,clock=m.clock;frames(m,100,{p1:{right:true,attack:true}});
 assert.equal(m.winner,winner);assert.equal(m.clock,clock);
});
test('published prototype keeps catalog private and wires both touch and keyboard input',()=>{
 for(const file of ['engine.js','game.js'])
  execFileSync(process.execPath,['--check',new URL('../games/houkago-fight/'+file,import.meta.url).pathname],{stdio:'pipe'});
 const js=readFileSync(new URL('../games/houkago-fight/game.js',import.meta.url),'utf8');
 const html=readFileSync(new URL('../games/houkago-fight/index.html',import.meta.url),'utf8');
 const css=readFileSync(new URL('../games/houkago-fight/game.css',import.meta.url),'utf8');
 assert.match(js,/requestAnimationFrame/);assert.match(js,/stepMatch\(game,/);
 assert.match(js,/pointerdown/);assert.match(js,/keydown/);assert.match(js,/cpuControls/);
 assert.match(html,/PROTOTYPE/);
 for(const key of ['attack','smash','special','jump','guard','left','right','up','down'])
  assert.match(html,new RegExp('data-key="'+key+'"'));
 assert.match(css,/@media\(orientation:portrait\)/);
 assert.doesNotMatch(readFileSync(new URL('../games/index.html',import.meta.url),'utf8'),/href="houkago-fight\/"/);
});

test('left/right + A instantly sets horizontal attack facing',()=>{
 const m=createMatch();startMatch(m);
 const p=m.fighters[0];p.facing=1;
 frames(m,1,{p1:{left:true,attack:true}});
 assert.equal(p.attack.kind,'tilt');
 assert.equal(p.facing,-1);
});
