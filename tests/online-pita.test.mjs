import {test} from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {createPita,pitaAction,pitaView,pitaPosition,pitaGrade,pitaLimits} from '../worker/src/pita-engine.js';
if(!globalThis.crypto)globalThis.crypto=webcrypto;
const fixture=(n=3)=>{
 const room={hostId:'p0',members:Array.from({length:n},(_,i)=>({id:'p'+i,name:'人'+i,icon:'🐶'}))};
 room.pita=createPita(room);return room;
};
const action=(room,id,type,extra={})=>pitaAction(room,id,{type,...extra});
const perfectTime=g=>Math.round(g.target/g.speed*1000);
const missTime=g=>Math.round((g.target+25)/g.speed*1000);
test('all participants start equal; movement bounces predictably and thresholds narrow',()=>{
 const r=fixture(10);
 assert.equal(r.pita.stage,'setup');assert.equal(action(r,'p1','pita-begin'),false);
 assert.equal(action(r,'p0','pita-begin'),true);
 assert.equal(r.pita.round,1);assert.equal(r.pita.stage,'playing');
 assert.ok(r.pita.target>=25&&r.pita.target<=75);
 assert.equal(pitaPosition(1000,50),50);
 assert.equal(pitaPosition(3000,50),50);
 assert.equal(pitaGrade(8,0),'great');
 assert.equal(pitaGrade(8,2),'miss');
 assert.deepEqual(pitaLimits(3),{perfect:1,excellent:2,great:4});
 for(let i=0;i<10;i++){
  assert.equal(pitaView(r,'p'+i).pressure,0);
  assert.equal(pitaView(r,'p'+i).target,r.pita.target);
 }
});
test('result remains hidden until everyone stops; only one stop per round',()=>{
 const r=fixture();
 action(r,'p0','pita-begin');
 const ms=perfectTime(r.pita);
 assert.equal(action(r,'p0','pita-stop',{elapsedMs:ms,choice:'attack'}),true);
 assert.equal(action(r,'p0','pita-stop',{elapsedMs:ms,choice:'heal'}),false);
 assert.deepEqual(pitaView(r,'p1').results,[]);
 assert.equal(pitaView(r,'p1').submittedCount,1);
 assert.equal(action(r,'p1','pita-stop',{elapsedMs:missTime(r.pita),choice:'heal'}),true);
 assert.equal(action(r,'p2','pita-stop',{elapsedMs:ms,choice:'heal'}),true);
 assert.equal(r.pita.stage,'review');
 assert.equal(r.pita.results.length,3);
 assert.equal(r.pita.lives.p0,3);
 assert.equal(r.pita.lives.p1,2);
 assert.equal(r.pita.lives.p2,5);
 assert.equal(r.pita.nextPressure.p0||0,0);
 assert.equal(r.pita.nextPressure.p1,2);
 assert.equal(r.pita.nextPressure.p2,2);
 assert.equal(action(r,'p1','pita-next'),false);
 assert.equal(action(r,'p0','pita-next'),true);
 assert.equal(r.pita.round,2);
 assert.equal(pitaView(r,'p0').pressure,0);
 assert.equal(pitaView(r,'p1').pressure,2);
 assert.equal(pitaView(r,'p2').pressure,2);
});
test('timeout restrictions, invalid action, and host-only closure',()=>{
 const r=fixture(2);action(r,'p0','pita-begin');
 assert.equal(action(r,'p0','pita-stop',{elapsedMs:-2,choice:'attack'}),false);
 assert.equal(action(r,'p0','pita-stop',{elapsedMs:999,choice:'unknown'}),false);
 assert.equal(action(r,'p1','pita-close'),false);
 assert.equal(action(r,'p0','pita-close'),false);
 r.pita.startedAt=Date.now()-26000;
 assert.equal(action(r,'p0','pita-close'),true);
 assert.equal(r.pita.stage,'review');
 assert.ok(r.pita.results.every(row=>row.grade==='miss'&&row.timedOut));
});
test('two player knockout final winner and finished stage',()=>{
 const r=fixture(2);action(r,'p0','pita-begin');
 for(let i=0;i<3;i++){
  const good=perfectTime(r.pita),bad=missTime(r.pita);
  assert.equal(action(r,'p0','pita-stop',{elapsedMs:good,choice:'heal'}),true);
  assert.equal(action(r,'p1','pita-stop',{elapsedMs:bad,choice:'attack'}),true);
  assert.equal(r.pita.stage,'review');
  if(i<2)assert.equal(action(r,'p0','pita-next'),true);
 }
 assert.equal(r.pita.lives.p1,0);
 assert.equal(r.pita.finalRound,true);
 assert.equal(action(r,'p0','pita-next'),true);
 assert.equal(r.pita.stage,'finished');
 assert.deepEqual(pitaView(r,'p1').winnerIds,['p0']);
 assert.equal(action(r,'p0','pita-next'),false);
});
test('timeout stop reaches a result without waiting for disconnected members',()=>{
 const r=fixture(5);action(r,'p0','pita-begin');
 const ms=perfectTime(r.pita);
 assert.equal(action(r,'p0','pita-stop',{elapsedMs:ms,choice:'attack'}),true);
 r.pita.startedAt=Date.now()-26000;
 assert.equal(action(r,'p0','pita-close'),true);
 assert.equal(r.pita.results.filter(x=>x.timedOut).length,4);
 assert.equal(r.pita.results.length,5);
});
