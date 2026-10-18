import {test} from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {createTower,towerAction,towerView,towerLegal,towerBottom,towerDeck,TOWER_SUBJECTS} from '../worker/src/tower-engine.js';
import {OnlineRoom} from '../worker/src/index.js';
if(!globalThis.crypto)globalThis.crypto=webcrypto;
const fixture=n=>{
 const room={hostId:'p0',members:Array.from({length:n},(_,i)=>({id:'p'+i,name:'人'+i,icon:'🐶'}))};
 room.tower=createTower(room);return room;
};
const act=(room,id,type,other={})=>towerAction(room,id,{type,...other});
test('offline deck has 36 books with original subject counts; rounds equal player count',()=>{
 const deck=towerDeck();assert.equal(deck.length,36);
 for(const s of TOWER_SUBJECTS)assert.equal(deck.filter(k=>k===s.key).length,s.count);
 for(let n=2;n<=6;n++){
  const r=fixture(n);assert.equal(r.tower.totalRounds,n);
  assert.equal(act(r,'p1','tower-begin'),false);
  assert.equal(act(r,'p0','tower-begin'),true);
  assert.equal(r.tower.round,0);assert.equal(r.tower.stage,'roundIntro');
  const counts=Object.values(r.tower.hands).map(h=>Object.values(h).reduce((a,b)=>a+b,0));
  assert.equal(counts.reduce((a,b)=>a+b,0)+(n===5?1:0),36);
  assert.ok(counts.every(v=>v===(n===5?7:36/n)));
  assert.equal(r.tower.board['0,0']!==undefined,n===5);
  assert.equal(r.tower.startId,'p0');
 }
});
test('legal placement is symmetric until eight base books, upper books need matching support',()=>{
 const b={};
 assert.deepEqual(towerLegal(b,'japanese'),[{level:0,x:0}]);
 b['0,0']='math';
 assert.deepEqual(towerLegal(b,'english'),[{level:0,x:-1},{level:0,x:1}]);
 b['0,1']='english';
 assert.deepEqual(towerLegal(b,'english'),[
  {level:0,x:-1},{level:0,x:2},{level:1,x:0}
 ]);
 assert.deepEqual(towerLegal(b,'science').filter(p=>p.level===1),[]);
 b['1,0']='english';
 assert.deepEqual(towerLegal(b,'english').filter(p=>p.level===1),[]);
 for(let x=2;x<8;x++)b['0,'+x]='science';
 assert.equal(towerBottom(b).count,8);
 assert.equal(towerLegal(b,'science').some(p=>p.level===0),false);
 assert.ok(towerLegal(b,'science').some(p=>p.level===1));
 assert.equal(towerLegal(b,'invalid').length,0);
});
test('only current owner can place; board visible but every other hand remains confidential',()=>{
 const r=fixture(3);act(r,'p0','tower-begin');
 assert.equal(act(r,'p1','tower-round-start'),false);
 assert.equal(act(r,'p0','tower-round-start'),true);
 const id=r.tower.currentId,s=TOWER_SUBJECTS.find(s=>r.tower.hands[id][s.key]>0).key;
 assert.equal(act(r,'p1','tower-place',{subject:s,level:0,x:0}),false);
 assert.equal(act(r,id,'tower-place',{subject:s,level:7,x:0}),false);
 assert.equal(act(r,id,'tower-place',{subject:s,level:0,x:0}),true);
 assert.equal(r.tower.board['0,0'],s);
 assert.equal(act(r,id,'tower-place',{subject:s,level:0,x:1}),false);
 const guest=towerView(r,'p1'),host=towerView(r,'p0');
 assert.equal(guest.board.length,host.board.length);
 assert.ok(!('hands' in guest)&&!('hands' in host));
 assert.equal(guest.myHand&&Object.values(guest.myHand).reduce((a,b)=>a+b,0),11);
 assert.equal(host.myHand&&Object.values(host.myHand).reduce((a,b)=>a+b,0),11);
 assert.equal(guest.members[0].cards,11);
 assert.equal(guest.choices===null,guest.currentId!=='p1');
});
test('complete two to six person games safely with legal automatic turn settlement and ranked result',()=>{
 for(let n=2;n<=6;n++){
  const r=fixture(n);act(r,'p0','tower-begin');
  for(let round=0;round<n;round++){
   assert.equal(r.tower.stage,'roundIntro');
   assert.equal(r.tower.startId,'p'+round);
   assert.equal(act(r,'p0','tower-round-start'),true);
   let safety=0;
   while(r.tower.stage==='playing'){
    if(++safety>50)throw Error('round did not finish '+n+'/'+round);
    const id=r.tower.currentId;
    const view=towerView(r,id);
    assert.equal(view.myTurn,true);
    const subject=TOWER_SUBJECTS.find(s=>(view.choices?.[s.key]||[]).length>0)?.key;
    assert.ok(subject,'current player must have legal move');
    const target=view.choices[subject][0];
    assert.equal(act(r,id,'tower-place',{subject,...target}),true);
   }
   assert.equal(r.tower.stage,'roundResult');
   assert.equal(Object.keys(r.tower.outcomes).length,n);
   assert.equal(act(r,'p1','tower-next'),false);
   assert.equal(act(r,'p0','tower-next'),true);
  }
  assert.equal(r.tower.stage,'finished');
  const ranking=towerView(r,'p1').rankings;
  assert.equal(ranking.length,n);
  assert.ok(ranking.every((a,i)=>i===0||ranking[i-1].score<=a.score));
  assert.equal(Object.values(r.tower.penalties).every(x=>x>=0),true);
 }
});
test('clearing a hand reduces prior penalties by no more than two',()=>{
 const r=fixture(2);act(r,'p0','tower-begin');act(r,'p0','tower-round-start');
 r.tower.penalties.p0=4;
 r.tower.hands.p0={japanese:1,math:0,science:0,social:0,english:0};
 r.tower.board={};r.tower.currentId='p0';r.tower.active=['p0','p1'];
 assert.equal(act(r,'p0','tower-place',{subject:'japanese',level:0,x:0}),true);
 assert.equal(r.tower.penalties.p0,2);
 assert.deepEqual(r.tower.outcomes.p0,{kind:'clear',returned:2,delta:-2});
 assert.equal(r.tower.active.includes('p0'),false);
});
test('web frontend routes, has offline visuals, and JS parses',()=>{
 const html=readFileSync(new URL('../online/kyokasho-tower/index.html',import.meta.url),'utf8');
 const game=readFileSync(new URL('../online/kyokasho-tower/game.js',import.meta.url),'utf8');
 const css=readFileSync(new URL('../online/kyokasho-tower/game.css',import.meta.url),'utf8');
 const lobby=readFileSync(new URL('../online/lobby.js',import.meta.url),'utf8');
 assert.doesNotThrow(()=>new Function(game));
 assert.ok(html.includes('../shared-ui.js'));
 assert.ok(html.includes('kyokasho_tower_logo.png'));
 assert.ok(css.includes('kyokasho_tower_background.png'));
 assert.ok(css.includes('.tower-board'));
 assert.ok(game.includes("send('tower-place'"));
 assert.ok(lobby.includes("type:'tower-start'"));
 assert.ok(lobby.includes("room.phase==='tower'"));
});
test('Worker routes actions and broadcasts only caller hand, rejects late joins, returns to lobby',async()=>{
 const state=new Map(),sockets=[];
 const storage={get:async key=>state.get(key),put:async(key,value)=>state.set(key,structuredClone(value)),
  setAlarm:async()=>{},deleteAll:async()=>state.clear(),deleteAlarm:async()=>{}};
 const worker=new OnlineRoom({storage,getWebSockets:()=>sockets,blockConcurrencyWhile:fn=>fn()},{});
 const req=(path,body)=>new Request('https://internal'+path,{method:'POST',body:JSON.stringify(body)});
 const a=await (await worker.fetch(req('/create',{code:'ABCD2345',name:'A',gameId:'kyokasho-tower'}))).json();
 const b=await (await worker.fetch(req('/join',{name:'B'}))).json();
 const socket=id=>({events:[],deserializeAttachment(){return{id}},send(t){this.events.push(JSON.parse(t))},close(){}});
 const p0=socket(a.id),p1=socket(b.id);sockets.push(p0,p1);
 const send=(sock,type,props={})=>worker.webSocketMessage(sock,JSON.stringify({type,...props}));
 for(const s of [p0,p1])await send(s,'ready',{ready:true});
 await send(p1,'tower-start');assert.equal(worker.room.tower,undefined);
 await send(p0,'tower-start');assert.equal(worker.snapshot().phase,'tower');
 assert.equal(worker.snapshot().tower,undefined);
 await send(p0,'tower-begin');await send(p0,'tower-round-start');
 const x=p0.events.at(-1).room.tower,y=p1.events.at(-1).room.tower;
 assert.ok(x.myHand&&y.myHand);
 assert.equal(x.members.length,2);
 assert.notDeepEqual(x.myHand,y.myHand);
 assert.ok(!('hands' in x)&&!('hands' in y));
 assert.equal((await worker.fetch(req('/join',{name:'C'}))).status,409);
 await send(p0,'tower-stop');
 assert.equal(worker.snapshot().phase,'lobby');
 assert.ok(worker.room.members.every(m=>!m.ready));
});
