/* オンライン版ピタ止め：既存2人KOの判定・回復ゲージ・連続成功を2〜10人同時対戦へ適用 */
import {PitadomeVersusRules as R} from './pita-versus-rules.js';
export const PITA_MAX_ROUNDS=25;
const random=n=>{const b=new Uint32Array(1);crypto.getRandomValues(b);return b[0]%n};
const active=g=>g.memberIds.filter(id=>g.lives[id]>0);
export const pitaPosition=(elapsedMs,speed)=>{const v=((elapsedMs*speed/1000)%200+200)%200;return v<=100?v:200-v};
export const pitaLimits=pressure=>({perfect:0,excellent:1,great:3,safe:R.effectiveSafe(10,pressure)});
export const pitaGrade=(error,pressure=0)=>R.tier(Math.round(error),R.effectiveSafe(10,pressure));
const randFloat=()=>random(1000000)/1000000;
export function pitaMotionAt(profile,initial,elapsedMs){
 let m={...initial};
 const n=Math.min(18000,Math.max(0,Math.floor(elapsedMs)));
 for(let i=0;i<n;i+=20)m=R.advanceMotion(m,Math.min(20,n-i)/1000,profile);
 return m.value;
}
function beginRound(g){
 const previous=g.targets||{};
 const nextRound=g.round+1;
 g.profiles={};g.motions={};g.targets={};
 for(const id of g.memberIds){
  const difficulty=g.difficulties[id]==='easy'?'easy':'normal';
  const p=R.roundProfile((nextRound*2)-1,difficulty,randFloat,previous[id]??null);
  g.profiles[id]=p;g.motions[id]=R.initialMotion(p,randFloat);g.targets[id]=p.target;
 }
 g.round=nextRound;
 // 旧コードからの参照用。プレイヤーには必ず個別プロフィールを送る。
 const first=g.memberIds[0];g.profile=g.profiles[first];g.initialMotion=g.motions[first];
 g.target=g.targets[first];g.speed=g.profile.speed;
 g.pressure=Object.fromEntries(g.memberIds.map(id=>[id,Math.min(3,g.nextPressure[id]||0)]));
 g.nextPressure={};g.submissions={};g.results=[];
 g.startedAt=Date.now()+2300;g.deadline=g.startedAt+18000;
 g.stage='playing';
}
export function createPita(room){
 const ids=room.members.map(m=>m.id);
 if(ids.length<2||ids.length>10)throw Error('2〜10人で遊んでね');
 return {stage:'setup',memberIds:ids,round:0,settings:{startingLives:3},
  lives:Object.fromEntries(ids.map(id=>[id,3])),
  difficulties:Object.fromEntries(ids.map(id=>[id,'normal'])),
  profiles:{},motions:{},targets:{},
  totals:Object.fromEntries(ids.map(id=>[id,{error:0,perfects:0,score:0}])),
  combos:Object.fromEntries(ids.map(id=>[id,0])),
  streaks:Object.fromEntries(ids.map(id=>[id,0])),
  charges:Object.fromEntries(ids.map(id=>[id,0])),
  quiet:Object.fromEntries(ids.map(id=>[id,0])),
  mushin:Object.fromEntries(ids.map(id=>[id,false])),
  pressure:Object.fromEntries(ids.map(id=>[id,0])),nextPressure:{},
  target:50,speed:34,profile:null,initialMotion:null,
  startedAt:0,deadline:0,submissions:{},results:[],
  finalRound:false,winnerIds:[]};
}
function resolve(room){
 const g=room.pita,ids=active(g),rows=[];
 for(const id of ids){
  const s=g.submissions[id],time=s?.elapsedMs??18000;
  const profile=g.profiles?.[id]||g.profile;
  const motion=g.motions?.[id]||g.initialMotion;
  const target=g.targets?.[id]??g.target;
  const value=s?pitaMotionAt(profile,motion,time):null;
  const difficulty=g.difficulties[id]==='easy'?'easy':'normal';
  const baseSafe=R.baseSafe((g.round*2)-1,difficulty);
  const pressure=g.pressure[id]||0,safe=R.effectiveSafe(baseSafe,pressure);
  const previous={combo:g.combos[id],greatStreak:g.streaks[id],
   charge:g.charges[id],quiet:g.quiet[id],mushinActive:g.mushin[id],
   score:g.totals[id].score};
  const evalResult=s&&time<18000?
    R.evaluateStop(value,target,previous,safe):null;
  const attempt=evalResult||{
   value:null,error:null,tier:'miss',perfect:false,combo:0,greatStreak:0,
   points:0,special:false,triple:false,charge:g.charges[id],quiet:g.quiet[id],
   chargeReward:0,mushinReady:false,total:g.totals[id].score,safe
  };
  const before=g.lives[id];
  const reward=R.applyRewards(before,{...attempt,error:attempt.error??1000});
  g.lives[id]=reward.life;
  g.combos[id]=attempt.combo;g.streaks[id]=attempt.greatStreak;
  g.charges[id]=attempt.charge;g.quiet[id]=attempt.quiet;
  g.mushin[id]=attempt.mushinReady;
  g.totals[id].score=attempt.total;
  g.totals[id].error+=(attempt.error??100);
  if(attempt.perfect)g.totals[id].perfects++;
  rows.push({id,target,difficulty,value:attempt.value,error:attempt.error,grade:attempt.tier,
   points:attempt.points,combo:attempt.combo,streak:attempt.greatStreak,
   special:attempt.special,triple:attempt.triple,
   chargeReward:attempt.chargeReward,charge:attempt.charge,
   heal:reward.healed,attack:reward.pressure,damage:reward.damage,
   safe,lifeBefore:before,lifeAfter:g.lives[id],pressure,
   eliminated:g.lives[id]===0,timedOut:!s||time>=18000});
 }
 // KOになった人の妨害は次のラウンドに持ち越さない。
 const survivors=active(g);
 for(const row of rows)if(row.attack&&g.lives[row.id]>0)
  for(const id of survivors)if(id!==row.id)
   g.nextPressure[id]=Math.min(3,(g.nextPressure[id]||0)+row.attack);
 g.results=rows;
 g.finalRound=survivors.length<=1||g.round>=PITA_MAX_ROUNDS;
 if(g.finalRound){
  const candidates=survivors.length?survivors:ids;
  const rank=id=>[g.lives[id],g.totals[id].perfects,g.totals[id].score,-g.totals[id].error];
  candidates.sort((a,b)=>{const x=rank(a),y=rank(b);return y[0]-x[0]||y[1]-x[1]||y[2]-x[2]||y[3]-x[3]});
  const best=rank(candidates[0]);
  g.winnerIds=candidates.filter(id=>rank(id).every((n,i)=>Math.abs(n-best[i])<.001));
 }
 g.stage='review';
}
export function pitaAction(room,id,data){
 const g=room.pita;if(!g||!g.memberIds.includes(id)||typeof data?.type!=='string')return false;
 // 旧オンライン進行中ルームは新しいオフライン準拠の盤面情報を持たない。
 // 自動移行で得点を壊さず、ホストの「対戦終了」操作を受けられる状態を保つ。
 if(g.stage!=='setup'&&!g.profile)return false;
 if(data.type==='pita-difficulty'){
  if(g.stage!=='setup'||!['normal','easy'].includes(data.difficulty))return false;
  if(!g.difficulties)g.difficulties=Object.fromEntries(g.memberIds.map(pid=>[pid,'normal']));
  if(g.difficulties[id]===data.difficulty)return false;
  g.difficulties[id]=data.difficulty;return true;
 }
 const host=id===room.hostId;
 if(data.type==='pita-begin'){
  if(!host||g.stage!=='setup')return false;beginRound(g);return true;
 }
 if(data.type==='pita-stop'){
  if(g.stage!=='playing'||g.lives[id]<=0||Object.hasOwn(g.submissions,id))return false;
  if(!Number.isInteger(data.elapsedMs)||data.elapsedMs<100||data.elapsedMs>18000)return false;
  // 以前のクライアントのchoiceは無視する。オフライン2人対戦と同じ自動報酬。
  g.submissions[id]={elapsedMs:data.elapsedMs};
  if(active(g).every(key=>Object.hasOwn(g.submissions,key)))resolve(room);
  return true;
 }
 if(data.type==='pita-close'){
  if(!host||g.stage!=='playing'||Date.now()-g.startedAt<22500)return false;
  resolve(room);return true;
 }
 if(data.type==='pita-next'){
  if(!host||g.stage!=='review')return false;
  if(g.finalRound)g.stage='finished';else beginRound(g);
  return true;
 }
 return false;
}
export function pitaView(room,id){
 const g=room.pita;if(!g)return null;
 const members=room.members.filter(m=>g.memberIds.includes(m.id)).map(m=>({
  id:m.id,name:m.name,icon:m.icon,lives:g.lives[m.id]??0,
  difficulty:g.difficulties?.[m.id]||'normal',
  score:g.totals[m.id]?.score||0,charge:g.charges?.[m.id]||0,combo:g.combos?.[m.id]||0,
  streak:g.streaks?.[m.id]||0,perfects:g.totals[m.id]?.perfects||0,
  eliminated:(g.lives[m.id]??0)===0
 }));
 const difficulty=g.difficulties?.[id]||'normal';
 const profile=g.profiles?.[id]||g.profile;
 const motion=g.motions?.[id]||g.initialMotion;
 const target=g.targets?.[id]??g.target;
 const base=R.baseSafe((g.round*2)-1,difficulty);
 return {stage:g.stage,round:g.round,maxRounds:PITA_MAX_ROUNDS,
  difficulty,target,speed:profile?.speed||g.speed,profile,initialMotion:motion,
  deadline:g.deadline,startedAt:g.startedAt,pressure:g.pressure[id]||0,
  baseSafe:base,safe:R.effectiveSafe(base,g.pressure[id]||0),
  mySubmitted:Object.hasOwn(g.submissions,id),
  submittedCount:Object.keys(g.submissions).length,activeCount:active(g).length,
  members,results:['review','finished'].includes(g.stage)?g.results:[],
  finalRound:g.finalRound,winnerIds:g.stage==='finished'?g.winnerIds:[],
  limits:pitaLimits(g.pressure[id]||0),chargeLimit:R.CHARGE_LIMIT};
}
