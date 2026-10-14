import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const game=readFileSync(new URL('../games/link-burst/game.js',import.meta.url),'utf8');
const engineJs=readFileSync(new URL('../games/link-burst/versus/engine.js',import.meta.url),'utf8');
const matchJs=readFileSync(new URL('../games/link-burst/versus/match.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../games/link-burst/game.css',import.meta.url),'utf8');
const versusCss=readFileSync(new URL('../games/link-burst/versus/play.css',import.meta.url),'utf8');

const env={window:{}};
runInNewContext(engineJs,env);
const E=env.window.LinkBurstVersusEngine;

test('official 2P LINK/COMBO attacks and rounding match the guide',()=>{
  for(const [link,jam] of [[1,0],[2,4],[3,11],[4,24],[5,35],[6,46],[7,58],[8,70],[9,70]]){
    assert.equal(E.attackFor(link,1),jam,'LINK '+link);
  }
  assert.equal(E.attackFor(1,2),3,'1 LINK / 2 COMBO');
  assert.equal(E.attackFor(1,3),6,'1 LINK / 3 COMBO');
  assert.equal(E.attackFor(2,3),10,'2 LINK / 3 COMBO');
  assert.equal(E.attackFor(4,3,180000),37,'25% boost floored');
  assert.equal(E.attackFor(4,3,240000),45,'50% boost floored');
  assert.equal(E.attackFor(8,3,240000),90,'upper attack cap');
  for(const label of ['2 LINKで4個','3 LINKで11個','4 LINKで24個','5 LINKで35個','6 LINKで46個','7 LINKで58個','8 LINK以上で70個']){
    assert.ok(game.includes(label),'Guide missing '+label);
  }
});
test('JAM wave and overtime timing boundaries agree with guide',()=>{
  for(const [ms,n] of [[0,14],[89999,14],[90000,21],[179999,21],
    [180000,28],[239999,28],[240000,30]]){
    assert.equal(E.jamWaveSize({elapsedMs:ms}),n);
  }
  for(const [ms,n] of [[0,1],[179999,1],[180000,1.25],[239999,1.25],[240000,1.5]]){
    assert.equal(E.jamPressure({elapsedMs:ms}),n);
  }
  assert.ok(game.includes('1分30秒から21個'));
  assert.ok(game.includes('3分から28個、4分から30個'));
  assert.ok(game.includes('最大90個'));
});
test('solo and versus scoring examples agree and basic piece dimensions unchanged',()=>{
  assert.equal(E.scoreGain(4,1,1),400);
  assert.equal(E.scoreGain(4,1,1)+E.scoreGain(4,2,1),1450);
  assert.equal(E.scoreGain(8,1,2),1400);
  assert.ok(game.includes('合計1,450点'));
  assert.match(engineJs,/const COLS=7,ROWS=15,HIDDEN=2/);
  assert.match(game,/const COLS=7;/);
});
test('duel snapshot is JSON-safe and engine can tick the restored board',()=>{
  const sequence=[];
  function sharedPair(index){
    while(sequence.length<=index)sequence.push({a:'blue',b:index%2?'red':'green'});
    return sequence[index];
  }
  const first=E.make({id:'a'},sharedPair);
  const second=E.make({id:'b'},sharedPair);
  first.elapsedMs=90001;
  E.queueJam(first,14);
  const stored=JSON.parse(JSON.stringify([first,second].map(x=>{const y={...x};delete y.pairSource;return y})));
  const restored=stored.map(x=>({...x,pairSource:sharedPair}));
  assert.equal(restored[0].jamQueue[0].count,14);
  assert.deepEqual(restored[0].piece,first.piece);
  E.tick(restored[0],16,false);
  E.tick(restored[1],16,false);
  assert.equal(typeof restored[0].phase,'string');
  assert.equal(restored[0].score,0);
  for(const tag of ['persistMatch','restoreMatch','resumeApi.offer','houkago-back-guard-open']){
    assert.ok(matchJs.includes(tag),tag+' unavailable');
  }
});
test('UI: solo control keys stay in their frame and duel JAM label is single-line',()=>{
  const end=css.slice(css.lastIndexOf('/* Solo controls: keep all buttons INSIDE'));
  assert.match(end,/grid-template-rows:calc\(var\(--lb-key-row\) \* 1\.3\)/);
  assert.match(end,/position:static/);
  assert.doesNotMatch(end,/top:calc\(-1/);
  assert.match(versusCss,/\.match-center \.center-mode \[data-pressure\]\{[\s\S]*?white-space:nowrap!important/);
  assert.match(matchJs,/data-pressure>JAM14個\/回/);
});
