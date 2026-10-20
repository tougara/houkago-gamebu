/* LINK BURST! Local demo adapter.
 * Actual offline VS gameplay engine; no room, Worker or network calls.
 * This file is inert except on ?testPlay=1. */
(()=>{
'use strict';
if(new URLSearchParams(location.search).get('testPlay')!=='1')return;
const E=window.LinkBurstVersusEngine;
if(!E){window.LinkBurstPreviewEngineError='オフライン対戦エンジンを読み込めませんでした';return}
const COLORS=E.COLORS,VALUES={blue:'1',red:'2',yellow:'3',green:'4',jam:'5'};
const PAIR_TARGET=6;
let game=null,sequence=0,stepCount=0,botCount=0,botLane=3,controls=null;
const blank=()=>({left:false,right:false,down:false,dir:null,repeatMs:0});
function create(){
 const pairs=[];
 const source=i=>{
  while(pairs.length<=i)pairs.push({
   a:COLORS[Math.floor(Math.random()*COLORS.length)],
   b:COLORS[Math.floor(Math.random()*COLORS.length)]
  });
  return pairs[i];
 };
 game={stage:'setup',countdown:0,reason:'',winners:[],self:E.make(null,source),
  opponent:E.make(null,source),sequence:++sequence};
 controls=blank();stepCount=0;botCount=0;botLane=3;
}
function start(){
 create();game.stage='countdown';game.countdown=3500;sequence++;return true;
}
function force(stage){
 if(!game)create();
 if(stage==='setup'){create();return true}
 if(stage==='countdown')return start();
 if(stage==='playing'){
  if(game.stage==='setup')start();
  game.stage='playing';game.countdown=0;sequence++;return true;
 }
 if(stage==='interrupted'){game.stage='interrupted';controls=blank();sequence++;return true}
 if(stage==='finished'){
  game.stage='finished';game.winners=['demo-a'];game.reason='サンプル対戦が終了したよ';
  controls=blank();sequence++;return true;
 }
 return false;
}
function resume(){
 if(game?.stage!=='interrupted')return false;
 game.stage='countdown';game.countdown=3500;controls=blank();sequence++;return true;
}
function input(action,pressed){
 if(!game||game.stage!=='playing'||!['left','right','down','rotate'].includes(action)||typeof pressed!=='boolean')return false;
 const st=game.self;
 if(action==='rotate'){if(pressed)return E.rotate(st);return true}
 if(controls[action]===pressed)return true;
 controls[action]=pressed;
 if(action==='left'||action==='right'){
  const dir=controls.right?'right':controls.left?'left':null;
  if(controls.dir!==dir){
   controls.dir=dir;controls.repeatMs=200;
   if(dir)E.move(st,dir==='left'?-1:1);
  }
 }else if(pressed)E.down(st);
 return true;
}
function resolve(){
 const states=[game.self,game.opponent],ready=states.map(p=>!p.over&&p.phase==='interturn');
 if(!ready.some(Boolean))return;
 const attacks=states.map((p,i)=>ready[i]?p.readyAttack:0);
 for(let i=0;i<2;i++)if(ready[i]){
  const counter=E.counterJam(states[i],attacks[i]);attacks[i]=counter.remaining;
 }
 const mutual=Math.min(attacks[0],attacks[1]);
 if(mutual){
  attacks[0]-=mutual;attacks[1]-=mutual;
  for(let i=0;i<2;i++)if(ready[i])states[i].counteredJam+=mutual;
 }
 for(let i=0;i<2;i++)if(attacks[i]>0){
  E.queueJam(states[1-i],attacks[i]);
  states[i].sentJam+=attacks[i];
  E.notice(states[i],'SEND +'+attacks[i]);
 }
 for(let i=0;i<2;i++)if(ready[i])E.finishTurn(states[i]);
}
function botTick(dt){
 const st=game.opponent;
 if(st.over||st.phase!=='falling'||!st.piece)return;
 botCount+=dt;
 if(!Number.isInteger(botLane))botLane=3;
 if(st.piece.y<=2&&stepCount%18===0)botLane=1+Math.floor(Math.random()*5);
 if(st.piece.x!==botLane&&botCount%200<dt)E.move(st,st.piece.x<botLane?1:-1);
 if(botCount%650<dt&&st.piece.y<6)E.rotate(st);
 if(botCount%145<dt)E.down(st);
}
function advance(ms=50){
 if(!game||!['countdown','playing'].includes(game.stage))return false;
 let remain=Math.min(2000,Math.max(0,Math.floor(ms)));
 if(game.stage==='countdown'){
  const used=Math.min(remain,game.countdown);
  game.countdown-=used;remain-=used;
  if(game.countdown===0){game.stage='playing';sequence++}
 }
 if(game.stage!=='playing'||remain===0)return true;
 for(let t=0;t<remain;t+=50){
  const dt=Math.min(50,remain-t);
  if(controls.dir&&game.self.phase==='falling'){
   controls.repeatMs-=dt;
   if(controls.repeatMs<=0){
    E.move(game.self,controls.dir==='left'?-1:1);controls.repeatMs+=82;
   }
  }
  E.tick(game.self,dt,controls.down);
  E.tick(game.opponent,dt,false);
  botTick(dt);
  resolve();
  stepCount++;
  if(game.self.over||game.opponent.over){
   game.stage='finished';
   game.winners=game.self.over&&game.opponent.over?[]:game.self.over?['demo-b']:['demo-a'];
   game.reason=game.winners.length?'中央から新しいブロックを出せなくなった':'両者同時KO';
   controls=blank();break;
  }
 }
 sequence++;
 return true;
}
function viewPlayer(p){
 const board=p.board.slice(E.HIDDEN).map(row=>row.map(c=>VALUES[c]||'0').join(''));
 return {board,piece:p.piece?{...p.piece,y:p.piece.y-E.HIDDEN}:null,
  next:p.queue.slice(0,2),phase:p.phase,score:p.score,pieces:p.pieces,maxLink:p.maxLink,
  combo:p.currentCombo,link:p.link,burst:p.burstCells,incoming:E.incomingCount(p),
  sent:p.sentJam,countered:p.counteredJam,notice:p.notice,over:p.over,elapsed:Math.floor(p.elapsedMs/1000)};
}
function snapshot(){
 if(!game)create();
 return {stage:game.stage,countdown:game.countdown,sequence,
  self:viewPlayer(game.self),opponent:viewPlayer(game.opponent),
  winners:[...game.winners],reason:game.reason};
}
create();
window.LinkBurstPreviewSimulator=Object.freeze({
 start,force,resume,input,advance,snapshot,get stage(){return game?.stage},
 get raw(){return game},get running(){return ['playing','countdown'].includes(game?.stage)}
});
})();