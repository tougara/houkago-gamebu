/* ニセ転校生を探せ！ オンライン: 秘密情報はDurable Object内に保持し、本人にだけ返す */
export const NISE_ROLES={
 classmate:{name:'クラスメイト',side:'real',max:10},
 fake:{name:'ニセ転校生',side:'fake',max:3},
 president:{name:'学級委員',side:'real',max:1},
 dayDuty:{name:'日直',side:'real',max:1},
 observer:{name:'観察係',side:'real',max:1},
 swapper:{name:'席替え係',side:'real',max:1},
 collaborator:{name:'秘密の協力者',side:'fake',max:1},
 trickster:{name:'いたずらっ子',side:'trick',max:1}
};
const activeList=g=>g.memberIds;
const random=n=>{const a=new Uint32Array(1);crypto.getRandomValues(a);return a[0]%n};
const shuffle=a=>{const b=[...a];for(let i=b.length-1;i>0;i--){const j=random(i+1);[b[i],b[j]]=[b[j],b[i]]}return b};
export const defaultNiseCounts=n=>({classmate:n-2,fake:2,president:1,swapper:1,dayDuty:0,observer:0,collaborator:0,trickster:0});
export const validNiseCounts=(counts,n)=>{
 if(!counts||!Number.isInteger(n)||n<3||n>10)return false;
 if(Object.keys(counts).some(k=>!NISE_ROLES[k]))return false;
 const fakeMax=n>=6?3:2;
 if(!Number.isInteger(counts.fake)||counts.fake<2||counts.fake>fakeMax)return false;
 return Object.keys(NISE_ROLES).every(k=>Number.isInteger(counts[k])&&counts[k]>=0&&counts[k]<=Math.min(NISE_ROLES[k].max,k==='fake'?fakeMax:10))&&
  Object.values(counts).reduce((a,b)=>a+b,0)===n+2;
};
export function createNise(room){
 const n=room.members.length;
 if(n<3||n>10)throw Error('3〜10人で遊んでね');
 return {stage:'setup',counts:defaultNiseCounts(n),memberIds:room.members.map(m=>m.id),duration:180,
 initial:{},final:{},rest:[],revealed:[],nightOrder:[],nightCursor:0,intel:{},votes:{},
 timerRemaining:180,deadline:0,result:null};
}
export function dealNise(g){
 if(!validNiseCounts(g.counts,g.memberIds.length))return false;
 const deck=shuffle(Object.entries(g.counts).flatMap(([k,n])=>Array(n).fill(k)));
 g.initial=Object.fromEntries(g.memberIds.map((id,i)=>[id,deck[i]]));
 g.final={...g.initial};g.rest=deck.slice(g.memberIds.length);
 g.revealed=[];g.votes={};g.intel={};g.result=null;g.deadline=0;g.timerRemaining=g.duration;
 g.nightOrder=shuffle(g.memberIds).sort((a,b)=>{
  const rank={fake:0,president:1,observer:2,dayDuty:2,swapper:3};
  return (rank[g.initial[a]]??4)-(rank[g.initial[b]]??4);
 });
 g.nightCursor=0;g.stage='reveal';return true;
}
const allRevealed=g=>g.memberIds.every(id=>g.revealed.includes(id));
export function niseView(room,id){
 const g=room.nise;if(!g)return null;
 const me=g.memberIds.includes(id),name=room.members.find(m=>m.id===id)?.name||'';
 const result=g.stage==='result'?g.result:null;
 const current=g.nightOrder[g.nightCursor];
 const r=g.initial[id];
 const waitingNight=g.stage==='night'&&current!==id;
 const myRole=me&&(g.stage!=='setup')?r:null;
 const voted=!!g.votes[id];
 const publicView={
  stage:g.stage,count:g.memberIds.length,members:room.members.map(m=>({id:m.id,name:m.name,icon:m.icon})),
  restCount:2,counts:g.counts,duration:g.duration,
  revealedCount:g.revealed.length,votedCount:Object.keys(g.votes).length,
  timerRemaining:g.timerRemaining,deadline:g.deadline,
  result,
  myRole,
  myFinalRole:g.stage==='result'&&me?g.final[id]:null,
  nightIsMyTurn:g.stage==='night'&&current===id,
  nightWaiting:waitingNight,
  myIntel:g.stage==='night'&&current===id?g.intel[id]||null:null,
  myVoted:voted,
  myRevealed:g.revealed.includes(id),
  isHost:id===room.hostId
 };
 if(g.stage==='night'&&current===id&&r==='fake'){
  publicView.partners=g.memberIds.filter(other=>other!==id&&g.initial[other]==='fake').map(other=>{
   const p=room.members.find(m=>m.id===other);return{id:other,name:p?.name||'',icon:p?.icon||''}
  });
 }
 return publicView;
}
export function niseVoteResult(g,room){
 const tally=Object.fromEntries(g.memberIds.map(id=>[id,0]));
 for(const target of Object.values(g.votes))tally[target]++;
 const max=Math.max(...Object.values(tally));
 const expelled=max<=1?[]:g.memberIds.filter(id=>tally[id]===max);
 const trickster=expelled.find(id=>g.final[id]==='trickster');
 const fakeExists=g.memberIds.some(id=>g.final[id]==='fake');
 const fakeCaught=expelled.some(id=>g.final[id]==='fake');
 const kind=trickster?'trick':!fakeExists&&!expelled.length?'peace':fakeExists&&fakeCaught?'real':'fake';
 return {kind,expelled,max,tally,votes:{...g.votes},initial:{...g.initial},final:{...g.final},
  rest:[...g.rest],winner:kind==='trick'?'クセモノサイド勝利！':kind==='peace'?'平和なクラス！':kind==='real'?'ホンモノサイド勝利！':'ニセモノサイド勝利！'};
}
const validTarget=(g,id,target)=>typeof target==='string'&&target!==id&&g.memberIds.includes(target);
export function niseAction(room,id,data){
 const g=room.nise;
 if(!g||!g.memberIds.includes(id)||!data||typeof data.type!=='string')return false;
 const host=id===room.hostId,stage=g.stage;
 if(data.type==='nise-config'){
  if(!host||stage!=='setup')return false;
  if(data.counts!==undefined){if(!validNiseCounts(data.counts,g.memberIds.length))return false;g.counts={...data.counts}}
  if(data.duration!==undefined){if(![120,180,300,420].includes(data.duration))return false;g.duration=data.duration}
  return true;
 }
 if(data.type==='nise-begin'){
  if(!host||stage!=='setup')return false;return dealNise(g);
 }
 if(data.type==='nise-reveal-done'){
  if(stage!=='reveal'||g.revealed.includes(id))return false;
  g.revealed.push(id);
  if(allRevealed(g)){g.stage='night';g.nightCursor=0}
  return true;
 }
 if(data.type==='nise-night-action'){
  if(stage!=='night'||g.nightOrder[g.nightCursor]!==id||g.intel[id])return false;
  const role=g.initial[id],kind=data.kind;
  if(role==='president'&&kind==='player'&&validTarget(g,id,data.target)){
   g.intel[id]={kind,role:g.initial[data.target],target:data.target};
  }else if(role==='president'&&kind==='rest'){
   g.intel[id]={kind:'rest',roles:[...g.rest]};
  }else if(role==='dayDuty'&&kind==='rest'&&Number.isInteger(data.index)&&data.index>=0&&data.index<2){
   g.intel[id]={kind:'rest',roles:[g.rest[data.index]],index:data.index};
  }else if(role==='observer'&&kind==='compare'&&Array.isArray(data.targets)&&data.targets.length===2&&
   new Set(data.targets).size===2&&data.targets.every(t=>validTarget(g,id,t))){
   const [a,b]=data.targets;
   g.intel[id]={kind:'compare',same:NISE_ROLES[g.initial[a]].side===NISE_ROLES[g.initial[b]].side,targets:[a,b]};
  }else if(role==='swapper'&&kind==='swap'&&validTarget(g,id,data.target)){
   [g.final[id],g.final[data.target]]=[g.final[data.target],g.final[id]];
   g.intel[id]={kind:'swap',role:g.final[id],target:data.target};
  }else if(role==='swapper'&&kind==='skip'){
   g.intel[id]={kind:'skip',role:g.final[id]};
  }else return false;
  return true;
 }
 if(data.type==='nise-night-done'){
  if(stage!=='night'||g.nightOrder[g.nightCursor]!==id)return false;
  const r=g.initial[id];
  if(['president','dayDuty','observer','swapper'].includes(r)&&!g.intel[id])return false;
  g.nightCursor++;
  if(g.nightCursor>=g.nightOrder.length){g.stage='discussion';g.timerRemaining=g.duration;g.deadline=0}
  return true;
 }
 if(data.type==='nise-timer'){
  if(!host||stage!=='discussion')return false;
  const remaining=g.deadline?Math.max(0,Math.ceil((g.deadline-Date.now())/1000)):g.timerRemaining;
  if(data.kind==='toggle'){g.deadline=g.deadline?0:Date.now()+remaining*1000;g.timerRemaining=remaining}
  else if(data.kind==='adjust'&&[60,-60,10,-10].includes(data.amount)){
   g.timerRemaining=Math.max(0,Math.min(3600,remaining+data.amount));
   if(g.deadline)g.deadline=Date.now()+g.timerRemaining*1000;
  }else if(data.kind==='reset'){g.timerRemaining=g.duration;if(g.deadline)g.deadline=Date.now()+g.duration*1000}
  else return false;
  return true;
 }
 if(data.type==='nise-start-vote'){
  if(!host||stage!=='discussion')return false;
  g.stage='voting';g.deadline=0;g.votes={};return true;
 }
 if(data.type==='nise-vote'){
  if(stage!=='voting'||g.votes[id]||!validTarget(g,id,data.target))return false;
  g.votes[id]=data.target;
  if(Object.keys(g.votes).length===g.memberIds.length){g.stage='result';g.result=niseVoteResult(g,room)}
  return true;
 }
 if(data.type==='nise-rematch'){
  if(!host||stage!=='result')return false;
  if(data.resetRoles){room.nise=createNise(room);return true}
  return dealNise(g);
 }
 return false;
}
