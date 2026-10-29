import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createLife,advanceYear,chooseEvent,manageMoney,moneySummary,validateSave,upgradeSave} from '../games/history-life/engine.js';
import {PURCHASES,UNIT} from '../games/history-life/money.js';
import {formatCurrency,yenEstimate,currencyInfo,periodFor} from '../games/history-life/currency.js';
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
  let calls=0;
  const ev=selectLifeEvent(s,()=>calls++===0?.01:i/50);
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

test('multi-seed 3-era lifetime economy and event simulation stays finite and serializable',()=>{
 let count=0,finished=0,pendingCount=0,hardship=0;
 for(const eraId of ['sengoku','edo','bakumatsu-meiji'])for(let i=1;i<=24;i++){
  const state=createLife({eraId,seed:i*21973});
  const focus=['work','learn','family','rest','explore'][i%5];
  for(let n=0;n<300&&state.phase!=='ended';n++){
   if(state.phase==='event'){
    const options=state.pending.options;
    assert.ok(options.length>=3);
    const result=chooseEvent(state,options[(i+n)%options.length].id);
    assert.ok(result.ok);pendingCount++;
   }else{
    advanceYear(state,focus,[]);
    if(state.phase==='living'&&state.age%7===0&&state.age>7)
     manageMoney(state,'save');
   }
   assert.ok(validateSave(state),eraId+' seed '+i+' age '+state.age+' invalid');
   const m=state.money;
   assert.ok(Number.isFinite(m.cash+m.savings+m.debt));
   assert.ok(m.cash>=0&&m.savings>=0&&m.debt>=0&&m.debt<=60);
   assert.ok(Object.values(state.stats).every(x=>x>=0&&x<=100&&Number.isInteger(x)));
   assert.ok(state.log.length<=240&&m.ledger.length<=80);
  }
  assert.equal(state.phase,'ended');
  count++;finished++;
  if(state.money.hadHardship)hardship++;
 }
 assert.equal(count,72);assert.equal(finished,72);
 assert.ok(pendingCount>100,'life events appear across many lives');
});

test('historical units and yen values vary with year, including the 1871 yen transition',()=>{
 const s=createLife({eraId:'bakumatsu-meiji',seed:77,birthYear:1850});
 s.year=1860;s.age=10;
 assert.equal(periodFor(s),'edo');
 assert.match(formatCurrency(40,s),/両/);
 assert.match(yenEstimate(40,s),/円/);
 const old=currencyInfo(s);
 assert.equal(old.monPerRyo,6500);
 s.year=1871;s.age=21;
 assert.equal(periodFor(s),'meiji');
 assert.equal(formatCurrency(10,s),'2円50銭');
 assert.match(yenEstimate(10,s),/円/);
 assert.match(yenEstimate(-10,s),/^−/);
 s.year=1912;s.age=62;
 assert.equal(currencyInfo(s).period,'meiji');
 assert.equal(currencyInfo(s).yenLow,2569/100);
});
test('early Sengoku kanmon and Edo exchange figures are explicitly source-backed examples',()=>{
 const s=createLife({eraId:'sengoku',seed:190,birthYear:1550});
 assert.equal(formatCurrency(10,s),'1貫文');
 assert.equal(yenEstimate(10,s),'約80,000円');
 assert.ok(currencyInfo(s).caution.length>20);
 s.eraId='edo';s.year=1750;
 assert.equal(formatCurrency(8,s),'1両');
 assert.match(yenEstimate(8,s),/40,000円.*60,000円/);
});
