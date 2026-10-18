/* リンクバースト！オンライン対戦。元のVSエンジンをサーバーだけで進行させる。 */
import {linkEngine as E} from './link-engine.js';
const STEP=50;
const randomSeed=()=>{const n=new Uint32Array(1);crypto.getRandomValues(n);return n[0]};
const emptyControls=()=>({left:false,right:false,down:false,dir:null,repeatMs:0});
export function createLink(room){
 if(room.members.length!==2)throw Error('リンクバースト！は2人専用');
 return {stage:'setup',ids:room.members.map(m=>m.id),seed:null,
  states:{},controls:{},countdown:3500,winners:[],reason:'',
  sequence:0,updatedAt:Date.now()};
}
const connected=(g,id)=>g.ids.includes(id);
const st=(g,id)=>g.states[id];
function initialize(g){
 g.seed=randomSeed();g.states={};g.controls={};g.winners=[];g.reason='';
 for(const id of g.ids){g.states[id]=E.make(null,g.seed);g.controls[id]=emptyControls()}
 g.stage='countdown';g.countdown=3500;g.sequence++;g.updatedAt=Date.now();
}
function finish(g){
 const dead=g.ids.filter(id=>st(g,id).over);
 if(!dead.length)return false;
 g.stage='finished';g.winners=dead.length===2?[]:g.ids.filter(id=>!dead.includes(id));
 g.reason=dead.length===2?'両者同時KO':'中央から新しいブロックを出せなくなった';
 for(const id of g.ids)g.controls[id]=emptyControls();
 g.sequence++;return true;
}
function resolve(g){
 const states=g.ids.map(id=>st(g,id));
 const ready=states.map(p=>!p.over&&p.phase==='interturn');
 if(!ready.some(Boolean))return;
 const attacks=states.map((p,i)=>ready[i]?p.readyAttack:0);
 for(let i=0;i<2;i++)if(ready[i]){
  const counter=E.counterJam(states[i],attacks[i]);
  attacks[i]=counter.remaining;
 }
 const mutual=Math.min(attacks[0],attacks[1]);
 if(mutual){attacks[0]-=mutual;attacks[1]-=mutual;
  for(let i=0;i<2;i++)if(ready[i]){
   states[i].counteredJam+=mutual;E.notice(states[i],'COUNTER −'+mutual)
  }
 }
 for(let i=0;i<2;i++)if(attacks[i]>0){
  E.queueJam(states[1-i],attacks[i]);
  states[i].sentJam+=attacks[i];E.notice(states[i],'SEND +'+attacks[i]);
 }
 for(let i=0;i<2;i++)if(ready[i])E.finishTurn(states[i]);
}
export function linkAction(room,id,data){
 const g=room.link;if(!g||!connected(g,id)||!data||typeof data.type!=='string')return false;
 const host=id===room.hostId;
 if(data.type==='link-begin'){
  if(!host||g.stage!=='setup')return false;
  initialize(g);return true;
 }
 if(data.type==='link-resume'){
  if(!host||g.stage!=='interrupted')return false;
  for(const pid of g.ids)g.controls[pid]=emptyControls();
  g.countdown=3500;g.stage='countdown';g.sequence++;return true;
 }
 if(data.type==='link-control'){
  if(g.stage!=='playing'||!['left','right','down','rotate'].includes(data.action)||typeof data.pressed!=='boolean')return false;
  const c=g.controls[id],p=st(g,id);
  const action=data.action,pressed=data.pressed;
  if(action==='rotate'){
   if(!pressed)return false;
   return E.rotate(p);
  }
  if(c[action]===pressed)return false;
  c[action]=pressed;
  if(['left','right'].includes(action)){
   const dir=c.right?'right':c.left?'left':null;
   if(dir!==c.dir){
    c.dir=dir;c.repeatMs=200;
    if(dir)E.move(p,dir==='left'?-1:1);
   }
  }else if(pressed)E.down(p);
  return true;
 }
 return false;
}
export function interruptLink(g){
 if(!g||!['playing','countdown'].includes(g.stage))return false;
 g.stage='interrupted';g.sequence++;
 for(const id of g.ids)g.controls[id]=emptyControls();
 return true;
}
export function advanceLink(g,elapsed=STEP){
 if(!g||!['playing','countdown'].includes(g.stage))return false;
 const elapsedMs=Math.max(0,Math.min(250,Math.floor(Number(elapsed)||0)));
 if(g.stage==='countdown'){
  g.countdown=Math.max(0,g.countdown-elapsedMs);
  if(g.countdown===0){g.stage='playing';g.sequence++}
  return true;
 }
 for(let t=0;t<elapsedMs;t+=STEP){
  const dt=Math.min(STEP,elapsedMs-t);
  for(const id of g.ids){
   const c=g.controls[id],p=st(g,id);
   if(c.dir&&p.phase==='falling'){
    c.repeatMs-=dt;
    if(c.repeatMs<=0){
     E.move(p,c.dir==='left'?-1:1);
     c.repeatMs+=82;
    }
   }
   E.tick(p,dt,c.down);
  }
  resolve(g);
  if(finish(g))return true;
 }
 g.sequence++;g.updatedAt=Date.now();
 return true;
}
const VALUES={blue:'1',red:'2',yellow:'3',green:'4',jam:'5'};
const encodeBoard=board=>board.slice(E.HIDDEN).map(row=>row.map(c=>VALUES[c]||'0').join(''));
function playerView(g,id){
 const p=g.states[id];if(!p)return null;
 return {board:encodeBoard(p.board),piece:p.piece?{...p.piece,y:p.piece.y-E.HIDDEN}:null,
  next:p.queue.slice(0,2),phase:p.phase,score:p.score,pieces:p.pieces,
  maxLink:p.maxLink,combo:p.currentCombo,link:p.link,burst:p.burstCells,
  incoming:E.incomingCount(p),sent:p.sentJam,countered:p.counteredJam,
  notice:p.notice,over:p.over,elapsed:Math.floor(p.elapsedMs/1000)};
}
export function linkView(room,id){
 const g=room.link;if(!g)return null;
 const opponent=g.ids.find(x=>x!==id),members=g.ids.map(pid=>{
  const p=room.members.find(m=>m.id===pid);
  return {id:pid,name:p?.name||'プレイヤー',icon:p?.icon||'？'};
 });
 return {stage:g.stage,members,meId:id,opponentId:opponent,
  countdown:g.stage==='countdown'?g.countdown:0,sequence:g.sequence,
  self:playerView(g,id),opponent:playerView(g,opponent),
  winners:g.stage==='finished'?g.winners:[],reason:g.reason};
}
