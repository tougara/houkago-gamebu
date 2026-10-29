import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createLife,advanceYear,chooseEvent,manageMoney,moneySummary,validateSave,upgradeSave} from '../games/history-life/engine.js';
import {PURCHASES,UNIT} from '../games/history-life/money.js';
import {selectLifeEvent} from '../games/history-life/life-events.js';
function toAge(s,age){
 for(let i=0;i<150&&s.age<age&&s.phase!=='ended';i++){
  if(s.phase==='event'){chooseEvent(s,s.pending.options[0].id);continue}
  advanceYear(s,'family',[]);
 }
 if(s.phase==='event')chooseEvent(s,s.pending.options[0].id);
}
test('financial snapshot is independent of legacy abstract wealth score',()=>{
 const s=createLife({seed:92,birthYear:1544});
 assert.equal(UNIT,'生活点');
 assert.ok(s.money.cash>0&&s.money.savings>0);
 assert.equal(s.money.debt,0);
 const b=moneySummary(s);
 assert.equal(b.netWorth,b.cash+b.savings-b.debt);
 assert.ok(validateSave(s));
});
test('annual household subsistence, income and audit ledger are recorded',()=>{
 const s=createLife({seed:14,birthYear:1544});
 advanceYear(s,'family',[]);
 assert.equal(s.money.year,s.year);
 const entries=s.money.ledger.filter(e=>e.year===s.year);
 assert.ok(entries.find(e=>e.label.includes('生活')));
 assert.ok(entries.find(e=>e.label.includes('家の収入')));
 assert.ok(s.money.yearIncome>0&&s.money.yearExpenses>0);
 assert.equal(s.money.netWorthHistory.at(-1).year,s.year);
 assert.ok(validateSave(s));
});
test('spending cannot exceed household cash plus savings; purchase boosts meaningful stat',()=>{
 const s=createLife({seed:18,birthYear:1544});
 toAge(s,7);
 const health=s.stats.health,amount=moneySummary(s).netWorth;
 const r=manageMoney(s,'food');
 assert.equal(r.ok,true);
 assert.ok(s.stats.health>=health);
 assert.equal(s.money.lastSpendYear,s.year);
 assert.ok(moneySummary(s).netWorth<=amount);
 assert.equal(manageMoney(s,'learning').ok,false,'only one special purchase per year');
 assert.ok(s.log.some(e=>e.kind==='money'));
});
test('deposit and withdraw preserve net worth; debt repayment reduces debt and cash equally',()=>{
 const s=createLife({seed:29,birthYear:1544});
 toAge(s,7);
 s.money.cash=20;s.money.savings=12;s.money.debt=10;
 const initial=moneySummary(s).netWorth;
 assert.equal(manageMoney(s,'save').ok,true);
 assert.equal(s.money.cash,15);assert.equal(s.money.savings,17);
 assert.equal(moneySummary(s).netWorth,initial);
 assert.equal(manageMoney(s,'withdraw').ok,true);
 assert.equal(s.money.cash,20);assert.equal(s.money.savings,12);
 assert.equal(manageMoney(s,'repay').ok,true);
 assert.equal(s.money.cash,15);assert.equal(s.money.debt,5);
 assert.equal(moneySummary(s).netWorth,initial);
});
test('debt cannot exceed cap; hardship affects wellbeing without negative balances',()=>{
 const s=createLife({seed:39,birthYear:1544});
 s.money.cash=0;s.money.savings=0;s.money.debt=59;
 s.stats.health=90;s.stats.joy=90;
 advanceYear(s,'rest',[]);
 assert.ok(s.money.debt<=60);
 assert.ok(s.money.cash>=0&&s.money.savings>=0);
 assert.ok(s.money.hadHardship);
 assert.ok(validateSave(s));
});
test('annual work focus changes financial outcome and salary is not inflated by repeated rendering',()=>{
 const a=createLife({seed:49,birthYear:1544});
 const b=createLife({seed:49,birthYear:1544});
 toAge(a,15);toAge(b,15);
 if(a.phase==='ended'||b.phase==='ended')return;
 const cashA=moneySummary(a).netWorth,cashB=moneySummary(b).netWorth;
 advanceYear(a,'work',[]);advanceYear(b,'rest',[]);
 assert.ok(moneySummary(a).netWorth-cashA>moneySummary(b).netWorth-cashB);
 const before=JSON.stringify(a.money);
 moneySummary(a);moneySummary(a);
 assert.equal(JSON.stringify(a.money),before,'read-only rendering must not post new entries');
});
test('v0.1 and v0.2 saves preserve year, unresolved decisions, and family on v0.3',()=>{
 for(const oldVersion of [1,2]){
  const actual=createLife({seed:63,birthYear:1544});
  toAge(actual,7);
  const old=JSON.parse(JSON.stringify(actual));
  old.version=oldVersion;delete old.money;
  if(oldVersion===1){delete old.people;delete old.career;delete old.nextPersonId;delete old.lastSocialYear;delete old.eventQueue}
  const migrated=upgradeSave(old);
  assert.ok(migrated&&validateSave(migrated));
  assert.equal(migrated.version,3);
  assert.equal(migrated.year,old.year);assert.equal(migrated.age,old.age);assert.equal(migrated.rng,old.rng);
  assert.deepEqual(migrated.pending,old.pending);
  assert.equal(migrated.meta.upgradedFrom,oldVersion);
  assert.ok(migrated.money.cash>=0&&migrated.money.savings>=0);
 }
});
test('mangled financial saves are rejected',()=>{
 const s=createLife({seed:90});
 assert.equal(validateSave({...s,money:{...s.money,cash:-10}}),false);
 assert.equal(validateSave({...s,money:{...s.money,debt:100}}),false);
 assert.equal(validateSave({...s,money:{...s.money,ledger:new Array(81).fill({})}}),false);
 assert.equal(manageMoney(s,'invalid').ok,false);
 assert.ok(PURCHASES.length>=4);
});

