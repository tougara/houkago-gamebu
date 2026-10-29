import {formatCurrency} from './currency.js';
/* Historical Life fictional household accounting (game units, NEVER historic currency).
 * Positive wealth choices post income, negative wealth choices post expenses.
 * All rates/costs/starting balances are GAME BALANCE placeholders, not historical statistics. */
const integer=n=>Math.max(0,Math.round(n));
const limit=(v,min,max)=>Math.max(min,Math.min(max,v));
const MAX_CREDIT=60;
export const UNIT='生活点';
export const PURCHASES=[
 {id:'food',name:'食べ物と備蓄を整える',cost:7,delta:{health:5,joy:1},detail:'食料を確保し、家族が安心して暮らせるようにした。'},
 {id:'tools',name:'仕事の道具をそろえる',cost:10,delta:{knowledge:4,joy:2},detail:'道具を整え、仕事の工夫ができるようになった。'},
 {id:'learning',name:'学びに使う',cost:9,delta:{knowledge:6,joy:1},detail:'学ぶために家計から費用を出した。'},
 {id:'family',name:'家族との時間に使う',cost:6,delta:{bonds:5,joy:4},detail:'大切な人との時間をつくった。'}
];
const balance=m=>m.cash+m.savings-m.debt;
function reflect(s){s.stats.wealth=limit(Math.round(20+balance(s.money)*.65),0,100)}
function entry(s,label,amount,kind){
 const m=s.money;
 m.ledger.push({year:m.year,label,amount:Math.round(amount),kind});
 if(m.ledger.length>80)m.ledger.shift();
 if(amount>0)m.yearIncome+=amount;
 else if(amount<0)m.yearExpenses+=-amount;
}
export function initMoney(s){
 const start=s.stats.wealth;
 s.money={cash:integer(9+start*.25),savings:integer(start*.36),debt:0,yearIncome:0,yearExpenses:0,
  year:s.year,lastSpendYear:null,ledger:[],hadHardship:false,netWorthHistory:[]};
 reflect(s);
 return s.money;
}
export function migrateMoney(s){
 if(s.money)return s.money;
 const original=s.stats.wealth;
 s.money={cash:integer(7+original*.24),savings:integer(original*.32),debt:0,yearIncome:0,yearExpenses:0,
  year:s.year,lastSpendYear:null,ledger:[],hadHardship:false,netWorthHistory:[]};
 reflect(s);return s.money;
}
export function changeMoney(s,amount,label='人生の出来事'){
 if(!s.money)return;
 amount=Math.trunc(amount);
 if(amount===0)return;
 const m=s.money;
 if(amount>0){
  // Income first covers ordinary spending. Debt repayment is a deliberate choice.
  m.cash+=amount;entry(s,label,amount,'income');
 }else{
  let due=-amount;
  let from=Math.min(m.cash,due);m.cash-=from;due-=from;
  from=Math.min(m.savings,due);m.savings-=from;due-=from;
  if(due>0){
   const credit=Math.min(MAX_CREDIT-m.debt,due);
   m.debt+=credit;due-=credit;
   if(due>0){m.hadHardship=true;s.stats.health=limit(s.stats.health-2,0,100);s.stats.joy=limit(s.stats.joy-3,0,100)}
  }
  entry(s,label,amount,'expense');
 }
 reflect(s);
}
export function beginMoneyYear(s){
 if(!s.money)initMoney(s);
 s.money.year=s.birthYear+s.age+1;
 s.money.yearIncome=0;s.money.yearExpenses=0;s.money.hadHardship=false;
}
export function settleYear(s){
 const m=s.money;
 if(!m)return;
 // Entirely fictitious per-year subsistence costs. Children cost resources,
 // adults work, elders have reduced earning capacity in later versions.
 const children=Math.min(5,s.family.children||0);
 const spouse=s.family.partner;
 const base=s.age<15?7:8;
 if(s.age<15)changeMoney(s,8+Math.floor(s.backgroundIndex/2),'家の収入・扶養');
 else if(spouse)changeMoney(s,3,'世帯の助け合い');
 const cost=base+Math.min(5,Math.ceil(children/2));
 changeMoney(s,-cost,'食事・住まい・生活の支出');
 if(m.debt>0){
  // This 4% is intentionally invented, NOT a historical rate of interest.
  const interest=Math.max(1,Math.round(m.debt*.04));
  m.debt=limit(m.debt+interest,0,MAX_CREDIT);
  entry(s,'借入に伴う負担（仮設定）',-interest,'interest');
 }
 m.netWorthHistory.push({year:s.year,net:balance(m),income:m.yearIncome,outgo:m.yearExpenses});
 if(m.netWorthHistory.length>110)m.netWorthHistory.shift();
 if(m.debt>=MAX_CREDIT){
  s.stats.joy=limit(s.stats.joy-2,0,100);
  m.hadHardship=true;
 }
 reflect(s);
}
export function moneyAction(s,action,effect,log){
 if(s.phase!=='living'||s.age<7)return {ok:false,reason:'今は家計を操作できません'};
 const m=s.money;
 let desc='';
 if(action==='save'){
  if(m.cash<5)return {ok:false,reason:'手元のお金が足りません'};
  m.cash-=5;m.savings+=5;desc='手元の'+formatCurrency(5,s)+'を蓄えに移した。';
 }else if(action==='withdraw'){
  if(m.savings<5)return {ok:false,reason:'蓄えが足りません'};
  m.savings-=5;m.cash+=5;desc='蓄えから'+formatCurrency(5,s)+'を取り出した。';
 }else if(action==='repay'){
  if(m.cash<5||m.debt<=0)return {ok:false,reason:'返済する借り入れか現金がありません'};
  const amount=Math.min(5,m.debt);m.cash-=amount;m.debt-=amount;desc='借りたお金を'+formatCurrency(amount,s)+'返した。';
 }else{
  const item=PURCHASES.find(p=>p.id===action);
  if(!item)return {ok:false,reason:'操作が無効'};
  if(m.lastSpendYear===s.year)return {ok:false,reason:'今年の特別な支出は済んでいます'};
  if(m.cash+m.savings<item.cost)return {ok:false,reason:'この買い物に使えるお金が足りません'};
  changeMoney(s,-item.cost,item.name);
  const normal={...item.delta};delete normal.wealth;
  effect(normal);
  m.lastSpendYear=s.year;desc=item.detail;
 }
 reflect(s);
 log('暮らしとお金',desc,{kind:'money'});
 return {ok:true,action};
}
export function validateMoney(s){
 const m=s.money;
 if(!m||!['cash','savings','debt','yearIncome','yearExpenses','year'].every(k=>Number.isFinite(m[k])&&m[k]>=0))return false;
 if(m.debt>MAX_CREDIT||!Array.isArray(m.ledger)||m.ledger.length>80||!Array.isArray(m.netWorthHistory)||m.netWorthHistory.length>110)return false;
 if(m.lastSpendYear!=null&&!Number.isInteger(m.lastSpendYear))return false;
 return true;
}
export function moneySummary(s){
 const m=s.money;
 return {cash:m.cash,savings:m.savings,debt:m.debt,netWorth:balance(m),
  yearIncome:m.yearIncome,yearExpenses:m.yearExpenses};
}
