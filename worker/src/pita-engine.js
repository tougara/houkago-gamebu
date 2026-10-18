/* ピタ止めチャレンジ ONLINE / 全員同時・ラウンドごとに一括発表 */
export const PITA_MAX_ROUNDS=25;
const random=n=>{const b=new Uint32Array(1);crypto.getRandomValues(b);return b[0]%n};
const active=g=>g.memberIds.filter(id=>g.lives[id]>0);
export const pitaPosition=(elapsedMs,speed)=>{
 const v=((elapsedMs*speed/1000)%200+200)%200;
 return v<=100?v:200-v;
};
export const pitaLimits=pressure=>({
 perfect:Math.max(1,2-Math.floor(pressure/2)),
 excellent:Math.max(2,5-pressure),
 great:Math.max(4,10-pressure*2)
});
export const pitaGrade=(error,pressure=0)=>{
 const limits=pitaLimits(pressure);
 return error<=limits.perfect?'perfect':error<=limits.excellent?'excellent':error<=limits.great?'great':'miss';
};
export function createPita(room){
 const memberIds=room.members.map(m=>m.id);
 if(memberIds.length<2||memberIds.length>10)throw Error('2〜10人で遊んでね');
 return {stage:'setup',memberIds,round:0,settings:{startingLives:3},
   lives:Object.fromEntries(memberIds.map(id=>[id,3])),
   totals:Object.fromEntries(memberIds.map(id=>[id,{error:0,perfects:0}])),
   pressure:Object.fromEntries(memberIds.map(id=>[id,0])),nextPressure:{},
   target:50,speed:62,startedAt:0,deadline:0,submissions:{},results:[],
   finalRound:false,winnerIds:[]};
}
function beginRound(g){
 const prior=g.target;
 let target=25+random(51);
 if(Math.abs(target-prior)<5)target=25+((target+13)%51);
 g.round++;g.target=target;g.speed=[54,66,78,90][(g.round-1)%4];
 g.pressure=Object.fromEntries(g.memberIds.map(id=>[id,Math.min(3,g.nextPressure[id]||0)]));
 g.nextPressure={};g.submissions={};g.results=[];g.startedAt=Date.now();
 g.deadline=g.startedAt+35000;g.stage='playing';
}
function resolve(room){
 const g=room.pita,ids=active(g),rows=[];
 for(const id of ids){
  const s=g.submissions[id],time=s?.elapsedMs??18000,choice=s?.choice||'attack';
  const value=s?pitaPosition(time,g.speed):null;
  const error=s?Math.round(Math.abs(value-g.target)*10)/10:null;
  const pressure=g.pressure[id]||0;
  const grade=s&&time<18000?pitaGrade(error,pressure):'miss';
  const before=g.lives[id];const power=grade==='perfect'?2:grade==='excellent'?1:0;
  const heal=power&&choice==='heal'?power:0;
  g.lives[id]=Math.min(5,Math.max(0,before+(grade==='miss'?-1:0)+heal));
  g.totals[id].error+=(error??100);
  if(grade==='perfect')g.totals[id].perfects++;
  rows.push({id,value:value===null?null:Math.round(value*10)/10,error,grade,
   choice:power?choice:null,attack:power&&choice==='attack'?power:0,heal,
   lifeBefore:before,lifeAfter:g.lives[id],pressure,eliminated:g.lives[id]===0,
   timedOut:!s||time>=18000});
 }
 const survivors=active(g);
 for(const row of rows)if(row.attack&&g.lives[row.id]>0){
  for(const id of survivors)if(id!==row.id)
   g.nextPressure[id]=Math.min(3,(g.nextPressure[id]||0)+row.attack);
 }
 g.results=rows;
 g.finalRound=survivors.length<=1||g.round>=PITA_MAX_ROUNDS;
 if(g.finalRound){
  const candidates=survivors.length?survivors:ids;
  const ranking=(id)=>[g.lives[id],g.totals[id].perfects,-g.totals[id].error];
  candidates.sort((a,b)=>{const x=ranking(a),y=ranking(b);return y[0]-x[0]||y[1]-x[1]||y[2]-x[2]});
  const best=ranking(candidates[0]);
  g.winnerIds=candidates.filter(id=>ranking(id).every((n,i)=>Math.abs(n-best[i])<0.001));
 }
 g.stage='review';
}
export function pitaAction(room,id,data){
 const g=room.pita;
 if(!g||!g.memberIds.includes(id)||typeof data?.type!=='string')return false;
 const host=id===room.hostId;
 if(data.type==='pita-begin'){
  if(!host||g.stage!=='setup')return false;
  beginRound(g);return true;
 }
 if(data.type==='pita-stop'){
  if(g.stage!=='playing'||g.lives[id]<=0||Object.hasOwn(g.submissions,id))return false;
  if(!Number.isInteger(data.elapsedMs)||data.elapsedMs<100||data.elapsedMs>18000||
     !['attack','heal'].includes(data.choice))return false;
  g.submissions[id]={elapsedMs:data.elapsedMs,choice:data.choice};
  if(active(g).every(key=>Object.hasOwn(g.submissions,key)))resolve(room);
  return true;
 }
 if(data.type==='pita-close'){
  if(!host||g.stage!=='playing'||Date.now()-g.startedAt<25000)return false;
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
   eliminated:(g.lives[m.id]??0)===0
 }));
 return {stage:g.stage,round:g.round,maxRounds:PITA_MAX_ROUNDS,
   target:g.target,speed:g.speed,deadline:g.deadline,startedAt:g.startedAt,
   pressure:g.pressure[id]||0,mySubmitted:Object.hasOwn(g.submissions,id),
   submittedCount:Object.keys(g.submissions).length,activeCount:active(g).length,
   members,results:['review','finished'].includes(g.stage)?g.results:[],
   finalRound:g.finalRound,winnerIds:g.stage==='finished'?g.winnerIds:[],
   limits:pitaLimits(g.pressure[id]||0)};
}
