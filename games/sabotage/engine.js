/* サボタージュ！ 共通ゲームエンジン。秘密情報は view 経由でのみ外部へ渡す。 */
export const SABOTAGE_COUNTS={
  4:{crew:3,impostor:2,repair:4},5:{crew:3,impostor:2,repair:5},
  6:{crew:4,impostor:2,repair:6},7:{crew:5,impostor:3,repair:7},
  8:{crew:5,impostor:3,repair:8},9:{crew:7,impostor:3,repair:8},
  10:{crew:8,impostor:3,repair:8}
};
const pick=n=>{const x=new Uint32Array(1);const limit=Math.floor(4294967296/n)*n;do{crypto.getRandomValues(x)}while(x[0]>=limit);return x[0]%n};
const shuffle=a=>{a=[...a];for(let i=a.length-1;i>0;i--){const j=pick(i+1);[a[i],a[j]]=[a[j],a[i]]}return a};
const count=(a,k)=>a.filter(x=>x===k).length;
// Suspense is independent of hidden type, so timing doesn't identify a BOMB.
export const sabotageSuspenseMs=()=>pick(5)===0?3150+pick(500):1550+pick(850);
export const sabotageHoldMs=type=>type==='error'?3300:type==='repair'?1800:1300;
export function sabotageRevealPhase(cut,now=Date.now()){
 if(!cut||!Number.isFinite(cut.startedAt)||!Number.isFinite(cut.suspenseMs))
  return {stage:'ready',waitMs:0};
 const revealAt=cut.startedAt+cut.suspenseMs;
 const readyAt=revealAt+sabotageHoldMs(cut.type);
 if(now<revealAt)return {stage:'suspense',waitMs:revealAt-now};
 if(now<readyAt)return {stage:'result',waitMs:readyAt-now};
 return {stage:'ready',waitMs:0};
}
/* Role deck may contain one hidden leftover card; no one learns which role was omitted. */
export function sabotageDefaultSettings(n){
 const c=SABOTAGE_COUNTS[n];if(!c)throw Error('人数は4〜10人');
 return {crew:c.crew,impostor:c.impostor,jackal:false,extra:c.crew+c.impostor-n};
}
export function sabotageValidateSettings(n,input){
 if(!SABOTAGE_COUNTS[n])throw Error('人数は4〜10人');
 if(input==null)return sabotageDefaultSettings(n);
 if(typeof input!=='object'||Array.isArray(input))throw Error('役職設定が不正');
 const {crew,impostor,jackal,extra}=input;
 if(!Number.isInteger(crew)||!Number.isInteger(impostor)||typeof jackal!=='boolean'||!Number.isInteger(extra)||extra<0||extra>1)
  throw Error('役職設定が不正');
 // A single unseen surplus card must never eliminate every crewmate or impostor.
 const min=extra?2:1;
 if(crew<min||impostor<min||crew+impostor+Number(jackal)!==n+extra)
  throw Error('役職カードの枚数が不正');
 return {crew,impostor,jackal,extra};
}
export function sabotageChangeSettings(n,current,action,amount){
 const base=sabotageValidateSettings(n,current),next={...base};
 if(action==='crew'||action==='impostor'){
  if(amount!==1&&amount!==-1)return null;
  next[action]+=amount;
  next[action==='crew'?'impostor':'crew']-=amount;
 }else if(action==='jackal'){
  if(typeof amount!=='boolean')return null;
  if(next.jackal===amount)return base;
  next.crew+=amount?-1:1;
  next.jackal=amount;
 }else if(action==='extra'){
  if(amount!==0&&amount!==1)return null;
  if(next.extra===amount)return base;
  next.crew+=amount-next.extra;
  next.extra=amount;
 }else return null;
 try{return sabotageValidateSettings(n,next)}catch{return null}
}
export const sabotageRoles=(n,settings=null)=>{
 const c=sabotageValidateSettings(n,settings);
 const pool=[...Array(c.crew).fill('crew'),...Array(c.impostor).fill('impostor'),...Array(c.jackal?1:0).fill('jackal')];
 return shuffle(pool).slice(0,n);
};
function distribute(g,deck){
 const shuffled=shuffle(deck),n=g.players.length,each=shuffled.length/n;
 if(!Number.isInteger(each))throw Error('配線配布枚数が不正');
 g.players.forEach((p,i)=>{p.hand=shuffled.slice(i*each,(i+1)*each);p.slots=Array.from({length:5},(_,index)=>index<each?{state:'closed'}:{state:'inactive'});p.seen=false});
 g.stage='briefing';g.cuts=0;g.lastCut=null;
}
export function createSabotage(members,settings=null){
 const n=members.length,c=SABOTAGE_COUNTS[n];if(!c)throw Error('4〜10人');
 const roleSettings=sabotageValidateSettings(n,settings);
 const roles=sabotageRoles(n,roleSettings);
 const g={roleSettings,stage:'briefing',round:1,cuts:0,required:c.repair,repaired:0,
  currentId:members[pick(n)].id,lastCut:null,pendingResult:null,winner:null,history:[],chat:[],chatAt:{},
  players:members.map((m,i)=>({id:m.id,name:m.name,icon:m.icon,role:roles[i],hand:[],slots:[],seen:false,roleSeen:false}))};
 distribute(g,[...Array(c.repair).fill('repair'),'error',...Array(5*n-c.repair-1).fill('dummy')]);
 g.stage='roles';
 return g;
}
export function sabotageAction(g,id,data){
 if(!g||!g.players.some(p=>p.id===id)||!data)return false;
 if(data.type==='sabotage-chat'){
  if(g.stage!=='playing'||!Number.isInteger(data.key))return false;
  const presets=['解除コードがある！','爆弾があるかも','誰を信じよう？','この人のコードを選んで','別の人にしよう','ちょっと待って！','怪しいと思う','信じる！'];
  if(data.key<0||data.key>=presets.length)return false;
  const now=Date.now();if(now-(g.chatAt[id]||0)<1200)return false;
  g.chatAt[id]=now;g.chat.push({id,text:presets[data.key]});
  g.chat=g.chat.slice(-20);return true;
 }
 if(data.type==='sabotage-role-seen'){
  if(g.stage!=='roles')return false;
  const p=g.players.find(x=>x.id===id);if(p.roleSeen)return false;
  p.roleSeen=true;
  if(g.players.every(x=>x.roleSeen))g.stage='briefing';
  return true;
 }
 if(data.type==='sabotage-seen'){
  if(g.stage!=='briefing')return false;
  const p=g.players.find(x=>x.id===id);if(p.seen)return false;
  p.seen=true;
  if(g.players.every(x=>x.seen))g.stage='playing';
  return true;
 }
 if(data.type==='sabotage-cut'){
  if(g.stage!=='playing'||id!==g.currentId||typeof data.targetId!=='string'||!Number.isInteger(data.index))return false;
  const p=g.players.find(x=>x.id===data.targetId);
  if(!p||p.id===id||data.index<0||data.index>=5)return false;
  if(!p.slots||p.slots[data.index]?.state!=='closed')return false;
  const remainingIndex=p.slots.slice(0,data.index).filter(x=>x.state==='closed').length;
  const [type]=p.hand.splice(remainingIndex,1);
  p.slots[data.index]={state:'opened',type};
  g.cuts++;
  if(type==='repair')g.repaired++;
  g.lastCut={type,by:id,targetId:p.id,round:g.round,number:g.cuts,startedAt:Date.now(),suspenseMs:sabotageSuspenseMs()};
  g.history.push(g.lastCut);
  if(type==='error')g.pendingResult='impostor';
  else if(g.repaired===g.required)g.pendingResult='crew';
  else if(g.round===4&&g.cuts===g.players.length)
   g.pendingResult=g.players.some(x=>x.role==='jackal')?'jackal':'impostor';
  g.currentId=p.id;g.stage='reveal';return true;
 }
 if(data.type==='sabotage-next'){
  if(g.stage!=='reveal'||sabotageRevealPhase(g.lastCut).stage!=='ready')return false;
  if(g.pendingResult){g.winner=g.pendingResult;g.stage='finished';return true}
  if(g.cuts===g.players.length){
   const deck=g.players.flatMap(p=>p.hand);
   g.round++;
   distribute(g,deck);
  }else g.stage='playing';
  return true;
 }
 return false;
}
export function sabotageView(g,id){
 if(!g)return null;
 const p=g.players.find(x=>x.id===id);
 if(!p)return null;
 const hidden=g.stage==='briefing'||g.stage==='roles',finished=g.stage==='finished';
 const counts={repair:count(p.hand,'repair'),error:count(p.hand,'error'),dummy:count(p.hand,'dummy')};
 return {stage:g.stage,round:g.round,rounds:4,cuts:g.cuts,totalCuts:g.players.length,
  required:g.required,repaired:g.repaired,currentId:g.currentId,lastCut:g.lastCut,
  winner:g.winner,history:g.history.slice(-18),chat:g.chat||[],
  seenCount:g.players.filter(x=>g.stage==='roles'?x.roleSeen:x.seen).length,mySeen:g.stage==='roles'?p.roleSeen:p.seen,
  myRole:p.role,myCounts:counts,
  members:g.players.map(x=>({id:x.id,name:x.name,icon:x.icon,cards:x.hand.length,
    seen:g.stage==='roles'?x.roleSeen:x.seen,
    slots:(x.slots||[]).map(slot=>slot.state==='opened'?{state:'opened',type:slot.type}:{state:slot.state}),
    ...(finished?{role:x.role}:{} )})),
  ...(finished?{allHistory:g.history,hasJackal:g.players.some(x=>x.role==='jackal')}: {})};
}
