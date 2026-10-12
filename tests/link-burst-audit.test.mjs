import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

// Run from repository root: node --test tests/link-burst-audit.test.mjs
const load=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const solo=load('games/link-burst/game.js');
const versus=load('games/link-burst/versus/match.js');
const engineCode=load('games/link-burst/versus/engine.js');
const scope={window:{}};
vm.runInNewContext(engineCode,scope);
const engine=scope.window.LinkBurstVersusEngine;
const extract=(code,start,end)=>{
  const a=code.indexOf(start),b=code.indexOf(end,a+start.length);
  assert.ok(a>=0&&b>a,'Failed to find function '+start);
  return code.slice(a,b);
};
const soloScore=new Function(extract(solo,'  function scoreGain(','  async function resolveClears(')+'\nreturn scoreGain;')();

test('Solo and versus share LINK-weighted score formula',()=>{
  const samples=[[4,1,1,400],[8,1,2,1400],[4,2,1,1050],[8,2,2,2450]];
  for(const [n,link,combo,expected] of samples){
    assert.equal(soloScore(n,link,combo),expected);
    assert.equal(engine.scoreGain(n,link,combo),expected);
  }
  assert.equal(soloScore(4,1,1)+soloScore(4,2,1),1450);
  assert.ok(soloScore(4,1,1)+soloScore(4,2,1)>soloScore(8,1,2));
});

test('JAM targets available columns instead of KO on a full edge',()=>{
  const st=engine.make({id:'test'});
  for(let y=0;y<15;y++)st.board[y][0]=y%2?'red':'blue';
  st.phase='interturn';st.pieces=1;engine.queueJam(st,20);
  st.pieces=2;engine.finishTurn(st);
  assert.equal(st.over,false);
  assert.equal(engine.incomingCount(st),6);
  assert.equal(st.board.flat().filter(x=>x==='jam').length,14);
  st.phase='interturn';st.pieces=3;engine.finishTurn(st);
  assert.equal(engine.incomingCount(st),0);
  assert.equal(st.board.flat().filter(x=>x==='jam').length,20);
});

test('KO still occurs when the central spawn is blocked',()=>{
  const st=engine.make({id:'test'});
  st.phase='interturn';st.pieces=1;st.board[2][3]='red';
  engine.finishTurn(st);
  assert.equal(st.over,true);
});

test('LINK attack power has Puyo-inspired growth and COMBO reward',()=>{
  const expectations=[[1,0],[2,4],[3,11],[4,24],[5,35],[6,46],[7,58],[8,70]];
  for(const [link,expected] of expectations)assert.equal(engine.attackFor(link,1),expected);
  assert.equal(engine.attackFor(1,2),3);
  assert.equal(engine.attackFor(1,3),6);
  assert.equal(engine.attackFor(8,3),76);
});
test('JAM wave reaches 30 gradually and overtime boosts actual attacks',()=>{
  for(const [ms,size] of [[0,14],[89999,14],[90000,21],[179999,21],[180000,28],[240000,30]]){
    assert.equal(engine.jamWaveSize({elapsedMs:ms}),size);
  }
  assert.equal(engine.attackFor(4,1,179999),24);
  assert.equal(engine.attackFor(4,1,180000),30);
  assert.equal(engine.attackFor(4,1,240000),36);
  assert.equal(engine.attackFor(8,3,240000),90);
  const st=engine.make({id:'late'});
  st.pieces=1;st.phase='interturn';st.elapsedMs=240000;
  engine.queueJam(st,60);st.pieces=2;engine.finishTurn(st);
  assert.equal(st.board.flat().filter(x=>x==='jam').length,30);
  assert.equal(engine.incomingCount(st),30);
});
test('COUNTER cancels pending JAM before a larger wave',()=>{
  const st=engine.make({id:'counter'});
  engine.queueJam(st,24);
  const result=engine.counterJam(st,11);
  assert.equal(result.countered,11);
  assert.equal(result.remaining,0);
  assert.equal(engine.incomingCount(st),13);
});


test('Versus chain keeps charge, burst and staged gravity',()=>{
  const st=engine.make({id:'test'});
  st.phase='settle';st.piece=null;st.phaseMs=0;
  for(let x=0;x<4;x++)st.board[14][x]='red';
  st.board[10][0]='blue';
  const phases=new Set();
  for(let i=0;i<120&&!st.over;i++){
    engine.tick(st,50);phases.add(st.phase);
    if(st.phase==='interturn')break;
  }
  for(const p of ['charge','burst','gravity','settle','interturn'])assert.ok(phases.has(p),p);
  assert.equal(st.board[14][0],'blue');
});

test('Versus score visual and JAM forecast use the server-side engine numbers',()=>{
  assert.ok(versus.includes('data-jam-forecast='));
  assert.ok(versus.includes('engine.jamWaveSize(st)'));
  assert.ok(versus.includes('engine.jamPressure('));
  assert.ok(versus.includes('engine.scoreGain('));
  assert.ok(versus.includes('function showBattleCue('));
  assert.ok(versus.includes('data-power=count>=14'));
});

test('Solo KO is determined by spawn collision and canceled runs cannot continue',()=>{
  assert.ok(solo.includes('if(!canPlace(state.piece,state.piece.x,state.piece.y,state.piece.rot)){'));
  assert.ok(!solo.includes("if(hiddenOccupied()){finishGame('topout');return}"));
  assert.ok(solo.includes('let runSerial=0;'));
  assert.ok(solo.includes('if(!await delay(clearWait,serial))return 0;'));
  assert.ok(solo.includes('if(!await applyGravityAnimated(link>=2?94:84,serial))return 0;'));
});

test('Historical rankings are preserved with old scoring labels',()=>{
  const fn=new Function(extract(solo,'  function cleanRankEntry(','  function loadRankings(')+'\nreturn cleanRankEntry;')();
  assert.equal(fn({score:200,maxLink:2},0).scoringVersion,1);
  assert.equal(fn({score:500,maxLink:2,scoringVersion:2},0).scoringVersion,2);
  assert.ok(solo.includes('旧得点'));
  assert.ok(solo.includes('rankingTop:state.score>oldModeBest'));
  assert.ok(solo.includes('modeBest:state.score>oldModeBest&&state.score>oldPersonalBest'));
});

test('Match history counts wins and draws separately from solo records',()=>{
  const fnSource=extract(versus,' function recordMatch(',' function finish(){');
  const builder=new Function('match','playersApi','localStorage','MATCHUP_KEY',fnSource+'\nreturn recordMatch;');
  const match={players:[{id:'a',name:'A'},{id:'b',name:'B'}],games:[
    {score:300,maxLink:2,maxCombo:1,clears:4,sentJam:2,counteredJam:0},
    {score:100,maxLink:1,maxCombo:1,clears:4,sentJam:0,counteredJam:0}
  ]};
  const saved=new Map(),calls=[];
  const record=builder(match,{recordGame:x=>calls.push(x)},{
    getItem:k=>saved.get(k)||null,setItem:(k,v)=>saved.set(k,v)
  },'test-matchup-history');
  record(0);record(1);
  const draw=record(-1);
  assert.equal(draw.wins.a,1);assert.equal(draw.wins.b,1);
  assert.equal(draw.draws,1);assert.equal(draw.played,3);
  assert.equal(calls.length,3);
  assert.equal(calls[0].gameId,'link-burst-versus');
  assert.equal(calls[2].winners.length,0);
  assert.equal(calls[2].metrics.a.totalDraws,1);
});
