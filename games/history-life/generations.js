/* Original multi-generational historical-life experience.
 * Simulated heir profiles/estate shares are GAME RULES, not a claim about
 * historically accurate primogeniture, adoption, gender, or succession law.
 */
import {createLife,lifeSummary} from './engine.js';
import {syncFamily} from './social.js';
import {getJob} from './careers.js';
import {getRegion,eraForYear} from './scenarios.js';

const nonnegative=n=>Math.max(0,Math.floor(Number(n)||0));
const bounded=n=>Math.max(0,Math.min(100,Math.round(Number(n)||0)));
export function ensureLineage(s){
 if(!s.lineage||typeof s.lineage!=='object'||Array.isArray(s.lineage)){
  const seed=(s.meta?.originSeed??s.rng)>>>0;
  s.lineage={id:'dynasty-'+seed.toString(36)+'-'+s.birthYear,
   generation:1,ancestors:[]};
 }
 if(!Array.isArray(s.lineage.ancestors))s.lineage.ancestors=[];
 if(!Number.isInteger(s.lineage.generation)||s.lineage.generation<1)s.lineage.generation=1;
 return s.lineage;
}
export function eligibleHeirs(s){
 if(s?.phase!=='ended')return [];
 return (s.people||[]).filter(p=>p?.role==='child'&&p.alive&&
  typeof p.id==='string'&&typeof p.name==='string'&&
  Number.isInteger(p.birthYear)&&p.birthYear<=s.year&&s.year-p.birthYear<=110);
}
export function ancestorSummary(s){
 return {
  generation:ensureLineage(s).generation,
  name:s.name,sex:s.sex,birthYear:s.birthYear,
  deathYear:s.year,age:s.age,
  home:getRegion(s.regionId).name,profession:s.profession,
  children:s.family.children,
  historicalEvents:(s.log||[]).filter(x=>x.kind==='history').length
 };
}
function stableChildSeed(s,child){
 let x=((s.rng>>>0)^((s.meta?.originSeed||0)>>>0)^Math.imul(child.birthYear,0x85ebca6b))>>>0;
 for(const ch of child.id)x=(Math.imul(x^ch.charCodeAt(0),16777619))>>>0;
 return x||0x6d2b79f5;
}
const relcopy=(npc,role,id,year)=>({
 id:'npc-'+id,role,name:npc.name,
 birthYear:npc.birthYear,trait:npc.trait||'quiet',
 traitLabel:npc.traitLabel||'物静か',
 closeness:bounded(npc.closeness),alive:!!npc.alive,
 metYear:Math.min(year,npc.metYear??year),notes:[],lastInteractionYear:null
});
export function inheritLife(s,childId){
 const child=eligibleHeirs(s).find(p=>p.id===childId);
 if(!child)return {ok:false,reason:'引き継げる子どもが見つかりません'};
 const parent=ensureLineage(s);
 const birthYear=child.birthYear;
 // createLife normally only generates initial era births. Here we need a child
 // already born inside a continuing family whose birthday may fall much later.
 const next=createLife({eraId:eraForYear(s.year),seed:stableChildSeed(s,child),
   regionId:s.regionId,birthYear});
 next.birthYear=birthYear;next.year=s.year;next.age=s.year-birthYear;
 next.name=child.name;next.sex=child.sex||next.sex;
 next.background=s.background;next.backgroundIndex=s.backgroundIndex;
 next.meta={...next.meta,continuedFamily:true,originSeed:stableChildSeed(s,child),
   birthEraId:eraForYear(birthYear)};
 next.stats={
  health:bounded(60+Math.min(24,child.closeness/5)-Math.max(0,next.age-50)*.35),
  knowledge:bounded(8+Math.min(40,next.age*.65)+s.stats.knowledge*.12),
  bonds:bounded(35+child.closeness*.42),
  joy:bounded(32+child.closeness*.38),
  wealth:20
 };
 next.lineage={
  id:parent.id,generation:parent.generation+1,
  ancestors:[...parent.ancestors,ancestorSummary(s)].slice(-16)
 };
 // The deceased player becomes an actual relative. Preserve surviving parent,
 // siblings and grandparents rather than manufacturing strangers.
 const relatives=[];
 let id=0;
 const add=(data,role)=>{if(!data)return;
  const p=relcopy(data,role,++id,next.year);
  if(p.birthYear<=next.year)relatives.push(p);
 };
 add({name:s.name,birthYear:s.birthYear,alive:false,closeness:100,
      trait:'kind',traitLabel:'親身に育ててくれた'},s.sex==='female'?'mother':'father');
 const livingPartner=(s.people||[]).find(p=>p.role==='partner'&&p.alive);
 if(livingPartner)add(livingPartner,s.sex==='female'?'father':'mother');
 for(const p of s.people||[]){
  if(p.role==='child'&&p.id!==child.id)add(p,'sibling');
  if(['father','mother'].includes(p.role))add(p,'grandparent');
 }
 next.people=relatives;
 next.nextPersonId=id;next.lastSocialYear=null;
 syncFamily(next);
 // Equal division of NET estate between surviving children is a *game
 // convenience*. Different periods and households followed varied practices.
 const inheritors=eligibleHeirs(s).length;
 const estate=Math.max(0,nonnegative(s.money.cash)+nonnegative(s.money.savings)-nonnegative(s.money.debt));
 const share=Math.floor(estate/inheritors);
 next.money.cash=Math.floor(share*.35);
 next.money.savings=share-next.money.cash;
 next.money.debt=0;
 next.money.year=next.year;
 next.money.yearIncome=0;next.money.yearExpenses=0;
 next.money.lastSpendYear=null;
 next.money.ledger=share?[{year:next.year,label:'前世代の財産を引き継いだ（ゲーム内の均等配分）',amount:share,kind:'inheritance'}]:[];
 next.money.netWorthHistory=[{year:next.year,net:share,income:0,outgo:0}];
 next.stats.wealth=bounded(20+Math.round(share*.65));
 if(next.age>=15){
  // An adult heir is assumed to have learned a basic form of the household's
  // work. The child did not previously have an independently simulated career.
  const inheritedJob=getJob(s.career?.jobId);
  const job=inheritedJob&&inheritedJob.eras.includes(next.eraId)?inheritedJob:getJob('apprentice');
  next.career.jobId=job.id;
  next.career.skill=bounded(8+Math.min(45,(next.age-15)*1.4));
  next.career.years=Math.max(0,next.age-15);
  next.career.rank=next.career.skill>=30?1:0;
  next.career.history=[{year:next.year,jobId:job.id,name:job.name,assumed:true}];
  next.profession=job.name;
 }else next.profession='家の仕事を少しずつ覚える子ども';
 next.pending=null;next.eventQueue=[];next.phase='living';next.death=null;
 next.log=[
  {year:birthYear,age:0,title:'生まれた年',text:birthYear+'年、'+getRegion(next.regionId).name+'に生まれた。親の人生の途中から、この家の物語が続いている。',
   kind:'birth',sourceId:null,eventId:null,personId:null},
  {year:s.year,age:next.age,title:'第'+next.lineage.generation+'代の人生へ',
   text:s.name+'を見送り、'+child.name+'が家の歴史を引き継いだ。前世代の正味財産は生存している子ども'+inheritors+'人でゲーム上均等に分けた。この人物のそれまでの生活は簡易的に推定している。',
   kind:'inheritance',sourceId:null,eventId:null,personId:null}
 ];
 next.lastStory={label:'世代継承',title:'第'+next.lineage.generation+'代：'+next.name,
  text:s.name+'の生涯は終わった。しかし、この家の物語はまだ続く。\n'+
   next.year+'年、'+next.age+'歳。'+getRegion(next.regionId).name+'で、'+child.name+'の人生をここから生きよう。'};
 return {ok:true,life:next,share,heirs:inheritors};
}
