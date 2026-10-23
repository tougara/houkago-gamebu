/* サボタージュ！ 共通ゲームエンジン。秘密情報は view 経由でのみ外部へ渡す。 */
export const SABOTAGE_COUNTS={
  4:{crew:3,impostor:2,repair:4},5:{crew:3,impostor:2,repair:5},
  6:{crew:4,impostor:2,repair:6},7:{crew:5,impostor:3,repair:7},
  8:{crew:5,impostor:3,repair:8},9:{crew:6,impostor:3,repair:8},
  10:{crew:7,impostor:3,repair:8}
};
const pick=n=>{const x=new Uint32Array(1);const limit=Math.floor(4294967296/n)*n;do{crypto.getRandomValues(x)}while(x[0]>=limit);return x[0]%n};
const shuffle=a=>{a=[...a];for(let i=a.length-1;i>0;i--){const j=pick(i+1);[a[i],a[j]]=[a[j],a[i]]}return a};
const count=(a,k)=>a.filter(x=>x===k).length;
export const sabotageRoles=n=>{
 const c=SABOTAGE_COUNTS[n];if(!c)throw Error('人数は4〜10人');
 const pool=[...Array(c.crew).fill('crew'),...Array(c.impostor).fill('impostor'),'jackal'];
 let hand;
 do{hand=shuffle(pool).slice(0,n)}while(!hand.includes('crew')||!hand.includes('impostor'));
 return hand;
};
function distribute(g,deck){
 const shuffled=shuffle(deck),n=g.players.length,each=shuffled.length/n;
 if(!Number.isInteger(each))throw Error('配線配布枚数が不正');
 g.players.forEach((p,i)=>{p.hand=shuffled.slice(i*each,(i+1)*each);p.seen=false});
 g.stage='briefing';g.cuts=0;g.lastCut=null;
}
export function createSabotage(members){
 const n=members.length,c=SABOTAGE_COUNTS[n];if(!c)throw Error('4〜10人');
 const roles=sabotageRoles(n);
 const g={stage:'briefing',round:1,cuts:0,required:c.repair,repaired:0,
  currentId:members[pick(n)].id,lastCut:null,pendingResult:null,winner:null,history:[],chat:[],chatAt:{},
  players:members.map((m,i)=>({id:m.id,name:m.name,icon:m.icon,role:roles[i],hand:[],seen:false}))};
 distribute(g,[...Array(c.repair).fill('repair'),'error',...Array(5*n-c.repair-1).fill('dummy')]);
 return g;
}
export function sabotageAction(g,id,data){
 if(!g||!g.players.some(p=>p.id===id)||!data)return false;
 if(data.type==='sabotage-chat'){
  if(g.stage!=='playing'||!Number.isInteger(data.key))return false;
  const presets=['修復コードがある！','エラーがあるかも','誰を信じよう？','この人のコードを選んで','別の人にしよう','ちょっと待って！','怪しいと思う','信じる！'];
  if(data.key<0||data.key>=presets.length)return false;
  const now=Date.now();if(now-(g.chatAt[id]||0)<1200)return false;
  g.chatAt[id]=now;g.chat.push({id,text:presets[data.key]});
  g.chat=g.chat.slice(-20);return true;
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
  if(!p||p.id===id||data.index<0||data.index>=p.hand.length)return false;
  const [type]=p.hand.splice(data.index,1);g.cuts++;
  if(type==='repair')g.repaired++;
  g.lastCut={type,by:id,targetId:p.id,round:g.round,number:g.cuts};
  g.history.push(g.lastCut);
  if(type==='error')g.pendingResult='impostor';
  else if(g.repaired===g.required)g.pendingResult='crew';
  else if(g.round===4&&g.cuts===g.players.length)
   g.pendingResult=g.players.some(x=>x.role==='jackal')?'jackal':'impostor';
  g.currentId=p.id;g.stage='reveal';return true;
 }
 if(data.type==='sabotage-next'){
  if(g.stage!=='reveal')return false;
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
 const hidden=g.stage==='briefing',finished=g.stage==='finished';
 const counts={repair:count(p.hand,'repair'),error:count(p.hand,'error'),dummy:count(p.hand,'dummy')};
 return {stage:g.stage,round:g.round,rounds:4,cuts:g.cuts,totalCuts:g.players.length,
  required:g.required,repaired:g.repaired,currentId:g.currentId,lastCut:g.lastCut,
  winner:g.winner,history:g.history.slice(-18),chat:g.chat||[],
  seenCount:g.players.filter(x=>x.seen).length,mySeen:p.seen,
  myRole:finished||hidden?p.role:null,myCounts:hidden?counts:null,
  members:g.players.map(x=>({id:x.id,name:x.name,icon:x.icon,cards:x.hand.length,
    seen:x.seen,...(finished?{role:x.role}:{} )})),
  ...(finished?{allHistory:g.history,hasJackal:g.players.some(x=>x.role==='jackal')}: {})};
}
