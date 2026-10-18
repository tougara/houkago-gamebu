/* ニセ転校生 ONLINE の完全ローカル画面確認。
   実際のオンライン game.js を動かし、通信だけをモック。部屋作成・WebSocket・サーバーAPI呼び出しは一切しない。 */
(()=>{
'use strict';
if(new URLSearchParams(location.search).get('testPlay')!=='1')return;
const ID='demo-self';
const members=[
 {id:ID,name:'あなた',icon:'🐶'},
 {id:'demo-yui',name:'ゆい',icon:'🐱'},
 {id:'demo-ken',name:'けん',icon:'🐼'},
 {id:'demo-mio',name:'みお',icon:'🦊'}
];
const roles=['classmate','fake','president','swapper','observer','dayDuty','collaborator','trickster'];
const sides={classmate:'real',fake:'fake',president:'real',swapper:'real',observer:'real',dayDuty:'real',collaborator:'fake',trickster:'trick'};
const title={setup:'役職設定',reveal:'役職確認',night:'休み時間',discussion:'話し合い',voting:'秘密投票',voteComplete:'投票完了',result:'結果発表'};
let currentRole='president';
let state;
const initialCounts=()=>({classmate:2,fake:2,president:1,swapper:1,observer:0,dayDuty:0,collaborator:0,trickster:0});
function fresh(){
 state={stage:'setup',counts:initialCounts(),duration:180,timerRemaining:180,deadline:0,
  initial:{},final:{},rest:['fake','classmate'],revealed:false,nightDone:false,intel:null,
  vote:null,votes:{},chat:[],result:null};
 setRoles();
}
function setRoles(){
 // テスト役職の変更時も、本人＋3人＋おやすみ2枚を実在する6枚の構成にする。
 const basic={
  classmate:{others:['fake','president','swapper'],rest:['fake','classmate']},
  fake:{others:['fake','classmate','president'],rest:['classmate','swapper']},
  president:{others:['fake','classmate','swapper'],rest:['fake','classmate']},
  swapper:{others:['fake','classmate','president'],rest:['fake','classmate']}
 };
 const arrangement=basic[currentRole]||{others:['fake','classmate','classmate'],rest:['fake','president']};
 state.initial={[ID]:currentRole};
 members.slice(1).forEach((m,i)=>state.initial[m.id]=arrangement.others[i]);
 state.final={...state.initial};state.rest=[...arrangement.rest];
 state.counts=Object.fromEntries(roles.map(k=>[k,0]));
 for(const key of [...Object.values(state.initial),...state.rest])state.counts[key]++;
 state.intel=null;state.nightDone=false;
}
function result(){
 const votes={...state.votes};
 const defaults={[ID]:'demo-yui','demo-yui':ID,'demo-ken':'demo-yui','demo-mio':'demo-yui'};
 for(const m of members)if(!votes[m.id])votes[m.id]=defaults[m.id];
 const tally=Object.fromEntries(members.map(m=>[m.id,0]));
 Object.values(votes).forEach(id=>tally[id]++);
 const max=Math.max(...Object.values(tally));
 const expelled=max<=1?[]:members.filter(m=>tally[m.id]===max).map(m=>m.id);
 const trick=expelled.some(id=>state.final[id]==='trickster');
 const fakeExists=members.some(m=>state.final[m.id]==='fake');
 const fakeCaught=expelled.some(id=>state.final[id]==='fake');
 const kind=trick?'trick':!fakeExists&&!expelled.length?'peace':fakeExists&&fakeCaught?'real':'fake';
 const winner={trick:'クセモノサイド勝利！',peace:'平和なクラス！',real:'ホンモノサイド勝利！',fake:'ニセモノサイド勝利！'}[kind];
 return {kind,winner,expelled,max,tally,votes,initial:{...state.initial},final:{...state.final},rest:[...state.rest]};
}
function jump(stage){
 if(!Object.hasOwn(title,stage))return false;
 if(stage==='setup'){fresh();return true}
 state.stage=stage;
 state.revealed=stage!=='reveal';state.nightDone=!['reveal','night'].includes(stage);
 state.intel=null;state.vote=null;
 state.deadline=0;state.timerRemaining=state.duration;
 state.chat=stage==='discussion'?[
  {id:'demo-yui',text:'私は学級委員って聞いたよ！'},
  {id:'demo-ken',text:'席替えがあったかもしれないね。'}
 ]:[];
 state.votes=['voteComplete','result'].includes(stage)?{
  [ID]:'demo-yui','demo-yui':ID,'demo-ken':'demo-yui','demo-mio':'demo-yui'
 }:{};
 state.result=stage==='result'?result():null;
 return true;
}
function setRole(role){
 if(!roles.includes(role))return false;
 currentRole=role;
 setRoles();
 if(state.stage==='setup')return true;
 if(state.stage==='night'){state.revealed=true;state.nightDone=false}
 if(state.stage==='result')state.result=result();
 return true;
}
function currentRoom(){
 const stage=state.stage;
 const view={
  stage,count:4,members:members.map(m=>({...m})),counts:{...state.counts},restCount:2,
  duration:state.duration,
  revealedCount:stage==='setup'?0:stage==='reveal'?3:4,
  nightDoneCount:stage==='night'?3:state.nightDone?4:0,
  votedCount:Object.keys(state.votes).length,
  timerRemaining:state.timerRemaining,deadline:state.deadline,
  result:stage==='result'?state.result:null,
  myRole:stage==='setup'?null:state.initial[ID],
  myFinalRole:stage==='result'?state.final[ID]:null,
  nightIsMyTurn:stage==='night'&&state.revealed&&!state.nightDone,
  nightWaiting:stage==='night'&&state.nightDone,
  myIntel:stage==='night'?state.intel:null,
  myNightDone:state.nightDone,
  myVoted:!!state.vote,
  chat:stage==='discussion'?state.chat:[],
  myRevealed:state.revealed,isHost:true
 };
 if(stage==='night'&&state.initial[ID]==='fake')
  view.partners=members.filter(m=>m.id!==ID&&state.initial[m.id]==='fake').map(m=>({...m}));
 return {code:'DEMO2026',phase:'nise',hostId:ID,members:members.map(m=>({...m})),nise:view};
}
function action(data){
 const type=data?.type;
 if(type==='nise-config'&&state.stage==='setup'){
  if(data.counts){
   const c=data.counts;
   if(roles.some(k=>!Number.isInteger(c[k])||c[k]<0)||Object.values(c).reduce((a,b)=>a+b,0)!==6
    ||c.fake!==2||c.classmate<0)return false;
   state.counts={...c};
  }
  if([120,180,300,420].includes(data.duration)){state.duration=data.duration;state.timerRemaining=data.duration}
  return true;
 }
 if(type==='nise-begin'&&state.stage==='setup'){jump('reveal');return true}
 if(type==='nise-reveal-done'&&state.stage==='reveal'){state.stage='night';state.revealed=true;return true}
 if(type==='nise-night-action'&&state.stage==='night'&&!state.intel){
  const kind=data.kind,role=state.initial[ID];
  if(role==='president'&&kind==='player'&&state.initial[data.target]){
   state.intel={kind,target:data.target,role:state.initial[data.target]};return true;
  }
  if(role==='president'&&kind==='rest'){
   state.intel={kind,roles:[...state.rest]};return true;
  }
  if(role==='dayDuty'&&kind==='rest'&&[0,1].includes(data.index)){
   state.intel={kind,index:data.index,roles:[state.rest[data.index]]};return true;
  }
  if(role==='observer'&&kind==='compare'&&Array.isArray(data.targets)&&data.targets.length===2){
   state.intel={kind,targets:data.targets,same:sides[state.initial[data.targets[0]]]===sides[state.initial[data.targets[1]]]};return true;
  }
  if(role==='swapper'&&kind==='swap'&&state.initial[data.target]&&data.target!==ID){
   const previous=state.final[ID];
   [state.final[ID],state.final[data.target]]=[state.final[data.target],state.final[ID]];
   state.intel={kind,role:state.final[ID],target:data.target,originalRole:previous};return true;
  }
  if(role==='swapper'&&kind==='skip'){state.intel={kind,role:state.final[ID]};return true}
  return false;
 }
 if(type==='nise-night-done'&&state.stage==='night'){
  if(['president','observer','swapper','dayDuty'].includes(state.initial[ID])&&!state.intel)return false;
  state.nightDone=true;jump('discussion');return true;
 }
 if(type==='nise-timer'&&state.stage==='discussion'){
  const remaining=state.deadline?Math.max(0,Math.ceil((state.deadline-Date.now())/1000)):state.timerRemaining;
  if(data.kind==='toggle'){state.deadline=state.deadline?0:Date.now()+remaining*1000;state.timerRemaining=remaining;return true}
  if(data.kind==='adjust'&&[60,-60,10,-10].includes(data.amount)){
   state.timerRemaining=Math.min(3600,Math.max(0,remaining+data.amount));
   if(state.deadline)state.deadline=Date.now()+state.timerRemaining*1000;
   return true;
  }
  return false;
 }
 if(type==='nise-chat'&&state.stage==='discussion'){
  const text=String(data.text||'').trim().slice(0,120);
  if(!text)return false;
  state.chat.push({id:ID,text});return true;
 }
 if(type==='nise-start-vote'&&state.stage==='discussion'){jump('voting');return true}
 if(type==='nise-vote'&&state.stage==='voting'&&data.target&&data.target!==ID){
  state.vote=data.target;
  state.votes={[ID]:data.target,'demo-yui':ID,'demo-ken':data.target,'demo-mio':data.target};
  state.stage='voteComplete';return true;
 }
 if(type==='nise-publish-result'&&state.stage==='voteComplete'){
  state.stage='result';state.result=result();return true;
 }
 if(type==='nise-rematch'&&state.stage==='result'){
  if(data.resetRoles){fresh();return true}
  jump('reveal');return true;
 }
 if(type==='nise-stop'){fresh();return true}
 return false;
}
fresh();
window.NiseOfflinePreview=Object.freeze({
 session:{code:'DEMO2026',token:'0'.repeat(64),id:ID,name:'あなた'},
 currentRoom,action,jump,setRole,get role(){return currentRole},get stage(){return state.stage},stages:title,
 roles
});
})();