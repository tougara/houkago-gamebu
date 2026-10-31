import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createLife,advanceYear,chooseEvent,upgradeSave,validateSave} from '../games/history-life/engine.js';
import {createChild,createPartner,createMentor,initPeople,syncFamily,peopleByRole,tickPeople} from '../games/history-life/social.js';

const noRepeat=s=>{
 const names=[s.name,...s.people.map(p=>p.name)];
 assert.equal(names.length,new Set(names).size,'Duplicate protagonist or NPC names: '+names.join(' / '));
};
const log=()=>{};
test('initial families avoid duplicate names with each other and the protagonist across 450 seeds',()=>{
 for(const eraId of ['sengoku','edo','bakumatsu-meiji']){
  for(let seed=1;seed<=150;seed++){
   const s=createLife({eraId,seed});
   noRepeat(s);
   assert.ok(validateSave(s));
  }
 }
});
test('repeated identical RNG draws still produce distinct children, spouse, mentor and friend names',()=>{
 const s=createLife({eraId:'edo',seed:29});
 const initial=s.rng;
 const fixed=()=>0;
 createPartner(s,fixed,log);
 for(let i=0;i<5;i++)createChild(s,fixed,log);
 createMentor(s,fixed,log);
 s.age=11;s.year=s.birthYear+11;
 tickPeople(s,'family',fixed,log,()=>{});
 assert.equal(peopleByRole(s,'child').length,5);
 assert.equal(peopleByRole(s,'friend').length,1);
 noRepeat(s);
 assert.equal(s.rng,initial,'test-only people generation should not touch the main state RNG');
 assert.equal(s.nextPersonId,s.people.length);
 assert.ok(validateSave(s));
});
test('old saves preserve their existing person names and IDs, and future births avoid duplicates',()=>{
 const s=createLife({eraId:'edo',seed:100});
 const existing=s.people.map(p=>({id:p.id,name:p.name}));
 s.people[1].name=s.people[0].name; // reproduce a legacy duplicate.
 const restored=upgradeSave(JSON.parse(JSON.stringify(s)));
 assert.ok(restored);
 assert.deepEqual(restored.people.map(p=>({id:p.id,name:p.name})),existing.map((p,i)=>({id:p.id,name:i===1?existing[0].name:p.name})),'legacy identities must not be silently renamed');
 createPartner(restored,()=>0,log);
 for(let i=0;i<5;i++)createChild(restored,()=>0,log);
 const names=restored.people.slice(2).map(p=>p.name);
 assert.equal(names.length,new Set(names).size);
 assert.ok(restored.people.slice(2).every(p=>p.name!==restored.people[0].name));
 assert.ok(validateSave(restored));
});
