/* 感覚メーター ONLINE：数字の秘密をサーバー内で保持し、各プレイヤー本人だけに送る。
   採点はオフライン版と同じ逆転ペア率で0〜100点。 */
import {KANKAKU_QUESTIONS} from './meter-questions.js';
export const METER_CATEGORIES=Object.keys(KANKAKU_QUESTIONS);
export const METER_ROUNDS=[3,5,7,10];
const dice=n=>{const b=new Uint32Array(1);crypto.getRandomValues(b);return b[0]%n};
const shuffle=arr=>{const result=[...arr];for(let i=result.length-1;i>0;i--){const j=dice(i+1);[result[i],result[j]]=[result[j],result[i]]}return result};
const clean=x=>typeof x==='string'?x.trim().replace(/[\u0000-\u001f\u007f<>]/g,''):'';
export function validateMeterTopic(item){
 if(!item||typeof item!=='object')return null;
 const q=clean(item.q),low=clean(item.low),high=clean(item.high);
 if(!q||!low||!high||q.length>60||low.length>30||high.length>30)return null;
 return {category:'みんなのお題',q,low,high};
}
const poolFor=g=>g.settings.categories.flatMap(category=>
 (KANKAKU_QUESTIONS[category]||[]).map(([q,low,high])=>({category,q,low,high})))
 .concat(g.customTopics);
