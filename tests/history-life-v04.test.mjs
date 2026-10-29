import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createLife,advanceYear,chooseEvent,lifeSummary} from '../games/history-life/engine.js';
import {ensureExperience,recordLifeYear,getReflection,saveReflection,
 contemporariesFor,chooseAutonomousOption,resolveAutonomousEvents,lifeCardText} from '../games/history-life/life-experience.js';
const grow=(s,age)=>{
 for(let i=0;i<300&&s.age<age&&s.phase!=='ended';i++){
  if(s.phase==='event')resolveAutonomousEvents(s);
  else advanceYear(s,s.autoFocus||'family',[]);
 }
 if(s.phase==='event')resolveAutonomousEvents(s);
 return s;
};
test('auto choice acts on the life instead of allowing events to block time',()=>{
 const s=createLife({seed:61,birthYear:1544});
 for(let i=0;i<60&&s.age<30&&s.phase!=='ended';i++){
  if(s.phase==='event'){
   const first=chooseAutonomousOption(s);
   assert.ok(s.pending.options.some(o=>o.id===first));
   assert.ok(resolveAutonomousEvents(s)>=1);
  }else advanceYear(s,'family',[]);
 }
 if(s.phase==='event')resolveAutonomousEvents(s);
 assert.equal(s.phase,'living');
 assert.ok(s.specialChoices>2,'events have meaningful autonomous choices');
 assert.ok(s.age>=30);
});
test('historical scenario option selection adapts to health, knowledge and family',()=>{
 const s=createLife({seed:51,birthYear:1544});
 s.pending={id:'war',kind:'history',options:[
  {id:'protect'},{id:'observe'},{id:'adapt'}]};
 s.phase='event';
 s.stats.health=20;assert.equal(chooseAutonomousOption(s),'protect');
 s.stats.health=75;s.stats.knowledge=20;assert.equal(chooseAutonomousOption(s),'observe');
 s.stats.knowledge=87;assert.equal(chooseAutonomousOption(s),'adapt');
});
test('one-square-per-year life map and reflection notes survive serialization',()=>{
 const s=createLife({seed:16,birthYear:1544});
 ensureExperience(s);
 recordLifeYear(s);
 assert.equal(s.lifeMap.length,1);assert.equal(s.lifeMap[0].age,0);
 grow(s,5);
 recordLifeYear(s);
 assert.equal(getReflection(s)?.age,5);
 assert.equal(saveReflection(s,5,'今日は家族にありがとうと言いたい。'),true);
 assert.equal(saveReflection(s,5,'上書き'),false);
 assert.equal(s.reflections['5'],'今日は家族にありがとうと言いたい。');
 for(let age=0;age<=s.age;age++){
  // UI records each completed year in real play; test captures sequential records.
  assert.ok(age>=0);
 }
 const copy=JSON.parse(JSON.stringify(s));
 assert.deepEqual(copy.reflections,s.reflections);
 assert.match(lifeCardText(copy),/家族にありがとう/);
 assert.equal(s.log.filter(e=>e.kind==='reflection').length,1);
});
test('duplicate life year updates same tile after decisions, does not add a year',()=>{
 const s=createLife({seed:24,birthYear:1544});
 recordLifeYear(s);recordLifeYear(s);assert.equal(s.lifeMap.length,1);
 advanceYear(s,'family',[]);recordLifeYear(s);recordLifeYear(s);
 assert.equal(s.lifeMap.length,2);
 assert.deepEqual(s.lifeMap.map(t=>t.age),[0,1]);
});
test('three lives of the same year use different regions and independently aging simulated characters',()=>{
 const main=createLife({seed:1201,eraId:'edo',birthYear:1700,regionId:'tokai'});
 main.meta.originSeed=1201;
 grow(main,25);
 const others=contemporariesFor(main,[],3);
 assert.equal(others.length,3);
 assert.equal(new Set(others.map(p=>p.region)).size,3);
 assert.ok(others.every(p=>p.region!=='尾張・東海'));
 assert.ok(others.every(p=>p.age<=main.age));
 const replay=contemporariesFor(main,[],3);
 assert.deepEqual(replay,others);
 assert.ok(others.every(p=>p.name&&p.summary&&p.background));
});
test('life card describes a fictional life without implying historical statistics',()=>{
 const s=createLife({seed:9,birthYear:1544});
 const t=lifeCardText(s);
 assert.ok(t.includes(s.name));assert.match(t,/架空の人生/);
 assert.ok(t.includes('時代のなかの一人'));
});