test('extra events depend on age, money conditions, job and family rather than pure annual repetition',()=>{
 const s=createLife({seed:118,birthYear:1544});
 s.age=17;s.year=s.birthYear+s.age;
 const none=selectLifeEvent(s,()=>.99);
 assert.equal(none,null,'event chance does not guarantee a yearly event');
 s.money.debt=28;
 const poor=selectLifeEvent(s,()=>0);
 assert.ok(poor&&poor.id==='supplies','random drawing picks an eligible event');
 assert.equal(poor.choices.length,3);
 const year6={...s,age:18};
 assert.equal(selectLifeEvent(year6,()=>0),null,'old year-six cards avoid duplicate bursts');
 const young={...s,age:12};
 assert.equal(selectLifeEvent(young,()=>0),null);
 s.career.jobId='farm';s.money.debt=0;
 const possibles=new Set();
 for(let i=0;i<=50;i++){
  const n=i/50*.24;
  const ev=selectLifeEvent(s,()=>n);
  if(ev)possibles.add(ev.id);
 }
 assert.ok(possibles.size>=4,'multiple event themes available to the same person');
});
test('dynamic events can interrupt time without erasing personal state',()=>{
 const s=createLife({seed:788,birthYear:1544});
 for(let i=0;i<80&&s.age<16&&s.phase!=='ended';i++){
  if(s.phase==='event'){chooseEvent(s,s.pending.options[0].id);continue}
  advanceYear(s,'family',[]);
 }
 if(s.phase==='ended')return;
 if(s.phase==='event')chooseEvent(s,s.pending.options[0].id);
 let last=s.age;
 for(let i=0;i<45&&s.phase!=='ended';i++){
  if(s.phase==='event'){
   const pending=s.pending;
   assert.equal(s.year,s.birthYear+s.age);
   assert.ok(pending.title&&pending.description&&pending.options.length>=3);
   assert.ok(pending.options.every(o=>o.id&&o.label&&o.result));
   assert.equal(chooseEvent(s,pending.options[0].id).ok,true);
   continue;
  }
  advanceYear(s,'family',[]);last=s.age;
 }
 assert.ok(last>=16);
 assert.ok(validateSave(s));
});