const topicKey=t=>t.category+'|'+t.q;
function drawTopic(g){
 const pool=poolFor(g);if(!pool.length)return false;
 let unused=pool.filter(t=>!g.usedTopics.includes(topicKey(t)));
 if(!unused.length){g.usedTopics=[];unused=pool}
 const chosen=unused[dice(unused.length)];
 g.topic={...chosen};g.usedTopics.push(topicKey(chosen));return true;
}
export function generateMeterNumbers(n,difficulty){
 if(!Number.isInteger(n)||n<2||n>10)throw Error('player count');
 const numbers=[];
 if(difficulty==='easy'){
  for(let i=0;i<n;i++){
   const base=Math.round((i+1)*100/(n+1));
   const number=Math.max(1,Math.min(100,base+dice(7)-3));
   if(!numbers.includes(number))numbers.push(number);
  }
 }else if(difficulty==='hard'){
  const span=Math.min(42,Math.max(22,n*5)),start=1+dice(100-span);
  while(numbers.length<n){const number=start+dice(span+1);if(!numbers.includes(number))numbers.push(number)}
 }
 while(numbers.length<n){const number=1+dice(100);if(!numbers.includes(number))numbers.push(number)}
 return shuffle(numbers);
}
export function meterScore(order,numbers){
 const ids=Object.keys(numbers);
 const correct=[...ids].sort((a,b)=>numbers[b]-numbers[a]);
 const rank=new Map(correct.map((id,i)=>[id,i]));
 const indices=order.map(id=>rank.get(id));
 let inversions=0;
 for(let i=0;i<indices.length;i++)for(let j=i+1;j<indices.length;j++)if(indices[i]>indices[j])inversions++;
 const max=order.length*(order.length-1)/2;
 return max?Math.round(100*(1-inversions/max)):100;
}
export function createMeter(room){
 const memberIds=room.members.map(m=>m.id);
 if(memberIds.length<2||memberIds.length>10)throw Error('2〜10人で遊んでね');
 return {stage:'setup',memberIds,settings:{difficulty:'normal',roundCount:5,categories:[...METER_CATEGORIES]},
  customTopics:[],usedTopics:[],round:0,topic:null,numbers:{},seen:[],
  order:[],shown:[],roundScore:null,totalScore:0,scores:[]};
}
function isPermutation(a,b){
 return Array.isArray(a)&&a.length===b.length&&a.every(x=>typeof x==='string'&&b.includes(x))&&new Set(a).size===b.length;
}
export function meterAction(room,id,data){
 const g=room.meter;if(!g||!g.memberIds.includes(id)||!data||typeof data.type!=='string')return false;
 const host=id===room.hostId;
 if(data.type==='meter-config'){
  if(!host||g.stage!=='setup')return false;
  const s=data.settings;
  if(!s||!['easy','normal','hard'].includes(s.difficulty)||!METER_ROUNDS.includes(s.roundCount)||
   !Array.isArray(s.categories)||s.categories.length<1||s.categories.length>METER_CATEGORIES.length||
   s.categories.some(c=>typeof c!=='string'||!METER_CATEGORIES.includes(c)))return false;
  g.settings={difficulty:s.difficulty,roundCount:s.roundCount,categories:[...new Set(s.categories)]};
  return true;
 }
 if(data.type==='meter-add-topic'){
  if(!host||g.stage!=='setup'||g.customTopics.length>=20)return false;
  const topic=validateMeterTopic(data.topic);if(!topic)return false;
  if(g.customTopics.some(x=>x.q===topic.q&&x.low===topic.low&&x.high===topic.high))return false;
  g.customTopics.push(topic);return true;
 }
 if(data.type==='meter-delete-topic'){
  if(!host||g.stage!=='setup'||!Number.isInteger(data.index)||data.index<0||data.index>=g.customTopics.length)return false;
  g.customTopics.splice(data.index,1);return true;
 }
 if(data.type==='meter-begin'){
  if(!host||g.stage!=='setup'||!drawTopic(g))return false;
  g.stage='preview';g.round=0;return true;
 }
 if(data.type==='meter-change-topic'){
  if(!host||g.stage!=='preview')return false;
  return drawTopic(g);
 }
 if(data.type==='meter-use-topic'){
  if(!host||g.stage!=='preview')return false;
  const t=validateMeterTopic(data.topic);if(!t)return false;
  g.topic=t;return true;
 }
 if(data.type==='meter-deal'){
  if(!host||g.stage!=='preview'||!g.topic)return false;
  const numbers=generateMeterNumbers(g.memberIds.length,g.settings.difficulty);
  g.numbers=Object.fromEntries(g.memberIds.map((memberId,i)=>[memberId,numbers[i]]));
  g.order=[...g.memberIds];g.seen=[];g.shown=[];g.roundScore=null;g.stage='reveal';return true;
 }
 if(data.type==='meter-seen'){
  if(g.stage!=='reveal'||g.seen.includes(id))return false;
  g.seen.push(id);
  if(g.seen.length===g.memberIds.length)g.stage='arrange';
  return true;
 }
 if(data.type==='meter-swap'){
  if(!host||g.stage!=='arrange'||!Number.isInteger(data.index)||![-1,1].includes(data.direction))return false;
  const i=data.index,j=i+data.direction;
  if(i<0||i>=g.order.length||j<0||j>=g.order.length)return false;
  [g.order[i],g.order[j]]=[g.order[j],g.order[i]];return true;
 }
 if(data.type==='meter-order'){
  if(!host||g.stage!=='arrange'||!isPermutation(data.order,g.memberIds))return false;
  g.order=[...data.order];return true;
 }
 if(data.type==='meter-finalize'){
  if(!host||g.stage!=='arrange')return false;
  g.roundScore=meterScore(g.order,g.numbers);g.totalScore+=g.roundScore;
  g.scores.push(g.roundScore);g.shown=[];g.stage='result';return true;
 }
 if(data.type==='meter-show'){
  if(!host||g.stage!=='result'||!g.memberIds.includes(data.memberId)||g.shown.includes(data.memberId))return false;
  g.shown.push(data.memberId);return true;
 }
 if(data.type==='meter-next'){
  if(!host||g.stage!=='result'||g.shown.length!==g.memberIds.length)return false;
  if(g.round+1>=g.settings.roundCount){g.stage='finished';return true}
  g.round++;g.numbers={};g.seen=[];g.shown=[];g.roundScore=null;
  if(!drawTopic(g))return false;
  g.stage='preview';return true;
 }
 return false;
}
export function meterView(room,id){
 const g=room.meter;if(!g)return null;
 const revealStage=['reveal','arrange'].includes(g.stage);
 const showResults=['result','finished'].includes(g.stage);
 const allShown=g.stage==='result'&&g.shown.length===g.memberIds.length;
 const members=room.members.filter(m=>g.memberIds.includes(m.id)).map(m=>({
  id:m.id,name:m.name,icon:m.icon,seen:g.seen.includes(m.id)}));
 return {stage:g.stage,settings:g.settings,categories:METER_CATEGORIES,poolCount:poolFor(g).length,
  customTopics:g.stage==='setup'?g.customTopics:undefined,
  round:g.round+1,topic:g.topic,members,seenCount:g.seen.length,
  myNumber:revealStage?g.numbers[id]:null,mySeen:g.seen.includes(id),
  order:['arrange','result','finished'].includes(g.stage)?g.order:[],
  shown:g.stage==='result'?g.shown:[],
  shownNumbers:g.stage==='result'?Object.fromEntries(g.shown.map(memberId=>[memberId,g.numbers[memberId]])):null,
  roundScore:allShown?g.roundScore:null,
  correctOrder:allShown?[...g.memberIds].sort((a,b)=>g.numbers[b]-g.numbers[a]):[],
  totalScore:g.stage==='finished'?g.totalScore:null,
  scores:g.stage==='finished'?g.scores:[],
  progressScore:showResults?undefined:g.scores.reduce((a,b)=>a+b,0)};
}
