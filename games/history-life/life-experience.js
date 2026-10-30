/* Independent life-experience features (no copyrighted UI or text).
 * All contemporaries are fictional simulations, not historical observations.
 */
import {REGIONS,getRegion,eraForYear} from './scenarios.js';
import {createLife,advanceYear,chooseEvent,lifeSummary} from './engine.js';

export const REFLECTIONS=[
 {age:5,question:'初めて覚えている、家族との出来事は？'},
 {age:15,question:'この時代に生まれた自分は、どんな道を選びたい？'},
 {age:30,question:'これまでの人生で、何を大切にしてきただろう。'},
 {age:50,question:'昔の自分に、今ならどんな言葉をかけたい？'},
 {age:70,question:'これまでの時間のうち、何を後世に伝えたい？'}
];
export function chooseAutonomousOption(s){
 const e=s.pending;
 if(!e||!Array.isArray(e.options)||!e.options.length)return null;
 const ids=e.options.map(x=>x.id);
 const pick=id=>ids.includes(id)?id:null;
 if(e.kind==='history'){
  if(s.stats.health<43)return pick('protect')||ids[0];
  if(s.stats.knowledge<60)return pick('observe')||ids[0];
  return pick('adapt')||ids[0];
 }
 if(e.id==='milestone-7'){
  return s.stats.wealth>=35?pick('seek'):pick('listen')||ids[0];
 }
 if(e.id==='milestone-15'){
  return s.stats.knowledge>=45&&s.stats.wealth>=25?pick('study'):(pick('home')||ids[0]);
 }
 if(e.id==='milestone-22'){
  return s.stats.bonds>=40?pick('partner'):(pick('work')||ids[0]);
 }
 if(e.id==='milestone-35'){
  return s.family.children>0?pick('care'):(pick('career')||ids[0]);
 }
 if(e.id==='milestone-55')return pick('teach')||ids[0];
 if(s.stats.health<35)return pick('rest')||pick('care')||pick('repair')||ids[0];
 if(s.money?.debt>25)return pick('extra')||pick('save')||pick('work')||ids[0];
 const focus=s.autoFocus||'family';
 const want=focus==='learn'?['study','observe','listen','seek','teach']:
  focus==='work'?['accept','try','career','extra','repair']:
  focus==='rest'?['rest','care','prepare','decline']:
  focus==='explore'?['try','accept','negotiate','travel']:
  ['join','help','listen','celebrate','care','support'];
 return want.map(pick).find(Boolean)||ids[0];
}
export function resolveAutonomousEvents(s,max=8){
 let count=0;
 while(s.phase==='event'&&count<max){
  const option=chooseAutonomousOption(s);
  if(!option)break;
  const result=chooseEvent(s,option);
  if(!result.ok)break;
  count++;
 }
 return count;
}
export function getReflection(s){
 return REFLECTIONS.find(r=>r.age===s.age)||null;
}
export function ensureExperience(s){
 if(!s.meta)s.meta={};
 if(!Number.isInteger(s.meta.originSeed))s.meta.originSeed=
  (Math.imul(s.birthYear,2654435761)^Math.imul(s.regionId.length,2246822519)^(s.backgroundIndex+1)*9187)>>>0;
 if(!Array.isArray(s.lifeMap))s.lifeMap=[];
 if(!s.reflections||typeof s.reflections!=='object'||Array.isArray(s.reflections))s.reflections={};
 return s;
}
export function recordLifeYear(s){
 ensureExperience(s);
 const tile={
  year:s.year,age:s.age,health:s.stats.health,joy:s.stats.joy,
  wealth:s.stats.wealth,profession:s.profession,regionId:s.regionId,
  events:s.log.filter(e=>e.year===s.year&&e.kind==='history').map(e=>e.title).slice(-3),
  alive:s.phase!=='ended'
 };
 const idx=s.lifeMap.findIndex(x=>x.year===s.year);
 if(idx>=0)s.lifeMap[idx]=tile;
 else s.lifeMap.push(tile);
 if(s.lifeMap.length>111)s.lifeMap.shift();
 return tile;
}
export function saveReflection(s,age,note){
 ensureExperience(s);
 const question=REFLECTIONS.find(r=>r.age===age);
 if(!question||s.age!==age||typeof note!=='string'||s.reflections[age]!=null)return false;
 const trimmed=note.trim().slice(0,140);
 if(!trimmed)return false;
 s.reflections[age]=trimmed;
 s.log.push({year:s.year,age:s.age,title:'人生のひと息',text:trimmed,
  kind:'reflection',sourceId:null,eventId:null,personId:null});
 if(s.log.length>240)s.log.shift();
 return true;
}
const memo=new Map();
export function contemporariesFor(s,events=[],count=3){
 ensureExperience(s);
 const eventSignature=events.length?String(events.length):'0';
 const key=[s.meta.originSeed,s.birthYear,s.age,s.eraId,s.regionId,eventSignature,count].join(':');
 if(memo.has(key))return memo.get(key);
 // Different locations but same birth year and era. Probabilities are invented in this game.
 const currentRegionIndex=REGIONS.findIndex(r=>r.id===s.regionId);
 const results=[];
 for(let i=0;i<count;i++){
  const region=REGIONS[(currentRegionIndex+1+i)%REGIONS.length];
  const seed=(s.meta.originSeed^Math.imul(i+1,0x9e3779b1)^0x852f3d23)>>>0;
  const p=createLife({seed,eraId:s.meta?.birthEraId||eraForYear(s.birthYear),
    birthYear:s.birthYear,regionId:region.id,allowOutOfRange:true});
  while(p.age<s.age&&p.phase!=='ended'){
   if(p.phase==='event'){resolveAutonomousEvents(p);continue}
   advanceYear(p,p.autoFocus||'family',events);
  }
  if(p.phase==='event')resolveAutonomousEvents(p);
  const overview=lifeSummary(p);
  results.push({index:i,id:'peer-'+i,name:p.name,region:getRegion(p.regionId).name,
    background:p.background,age:p.age,alive:p.phase!=='ended',profession:p.profession,
    happiness:p.stats.joy,health:p.stats.health,bonds:p.stats.bonds,
    currentYear:p.year,endYear:p.phase==='ended'?p.year:null,children:p.family.children,
    summary:overview});
 }
 memo.set(key,results);
 if(memo.size>250)memo.delete(memo.keys().next().value);
 return results;
}
export function lifeCardText(s){
 const summary=lifeSummary(s);
 const notes=Object.entries(s.reflections||{}).sort((a,b)=>Number(a[0])-Number(b[0]))
  .map(([age,text])=>age+'歳「'+text+'」');
 return '時代のなかの一人｜'+summary.name+'の人生\n'+
  summary.hometown+'・'+summary.background+'／'+s.birthYear+'年生まれ\n'+
  (s.phase==='ended'?summary.age+'歳まで生きた':'現在'+summary.age+'歳')+
  '／'+summary.profession+'\n'+
  '子ども '+summary.children+'人／関わった史実 '+summary.historySeen+'件\n'+
  (notes.length?notes.join('\n')+'\n':'')+
  '※歴史上の出来事を背景とする架空の人生シミュレーション';
}
