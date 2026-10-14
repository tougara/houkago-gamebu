import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const root=new URL('../',import.meta.url);
const file=path=>readFileSync(new URL(path,root),'utf8');
const engineJs=file('games/link-burst/versus/engine.js');
const soloJs=file('games/link-burst/game.js');
const soloCss=file('games/link-burst/game.css');
const matchJs=file('games/link-burst/versus/match.js');
const matchCss=file('games/link-burst/versus/play.css');
const pitaVs=file('games/pitadome-challenge/versus/versus.js');
const guard=file('game-back-guard.js');
const engineContext={window:{}};vm.runInNewContext(engineJs,engineContext);
const E=engineContext.window.LinkBurstVersusEngine;

test('link burst 7x13 visible board and four colors',()=>{
  assert.equal(E.COLS,7);assert.equal(E.ROWS-E.HIDDEN,13);
  assert.deepEqual(Array.from(E.COLORS),['blue','red','yellow','green']);
});
test('base JAM attacks match all LINK values and capped 3 COMBO bonus',()=>{
  const expected=[0,0,4,11,24,35,46,58,70];
  expected.forEach((count,link)=>assert.equal(E.attackFor(link,1,0),count,link+' LINK'));
  assert.equal(E.attackFor(1,2),3);
  assert.equal(E.attackFor(1,3),6);
  assert.equal(E.attackFor(1,4),6);
  assert.equal(E.attackFor(8,4,240000),90);
});
test('JAM wave limits and late-game attack multipliers exactly match guide',()=>{
  for(const [ms,expected] of [[0,14],[89999,14],[90000,21],[179999,21],
      [180000,28],[239999,28],[240000,30]]){
    assert.equal(E.jamWaveSize({elapsedMs:ms}),expected,ms+' milliseconds');
  }
  for(const [ms,mult] of [[0,1],[179999,1],[180000,1.25],[240000,1.5]]){
    assert.equal(E.jamPressure({elapsedMs:ms}),mult);
  }
  assert.equal(E.attackFor(3,1,180000),13); // floor(11 * 1.25)
  assert.equal(E.attackFor(3,1,240000),16); // floor(11 * 1.5)
});
test('solo score examples in guide match duel engine formula',()=>{
  assert.equal(E.scoreGain(4,1,1),400);
  assert.equal(E.scoreGain(4,1,1)+E.scoreGain(4,2,1),1450);
  assert.equal(E.scoreGain(8,1,2),1400);
  assert.match(soloJs,/2 LINKなら合計1,450点/);
  assert.match(soloJs,/2 COMBOは1,400点/);
});
test('rules cover actual attack values, MAX and floor operations',()=>{
  for(const amount of ['2 LINKで4個','3 LINKで11個','4 LINKで24個',
    '5 LINKで35個','6 LINKで46個','7 LINKで58個','8 LINK以上で70個']){
    assert.ok(soloJs.includes(amount),amount+' omitted from guide');
  }
  assert.match(soloJs,/端数は切り捨て/);
  assert.match(soloJs,/最大90個/);
  assert.match(soloJs,/1分30秒から21個、3分から28個、4分から30個/);
});
test('JAM HUD fits as single line and overtime boost occupies a separate line',()=>{
  assert.match(matchJs,/JAM14個\/回/);
  assert.match(matchJs,/data-pressure-rate/);
  assert.match(matchJs,/pressure.textContent='JAM'\+wave\+'個\/回'/);
  assert.match(matchCss,/white-space:nowrap!important/);
  assert.match(matchCss,/font-size:clamp\(7px,.9vw,11px\)!important/);
});
test('solo arrows stay inside controller frame and no board overlap on PC',()=>{
  const s=soloCss.slice(soloCss.lastIndexOf('/* Solo controls: keep all buttons INSIDE'));
  assert.match(s,/grid-template-rows:calc\(var\(--lb-key-row\) \* 1\.3\) calc\(var\(--lb-key-row\) \* \.7\)/);
  assert.match(s,/position:static/);
  assert.doesNotMatch(s,/top:calc\(-1/);
  assert.match(soloCss,/aspect-ratio:7 \/ 13/);
});
test('browser Back protection is included in every offline game and duel screen',()=>{
  for(const game of ['nise-transfer-student','minna-wa-docchi','kankaku-meter',
     'kyokasho-tower','gesture-battle','pitadome-challenge','link-burst']){
    assert.match(file('games/'+game+'/index.html'),/game-back-guard\.js/,game);
  }
  for(const path of ['games/pitadome-challenge/versus/index.html',
      'games/link-burst/versus/index.html','games/link-burst/versus/play.html',
      'online/minna-wa-docchi/index.html']){
    assert.match(file(path),/game-back-guard\.js/,path);
  }
  assert.match(guard,/history\.pushState/);
  assert.match(guard,/addEventListener\('popstate'/);
  assert.match(guard,/ゲームを続ける/);
  assert.match(guard,/houkago-back-guard-save/);
});
test('each offline game retains its real save/restore mechanism',()=>{
  for(const game of ['nise-transfer-student','minna-wa-docchi','kankaku-meter',
      'kyokasho-tower','gesture-battle','pitadome-challenge','link-burst']){
    const src=file('games/'+game+'/game.js');
    assert.match(src,/HoukagoResume/,game);
    assert.match(src,/persistResume\(/,game);
    assert.match(src,/restoreResume\(/,game);
  }
});
test('both local duel modes save and restore game-specific state',()=>{
  assert.match(matchJs,/function persistMatch\(\)/);
  assert.match(matchJs,/function restoreMatch\(/);
  assert.match(matchJs,/pairSequence:match.pairSequence/);
  assert.match(matchJs,/st.pairSource=sharedPair/);
  assert.match(matchJs,/pause\(true,false\)/); // Do not overwrite a saved match on startup.
  assert.match(pitaVs,/function persistVersus\(\)/);
  assert.match(pitaVs,/function restoreVersus\(/);
  assert.match(pitaVs,/phase:playing\?'ready':state.phase/);
  assert.match(pitaVs,/resultReady:state.phase==='judged'\?true/);
});
