import {test} from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {linkEngine as E} from '../worker/src/link-engine.js';
import {createLink,linkAction,advanceLink,linkView,interruptLink} from '../worker/src/link-game.js';
import {OnlineRoom} from '../worker/src/index.js';
if(!globalThis.crypto)globalThis.crypto=webcrypto;
const make=()=>{
 const r={hostId:'p0',members:[
  {id:'p0',name:'P1',icon:'🐶'},{id:'p1',name:'P2',icon:'🐱'}
 ]};
 r.link=createLink(r);return r;
};
const act=(r,id,type,other={})=>linkAction(r,id,{type,...other});
const startPlaying=g=>{for(let i=0;i<70;i++)advanceLink(g,50);assert.equal(g.stage,'playing')};
test('online engine maintains original 7x13 visible board, deterministic shared pairs and scoring',()=>{
 assert.equal(E.COLS,7);assert.equal(E.ROWS,15);assert.equal(E.HIDDEN,2);
 const a=E.make(null,7893),b=E.make(null,7893);
 assert.deepEqual(a.piece,b.piece);assert.deepEqual(a.queue,b.queue);
 assert.equal(a.pairIndex,b.pairIndex);
 assert.equal(E.attackFor(2,1,0),4);
 assert.equal(E.attackFor(3,1,0),11);
 assert.equal(E.attackFor(4,1,0),24);
 assert.equal(E.attackFor(3,1,240000),16);
 assert.equal(E.jamWaveSize({elapsedMs:0}),14);
 assert.equal(E.jamWaveSize({elapsedMs:180000}),28);
});
test('host starts and clients see same blocks with their own perspective',()=>{
 const r=make();
 assert.equal(act(r,'p1','link-begin'),false);
 assert.equal(act(r,'p0','link-begin'),true);
 const g=r.link;
 assert.equal(g.stage,'countdown');
 assert.deepEqual(g.states.p0.piece,g.states.p1.piece);
 assert.deepEqual(g.states.p0.queue,g.states.p1.queue);
 const s=structuredClone(g);assert.equal(s.states.p0.pairSeed,g.seed);
 assert.equal(act(r,'p0','link-control',{action:'left',pressed:true}),false);
 for(let i=0;i<70;i++)advanceLink(g,50);
 assert.equal(g.stage,'playing');
 assert.equal(linkView(r,'p0').self.board.length,13);
 assert.equal(linkView(r,'p0').opponent.board.length,13);
 assert.equal(linkView(r,'p1').meId,'p1');
 assert.equal(linkView(r,'p1').opponentId,'p0');
 assert.ok(!('controls' in linkView(r,'p0')));
 assert.ok(!('states' in linkView(r,'p1')));
 assert.equal(act(r,'p0','link-control',{action:'left',pressed:true}),true);
 assert.equal(act(r,'p0','link-control',{action:'left',pressed:true}),false);
 assert.equal(act(r,'p1','link-control',{action:'right',pressed:true}),true);
 assert.ok(g.states.p0.piece.x<3&&g.states.p1.piece.x>3);
 assert.equal(act(r,'p0','link-control',{action:'left',pressed:false}),true);
 assert.equal(act(r,'p1','link-control',{action:'right',pressed:false}),true);
 assert.equal(act(r,'p0','link-control',{action:'invalid',pressed:true}),false);
});
test('JAM cancels incoming, transfers to opponent, and both see their own HUD',()=>{
 const r=make();act(r,'p0','link-begin');
 const g=r.link;startPlaying(g);
 const a=g.states.p0,b=g.states.p1;
 E.queueJam(a,3);
 a.phase='interturn';a.piece=null;a.readyAttack=11;
 b.phase='falling';b.readyAttack=0;
 advanceLink(g,50);
 assert.equal(E.incomingCount(a),0);
 assert.equal(E.incomingCount(b),8);
 assert.equal(a.sentJam,8);
 assert.equal(a.counteredJam,3);
 assert.equal(linkView(r,'p1').self.incoming,8);
});
test('a disconnected duel pauses and supports host-only resume without changing boards',()=>{
 const r=make();act(r,'p0','link-begin');
 startPlaying(r.link);const before=r.link.states.p0.board.map(row=>row.slice());
 assert.equal(interruptLink(r.link),true);
 assert.equal(r.link.stage,'interrupted');
 assert.equal(act(r,'p1','link-resume'),false);
 assert.equal(act(r,'p0','link-control',{action:'left',pressed:true}),false);
 assert.equal(act(r,'p0','link-resume'),true);
 assert.deepEqual(r.link.states.p0.board,before);
 assert.equal(r.link.stage,'countdown');
});
test('server game outcome keeps current boards; simultaneous knockout produces draw',()=>{
 const r=make();act(r,'p0','link-begin');
 startPlaying(r.link);
 r.link.states.p0.over=true;r.link.states.p1.over=true;
 advanceLink(r.link,50);
 assert.equal(r.link.stage,'finished');
 assert.deepEqual(linkView(r,'p0').winners,[]);
 const t=make();act(t,'p0','link-begin');startPlaying(t.link);
 t.link.states.p0.over=true;advanceLink(t.link,50);
 assert.deepEqual(linkView(t,'p1').winners,['p1']);
 assert.equal(linkView(t,'p0').self.over,true);
});
test('Online Link Burst adopts exact offline solo visual system on phone, tablet and PC',()=>{
 const game=readFileSync(new URL('../online/link-burst/game.js',import.meta.url),'utf8');
 const css=readFileSync(new URL('../online/link-burst/game.css',import.meta.url),'utf8');
 const html=readFileSync(new URL('../online/link-burst/index.html',import.meta.url),'utf8');
 const soloCss=readFileSync(new URL('../games/link-burst/game.css',import.meta.url),'utf8');
 const lobby=readFileSync(new URL('../online/lobby.js',import.meta.url),'utf8');
 assert.doesNotThrow(()=>new Function(game));
 assert.ok(game.includes('data-action="begin">対戦開始</button>'));
 assert.ok(game.includes('data-action="resume">対戦再開</button>'));
 assert.ok(!game.includes('3・2・1 スタート'));
 assert.ok(!game.includes('3・2・1 で再開'));
 // Own playfield and player controls remain portrait first.
 assert.match(css,/grid-template-columns:var\(--rail-left\) minmax\(0,1fr\) var\(--rail-right\)/);
 assert.match(css,/\.me-area,\.me-top\{display:contents\}/);
 assert.match(css,/\.left-rail\{[\s\S]*?grid-column:1;grid-row:1/);
 assert.match(css,/\.me-board-wrap\{[\s\S]*?grid-column:2;grid-row:1/);
 assert.match(css,/\.side\{[\s\S]*?grid-column:3;grid-row:1/);
 assert.match(css,/\.controls\{[\s\S]*?grid-column:1\/-1;grid-row:2/);
 assert.match(css,/\.opponent-board\{[\s\S]*?aspect-ratio:7\/13/);
 assert.match(css,/\.me-board-wrap\{[\s\S]*?aspect-ratio:7\/13/);
 assert.match(css,/background_vertical\.png/);
 assert.match(css,/@media\(max-width:380px\)/);
 assert.match(css,/@media\(max-height:520px\)/);
 assert.match(css,/@media\(min-width:900px\)/);
 // Offline playfield: subtle transparent cells, 7x13 with solo frame.
 assert.match(css,/grid-template-columns:repeat\(7,minmax\(0,1fr\)\)/);
 assert.match(css,/grid-template-rows:repeat\(13,minmax\(0,1fr\)\)/);
 assert.match(css,/background:rgba\(103,146,204,.095\)/);
 assert.match(css,/border:2px solid rgba\(126,224,255,.70\)/);
 assert.match(soloCss,/background:rgba\(103,146,204,.095\)/);
 assert.match(soloCss,/border:2px solid rgba\(126,224,255,.64\)/);
 // Original offline console: navy keys, two-button top row, long drop & tall rotate.
 assert.match(css,/background:linear-gradient\(158deg,#364b70/);
 assert.match(css,/\.control\[data-key="left"\]\{grid-column:1;grid-row:1\}/);
 assert.match(css,/\.control\[data-key="right"\]\{grid-column:2;grid-row:1\}/);
 assert.match(css,/\.control\[data-key="down"\]\{[\s\S]*?grid-column:1\/3;grid-row:2/);
 assert.match(css,/\.control\[data-key="rotate"\]\{[\s\S]*?grid-column:3;grid-row:1\/3/);
 for(const label of ['LEFT','RIGHT','DROP','ROTATE'])assert.match(css,new RegExp('content:"'+label+'"'));
 // NEXT is upper left and vertical, then English-only score labels.
 for(const label of ['NEXT','NEXT 2','SCORE','MAX LINK','SEND JAM','RECEIVE JAM','BATTLE STATUS'])
  assert.ok(game.includes(label),label);
 for(const japanese of ['<small>得点</small>','<small>送信JAM</small>'])
  assert.ok(!game.includes(japanese));
 assert.ok(game.indexOf('class="me-rail"')<game.indexOf('class="me-stats"'));
 assert.ok(game.indexOf('class="me-stats"')<game.indexOf('class="me-board-wrap"'));
 assert.ok(game.indexOf('class="opponent-board"')<game.indexOf('class="right-summary"'));
 assert.match(css,/\.pair\{display:flex;flex-direction:column/);
 assert.match(game,/function pairPiece\(piece\)[\s\S]*symbols=/);
 // Same full-screen, giant 3-2-1 treatment as offline solo.
 assert.match(game,/class="lb-countdown-overlay"/);
 assert.match(css,/\.lb-countdown-overlay\{[\s\S]*?position:fixed;inset:0/);
 assert.match(css,/font-size:clamp\(104px,32vw,170px\)/);
 assert.match(soloCss,/font-size:clamp\(104px,32vw,170px\)/);
 assert.match(game,/g.countdown>500\?String\(Math.max\(1,Math.ceil\(\(g.countdown-500\)\/1000\)\)\):'START!'/);
 assert.doesNotMatch(game,/スマホを横向きにしてね|overlay-portrait/);
 assert.ok(html.includes('game.css?v=20261020-solo2'));
 assert.ok(html.includes('game.js?v=20261020-solo2'));
 assert.ok(html.includes('../shared-ui.js'));
 assert.ok(lobby.includes("type:'link-start'"));
 assert.ok(lobby.includes("room.phase==='link'"));
});
test('online room prevents third player, wrong host start, and cleans up after stop',async()=>{
 const state=new Map(),sockets=[];
 const storage={get:async key=>state.get(key),put:async(key,value)=>state.set(key,structuredClone(value)),setAlarm:async()=>{},deleteAll:async()=>state.clear(),deleteAlarm:async()=>{}};
 const worker=new OnlineRoom({storage,getWebSockets:()=>sockets,blockConcurrencyWhile:fn=>fn()},{});
 const req=(path,body)=>new Request('https://internal'+path,{method:'POST',body:JSON.stringify(body)});
 const a=await (await worker.fetch(req('/create',{code:'ABCD2345',name:'Host',gameId:'link-burst'}))).json();
 const b=await (await worker.fetch(req('/join',{name:'Guest'}))).json();
 assert.equal((await worker.fetch(req('/join',{name:'Third'}))).status,409);
 const sock=id=>({events:[],deserializeAttachment(){return{id}},send(text){this.events.push(JSON.parse(text))},close(){}});
 const p0=sock(a.id),p1=sock(b.id);sockets.push(p0,p1);
 const send=(s,type,props={})=>worker.webSocketMessage(s,JSON.stringify({type,...props}));
 await send(p0,'ready',{ready:true});await send(p1,'ready',{ready:true});
 await send(p1,'link-start');assert.equal(worker.room.link,undefined);
 await send(p0,'link-start');assert.equal(worker.snapshot().phase,'link');
 assert.equal(worker.snapshot().link,undefined);
 const x=p0.events.at(-1).room.link,y=p1.events.at(-1).room.link;
 assert.equal(x.stage,'setup');assert.equal(y.stage,'setup');
 await send(p1,'link-begin');assert.equal(worker.room.link.stage,'setup');
 await send(p0,'link-begin');
 assert.equal(worker.room.link.stage,'countdown');
 assert.deepEqual(p0.events.at(-1).room.link.self.next,p1.events.at(-1).room.link.self.next);
 await send(p0,'link-stop');
 assert.equal(worker.snapshot().phase,'lobby');
 assert.ok(worker.room.members.every(p=>!p.ready));
 assert.equal(worker.linkTimer,null);
});
