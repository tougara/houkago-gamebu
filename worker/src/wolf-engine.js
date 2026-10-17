/* ことばのオオカミ ONLINE: 秘密のお題・投票はDurable Objectだけで管理 */
import {WOLF_PAIRS,WOLF_CATEGORIES,WOLF_ALIASES} from './wolf-questions.js';

const random=n=>{const bytes=new Uint32Array(1);crypto.getRandomValues(bytes);return bytes[0]%n};
const clean=x=>typeof x==='string'?x.trim().replace(/[\u0000-\u001f\u007f<>]/g,''):'';
export const normalizedWolf=x=>String(x||'').normalize('NFKC').trim().toLowerCase()
 .replace(/[\s　・･、。．.！!？?「」『』'"（）()_-]/g,'')
 .replace(/[ァ-ヶ]/g,ch=>String.fromCharCode(ch.charCodeAt(0)-96))
 .replace(/[ー－]/g,'ー');
export const wolfAnswerMatches=(answer,expected)=>
 [expected,...(WOLF_ALIASES[expected]||[])].some(x=>normalizedWolf(x)===normalizedWolf(answer));

export function createWolf(room){
 const ids=room.members.map(p=>p.id);
 return {
  stage:'setup',
  settings:{source:'auto',mode:'reverse',duration:180,categories:[...WOLF_CATEGORIES],authorId:room.hostId},
  memberIds:ids,activeIds:ids,authorId:null,
  pair:null,majority:'',minority:'',wolfId:null,seenPairs:[],
  revealed:[],votes:{},firstTally:null,finalTally:null,runoff:false,candidates:[],
  durationLeft:180,deadline:0,paused:true,result:null,guess:''
 };
}
const active=g=>g.activeIds;
const wolfMember=(room,id)=>room.members.find(m=>m.id===id);
const tallyVotes=(g,memberIds)=>{
 const tally=Object.fromEntries(memberIds.map(id=>[id,0]));
 for(const target of Object.values(g.votes))if(Object.hasOwn(tally,target))tally[target]++;
 return tally;
};
const leadersOf=tally=>{
 const max=Math.max(0,...Object.values(tally));
 return max?Object.keys(tally).filter(id=>tally[id]===max):[];
};
const remaining=g=>g.paused?g.durationLeft:Math.max(0,Math.ceil((g.deadline-Date.now())/1000));
const startVote=g=>{
 g.stage='voting';g.votes={};g.paused=true;g.durationLeft=remaining(g);g.deadline=0;
};
const deal=(g,pair,custom=false)=>{
 g.pair={id:pair.id||'custom',category:pair.category||'自由入力'};
 g.majority=custom?pair.a:(random(2)?pair.a:pair.b);
 g.minority=custom?pair.b:(g.majority===pair.a?pair.b:pair.a);
 g.wolfId=g.activeIds[random(g.activeIds.length)];
 g.stage='reveal';g.revealed=[];g.votes={};g.firstTally=null;g.finalTally=null;
 g.candidates=[];g.runoff=false;g.result=null;g.guess='';
 g.durationLeft=g.settings.duration;g.deadline=0;g.paused=true;
};
const end=(g,winner)=>{
 g.paused=true;g.deadline=0;g.stage='result';
 g.result={winner,wolfId:g.wolfId,majority:g.majority,minority:g.minority,
  eliminated:g.eliminated??null,firstTally:g.firstTally,finalTally:g.finalTally,
  runoff:g.runoff,guess:g.guess||null};
};
const settle=(g)=>{
 const t=tallyVotes(g,g.activeIds),leaders=leadersOf(t);
 if(!g.runoff)g.firstTally=t;else g.finalTally=t;
 if(leaders.length!==1){
  if(g.runoff){g.eliminated=null;end(g,'wolf');}
  else{g.stage='runoffReady';g.candidates=leaders;g.votes={};}
  return;
 }
 g.eliminated=leaders[0];
 if(g.eliminated!==g.wolfId){end(g,'wolf');return}
 if(g.settings.mode==='reverse'){g.stage='reverse';g.votes={};return}
 end(g,'human');
};

export function wolfView(room,id){
 const g=room.wolf;if(!g)return null;
 const playing=active(g).includes(id);
 const author=g.authorId===id;
 const stage=g.stage;
 const canReadWord=playing&&stage==='reveal';
 const count=Object.keys(g.votes).length;
 return {
  stage,settings:{...g.settings,categories:[...g.settings.categories]},
  categories:WOLF_CATEGORIES,questionsTotal:WOLF_PAIRS.length,
  members:room.members.map(m=>({id:m.id,name:m.name,icon:m.icon})),
  activeIds:[...g.activeIds],authorId:g.authorId,playing,author,
  myWord:canReadWord?(id===g.wolfId?g.minority:g.majority):null,
  myRevealed:g.revealed.includes(id),revealedCount:g.revealed.length,
  voteCount:count,voted:Object.hasOwn(g.votes,id),
  candidates:stage==='voting'&&g.runoff?[...g.candidates]:[],
  runoff:g.runoff,firstTally:stage==='runoffReady'||stage==='result'?g.firstTally:null,
  durationLeft:remaining(g),deadline:g.deadline,paused:g.paused,
  result:stage==='result'?g.result:null
 };
}
export function wolfAction(room,id,data){
 const g=room.wolf;
 if(!g||!room.members.some(m=>m.id===id)||!data||typeof data.type!=='string')return false;
 const host=room.hostId===id,stage=g.stage,play=active(g).includes(id);
 switch(data.type){
  case 'wolf-config':{
   if(!host||stage!=='setup')return false;
   const s=data.settings;
   if(!s||!['auto','custom'].includes(s.source)||!['simple','reverse'].includes(s.mode)||
    ![120,180,300,420].includes(s.duration)||!Array.isArray(s.categories)||
    s.categories.length>WOLF_CATEGORIES.length||s.categories.some(c=>!WOLF_CATEGORIES.includes(c))||
    !room.members.some(m=>m.id===s.authorId))return false;
   g.settings={source:s.source,mode:s.mode,duration:s.duration,
    categories:[...new Set(s.categories)],authorId:s.authorId};return true;
  }
  case 'wolf-begin':{
   if(!host||stage!=='setup'||room.members.length<3||room.members.length>10)return false;
   const s=g.settings;
   if(s.source==='custom'){
    if(room.members.length<4)return false;
    g.authorId=s.authorId;
    g.activeIds=g.memberIds.filter(x=>x!==g.authorId);
    g.stage='customInput';return true;
   }
   if(!s.categories.length)return false;
   const pool=WOLF_PAIRS.filter(p=>s.categories.includes(p.category));
   if(!pool.length)return false;
   const fresh=pool.filter(p=>!g.seenPairs.includes(p.id));
   const pair=(fresh.length?fresh:pool)[random((fresh.length?fresh:pool).length)];
   g.seenPairs=[...g.seenPairs.filter(x=>x!==pair.id),pair.id].slice(-50);
   g.authorId=null;g.activeIds=[...g.memberIds];deal(g,pair);return true;
  }
  case 'wolf-custom-topics':{
   if(stage!=='customInput'||id!==g.authorId)return false;
   const a=clean(data.a),b=clean(data.b);
   if(!a||!b||a.length>30||b.length>30||normalizedWolf(a)===normalizedWolf(b))return false;
   deal(g,{a,b,id:'custom',category:'自由入力'},true);return true;
  }
  case 'wolf-word-done':{
   if(stage!=='reveal'||!play||g.revealed.includes(id))return false;
   g.revealed.push(id);
   if(g.revealed.length===g.activeIds.length){g.stage='discussion';g.paused=true;g.durationLeft=g.settings.duration}
   return true;
  }
  case 'wolf-timer':{
   if(!host||stage!=='discussion')return false;
   const old=remaining(g);
   if(data.action==='toggle'){
    g.paused=!g.paused;
    if(g.paused){g.durationLeft=old;g.deadline=0}
    else{g.durationLeft=old;g.deadline=Date.now()+old*1000}
    return true;
   }
   if(data.action==='adjust'&&[10,-10,30,-30].includes(data.seconds)){
    const next=Math.max(0,Math.min(1800,old+data.seconds));
    g.durationLeft=next;
    if(!g.paused)g.deadline=Date.now()+next*1000;
    return true;
   }
   if(data.action==='reset'){g.durationLeft=g.settings.duration;g.paused=true;g.deadline=0;return true}
   return false;
  }
  case 'wolf-start-vote':{
   if(!host||stage!=='discussion')return false;
   g.durationLeft=remaining(g);g.paused=true;g.deadline=0;startVote(g);return true;
  }
  case 'wolf-vote':{
   if(stage!=='voting'||!play||Object.hasOwn(g.votes,id)||typeof data.target!=='string'||
      data.target===id||!active(g).includes(data.target)||(g.runoff&&!g.candidates.includes(data.target)))return false;
   g.votes[id]=data.target;
   if(Object.keys(g.votes).length===g.activeIds.length)g.stage='voteComplete';
   return true;
  }
  case 'wolf-publish':{
   if(!host||stage!=='voteComplete')return false;
   settle(g);return true;
  }
  case 'wolf-runoff':{
   if(!host||stage!=='runoffReady'||g.candidates.length<2)return false;
   g.runoff=true;startVote(g);return true;
  }
  case 'wolf-guess':{
   if(stage!=='reverse'||id!==g.wolfId||!play)return false;
   const guess=clean(data.guess);
   if(!guess||guess.length>40)return false;
   g.guess=guess;
   end(g,wolfAnswerMatches(guess,g.majority)?'wolf':'human');return true;
  }
  case 'wolf-skip-guess':{
   if(!host||stage!=='reverse')return false;
   end(g,'human');return true;
  }
  case 'wolf-again':{
   if(!host||stage!=='result')return false;
   const old={...g.settings,categories:[...g.settings.categories]};
   room.wolf=createWolf(room);
   room.wolf.settings=old;return true;
  }
 }
 return false;
}
