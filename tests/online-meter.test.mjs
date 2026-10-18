import {test} from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {createMeter,meterAction,meterView,meterScore,generateMeterNumbers,METER_CATEGORIES} from '../worker/src/meter-engine.js';
import {KANKAKU_QUESTIONS} from '../worker/src/meter-questions.js';
import {OnlineRoom} from '../worker/src/index.js';
if(!globalThis.crypto)globalThis.crypto=webcrypto;
const make=n=>{
 const room={hostId:'p0',members:Array.from({length:n},(_,i)=>({id:'p'+i,name:'人'+i,icon:'🐱'}))};
 room.meter=createMeter(room);return room;
};
const act=(r,id,type,extra={})=>meterAction(r,id,{type,...extra});
test('same offline question database, eight categories and three difficulty distributions',()=>{
 assert.equal(METER_CATEGORIES.length,8);
 assert.ok(Object.values(KANKAKU_QUESTIONS).every(a=>a.length>=5&&a.every(t=>t.length===3)));
 for(const mode of ['easy','normal','hard']){
  for(const n of [2,3,5,10]){
   const a=generateMeterNumbers(n,mode);
   assert.equal(a.length,n);assert.equal(new Set(a).size,n);
   assert.ok(a.every(x=>Number.isInteger(x)&&x>=1&&x<=100));
  }
 }
 assert.equal(meterScore(['c','b','a'],{a:10,b:50,c:90}),100);
 assert.equal(meterScore(['a','b','c'],{a:10,b:50,c:90}),0);
 assert.equal(meterScore(['c','a','b'],{a:10,b:50,c:90}),67);
});
test('host-only configuration, categories, custom questions, no empty topic and 2–10 players',()=>{
 for(let n=2;n<=10;n++){
  const r=make(n);
  assert.equal(meterView(r,'p0').stage,'setup');
  assert.equal(act(r,'p1','meter-begin'),false);
  assert.equal(act(r,'p1','meter-config',{settings:{difficulty:'hard',roundCount:3,categories:METER_CATEGORIES}}),false);
  assert.equal(act(r,'p0','meter-config',{settings:{difficulty:'hard',roundCount:3,categories:[]}}),false);
  assert.equal(act(r,'p0','meter-config',{settings:{difficulty:'easy',roundCount:3,categories:[METER_CATEGORIES[0]]}}),true);
  assert.equal(act(r,'p1','meter-add-topic',{topic:{q:'何？',low:'だめ',high:'すごい'}}),false);
  assert.equal(act(r,'p0','meter-add-topic',{topic:{q:'好きな場所',low:'行かない',high:'毎日行く'}}),true);
  assert.equal(act(r,'p0','meter-begin'),true);
  assert.equal(meterView(r,'p0').stage,'preview');
  assert.equal(meterView(r,'p1').myNumber,null);
 }
});
test('strictly personal numbers until host reveals and collective ordering follows offline score',()=>{
 const r=make(4);
 assert.equal(act(r,'p0','meter-begin'),true);
 assert.equal(act(r,'p1','meter-change-topic'),false);
 assert.equal(act(r,'p0','meter-use-topic',{topic:{q:'A',low:'嫌い',high:'大好き'}}),true);
 assert.equal(act(r,'p0','meter-deal'),true);
 assert.equal(r.meter.stage,'reveal');
 for(let i=0;i<4;i++){
  const d=meterView(r,'p'+i);
  assert.ok(d.myNumber>=1&&d.myNumber<=100);
  assert.equal(d.shownNumbers,null);
  assert.equal(d.roundScore,null);
  assert.equal(d.correctOrder.length,0);
 }
 assert.equal(act(r,'p1','meter-seen'),true);
 assert.equal(act(r,'p1','meter-seen'),false);
 assert.equal(r.meter.stage,'reveal');
 for(const id of ['p0','p2','p3'])assert.equal(act(r,id,'meter-seen'),true);
 assert.equal(r.meter.stage,'arrange');
 assert.equal(act(r,'p1','meter-swap',{index:0,direction:1}),false);
 assert.equal(act(r,'p0','meter-order',{order:['p0','p0','p1','p2']}),false);
 const order=Object.keys(r.meter.numbers).sort((a,b)=>r.meter.numbers[b]-r.meter.numbers[a]);
 assert.equal(act(r,'p0','meter-order',{order}),true);
 assert.equal(act(r,'p1','meter-finalize'),false);
 assert.equal(act(r,'p0','meter-finalize'),true);
 assert.equal(r.meter.roundScore,100);
 for(const id of ['p0','p1','p2','p3']){
  const d=meterView(r,id);
  assert.equal(d.roundScore,null);
  assert.equal(d.myNumber,null);
  assert.deepEqual(d.shownNumbers,{});
 }
 assert.equal(act(r,'p0','meter-next'),false);
 assert.equal(act(r,'p1','meter-show',{memberId:'p1'}),false);
 assert.equal(act(r,'p0','meter-show',{memberId:'p1'}),true);
 assert.equal(act(r,'p0','meter-show',{memberId:'p1'}),false);
 assert.deepEqual(meterView(r,'p2').shownNumbers,{p1:r.meter.numbers.p1});
 for(const id of ['p0','p2','p3'])assert.equal(act(r,'p0','meter-show',{memberId:id}),true);
 assert.equal(meterView(r,'p1').roundScore,100);
 assert.deepEqual(meterView(r,'p1').correctOrder,order);
});
test('three full rounds end in final cooperative score',()=>{
 const r=make(3);
 assert.equal(act(r,'p0','meter-config',{settings:{difficulty:'normal',roundCount:3,categories:METER_CATEGORIES}}),true);
 assert.equal(act(r,'p0','meter-begin'),true);
 for(let round=1;round<=3;round++){
  assert.equal(act(r,'p0','meter-deal'),true);
  for(const id of r.meter.memberIds)assert.equal(act(r,id,'meter-seen'),true);
  const sort=[...r.meter.memberIds].sort((a,b)=>r.meter.numbers[b]-r.meter.numbers[a]);
  assert.equal(act(r,'p0','meter-order',{order:sort}),true);
  assert.equal(act(r,'p0','meter-finalize'),true);
  for(const id of r.meter.memberIds)assert.equal(act(r,'p0','meter-show',{memberId:id}),true);
  assert.equal(act(r,'p0','meter-next'),true);
  assert.equal(r.meter.stage,round===3?'finished':'preview');
 }
 assert.equal(r.meter.totalScore,300);
 assert.deepEqual(meterView(r,'p1').scores,[100,100,100]);
 assert.equal(meterView(r,'p1').myNumber,null);
});
test('online route, controls, offline art and browser script parse',()=>{
 const html=readFileSync(new URL('../online/kankaku-meter/index.html',import.meta.url),'utf8');
 const game=readFileSync(new URL('../online/kankaku-meter/game.js',import.meta.url),'utf8');
 const style=readFileSync(new URL('../online/kankaku-meter/game.css',import.meta.url),'utf8');
 const lobby=readFileSync(new URL('../online/lobby.js',import.meta.url),'utf8');
 assert.doesNotThrow(()=>new Function(game));
 assert.ok(html.includes('../shared-ui.js'));
 assert.ok(html.includes('kankaku_meter_logo.png'));
 assert.ok(style.includes('kankaku_meter_background.png'));
 assert.ok(lobby.includes("type:'meter-start'"));
 assert.ok(lobby.includes("room.phase==='meter'"));
 assert.ok(game.includes("send('meter-finalize')"));
});
test('room Worker keeps per-member numbers private and returns to lobby after host stop',async()=>{
 const data=new Map(),sockets=[];
 const storage={get:async k=>data.get(k),put:async(k,v)=>data.set(k,structuredClone(v)),setAlarm:async()=>{},deleteAll:async()=>data.clear(),deleteAlarm:async()=>{}};
 const ctx={storage,getWebSockets:()=>sockets,blockConcurrencyWhile:cb=>cb()};
 const worker=new OnlineRoom(ctx,{});
 const req=(path,payload)=>new Request('https://internal'+path,{method:'POST',body:JSON.stringify(payload)});
 const a=await (await worker.fetch(req('/create',{code:'ABCD2345',name:'Host',gameId:'kankaku-meter'}))).json();
 const b=await (await worker.fetch(req('/join',{name:'Guest'}))).json();
 const socket=id=>({events:[],deserializeAttachment(){return{id}},send(t){this.events.push(JSON.parse(t))},close(){}});
 const host=socket(a.id),guest=socket(b.id);sockets.push(host,guest);
 const send=(s,type,extra={})=>worker.webSocketMessage(s,JSON.stringify({type,...extra}));
 await send(host,'ready',{ready:true});await send(guest,'ready',{ready:true});
 await send(guest,'meter-start');assert.equal(worker.room.meter,undefined);
 await send(host,'meter-start');assert.equal(worker.snapshot().phase,'meter');
 assert.equal(worker.snapshot().meter,undefined);
 await send(host,'meter-begin');
 await send(host,'meter-deal');
 const h=host.events.at(-1).room.meter,g=guest.events.at(-1).room.meter;
 assert.equal(h.stage,'reveal');assert.equal(g.stage,'reveal');
 assert.notEqual(h.myNumber,g.myNumber);
 assert.equal(h.shownNumbers,null);assert.equal(g.shownNumbers,null);
 assert.ok(!('numbers' in h)&&!('numbers' in g));
 assert.equal((await worker.fetch(req('/join',{name:'Late'}))).status,409);
 await send(guest,'meter-seen');await send(host,'meter-seen');
 assert.equal(worker.room.meter.stage,'arrange');
 await send(host,'meter-stop');
 assert.equal(worker.snapshot().phase,'lobby');
 assert.ok(worker.room.members.every(x=>!x.ready));
});
