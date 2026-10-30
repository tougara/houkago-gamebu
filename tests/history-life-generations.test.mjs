import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createLife,validateSave,upgradeSave,advanceYear,chooseEvent} from '../games/history-life/engine.js';
import {syncFamily,labelRole} from '../games/history-life/social.js';
import {ensureLineage,eligibleHeirs,inheritLife,ancestorSummary} from '../games/history-life/generations.js';
import {periodFor} from '../games/history-life/currency.js';
import {eraForYear} from '../games/history-life/scenarios.js';
function endedFamily({eraId='sengoku',seed=78,year=1611,children=2}={}){
 const s=createLife({eraId,seed,regionId:'tokai'});
 s.age=year-s.birthYear;s.year=year;s.phase='ended';
 s.death={year,age:s.age,reason:'生涯の終わり'};
 s.money.cash=50;s.money.savings=75;s.money.debt=20;
 s.people.push({id:'npc-'+(++s.nextPersonId),role:'partner',name:'ふみ',birthYear:s.birthYear+2,
  trait:'kind',traitLabel:'面倒見がいい',closeness:76,alive:true,metYear:year-30,notes:[],lastInteractionYear:null});
 for(let i=0;i<children;i++){
  s.people.push({id:'npc-'+(++s.nextPersonId),role:'child',name:['竹','松','梅'][i],
   birthYear:year-(23+i*3),trait:'curious',traitLabel:'好奇心旺盛',
   closeness:75+i*3,alive:true,metYear:year-(23+i*3),notes:[],lastInteractionYear:null});
 }
 syncFamily(s);
 return s;
}
test('the dead parent offers only living children as successors',()=>{
 const s=endedFamily();
 assert.ok(validateSave(s));
 assert.equal(eligibleHeirs(s).length,2);
 const first=eligibleHeirs(s)[0];
 first.alive=false;
 assert.equal(eligibleHeirs(s).length,1);
 assert.equal(inheritLife(s,first.id).ok,false);
 s.phase='living';assert.equal(eligibleHeirs(s).length,0);
});
test('heir continues at actual age/year, not reborn in era selection window',()=>{
 const s=endedFamily({year:1640});
 const p=eligibleHeirs(s)[0];
 const first=inheritLife(s,p.id);
 assert.equal(first.ok,true);
 const child=first.life;
 assert.equal(child.birthYear,p.birthYear);
 assert.equal(child.year,s.year);
 assert.equal(child.age,23);
 assert.equal(child.name,p.name);
 assert.equal(child.regionId,s.regionId);
 assert.equal(child.phase,'living');assert.ok(validateSave(child));
 assert.equal(child.meta.continuedFamily,true);
 assert.ok(child.log.some(e=>e.kind==='inheritance'));
 assert.equal(child.lifeMap,undefined,'do not fabricate 23 years of map entries');
 const before=child.year;
 if(child.age>=7)advanceYear(child,'family',[]);
 assert.equal(child.year,before+1);
});
test('parent is genuinely deceased, surviving partner and children become relatives',()=>{
 const s=endedFamily();
 const next=inheritLife(s,eligibleHeirs(s)[0].id).life;
 const deadParent=next.people.find(p=>p.name===s.name&&['father','mother'].includes(p.role));
 assert.ok(deadParent&&!deadParent.alive);
 assert.ok(next.people.some(p=>p.name==='ふみ'&&p.alive&&['mother','father'].includes(p.role)));
 assert.ok(next.people.some(p=>p.role==='sibling'&&p.name==='松'));
 assert.equal(next.family.children,0);
 assert.equal(next.family.partner,false);
 assert.ok(next.people.some(p=>p.role==='grandparent'));
 assert.equal(labelRole('grandparent'),'祖父母');
});
test('net household estate divided per living heir without manufacturing new credit',()=>{
 const s=endedFamily();
 ensureLineage(s); // A family identity is added lazily, but the deceased life otherwise stays unchanged.
 const old=JSON.stringify(s);
 const first=inheritLife(s,eligibleHeirs(s)[0].id);
 assert.equal(first.share,52);assert.equal(first.heirs,2);
 assert.equal(first.life.money.cash+first.life.money.savings,52);
 assert.equal(first.life.money.debt,0);
 assert.ok(first.life.money.ledger.some(e=>e.kind==='inheritance'));
 assert.equal(JSON.stringify(s),old,'the previous generation is retained for archives');
 assert.ok(validateSave(first.life));
});
test('family chain can continue through at least three generations with unique life summaries',()=>{
 const root=endedFamily({year:1611});
 const first=inheritLife(root,eligibleHeirs(root)[0].id).life;
 assert.equal(ensureLineage(first).generation,2);
 assert.equal(first.lineage.ancestors.length,1);
 assert.equal(first.lineage.ancestors[0].name,root.name);
 first.year=1650;first.age=1650-first.birthYear;first.phase='ended';
 first.death={year:1650,age:first.age,reason:'生涯の終わり'};
 first.people.push({id:'npc-'+(++first.nextPersonId),name:'若竹',role:'child',birthYear:1630,
  trait:'kind',traitLabel:'面倒見がいい',closeness:85,alive:true,metYear:1630,notes:[],lastInteractionYear:null});
 syncFamily(first);
 assert.ok(validateSave(first));
 const second=inheritLife(first,eligibleHeirs(first)[0].id).life;
 assert.equal(second.lineage.generation,3);
 assert.equal(second.lineage.ancestors.length,2);
 assert.equal(second.birthYear,1630);
 assert.deepEqual(second.lineage.ancestors.map(x=>x.name),[root.name,first.name]);
 assert.equal(second.lineage.id,first.lineage.id);
 assert.ok(validateSave(second));
 const saved=JSON.parse(JSON.stringify(second));
 assert.ok(upgradeSave(saved));
 assert.deepEqual(saved.lineage,second.lineage);
});
test('older v0.3 and v0.4 saved lives get a root family line without changing RNG',()=>{
 const s=createLife({seed:11,birthYear:1544});
 const originalRng=s.rng,year=s.year;
 delete s.lineage;
 const family=ensureLineage(s);
 assert.equal(family.generation,1);assert.equal(s.rng,originalRng);assert.equal(s.year,year);
 assert.ok(validateSave(s));
 assert.equal(ensureLineage(s).id,family.id);
});
test('heir life in Bakumatsu-Meiji retains the actual 1871 reform chronology',()=>{
 const s=endedFamily({eraId:'bakumatsu-meiji',year:1872,children:1});
 const next=inheritLife(s,eligibleHeirs(s)[0].id).life;
 assert.equal(next.year,1872);assert.equal(periodFor(next),'meiji');
 assert.ok(validateSave(next));
});
test('absent or deceased children cannot advance a family, allowing a meaningful natural ending',()=>{
 const s=endedFamily({children:0});
 assert.deepEqual(eligibleHeirs(s),[]);
 assert.equal(inheritLife(s,'npc-444').ok,false);
 assert.equal(ancestorSummary(s).children,0);
});

