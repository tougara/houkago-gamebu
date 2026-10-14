import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const soloJs=readFileSync(new URL('../games/link-burst/game.js',import.meta.url),'utf8');
const soloCss=readFileSync(new URL('../games/link-burst/game.css',import.meta.url),'utf8');
const versusJs=readFileSync(new URL('../games/link-burst/versus/match.js',import.meta.url),'utf8');
const versusCss=readFileSync(new URL('../games/link-burst/versus/play.css',import.meta.url),'utf8');
const soloHtml=readFileSync(new URL('../games/link-burst/index.html',import.meta.url),'utf8');
const versusHtml=readFileSync(new URL('../games/link-burst/versus/play.html',import.meta.url),'utf8');

test('solo: HUD is at left of board with NEXT/PAUSE at right, and controls remain connected',()=>{
  const start=soloJs.indexOf('  function playScreen(){');
  const end=soloJs.indexOf('  function resultScreen(){',start);
  assert.ok(start>=0&&end>start);
  const makeHtml=new Function('state','miniPieceHtml',soloJs.slice(start,end)+'return playScreen();');
  const markup=makeHtml({queue:[{},{}],mode:'endless',countdownActive:false},()=>'<i class="test-pair"></i>');
  const hud=markup.indexOf('<section class="play-hud">');
  const board=markup.indexOf('class="board-frame"');
  const next=markup.indexOf('class="next-panel"');
  assert.ok(markup.startsWith('<section class="board-stage">'));
  assert.ok(hud>0&&board>hud&&next>board);
  for(const key of ['data-score','data-best-score','data-max-link','data-third-label','data-third-value',
    'data-next-one','data-next-two','data-pause','data-board-frame','data-board']){
    assert.ok(markup.includes(key),key+' missing');
  }
  for(const action of ['left','right','down','rotate']){
    assert.equal(markup.split('data-control="'+action+'"').length-1,1);
  }
});
test('solo: three columns with fixed 7:13 field and two expanded console rows',()=>{
  assert.match(soloCss,/grid-template-columns:var\(--lb-stat-rail\) minmax\(0,1fr\) var\(--lb-rail-width\)/);
  assert.match(soloCss,/\.screen-play \.board-stage > \.play-hud\{[\s\S]*?grid-column:1/);
  assert.match(soloCss,/\.screen-play \.board-stage > \.board-frame\{[\s\S]*?grid-column:2/);
  assert.match(soloCss,/\.screen-play \.board-stage > \.next-panel\{[\s\S]*?grid-column:3/);
  assert.match(soloCss,/aspect-ratio:7\s*\/\s*13/);
  assert.match(soloCss,/grid-template-rows:repeat\(2,67px\)/);
  assert.match(soloCss,/\.screen-play \.board-stage \.pause-btn\{[\s\S]*?min-height:clamp\(65px/);
  assert.match(soloCss,/\.screen-play \.board-stage \.score-box em\{[\s\S]*?overflow-wrap:anywhere/);
  assert.match(soloCss,/--lb-stage-board-offset:24px/);
  assert.match(soloJs,/const COLS=7;/);
  assert.match(soloJs,/const VISIBLE_ROWS=13;/);
});
test('versus: preserve two 7x13 boards, outer-side controls and NEXT rails',()=>{
  assert.match(versusJs,/data-board=/);
  assert.match(versusJs,/7列13段盤面/);
  assert.match(versusJs,/class="arena-controls"/);
  assert.match(versusJs,/class="arena-board-stack"/);
  assert.match(versusJs,/class="arena-next"/);
  assert.match(versusCss,/\.arena-core\{[\s\S]*?grid-template-columns:var\(--v7-controls\) minmax\(0,var\(--v7-board\)\) var\(--v7-next\)/);
  assert.match(versusCss,/\.arena\[data-side="1"\] \.arena-core\{[\s\S]*?grid-template-columns:var\(--v7-next\) minmax\(0,var\(--v7-board\)\) var\(--v7-controls\)/);
});
test('versus: empty row removed; larger rotation, arrows and drop occupy three rows',()=>{
  const start=versusCss.lastIndexOf('/* Link Burst 2P: enlarge OUTER touch controls');
  assert.ok(start>=0);
  const updated=versusCss.slice(start);
  assert.match(updated,/grid-template-rows:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(updated,/\.v-control-spacer\{display:none\}/);
  assert.match(updated,/\.v-control-rotate\{[\s\S]*?grid-row:1/);
  assert.match(updated,/\.v-control-arrows\{[\s\S]*?grid-row:2/);
  assert.match(updated,/\.v-control-down\{[\s\S]*?grid-row:3/);
  assert.match(updated,/clamp\(188px,77dvh,324px\)/);
  for(const action of ['left','right','down','rotate']){
    assert.ok(versusJs.includes('data-action="'+action+'"'),action+' missing');
  }
});
test('the new CSS and solo markup are cache-busted for mobile browser refreshes',()=>{
  assert.match(soloHtml,/href="game\.css\?v=20261014-ui4"/);
  assert.match(soloHtml,/src="game\.js\?v=20261014-ui3"/);
  assert.match(versusHtml,/href="play\.css\?v=20261014-ui3"/);
});


test('rules: solo and versus guide tabs preserve the complete original solo rules',()=>{
  const a=soloJs.indexOf('  function versusRulesHtml(){');
  const b=soloJs.indexOf('  function miniPieceHtml(',a);
  assert.ok(a>=0&&b>a);
  const rulesCode=soloJs.slice(a,b);
  const guide=tab=>new Function('state','topNav','heading',rulesCode+'return rulesScreen();')(
    {ruleTab:tab},()=>'',(title,desc)=>'<h1>'+title+'</h1><p>'+desc+'</p>'
  );
  const one=guide('solo'),two=guide('versus');
  assert.match(one,/data-rule-tab="solo"/);
  assert.match(one,/data-rule-tab="versus"/);
  assert.match(one,/6\. モードと終了条件/);
  assert.doesNotMatch(one,/JAMの着弾と長期戦/);
  assert.match(two,/JAMの着弾と長期戦/);
  assert.match(two,/JAMで相手を攻撃/);
  assert.match(two,/2人対戦の操作/);
  assert.match(two,/着弾上限/);
  assert.doesNotMatch(two,/6\. モードと終了条件/);
  assert.match(soloJs,/new URLSearchParams\(location\.search\)\.get\('rules'\)==='versus'/);
  assert.match(soloJs,/data-rule-tab/);
});
test('duel ready: removes full JAM explanation and links to the rules versus tab',()=>{
  const setup=readFileSync(new URL('../games/link-burst/versus/versus.js',import.meta.url),'utf8');
  const setupCss=readFileSync(new URL('../games/link-burst/versus/versus.css',import.meta.url),'utf8');
  assert.doesNotMatch(setup,/'<section class="card versus-rules-card">'\+/);
  assert.match(setup,/href="\.\.\/\?rules=versus"/);
  assert.match(setup,/data-launch/);
  assert.match(setupCss,/\.versus-howto-link a\{/);
  assert.match(versusHtml,/play\.css\?v=20261014-ui3/);
});
test('solo restores larger 7x13 board while keys extend up 1.5 times without taking grid height',()=>{
  const newStyle=soloCss.slice(soloCss.indexOf('/* Recover playfield width lost'));
  assert.match(newStyle,/--lb-stat-rail:clamp\(42px,12vw,56px\)/);
  assert.match(newStyle,/--lb-rail-width:clamp\(42px,11\.5vw,53px\)/);
  assert.match(newStyle,/--lb-app-padding:5px/);
  assert.match(newStyle,/aspect-ratio:7 \/ 13/);
  assert.match(newStyle,/--lb-key-row:67px/);
  assert.match(newStyle,/--lb-arrow-grow:calc\(var\(--lb-key-row\) \* \.5\)/);
  assert.match(newStyle,/grid-template-rows:repeat\(2,var\(--lb-key-row\)\)/);
  assert.match(newStyle,/margin:0 auto/);
  assert.match(newStyle,/\.control-btn\[data-control="left"\],[\s\S]*?\.control-btn\[data-control="right"\]\{/);
  assert.match(newStyle,/top:calc\(-1 \* var\(--lb-arrow-grow\)\)/);
  assert.match(newStyle,/height:calc\(100% \+ var\(--lb-arrow-grow\)\)/);
  assert.match(newStyle,/\.control-btn\[data-control="rotate"\]\{[\s\S]*?grid-row:1 \/ 3/);
  assert.doesNotMatch(newStyle,/grid-template-rows:calc\(var\(--lb-key-row\) \+/);
});
test('duel controls: DOWN uses original one-row height, arrows and ROTATE split the rest',()=>{
  const a=versusCss.lastIndexOf('/* Link Burst 2P touch area revision:');
  assert.ok(a>=0);
  const c=versusCss.slice(a);
  assert.match(c,/grid-template-rows:minmax\(0,1fr\) minmax\(0,1fr\) var\(--v7-btn\)/);
  assert.match(c,/\.v-control-arrows\{[\s\S]*?grid-row:2/);
  assert.match(c,/\.v-control-down\{[\s\S]*?grid-row:3/);
  assert.doesNotMatch(c,/\.arena-field\{|\.arena-board-stack\{/);
});


test('versus ready buttons have no decorative arrow characters',()=>{
  const setup=readFileSync(new URL('../games/link-burst/versus/versus.js',import.meta.url),'utf8');
  for(const label of ['遊び方（2人対戦）を確認する','2人で対戦をはじめる','プレイヤーを変更']){
    assert.match(setup,new RegExp(label));
  }
  for(const arrowLabel of ['遊び方（2人対戦）を確認する ↗','2人で対戦をはじめる →','← プレイヤーを変更']){
    assert.ok(!setup.includes(arrowLabel),'Unexpected arrow: '+arrowLabel);
  }
  const setupHtml=readFileSync(new URL('../games/link-burst/versus/index.html',import.meta.url),'utf8');
  assert.match(setupHtml,/versus\.js\?v=20261014-ui4/);
});
