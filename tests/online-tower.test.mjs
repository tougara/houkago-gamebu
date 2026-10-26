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
 assert.equal(guest.myHand&&Object.values(guest.myHand).reduce((a,b)=>a+b,0),12);
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

test('online tower uses a single gameplay viewport with compact action-first flow',()=>{
 const html=readFileSync(new URL('../online/kyokasho-tower/index.html',import.meta.url),'utf8');
 const js=readFileSync(new URL('../online/kyokasho-tower/game.js',import.meta.url),'utf8');
 const css=readFileSync(new URL('../online/kyokasho-tower/game.css',import.meta.url),'utf8');
 assert.doesNotThrow(()=>new Function(js));
 assert.match(css,/\.tower-online\[data-stage="playing"\]\{[^}]*height:100dvh/);
 assert.match(css,/\.tower-play-screen\{[^}]*grid-template-rows:auto minmax\(0,1fr\) auto/);
 assert.match(css,/\.tower-play-screen \.board-panel\{[^}]*grid-template-rows:auto minmax\(0,1fr\)/);
 assert.match(js,/class="tower-more"/);
 assert.match(js,/順位・詳細/);
 assert.match(js,/tower-more-popover/);
 assert.doesNotMatch(js,/tower-wait-footer/);
 assert.match(js,/summary\+board\(g,editable\)\+hand\(g,editable\)/);
 assert.match(js,/fitTowerBoard\(\)/);
 assert.match(js,/height\/\(rows\+\.12\)/);
 assert.match(js,/\.setAttribute\('data-stage',g\.stage\)/);
 assert.match(css,/body:has\(\.hog-demo-tools\) \.tower-online\[data-stage="playing"\]/);
 assert.match(html,/game\.css\?v=20261026-waiting-hand1/);
 assert.match(html,/game\.js\?v=20261026-waiting-hand1/);
 assert.match(js,/tower-quick-rules/);
 assert.match(js,/詳しいルールを見る/);
});
test('online board aligns every slot to the same x origin and shrinks targets inside a cell',()=>{
 const js=readFileSync(new URL('../online/kyokasho-tower/game.js',import.meta.url),'utf8');
 const css=readFileSync(new URL('../online/kyokasho-tower/game.css',import.meta.url),'utf8');
 const start=js.indexOf('function board(g,editable=false){');
 const end=js.indexOf('\nfunction members(g)',start);
 assert.ok(start>=0&&end>start);
 const lookup={
  japanese:{image:'j.png',name:'国語'},math:{image:'m.png',name:'算数'},
  science:{image:'s.png',name:'理科'},social:{image:'h.png',name:'社会'},english:{image:'e.png',name:'英語'}
 };
 const makeBoard=new Function('g','selected','pending','lookup','esc',js.slice(start,end)+'return board(g,true);');
 const sample={
  bottom:{count:3,min:0,max:2},
  board:[{level:0,x:0,subject:'math'},{level:0,x:1,subject:'social'},{level:0,x:2,subject:'english'}],
  choices:{math:[{level:0,x:-1},{level:0,x:3},{level:1,x:0}]}
 };
 const markup=makeBoard(sample,'math',null,lookup,x=>x);
 assert.match(markup,/--tower-columns:5/);
 assert.match(markup,/class="tower-cell candidate" style="--offset:0"/);
 assert.match(markup,/class="tower-cell candidate" style="--offset:4"/);
 assert.match(markup,/class="tower-cell candidate" style="--offset:1\.5"/);
 assert.equal((markup.match(/class="tower-cell book"/g)||[]).length,3);
 assert.equal((markup.match(/class="slot"/g)||[]).length,3);
 assert.match(css,/\.tower-cell\{[^}]*position:absolute/);
 assert.match(css,/left:calc\(var\(--offset\) \* var\(--tile\)\)/);
 assert.match(css,/\.tower-cell \.slot\{[^}]*width:calc\(var\(--tile\) - 6px\)/);
 assert.match(css,/\.tower-cell\.book img\.tower-book,[^}]*width:calc\(var\(--tile\) - 2px\)/);
 const preview=makeBoard(sample,'math',{level:1,x:0},lookup,x=>x);
 assert.match(preview,/class="tower-cell candidate-preview" style="--offset:1\.5"/);
 assert.match(preview,/class="slot preview"/);
 const full={...sample,bottom:{count:8,min:0,max:7},
  board:Array.from({length:8},(_,i)=>({level:0,x:i,subject:'math'})),
  choices:{math:[{level:1,x:0}]}};
 const fullMarkup=makeBoard(full,'math',null,lookup,x=>x);
 assert.match(fullMarkup,/--tower-columns:8/);
 assert.doesNotMatch(fullMarkup,/data-x="-1"/);
 assert.doesNotMatch(fullMarkup,/data-x="8"/);
 const empty=makeBoard({bottom:{count:0,min:0,max:-1},board:[],choices:{math:[{level:0,x:0}]}},'math',null,lookup,x=>x);
 assert.match(empty,/--tower-columns:1/);
 assert.match(empty,/data-level="0" data-x="0"/);
});
test('online play hides repetitive status panels, keeping personal actions and confidentiality',()=>{
 const js=readFileSync(new URL('../online/kyokasho-tower/game.js',import.meta.url),'utf8');
 const start=js.indexOf('function playing(g){'),end=js.indexOf('\nfunction result(g){',start);
 assert.ok(start>=0&&end>start);
 const play=new Function('g','person','pname','members','board','hand','playedEvent',js.slice(start,end)+'return playing(g);');
 const data={myTurn:true,currentId:'p0',members:[{id:'p0',name:'本人',icon:'🐶',cards:8,score:0}],
  round:1,totalRounds:3,bottom:{count:2},movesMade:2,lastEvent:{kind:'placed'}};
 const render=editable=>play({...data,myTurn:editable},
  ()=>data.members[0],()=> '🐶 本人',()=>'<div class="member-list">点数</div>',
  ()=>'<section class="board-panel">タワー</section>',()=>'<section class="hand-panel">手札</section>',
  ()=>'<div>前回の手番</div>');
 const self=render(true);
 assert.equal((self.match(/board-panel/g)||[]).length,1);
 assert.equal((self.match(/hand-panel/g)||[]).length,1);
 assert.match(self,/tower-play-screen is-my-turn/);
 assert.match(self,/class="tower-more"/);
 assert.ok(self.indexOf('board-panel')<self.indexOf('hand-panel'));
 const waiting=render(false);
 assert.match(waiting,/is-waiting/);
 assert.doesNotMatch(waiting,/自分の手札を見る/);
 assert.match(waiting,/class="hand-panel"/);
 assert.equal((waiting.match(/hand-panel/g)||[]).length,1);
 assert.equal((waiting.match(/board-panel/g)||[]).length,1);
 assert.ok(waiting.indexOf('board-panel')<waiting.indexOf('hand-panel'));
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

test('online waiting hand remains openly visible while placement is disabled',()=>{
 const js=readFileSync(new URL('../online/kyokasho-tower/game.js',import.meta.url),'utf8');
 const css=readFileSync(new URL('../online/kyokasho-tower/game.css',import.meta.url),'utf8');
 const start=js.indexOf('function hand(g,editable){'),end=js.indexOf('\nfunction setup(g){',start);
 assert.ok(start>=0&&end>start);
 const subjects=TOWER_SUBJECTS.map(s=>({key:s.key,name:s.label,image:'../../textbook_'+s.key+'.png'}));
 const esc=s=>s,lookup=Object.fromEntries(subjects.map(s=>[s.key,s]));
 const hand=new Function('g','editable','selected','pending','subjects','esc','lookup','btn',
  js.slice(start,end)+'return hand(g,editable);');
 const myHand={japanese:2,math:0,science:3,social:1,english:0};
 const g={myHand,choices:null,myTurn:false};
 const markup=hand(g,false,null,null,subjects,esc,lookup,()=>'<button></button>');
 assert.match(markup,/class="panel hand-panel"/);
 assert.match(markup,/自分の番まで確認できます/);
 assert.equal((markup.match(/data-subject=/g)||[]).length,5);
 assert.equal((markup.match(/disabled/g)||[]).length,5);
 assert.equal((markup.match(/has-cards/g)||[]).length,3);
 assert.match(markup,/×3/);
 assert.doesNotMatch(markup,/place-confirm|ここに置く/);
 assert.match(css,/\.tower-play-screen\.is-waiting \.hand-book\.has-cards:disabled/);
 assert.match(css,/\.tower-play-screen\{[^}]*grid-template-rows:auto minmax\(0,1fr\) auto/);
});
