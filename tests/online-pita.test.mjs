import {test} from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {OnlineRoom} from '../worker/src/index.js';
import {PitadomeVersusRules as R} from '../worker/src/pita-versus-rules.js';
import {createPita,pitaAction,pitaView,pitaPosition,pitaGrade,pitaLimits,pitaMotionAt} from '../worker/src/pita-engine.js';
if(!globalThis.crypto)globalThis.crypto=webcrypto;
const fixture=(n=3)=>{const room={hostId:'p0',members:Array.from({length:n},(_,i)=>({id:'p'+i,name:'人'+i,icon:'🐶'}))};room.pita=createPita(room);return room};
const action=(r,id,type,extra={})=>pitaAction(r,id,{type,...extra});
function timeFor(g,predicate){
 let m={...g.initialMotion};
 for(let ms=20;ms<18000;ms+=20){
  m=R.advanceMotion(m,.02,g.profile);
  if(ms>=100&&predicate(Math.abs(Math.round(m.value)-g.target),Math.round(m.value)))return ms;
 }
 throw Error('no stop found');
}
test('オンラインKOはオフライン2人対戦と同じ判定・動き・連続成功・回復ゲージを使う',()=>{
 assert.equal(R.CHARGE_LIMIT,350);
 assert.equal(R.tier(0,15),'perfect');assert.equal(R.tier(1,15),'excellent');
 assert.equal(R.tier(2,15),'great');assert.equal(R.tier(4,15),'good');
 assert.equal(R.tier(6,15),'safe');assert.equal(R.tier(16,15),'miss');
 assert.equal(pitaGrade(0), 'perfect');
 assert.equal(pitaLimits(3).safe,7);
 const r=fixture(10);
 assert.equal(r.pita.stage,'setup');
 assert.equal(action(r,'p1','pita-begin'),false);
 assert.equal(action(r,'p0','pita-begin'),true);
 assert.equal(r.pita.round,1);assert.equal(r.pita.stage,'playing');
 assert.ok(r.pita.target>=10&&r.pita.target<=90);
 assert.equal(r.pita.profile.level,1);assert.equal(r.pita.profile.baseSafe,15);
 assert.equal(r.pita.speed,r.pita.profile.speed);
 assert.equal(pitaPosition(1000,50),50); // 旧APIの互換性は維持
 const t=timeFor(r.pita,e=>e===0);
 assert.equal(Math.round(pitaMotionAt(r.pita.profile,r.pita.initialMotion,t)),r.pita.target);
 for(let i=0;i<10;i++){
  assert.equal(pitaView(r,'p'+i).safe,15);
  assert.equal(pitaView(r,'p'+i).target,r.pita.target);
  assert.equal(pitaView(r,'p'+i).chargeLimit,350);
 }
});
test('全員の結果は揃うまで非公開。PERFECTは回復・妨害、MISSはライフ減少',()=>{
 const r=fixture(),g=r.pita;action(r,'p0','pita-begin');
 const perfect=timeFor(g,e=>e===0),miss=timeFor(g,e=>e>16);
 assert.equal(action(r,'p0','pita-stop',{elapsedMs:perfect}),true);
 assert.equal(action(r,'p0','pita-stop',{elapsedMs:perfect}),false);
 assert.deepEqual(pitaView(r,'p1').results,[]);
 assert.equal(pitaView(r,'p1').submittedCount,1);
 assert.equal(action(r,'p1','pita-stop',{elapsedMs:miss}),true);
 assert.equal(action(r,'p2','pita-stop',{elapsedMs:perfect}),true);
 assert.equal(g.stage,'review');assert.equal(g.results.length,3);
 assert.equal(g.results.find(v=>v.id==='p0').grade,'perfect');
 assert.equal(g.results.find(v=>v.id==='p0').special,true);
 assert.equal(g.results.find(v=>v.id==='p0').points>=100,true);
 assert.equal(g.results.find(v=>v.id==='p1').grade,'miss');
 assert.equal(g.lives.p0,3);assert.equal(g.lives.p1,2);assert.equal(g.lives.p2,3);
 assert.equal(g.nextPressure.p0,2);assert.equal(g.nextPressure.p1,3);
 assert.equal(g.nextPressure.p2,2);
 assert.equal(action(r,'p1','pita-next'),false);assert.equal(action(r,'p0','pita-next'),true);
 assert.equal(g.round,2);
 assert.equal(pitaView(r,'p0').pressure,2);assert.equal(pitaView(r,'p1').pressure,3);
 assert.equal(pitaView(r,'p1').safe,12);
});
test('GREAT以上3連続はSPECIAL、350点でゲージが回復になる',()=>{
 const r=fixture(2),g=r.pita;action(r,'p0','pita-begin');
 const great=timeFor(g,e=>e>=1&&e<=3);
 const miss=timeFor(g,e=>e>16);
 // 前回までGREAT系2連続・回復ゲージは満タン直前
 g.streaks.p0=2;g.charges.p0=349;g.lives.p0=1;
 action(r,'p0','pita-stop',{elapsedMs:great});
 action(r,'p1','pita-stop',{elapsedMs:miss});
 const a=g.results.find(v=>v.id==='p0');
 assert.equal(a.triple,true);assert.equal(a.special,true);
 assert.ok(a.chargeReward>=1);
 assert.ok(a.heal>=1);
 assert.equal(g.lives.p0,3);
 assert.equal(g.streaks.p0,0);
 assert.equal(g.charges.p0,a.charge);
});
test('KO・最大25ラウンド・同時全滅の判定、ホスト締切と無効な操作',()=>{
 const r=fixture(2),g=r.pita;action(r,'p0','pita-begin');
 assert.equal(action(r,'p0','pita-stop',{elapsedMs:-2}),false);
 assert.equal(action(r,'p0','pita-stop',{elapsedMs:18001}),false);
 assert.equal(action(r,'p1','pita-close'),false);
 assert.equal(action(r,'p0','pita-close'),false);
 g.startedAt=Date.now()-23000;
 assert.equal(action(r,'p0','pita-close'),true);
 assert.equal(g.stage,'review');
 assert.ok(g.results.every(row=>row.grade==='miss'&&row.timedOut));
 assert.equal(action(r,'p0','pita-next'),true);
 g.startedAt=Date.now()-23000;action(r,'p0','pita-close');action(r,'p0','pita-next');
 g.startedAt=Date.now()-23000;action(r,'p0','pita-close');
 assert.equal(g.lives.p0,0);assert.equal(g.lives.p1,0);
 assert.equal(g.finalRound,true);assert.ok(g.winnerIds.length>=1);
 action(r,'p0','pita-next');
 assert.equal(g.stage,'finished');
 assert.equal(action(r,'p0','pita-next'),false);
});
test('オンラインはオフライン演出を再利用して縦1画面・参加者結果・勝者画面を実装',()=>{
 const html=readFileSync(new URL('../online/pitadome-challenge/index.html',import.meta.url),'utf8');
 const js=readFileSync(new URL('../online/pitadome-challenge/game.js',import.meta.url),'utf8');
 const css=readFileSync(new URL('../online/pitadome-challenge/game.css',import.meta.url),'utf8');
 const lobby=readFileSync(new URL('../online/lobby.js',import.meta.url),'utf8');
 assert.doesNotThrow(()=>new Function(js));
 assert.ok(html.includes('versus/versus-rules.js'));
 assert.ok(html.includes('effects.css'));assert.ok(html.includes('effects.js'));
 assert.ok(html.includes('pitadome_challenge_logo.png'));
 assert.ok(css.includes('pitadome_challenge_background.png'));
 assert.ok(css.includes('height:100dvh'));assert.ok(css.includes('overflow:hidden'));
 assert.ok(css.includes('champ-particles'));assert.ok(css.includes('.pita-stop'));
 assert.ok(js.includes('FX.cutinHtml'));
 assert.ok(js.includes('回復ゲージ'));assert.ok(js.includes('GREAT'));
 assert.ok(lobby.includes("type:'pita-start'"));
 assert.ok(lobby.includes("room.phase==='pita'"));
});
test('Workerはホスト専用開始、個別情報、全員STOP後の結果、ロビー復帰',async()=>{
 const memory=new Map(),sockets=[];
 const storage={get:async k=>memory.get(k),put:async(k,v)=>memory.set(k,structuredClone(v)),
  setAlarm:async()=>{},deleteAll:async()=>memory.clear(),deleteAlarm:async()=>{}};
 const worker=new OnlineRoom({storage,getWebSockets:()=>sockets,blockConcurrencyWhile:cb=>cb()},{});
 const req=(path,body)=>new Request('https://internal'+path,{method:'POST',body:JSON.stringify(body)});
 const created=await(await worker.fetch(req('/create',{code:'ABCD2345',name:'host',gameId:'pitadome-challenge'}))).json();
 const joined=await(await worker.fetch(req('/join',{name:'guest'}))).json();
 const sock=id=>({events:[],deserializeAttachment(){return{id}},send(text){this.events.push(JSON.parse(text))},close(){}});
 const a=sock(created.id),b=sock(joined.id);sockets.push(a,b);
 const send=(s,command)=>worker.webSocketMessage(s,JSON.stringify(command));
 await send(a,{type:'ready',ready:true});await send(b,{type:'ready',ready:true});
 await send(b,{type:'pita-start'});assert.equal(worker.room.pita,undefined);
 await send(a,{type:'pita-start'});assert.equal(worker.snapshot().phase,'pita');
 assert.equal(worker.snapshot().pita,undefined);
 await send(b,{type:'pita-begin'});assert.equal(worker.room.pita.stage,'setup');
 await send(a,{type:'pita-begin'});assert.equal(worker.room.pita.stage,'playing');
 const ms=timeFor(worker.room.pita,e=>e===0);
 await send(a,{type:'pita-stop',elapsedMs:ms});
 assert.equal(worker.room.pita.stage,'playing');assert.equal(b.events.at(-1).room.pita.results.length,0);
 await send(b,{type:'pita-stop',elapsedMs:ms});
 assert.equal(worker.room.pita.stage,'review');assert.equal(b.events.at(-1).room.pita.results.length,2);
 await send(a,{type:'pita-stop-game'});
 assert.equal(worker.snapshot().phase,'lobby');assert.ok(worker.room.members.every(x=>x.ready===false));
});