test('calendar-year change updates a living person without erasing their birthplace or family',()=>{
 assert.equal(eraForYear(1602),'sengoku');
 assert.equal(eraForYear(1603),'edo');
 assert.equal(eraForYear(1852),'edo');
 assert.equal(eraForYear(1853),'bakumatsu-meiji');
 let person=null;
 for(let seed=10;seed<50;seed++){
  const testLife=createLife({eraId:'sengoku',seed,birthYear:1586});
  for(let n=0;n<50&&testLife.age<17&&testLife.phase!=='ended';n++){
   if(testLife.phase==='event')chooseEvent(testLife,testLife.pending.options[0].id);
   else advanceYear(testLife,'family',[]);
  }
  if(testLife.phase!=='ended'){person=testLife;break}
 }
 assert.ok(person);
 assert.equal(person.year,1603);
 assert.equal(person.eraId,'edo');
 assert.equal(person.meta.birthEraId,'sengoku');
 assert.ok(person.log.some(e=>e.kind==='history-context'));
 assert.ok(validateSave(person));
});
test('heir arriving in 1640 has Edo career choices even if ancestor was born in Sengoku',()=>{
 const parent=endedFamily({year:1640});
 const next=inheritLife(parent,eligibleHeirs(parent)[0].id).life;
 assert.equal(next.eraId,'edo');
 assert.equal(next.meta.birthEraId,'edo');
 assert.ok(validateSave(next));
});
