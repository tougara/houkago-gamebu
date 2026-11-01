import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {WORLD,FIGHTERS,FIXED_DT,MOVES,MAX_HP,ROUND_SECONDS,ROUNDS_TO_WIN,createMatch,startMatch,stepMatch,fighterStatus} from '../games/houkago-fight/engine.js';
const frames=(m,n,input={})=>{for(let i=0;i<n;i++)stepMatch(m,input,FIXED_DT);return m};
const close=()=>{const m=createMatch();startMatch(m);const [a,b]=m.fighters;a.x=400;b.x=468;a.facing=1;b.facing=-1;return m};
test('classic HP match starts at 100 HP, 60 seconds, first to two rounds',()=>{
 const m=createMatch();
 assert.equal(MAX_HP,100);assert.equal(ROUND_SECONDS,60);assert.equal(ROUNDS_TO_WIN,2);
 assert.equal(m.phase,'ready');assert.equal(m.clock,60);
 assert.equal(m.fighters.length,2);
 assert.deepEqual(m.fighters.map(x=>x.hp),[100,100]);
 assert.deepEqual(m.rounds,{p1:0,p2:0});
 assert.ok(FIGHTERS.speed.speed>FIGHTERS.power.speed);
 assert.ok(FIGHTERS.power.damage>FIGHTERS.speed.damage);
 assert.equal(startMatch(m),true);assert.equal(startMatch(m),false);
 assert.throws(()=>createMatch({p1:'unknown'}));
});
test('left/right movement, facing and fixed stage boundaries; no falling out',()=>{
 const m=createMatch();startMatch(m);
 const x=m.fighters[0].x;
 frames(m,18,{p1:{right:true}});
 assert.ok(m.fighters[0].x>x+40);
 frames(m,18,{p1:{left:true}});
 assert.ok(m.fighters[0].vx<0);
 assert.equal(m.fighters[0].facing,1,'fighter automatically faces the opponent');
 m.fighters[0].x=WORLD.edgeL+22;frames(m,150,{p1:{left:true}});
 assert.ok(m.fighters[0].x>=WORLD.edgeL+21);
 m.fighters[0].x=WORLD.edgeR-22;frames(m,150,{p1:{right:true}});
 assert.ok(m.fighters[0].x<=WORLD.edgeR-21);
 assert.equal(m.phase,'playing');
});
test('one jump only, natural landing, no double-jump input',()=>{
 const m=createMatch();startMatch(m);
 frames(m,1,{p1:{jump:true}});const f=m.fighters[0];
 assert.ok(!f.grounded&&f.vy<0);
 frames(m,3);frames(m,1,{p1:{jump:true}});
 assert.ok(f.vy>-FIGHTERS.speed.jump+40,'cannot jump a second time');
 frames(m,120);
 assert.equal(f.grounded,true);assert.equal(f.y,WORLD.groundY);
});
test('weak hits subtract HP; strong is slower but stronger',()=>{
 const a=close();
 frames(a,1,{p1:{light:true}});frames(a,14);
 assert.equal(a.fighters[1].hp,93);
 assert.equal(a.fighters[1].stun>0,true);
 assert.ok(a.events.every(e=>e.type!=='ko'));
 const b=close();frames(b,1,{p1:{heavy:true}});frames(b,19);
 assert.equal(b.fighters[1].hp,84);
 assert.ok(MOVES.heavy.startup>MOVES.light.startup);
 assert.ok(MOVES.heavy.recovery>MOVES.light.recovery);
});
test('holding guard in front blocks damage; guard stun visibly stops attacking',()=>{
 const m=close();
 frames(m,1,{p1:{light:true},p2:{guard:true}});
 frames(m,10,{p2:{guard:true}});
 assert.equal(m.fighters[1].hp,100);
 assert.ok(m.fighters[1].guardStun>0);
 assert.equal(fighterStatus(m.fighters[1]).label,'ガード硬直');
 frames(m,1,{p2:{heavy:true}});
 assert.equal(m.fighters[1].attack,null,'cannot counterattack during block stun');
});
test('weak -> weak -> strong connects as a simple three-hit combo',()=>{
 const m=close(),b=m.fighters[1];
 frames(m,1,{p1:{light:true}});
 frames(m,7);
 frames(m,1,{p1:{light:true}});
 console.log('COMBO_DEBUG',JSON.stringify({attack:m.fighters[0].attack,prev:m.fighters[0].prev,buffer:m.fighters[0].buffer,opponentHP:m.fighters[1].hp}));
 assert.equal(m.fighters[0].attack?.stage,2);
 frames(m,9);
 frames(m,1,{p1:{heavy:true}});
 assert.equal(m.fighters[0].attack?.kind,'heavy');
 assert.equal(m.fighters[0].attack?.stage,3);
 frames(m,20);
 assert.equal(b.hp,70,'7 + 7 + 16 must be reflected in real HP');
 assert.equal(b.hitsTaken,3);
});
test('cannot cancel on whiff, guard, or directly spam strong',()=>{
 const miss=close();miss.fighters[1].x=750;
 frames(miss,1,{p1:{light:true}});frames(miss,7);frames(miss,1,{p1:{heavy:true}});
 assert.equal(miss.fighters[0].attack?.kind,'light','misses never combo-cancel');
 const block=close();frames(block,1,{p1:{light:true},p2:{guard:true}});
 frames(block,7,{p2:{guard:true}});frames(block,1,{p1:{heavy:true},p2:{guard:true}});
 assert.equal(block.fighters[0].attack?.kind,'light','blocked hits never combo-cancel');
 const heavy=close();frames(heavy,1,{p1:{heavy:true}});frames(heavy,13);frames(heavy,1,{p1:{light:true}});
 assert.equal(heavy.fighters[0].attack?.kind,'heavy','strong attack cannot chain into light');
});
test('attacks have meaningful recovery: moving, jumping and guarding are locked until finished',()=>{
 const m=close(),f=m.fighters[0];frames(m,1,{p1:{heavy:true}});
 frames(m,19);assert.equal(fighterStatus(f).tone,'recovery');
 const original=f.x;
 frames(m,4,{p1:{right:true,guard:true,jump:true}});
 assert.equal(f.guarding,false);assert.equal(f.grounded,true);
 assert.equal(f.x,original);
 frames(m,25);
 assert.equal(f.attack,null);assert.equal(fighterStatus(f).label,'操作可能');
});
test('a hit interrupts an opponent attack, not just HP',()=>{
 const m=close();const [a,b]=m.fighters;
 frames(m,1,{p2:{heavy:true}});
 frames(m,1,{p1:{light:true}});
 frames(m,8);
 assert.equal(b.attack,null);
 assert.ok(b.stun>0);
 assert.ok(b.hp<100);
});
test('KO awards one round; next round restores both HP and begins automatically',()=>{
 const m=close();const b=m.fighters[1];b.hp=5;
 frames(m,1,{p1:{light:true}});frames(m,12);
 assert.equal(m.phase,'roundOver');assert.equal(m.rounds.p1,1);
 assert.equal(m.winner,null);
 frames(m,130);
 assert.equal(m.phase,'playing');assert.equal(m.round,2);
 assert.deepEqual(m.fighters.map(x=>x.hp),[100,100]);
 assert.ok(m.clock<=60&&m.clock>58,'second round timer reset and is counting down');
});
test('second round victory is match victory and cannot be changed afterwards',()=>{
 const m=close();m.rounds.p1=1;m.round=2;m.fighters[1].hp=4;
 frames(m,1,{p1:{light:true}});frames(m,14);
 assert.equal(m.phase,'finished');assert.equal(m.winner,'p1');
 assert.equal(m.rounds.p1,2);
 const stable=JSON.stringify(m.fighters);
 frames(m,120,{p1:{left:true,light:true}});
 assert.equal(JSON.stringify(m.fighters),stable);
});
test('60-second timeout decides by remaining HP; exact tie repeats round without awarding score',()=>{
 const m=close();m.clock=.005;m.fighters[1].hp=54;
 stepMatch(m);assert.equal(m.phase,'roundOver');assert.equal(m.rounds.p1,1);
 const t=close();t.clock=.005;stepMatch(t);
 assert.equal(t.phase,'roundOver');assert.deepEqual(t.rounds,{p1:0,p2:0});
 frames(t,125);assert.equal(t.phase,'playing');assert.equal(t.round,2);
});
test('damage from each fighter archetype is readable and deterministic',()=>{
 const a=createMatch({p1:'power',p2:'speed'}),b=createMatch({p1:'power',p2:'speed'});
 startMatch(a);startMatch(b);
 for(let i=0;i<70;i++){
  const inp={p1:i===1?{right:true}:i===21?{light:true}:i===39?{heavy:true}:{}};
  stepMatch(a,inp,FIXED_DT);stepMatch(b,inp,FIXED_DT);
 }
 assert.deepEqual(a,b);
});
test('prototype remains unlisted and uses only six touch keys and matching keyboard mapping',()=>{
 for(const file of ['engine.js','game.js'])execFileSync(process.execPath,['--check',new URL('../games/houkago-fight/'+file,import.meta.url).pathname],{stdio:'pipe'});
 const js=readFileSync(new URL('../games/houkago-fight/game.js',import.meta.url),'utf8');
 const html=readFileSync(new URL('../games/houkago-fight/index.html',import.meta.url),'utf8');
 const css=readFileSync(new URL('../games/houkago-fight/game.css',import.meta.url),'utf8');
 assert.match(js,/requestAnimationFrame/);assert.match(js,/stepMatch\(game,/);assert.match(js,/pointerdown/);assert.match(js,/keydown/);assert.match(js,/cpuControls/);
 assert.match(html,/CPU対戦試作/);
 for(const key of ['light','heavy','jump','guard','left','right'])assert.match(html,new RegExp('data-key="'+key+'"'));
 for(const old of ['smash','attack','special','up','down'])assert.doesNotMatch(html,new RegExp('data-key="'+old+'"'));
 assert.equal((html.match(/data-key=/g)||[]).length,6);
 assert.match(css,/@media\(orientation:portrait\)/);
 assert.doesNotMatch(readFileSync(new URL('../games/index.html',import.meta.url),'utf8'),/href="houkago-fight\/"/);
});
