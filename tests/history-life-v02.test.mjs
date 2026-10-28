import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createLife,advanceYear,chooseEvent,validateSave,upgradeSave,interactWithPerson,changeCareer,jobOptions,lifeSummary} from '../games/history-life/engine.js';
import {alivePeople,peopleByRole,personAge,RELATION_ACTIONS} from '../games/history-life/social.js';
import {JOBS,getJob} from '../games/history-life/careers.js';
function travel(s,age){
 for(let n=0;n<250&&s.age<age&&s.phase!=='ended';n++){
  if(s.phase==='event'){chooseEvent(s,s.pending.options[0].id);continue}
  advanceYear(s,'family',[]);
 }
 return s;
}
test('v0.2 birth creates distinct named, aging, personality-bearing relatives in all three eras',()=>{
 for(const eraId of ['sengoku','edo','bakumatsu-meiji']){
  const s=createLife({eraId,seed:4234,birthYear:eraId==='sengoku'?1550:eraId==='edo'?1700:1854});
  assert.equal(s.version,2);assert.ok(validateSave(s));
  const father=peopleByRole(s,'father')[0],mother=peopleByRole(s,'mother')[0];
  for(const p of [father,mother]){
   assert.ok(p.id&&p.name&&p.traitLabel&&p.alive);
   assert.ok(personAge(p,s.year)>=19);
   assert.ok(p.closeness>=0&&p.closeness<=100);
  }
  assert.notEqual(father.id,mother.id);
  travel(s,7);
  assert.equal(personAge(father,s.year),personAge(father,s.birthYear)+7);
  assert.equal(personAge(mother,s.year),personAge(mother,s.birthYear)+7);
 }
});
test('one relationship interaction per year, with persistent closeness and log',()=>{
 const s=createLife({seed:122,birthYear:1550});
 travel(s,7);chooseEvent(s,'listen');
 const parent=alivePeople(s)[0],start=parent.closeness;
 const first=interactWithPerson(s,parent.id,'talk');
 assert.equal(first.ok,true);assert.ok(parent.closeness>=start);
 assert.equal(s.lastSocialYear,s.year);
 assert.equal(interactWithPerson(s,parent.id,'gift').ok,false);
 assert.ok(s.log.some(e=>e.personId===parent.id&&e.kind==='relationship'));
 const restored=JSON.parse(JSON.stringify(s));assert.ok(validateSave(restored));
 assert.equal(interactWithPerson(restored,parent.id,'talk').ok,false);
 advanceYear(restored,'family',[]);
 if(restored.phase==='event')chooseEvent(restored,restored.pending.options[0].id);
 assert.equal(interactWithPerson(restored,parent.id,'talk').ok,true);
});
test('no interaction with dead relatives, missing person, or without wealth',()=>{
 const s=createLife({seed:17,birthYear:1550});travel(s,7);chooseEvent(s,'listen');
 const parent=alivePeople(s)[0];parent.alive=false;
 assert.equal(interactWithPerson(s,parent.id,'talk').ok,false);
 assert.equal(interactWithPerson(s,'npc-999','talk').ok,false);
 s.stats.wealth=0;
 const next=alivePeople(s)[0];
 assert.equal(interactWithPerson(s,next.id,'gift').ok,false);
 assert.equal(interactWithPerson(s,next.id,'talk').ok,true);
});
test('partner creation records identity and children gain actual independent age and relationship',()=>{
 const survivors=Array.from({length:24},(_,i)=>{
  const state=createLife({seed:1000+i,birthYear:1550});
  return travel(state,22);
 });
 const s=survivors.find(state=>state.age===22&&state.pending?.id==='milestone-22');
 assert.ok(s,'at least one seeded life should reach the age-22 relationship milestone');
 // Regardless of marriage roll, a partnership choice must not produce phantom children.
 chooseEvent(s,'partner');
 const actualPartners=peopleByRole(s,'partner').filter(p=>p.alive);
 assert.equal(s.family.partner,actualPartners.length>0);
 assert.equal(s.family.children,peopleByRole(s,'child').length);
 for(let i=0;i<20&&s.phase!=='ended';i++){
  if(s.phase==='event'){chooseEvent(s,s.pending.options[0].id);continue}
  advanceYear(s,'family',[]);
 }
 for(const c of peopleByRole(s,'child')){
  assert.ok(Number.isInteger(c.birthYear)&&c.birthYear<=s.year);
  assert.equal(personAge(c,s.year),s.year-c.birthYear);
  assert.ok(c.role==='child'&&c.traitLabel);
 }
 assert.equal(s.family.children,peopleByRole(s,'child').length);
});
test('jobs are era-specific and based on known skill/education requirements',()=>{
 for(const eraId of ['sengoku','edo','bakumatsu-meiji']){
  const s=createLife({eraId,seed:444,birthYear:eraId==='sengoku'?1544:eraId==='edo'?1700:1855});
  travel(s,15);if(s.phase==='event')chooseEvent(s,s.pending.options[0].id);
  assert.ok(s.age>=15);
  const options=jobOptions(s);
  assert.ok(options.length>=7);
  assert.ok(options.every(j=>j.eras.includes(eraId)));
  assert.ok(options.every(j=>Number.isInteger(j.needKnowledge)));
  assert.equal(options.some(j=>j.id==='office'),eraId==='bakumatsu-meiji');
  assert.equal(options.some(j=>j.id==='service'),eraId==='sengoku');
  assert.equal(options.some(j=>j.id==='retainer'),eraId==='edo');
 }
});
test('career applications are at most once per year, and can fail without losing old profession',()=>{
 const s=createLife({seed:55,birthYear:1544});
 travel(s,15);if(s.phase==='event')chooseEvent(s,s.pending.options[0].id);
 const available=jobOptions(s).find(j=>j.available);
 assert.ok(available,'at least apprentice or inherited career is open');
 const original=s.profession,attempt=changeCareer(s,available.id);
 assert.equal(attempt.ok,true);
 assert.equal(s.career.lastSwitchYear,s.year);
 assert.equal(changeCareer(s,'apprentice').ok,false);
 assert.equal(s.career.jobId!==undefined,true);
 assert.ok(s.profession===original||s.profession===available.name);
 assert.ok(validateSave(s));
});
test('skill advances annually and the same career can reach an experienced rank',()=>{
 const s=createLife({seed:224,birthYear:1544});
 travel(s,15);if(s.phase==='event')chooseEvent(s,s.pending.options[0].id);
 const job=getJob(s.career.jobId);assert.ok(job,'milestone should set a career');
 const start=s.career.skill;
 let years=0;
 while(s.age<34&&s.phase!=='ended'&&years<55){
  if(s.phase==='event'){chooseEvent(s,s.pending.options[0].id);continue}
  advanceYear(s,'work',[]);years++;
 }
 assert.ok(s.career.skill>=start);
 assert.ok(s.career.years>=years);
 assert.ok(s.career.rank>=1,'experience should lead to a rank upgrade');
 assert.ok(s.log.some(e=>e.kind==='career'));
});
test('v0.1 legacy saves migrate without changing age, year, current event or RNG',()=>{
 const s=createLife({seed:151,birthYear:1550});
 travel(s,7);
 assert.equal(s.phase,'event');
 const legacy=JSON.parse(JSON.stringify(s));
 legacy.version=1;delete legacy.people;delete legacy.career;delete legacy.nextPersonId;delete legacy.lastSocialYear;
 const before={year:legacy.year,age:legacy.age,rng:legacy.rng,pending:legacy.pending};
 const migrated=upgradeSave(legacy);
 assert.ok(migrated&&validateSave(migrated));
 assert.equal(migrated.version,2);
 assert.equal(migrated.meta.upgradedFrom,1);
 assert.equal(migrated.year,before.year);assert.equal(migrated.age,before.age);
 assert.equal(migrated.rng,before.rng);
 assert.deepEqual(migrated.pending,before.pending);
 assert.ok(migrated.people.some(p=>p.role==='father'));
 assert.ok(migrated.career);
 const decided=chooseEvent(migrated,'listen');assert.equal(decided.ok,true);
 assert.ok(validateSave(migrated));
});
test('past saves with later family state migrate into named partner and children instead of losing them',()=>{
 const old=createLife({seed:125,birthYear:1544});
 travel(old,22);if(old.phase==='event')chooseEvent(old,old.pending.options[0].id);
 const legacy=JSON.parse(JSON.stringify(old));legacy.version=1;delete legacy.people;delete legacy.career;delete legacy.nextPersonId;delete legacy.lastSocialYear;
 legacy.family={partner:true,children:2,parentsAlive:false};
 const m=upgradeSave(legacy);assert.ok(validateSave(m));
 assert.equal(m.family.children,2);
 assert.equal(m.people.filter(p=>p.role==='child').length,2);
 assert.equal(m.people.filter(p=>p.role==='partner').length,1);
 assert.equal(m.people.filter(p=>p.role==='father'&&p.alive).length,0);
});
test('unsupported and malformed data is rejected and cannot delete valid v0.2 state',()=>{
 const valid=createLife({seed:40});
 assert.ok(validateSave(valid));
 assert.equal(upgradeSave({...valid,version:99}),null);
 assert.equal(validateSave({...valid,people:[{id:'duplicate'}]}),false);
 assert.equal(validateSave({...valid,career:{jobId:'farm'}}),false);
 assert.ok(validateSave(valid));
});
test('life summary preserves careers and people; choice randomness is reproducible',()=>{
 const x=createLife({seed:345}),y=createLife({seed:345});
 travel(x,15);travel(y,15);
 assert.deepEqual(x,y);
 const summary=lifeSummary(x);
 assert.equal(summary.lovedOnes,x.people.length);
 assert.equal(summary.careerChanges,x.career.history.length);
 assert.equal(summary.careerSkill,x.career.skill);
 assert.ok(JOBS.length>=10);assert.equal(RELATION_ACTIONS.length,4);
});

test('history and age-15 career choice both appear in 1560 when they coincide',()=>{
 const events=JSON.parse(requireHistoryFile()).events;
 const s=createLife({seed:110,birthYear:1545,regionId:'tokai'});
 for(let i=0;i<250&&s.age<15&&s.phase!=='ended';i++){
  if(s.phase==='event'){chooseEvent(s,s.pending.options[0].id);continue}
  advanceYear(s,'family',events);
 }
 assert.equal(s.age,15);assert.equal(s.phase,'event');
 assert.match(s.pending.title,/桶狭間/);
 assert.ok(s.eventQueue.some(e=>e.id==='milestone-15'),'career milestone must queue after historical event');
 assert.equal(chooseEvent(s,'observe').ok,true);
 assert.equal(s.pending.id,'milestone-15');
 assert.equal(chooseEvent(s,'home').ok,true);
 assert.notEqual(s.profession,'家族に育てられる子ども');
 assert.ok(s.log.some(x=>x.title==='暮らしの道を選ぶ'));
 assert.ok(validateSave(s));
});
function requireHistoryFile(){
 return readFileSync(new URL('../games/history-life/data/historical-events.jp.json',import.meta.url),'utf8');
}
