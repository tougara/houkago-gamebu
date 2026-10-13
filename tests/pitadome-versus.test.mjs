import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const r=require('../games/pitadome-challenge/versus/versus-rules.js');

test('each single stop advances a turn; profile/difficulty advances every pair',()=>{
 assert.equal(r.levelForTurn(1),1);assert.equal(r.levelForTurn(2),1);
 assert.equal(r.levelForTurn(3),2);assert.equal(r.levelForTurn(4),2);
 assert.equal(r.levelForTurn(20),10);
});
test('normal and easy eventually demand exact zero error',()=>{
 assert.deepEqual([1,5,9,17,23,29].map(t=>r.baseSafe(t,'normal')),[12,9,7,3,2,0]);
 assert.deepEqual([1,5,9,17,23,33].map(t=>r.baseSafe(t,'easy')),[15,12,10,6,4,0]);
});
test('pressure caps at three and can never make safe negative',()=>{
 assert.equal(r.effectiveSafe(12,2),10);
 assert.equal(r.effectiveSafe(2,3),0);
 assert.equal(r.effectiveSafe(0,99),0);
});
test('a perfect stop awards combo, points and exactly one special effect',()=>{
 const a=r.evaluateStop(50,50,{combo:0,charge:0,score:0},10);
 assert.equal(a.value,50);assert.equal(a.error,0);assert.equal(a.points,110);
 assert.equal(a.perfect,true);assert.equal(a.special,true);
 assert.equal(a.combo,2);assert.equal(a.chargeReward,0);
 const effect=r.applyRewards(1,a);
 assert.deepEqual(effect,{life:2,healed:1,damage:0,pressure:2});
});
test('perfect at full life still causes -2 on opponent next turn',()=>{
 const a=r.evaluateStop(40,40,{},6),effect=r.applyRewards(3,a);
 assert.equal(effect.life,3);assert.equal(effect.pressure,2);
});
test('three consecutive GREAT-or-better stops excluding PERFECT trigger equivalent reward',()=>{
 let p={combo:0,greatStreak:0,charge:0,score:0},last;
 for(let i=0;i<3;i++){last=r.evaluateStop(41,40,p,10);p={combo:last.combo,greatStreak:last.greatStreak,charge:last.charge,score:last.total};}
 assert.equal(last.triple,true);assert.equal(last.special,true);assert.equal(last.greatStreak,0);
 assert.equal(r.applyRewards(2,last).pressure,2);
});
test('a perfect resets the triple GREAT streak rather than double triggering it',()=>{
 const a=r.evaluateStop(40,40,{greatStreak:2},10);
 assert.equal(a.triple,false);assert.equal(a.greatStreak,0);assert.equal(a.special,true);
});
test('scoring follows solo grades and combo multiplier, never timing',()=>{
 assert.equal(r.scoreForError(0),100);assert.equal(r.scoreForError(1),95);
 assert.equal(r.scoreForError(2),90);assert.equal(r.scoreForError(3),80);
 assert.equal(r.scoreForError(5),70);assert.equal(r.scoreForError(8),50);
 assert.equal(r.scoreForError(12),30);assert.equal(r.scoreForError(50),10);
 assert.equal(r.comboMultiplierFor(2),1.1);assert.equal(r.comboMultiplierFor(10),1.5);
 assert.equal(Object.hasOwn(r.evaluateStop(27,28),'fast'),false);
});
test('score crosses 500 threshold; heals if missing life',()=>{
 const a=r.evaluateStop(45,40,{charge:480,score:200},10);
 assert.equal(a.chargeReward,1);
 const fx=r.applyRewards(1,a);
 assert.equal(fx.life,2);assert.equal(fx.healed,1);assert.equal(fx.pressure,0);
});
test('score crosses 500 at full health; applies -1 instead',()=>{
 const a=r.evaluateStop(45,40,{charge:480},10),fx=r.applyRewards(3,a);
 assert.equal(fx.healed,0);assert.equal(fx.pressure,1);
});
test('perfect + score charge both at full life cap pressure to 3',()=>{
 const a=r.evaluateStop(40,40,{charge:470},10),fx=r.applyRewards(3,a);
 assert.equal(fx.pressure,3);
});
test('perfect heals first, so a 500-point charge does not over-heal',()=>{
 const a=r.evaluateStop(40,40,{charge:470},10),fx=r.applyRewards(2,a);
 assert.equal(fx.life,3);assert.equal(fx.healed,1);assert.equal(fx.pressure,3);
});
test('miss instantly loses a life; no extra attack damage occurs',()=>{
 const a=r.evaluateStop(60,40,{},5),fx=r.applyRewards(1,a);
 assert.equal(fx.life,0);assert.equal(fx.damage,1);assert.equal(fx.pressure,0);
});
test('first player can be chosen at random, not always P1',()=>{
 assert.equal(r.chooseRandom(()=>0.1),0);
 assert.equal(r.chooseRandom(()=>0.8),1);
});
test('normal solo ten stages provide identical speed, bar scale, range and gimmick',()=>{
 const expected=[
 [32,.86,100,'normal'],[40,.86,100,'normal'],[40,.58,100,'normal'],
 [42,.86,100,'normal'],[46,.86,100,'change'],[46,.86,100,'normal'],
 [48,.86,150,'normal'],[52,.58,100,'reverse'],[118,1,100,'hyper'],[58,.86,200,'normal']
 ];
 for(let n=1;n<=10;n++){
   const p=r.roundProfile(n*2-1,'normal',()=>0.5);
   const [speed,bar,max,movement]=expected[n-1];
   assert.equal(p.speed,speed,'speed level '+n);
   assert.equal(p.barScale,bar,'bar scale '+n);
   assert.equal(p.maxValue,max,'max range '+n);
   if(n!==10)assert.equal(p.movement,movement,'movement level '+n); // FINAL randomly picks two gimmicks
 }
});
test('easy does not put blind over target area, including range 1..100',()=>{
 for(let n=1;n<=50;n++){
  const p=r.roundProfile(n,'easy',()=>.45);
  assert.equal(p.minValue,1);assert.equal(p.maxValue,100);
  if(p.blind){const t=((p.target-1)/99)*100;assert.ok(p.blindEnd<t-10||p.blindStart>t+10)}
 }
});
test('motion follows solo direction and bounces at the ends',()=>{
 const p=r.roundProfile(1,'normal',()=>.3);
 const x=r.initialMotion(p,()=>0.2);
 assert.equal(x.value,0);assert.equal(x.dir,1);
 const step=r.advanceMotion({...x,value:99,dir:1},.04,p);
 assert.ok(step.value<=100);assert.equal(step.dir,-1);
});

test('solo quiet gauge fills at 100 and activates one future score boost',()=>{
 const first=r.evaluateStop(50,50,{quiet:80},10);
 assert.equal(first.mushinReady,true);
 assert.equal(first.quiet,0);
 const boosted=r.evaluateStop(50,50,{mushinActive:true},10);
 assert.equal(boosted.points,165);
 assert.equal(boosted.mushinReady,false);
});
test('quiet gauge accumulates by solo accuracy grades',()=>{
 const great=r.evaluateStop(52,50,{quiet:20},10);
 assert.equal(great.quiet,40);
 const excellent=r.evaluateStop(51,50,{quiet:40},10);
 assert.equal(excellent.quiet,70);
 const imperfect=r.evaluateStop(65,50,{quiet:70},10);
 assert.equal(imperfect.quiet,70);
});
