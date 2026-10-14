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
  assert.match(soloHtml,/href="game\.css\?v=20261014-ui2"/);
  assert.match(soloHtml,/src="game\.js\?v=20261014-ui2"/);
  assert.match(versusHtml,/href="play\.css\?v=20261014-ui2"/);
});
