/* 教科書タワー ONLINE: offline game.js のデッキ / 配置 / 勝敗を共有サーバーで再現 */
export const TOWER_SUBJECTS=Object.freeze([
 {key:'japanese',label:'国語',count:8},
 {key:'math',label:'算数',count:7},
 {key:'science',label:'理科',count:7},
 {key:'social',label:'社会',count:7},
 {key:'english',label:'英語',count:7}
]);
const KEYS=new Set(TOWER_SUBJECTS.map(s=>s.key));
const random=n=>{const u=new Uint32Array(1);crypto.getRandomValues(u);return u[0]%n};
const shuffle=arr=>{const a=[...arr];for(let i=a.length-1;i>0;i--){const j=random(i+1);[a[i],a[j]]=[a[j],a[i]]}return a};
const cell=(level,x)=>level+','+x;
const handTotal=hand=>Object.values(hand||{}).reduce((a,b)=>a+b,0);
const emptyHand=()=>Object.fromEntries(TOWER_SUBJECTS.map(s=>[s.key,0]));
export function towerDeck(){
 return shuffle(TOWER_SUBJECTS.flatMap(s=>Array(s.count).fill(s.key)));
}
export function towerBottom(board){
 const xs=Object.keys(board).map(k=>k.split(',').map(Number)).filter(([level])=>level===0).map(([,x])=>x).sort((a,b)=>a-b);
 return {count:xs.length,min:xs[0]??0,max:xs[xs.length-1]??0};
}
export function towerLegal(board,key){
 if(!KEYS.has(key))return [];
 const b=towerBottom(board);
 if(!b.count)return [{level:0,x:0}];
 const out=[];
 if(b.count<8)out.push({level:0,x:b.min-1},{level:0,x:b.max+1});
 for(let level=1;level<8;level++){
  for(let x=b.min;x<=b.max-level;x++){
   if(board[cell(level,x)])continue;
   const a=board[cell(level-1,x)],c=board[cell(level-1,x+1)];
   if(a&&c&&(a===key||c===key))out.push({level,x});
  }
 }
 return out;
}
const hasMove=(g,id)=>TOWER_SUBJECTS.some(s=>g.hands[id][s.key]>0&&towerLegal(g.board,s.key).length>0);
const currentMember=(g,id)=>g.memberIds.indexOf(id);
function nextActive(g,from){
 const n=g.memberIds.length;
 for(let step=1;step<=n;step++){
  const candidate=g.memberIds[(currentMember(g,from)+step)%n];
  if(g.active.includes(candidate))return candidate;
 }
 return null;
}
function startRound(g){
 g.startId=g.memberIds[g.round%g.memberIds.length];
 g.currentId=g.startId;g.board={};g.active=[...g.memberIds];
 g.outcomes={};g.lastEvent=null;g.movesMade=0;
 g.hands=Object.fromEntries(g.memberIds.map(id=>[id,emptyHand()]));
 const deck=towerDeck();
 if(g.memberIds.length===5)g.board[cell(0,0)]=deck.pop();
 deck.forEach((subject,i)=>{
  const id=g.memberIds[(g.round+i)%g.memberIds.length];
  g.hands[id][subject]++;
 });
 g.stage='roundIntro';
}
function settleTurn(g){
 // 手番が回ってきても1枚も配置できない人は、残り手札を罰点化して除外。
 for(let safety=0;safety<=g.memberIds.length;safety++){
  const id=g.currentId;
  if(!id||!g.active.includes(id)){
   g.currentId=null;g.stage='roundResult';return;
  }
  if(hasMove(g,id)){g.stage='playing';return;}
  const remaining=handTotal(g.hands[id]);
  g.penalties[id]+=remaining;
  g.outcomes[id]={kind:'stuck',remaining,delta:remaining};
  g.active=g.active.filter(x=>x!==id);
  g.lastEvent={kind:'stuck',id,remaining};
  if(!g.active.length){g.currentId=null;g.stage='roundResult';return}
  g.currentId=nextActive(g,id);
 }
 throw Error('turn settlement did not converge');
}
export function createTower(room){
 const ids=room.members.map(m=>m.id);
 if(ids.length<2||ids.length>6)throw Error('教科書タワーは2〜6人で遊べます');
 return {stage:'setup',memberIds:ids,round:0,totalRounds:ids.length,
  penalties:Object.fromEntries(ids.map(id=>[id,0])),board:{},hands:{},
  active:[],currentId:null,startId:null,outcomes:{},lastEvent:null,movesMade:0};
}
export function towerAction(room,id,data){
 const g=room.tower;
 if(!g||!g.memberIds.includes(id)||!data||typeof data.type!=='string')return false;
 const host=id===room.hostId;
 if(data.type==='tower-begin'){
  if(!host||g.stage!=='setup')return false;
  g.round=0;startRound(g);return true;
 }
 if(data.type==='tower-round-start'){
  if(!host||g.stage!=='roundIntro')return false;
  settleTurn(g);return true;
 }
 if(data.type==='tower-place'){
  if(g.stage!=='playing'||id!==g.currentId||!KEYS.has(data.subject)||
    !Number.isInteger(data.level)||!Number.isInteger(data.x))return false;
  if(data.level<0||data.level>7||data.x< -8||data.x>8||
    !g.hands[id][data.subject]||
    !towerLegal(g.board,data.subject).some(pos=>pos.level===data.level&&pos.x===data.x))return false;
  g.board[cell(data.level,data.x)]=data.subject;
  g.hands[id][data.subject]--;g.movesMade++;
  let returned=0;
  if(handTotal(g.hands[id])===0){
   returned=Math.min(2,g.penalties[id]);g.penalties[id]-=returned;
   g.outcomes[id]={kind:'clear',returned,delta:-returned};
   g.active=g.active.filter(x=>x!==id);
  }
  g.lastEvent={kind:'placed',id,subject:data.subject,level:data.level,x:data.x,returned,
    cleared:!!g.outcomes[id]};
  if(!g.active.length){g.currentId=null;g.stage='roundResult';return true}
  g.currentId=nextActive(g,id);
  settleTurn(g);return true;
 }
 if(data.type==='tower-next'){
  if(!host||g.stage!=='roundResult')return false;
  if(g.round+1>=g.totalRounds){g.stage='finished';g.currentId=null;return true}
  g.round++;startRound(g);return true;
 }
 return false;
}
export function towerView(room,id){
 const g=room.tower;if(!g)return null;
 const playing=g.stage==='playing';
 const myTurn=playing&&g.currentId===id;
 const members=room.members.filter(m=>g.memberIds.includes(m.id)).map(m=>({
  id:m.id,name:m.name,icon:m.icon,score:g.penalties[m.id],
  cards:g.hands[m.id]?handTotal(g.hands[m.id]):null,
  active:g.active.includes(m.id)
 }));
 return {stage:g.stage,round:g.round+1,totalRounds:g.totalRounds,
  startId:g.startId,currentId:g.currentId,movesMade:g.movesMade,
  board:Object.entries(g.board).map(([k,subject])=>{
   const [level,x]=k.split(',').map(Number);return {level,x,subject};
  }),
  bottom:towerBottom(g.board),
  members,lastEvent:g.lastEvent,myTurn,
  myHand:['roundIntro','playing'].includes(g.stage)?g.hands[id]:null,
  choices:myTurn?Object.fromEntries(TOWER_SUBJECTS.map(s=>[
   s.key,g.hands[id][s.key]?towerLegal(g.board,s.key):[]
  ])):null,
  outcomes:['roundResult','finished'].includes(g.stage)?g.outcomes:null,
  rankings:g.stage==='finished'?[...members].sort((a,b)=>a.score-b.score):null};
}
