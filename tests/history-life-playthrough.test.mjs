import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createLife,advanceYear,chooseEvent,jobOptions,changeCareer} from '../games/history-life/engine.js';

function quantile(arr,q){const a=[...arr].sort((x,y)=>x-y);return a[Math.floor((a.length-1)*q)]}
function play(eraId,seed,strategy='adaptive'){
 const s=createLife({eraId,seed,regionId:'kanto'});
 const ages=[],money=[],started=[],decisions=[];
 let guard=0;
 while(s.phase!=='ended'&&guard++<450){
  if(s.phase==='event'){
   const option=s.pending.options[0];
   assert.ok(chooseEvent(s,option.id).ok);
   decisions.push(s.age);continue;
  }
  if(strategy==='adaptive'&&s.age===15&&s.career?.jobId==='dependent'){
   const opt=jobOptions(s).find(j=>j.available&&j.id==='farm')||jobOptions(s).find(j=>j.available&&j.id==='apprentice');
   if(opt)changeCareer(s,opt.id,()=>.01,()=>{},{});
  }
  const focus=strategy==='defaultFamily'?'family':s.stats.health<38?'rest':s.age<15?'learn':s.stats.wealth<35?'work':'family';
  const before=s.age;
  const r=advanceYear(s,focus,[]);
  assert.ok(r.ok);
  assert.equal(s.age,before+1);
  ages.push(s.age);
  money.push({age:s.age,debt:s.money?.debt||0,net:(s.money?.cash||0)+(s.money?.savings||0)-(s.money?.debt||0),wealth:s.stats.wealth,health:s.stats.health});
  if(s.age===15||s.age===30||s.age===50)started.push({age:s.age,wealth:s.stats.wealth,cash:s.money.cash,debt:s.money.debt,health:s.stats.health,joy:s.stats.joy,career:s.career.jobId});
 }
 assert.ok(s.phase==='ended',`life did not end: ${eraId} ${seed}`);
 assert.ok(s.age<=110);
 assert.ok(guard<450);
 return {age:s.age,years:ages.length,choices:decisions.length,at30:started.find(x=>x.age===30)||null,
  debtCap:money.some(x=>x.debt>=60),lastNet:money.at(-1)?.net||0,
  peakDebt:Math.max(0,...money.map(x=>x.debt)),last:s};
}
test('playthrough benchmark: 3 eras × 40 actual lifetimes, fiscal and longevity diagnostics',()=>{
 for(const era of ['sengoku','edo','bakumatsu-meiji']){
  const lives=Array.from({length:40},(_,i)=>play(era,1000+i*71));
  const ages=lives.map(x=>x.age);
  const at30=lives.map(x=>x.at30).filter(Boolean);
  const report={era,n:lives.length,medianAge:quantile(ages,.5),
    p10Age:quantile(ages,.10),p90Age:quantile(ages,.90),
    age30Reached:at30.length,
    debtCapShare:lives.filter(x=>x.debtCap).length/lives.length,
    age30MedianWealth:at30.length?quantile(at30.map(x=>x.wealth),.5):null,
    age30MedianDebt:at30.length?quantile(at30.map(x=>x.debt),.5):null,
    lastMedianNet:quantile(lives.map(x=>x.lastNet),.5),
    meanChoices:+(lives.reduce((a,x)=>a+x.choices,0)/lives.length).toFixed(1)};
  console.log('BALANCE_PLAYTEST '+JSON.stringify(report));
  assert.equal(lives.length,40);
 }
});

test('playthrough benchmark: default family-focused autopilot without deliberate career choice',()=>{
 for(const era of ['sengoku','edo','bakumatsu-meiji']){
  const lives=Array.from({length:40},(_,i)=>play(era,1000+i*71,'defaultFamily'));
  const age30=lives.map(x=>x.at30).filter(Boolean);
  console.log('DEFAULT_PLAYTEST '+JSON.stringify({era,n:lives.length,
   medianAge:quantile(lives.map(x=>x.age),.5),
   debtCapShare:lives.filter(x=>x.debtCap).length/lives.length,
   age30MedianWealth:age30.length?quantile(age30.map(x=>x.wealth),.5):null,
   age30MedianDebt:age30.length?quantile(age30.map(x=>x.debt),.5):null,
   noJobAt30:age30.filter(x=>x.career==='dependent').length,
   age30Count:age30.length}));
  assert.equal(lives.length,40);
 }
});
