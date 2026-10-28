import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createLife,advanceYear,chooseEvent,autoAdvance,lifeSummary,validateSave} from '../games/history-life/engine.js';
import {ERAS,REGIONS,getEra,relevantLocal} from '../games/history-life/scenarios.js';
const history=JSON.parse(readFileSync(new URL('../games/history-life/data/historical-events.jp.json',import.meta.url),'utf8')).events;
const advanceReady=(s,until,focus='family')=>{
 for(let i=0;i<170&&s.age<until&&s.phase!=='ended';i++){
  if(s.phase==='event'){chooseEvent(s,s.pending.options[0].id);continue}
  advanceYear(s,focus,history);
 }
 return s;
};
test('all three historical eras have playable birth range, career backgrounds and region coverage',()=>{
 assert.deepEqual(ERAS.map(e=>e.id),['sengoku','edo','bakumatsu-meiji']);
 assert.equal(REGIONS.length,6);
 for(const e of ERAS){
  assert.ok(e.birthYears[0]<e.birthYears[1]);assert.equal(e.backgrounds.length,e.careers.length);
  const s=createLife({eraId:e.id,seed:197204,regionId:'kinai'});
  assert.ok(s.birthYear>=e.birthYears[0]&&s.birthYear<=e.birthYears[1]);
  assert.equal(s.regionId,'kinai');assert.equal(s.age,0);
  assert.equal(s.year,s.birthYear);assert.equal(s.family.children,0);
  assert.equal(s.phase,'living');assert.ok(validateSave(s));
 }
});
test('birth randomness is reproducible by seed and not advertised as historical distribution',()=>{
 const a=createLife({eraId:'edo',seed:232343});
 const b=createLife({eraId:'edo',seed:232343});
 assert.deepEqual(a,b);
 assert.equal(a.meta.birthWeights,'fictional_equal_weights');
 assert.equal(a.meta.chanceModel,'game_balance_placeholder');
 assert.ok(a.stats.wealth>=0&&a.stats.wealth<=100);
});
test('year and age always progress together; preschool years do not count as choices',()=>{
 const s=createLife({seed:101,birthYear:1550});
 const start=s.birthYear;
 for(let i=0;i<5;i++)advanceYear(s,'work',[]);
 assert.equal(s.age,5);assert.equal(s.year,start+5);assert.equal(s.choices,0);
 assert.equal(s.phase,'living');
 assert.ok(s.log.some(x=>x.kind==='birth'));
});
test('at age 7 the first historical-life milestone has three meaningful choices',()=>{
 const s=createLife({seed:1234,birthYear:1535});
 advanceReady(s,7);
 assert.equal(s.age,7);assert.equal(s.phase,'event');
 assert.equal(s.pending.id,'milestone-7');assert.equal(s.pending.options.length,3);
 const before=s.stats.knowledge;
 const x=chooseEvent(s,'seek');
 assert.equal(x.ok,true);assert.equal(s.phase,'living');
 assert.ok(s.stats.knowledge>before);
 assert.equal(s.specialChoices,1);
});
test('historical event in Owari has source and local effect, distant event is only hearsay',()=>{
 const found=history.find(e=>e.year===1560);
 assert.equal(found.title,'桶狭間の戦い');
 assert.equal(relevantLocal(found,'tokai'),'nearby');
 assert.equal(relevantLocal(found,'tohoku'),'distant');
 const s=createLife({seed:19,birthYear:1548,regionId:'tokai'});
 advanceReady(s,12);
 assert.equal(s.year,1560);
 assert.equal(s.phase,'event');
 assert.match(s.pending.title,/桶狭間/);
 assert.equal(s.pending.kind,'history');
 assert.equal(s.pending.sourceId,found.sourceId);
 assert.ok(s.pending.description.includes('尾張・東海'));
 assert.equal(chooseEvent(s,'observe').ok,true);
 assert.equal(s.log.filter(x=>x.kind==='history'&&x.eventId===found.id).length,1);
 const distant=createLife({seed:19,birthYear:1548,regionId:'tohoku'});
 advanceReady(distant,12);
 assert.match(distant.pending.description,/話を耳にした/);
});
test('unknown source/history probabilities are never embedded in historical records',()=>{
 assert.ok(history.length>=35);
 for(const ev of history){
  assert.equal(ev.status,'historical_fact');
  assert.ok(ev.sourceId&&ev.regionId);
  assert.equal(ev.probability,undefined);
  assert.equal(ev.deathRate,undefined);
 }
});
test('invalid decision is rejected without changing pending stage',()=>{
 const s=createLife({seed:89,birthYear:1535});
 advanceReady(s,7);
 const before=JSON.stringify(s);
 assert.deepEqual(chooseEvent(s,'not-an-option'),{ok:false});
 assert.equal(JSON.stringify(s),before);
});
test('actions have distinct consequences; yearly choices do not just increase everything',()=>{
 const build=focus=>{
  const s=createLife({seed:505,birthYear:1535});advanceReady(s,7);
  chooseEvent(s,'listen');advanceYear(s,focus,[]);return s;
 };
 const work=build('work'),study=build('learn'),rest=build('rest');
 assert.ok(work.stats.wealth>study.stats.wealth);
 assert.ok(study.stats.knowledge>work.stats.knowledge);
 assert.ok(rest.stats.health>work.stats.health);
 assert.ok(work.choices>=1);
});
test('a career choice at 15 sets profession, making different life paths',()=>{
 const s=createLife({seed:11,birthYear:1542});
 advanceReady(s,15);
 assert.equal(s.pending.id,'milestone-15');
 assert.equal(chooseEvent(s,'apprentice').ok,true);
 assert.equal(s.profession,'見習い・奉公');
});
test('five-year automation stops for decisions or death, never skips historical cards',()=>{
 const s=createLife({seed:1357,birthYear:1548,regionId:'tokai'});
 advanceReady(s,10);
 assert.equal(s.year,1558);
 const r=autoAdvance(s,5,history);
 assert.ok(r.advanced<=5);assert.equal(s.year,1560);assert.equal(r.stoppedBy,'event');
 assert.match(s.pending.title,/桶狭間/);
});
test('health/death and end of life produce a complete record without claiming precise mortality data',()=>{
 const s=createLife({seed:108,birthYear:1544});
 advanceReady(s,8);
 s.stats.health=0;
 advanceYear(s,'work',[]);
 assert.equal(s.phase,'ended');assert.equal(s.death.age,9);
 assert.equal(s.pending,null);assert.ok(s.log.find(e=>e.kind==='ending'));
 const r=lifeSummary(s);
 assert.equal(r.age,1);assert.equal(r.birthYear,1535);assert.ok(validateSave(s));
 assert.equal(advanceYear(s,'learn',[]).ok,false);
});
test('saved pending events can be serialized and resumed identically',()=>{
 const s=createLife({seed:600,birthYear:1535});
 advanceReady(s,7);
 const json=JSON.parse(JSON.stringify(s));
 assert.ok(validateSave(json));assert.deepEqual(json,s);
 const result=chooseEvent(json,'not-an-option');
 assert.equal(result.ok,false,'unknown option should not remove event');
 const option=json.pending.options[1].id;
 assert.equal(chooseEvent(json,option).ok,true);
 assert.ok(validateSave(json));
});
test('tampered saves, invalid version and impossible ages are rejected',()=>{
 const s=createLife({seed:92,birthYear:1535});
 assert.equal(validateSave({...s,age:-1}),false);
 assert.equal(validateSave({...s,version:7}),false);
 assert.equal(validateSave({...s,year:1768}),false);
 assert.equal(validateSave({...s,stats:{...s.stats,wealth:999}}),false);
});
test('game is independent with source documentation and not included in official game directory',()=>{
 const names=['engine.js','scenarios.js','app.js'];
 for(const path of names){
  execFileSync(process.execPath,['--check',new URL('../games/history-life/'+path,import.meta.url).pathname],{stdio:'pipe'});
 }
 const html=readFileSync(new URL('../games/history-life/index.html',import.meta.url),'utf8');
 assert.match(html,/id="newLifeButton"/);assert.match(html,/id="actionArea"/);
 assert.match(html,/id="statBars"/);assert.match(html,/id="historyModal"/);
 const browser=readFileSync(new URL('../games/index.html',import.meta.url),'utf8');
 assert.doesNotMatch(browser,/href="history-life\/"/);
});
