import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const js=readFileSync(new URL('../games/pitadome-challenge/versus/versus.js',import.meta.url),'utf8');
const rulesJs=readFileSync(new URL('../games/pitadome-challenge/versus/versus-rules.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../games/pitadome-challenge/versus/versus.css',import.meta.url),'utf8');

function harness(){
  const events={},timers=new Map(),frames=new Map();
  let seq=0,landscape=true,clock=10;
  const players=[{id:'a',name:'アルファ',icon:'🐶'},{id:'b',name:'ベータ',icon:'🐱'}],records=[];
  const root={innerHTML:'',className:'',overlay:{hidden:true},
    addEventListener(name,callback){events[name]=callback},
    querySelector(selector){return selector==='[data-rotate]'?this.overlay:null},
    querySelectorAll(){return []}};
  const registry={
    load:()=>({roster:players,players}),resolveId:p=>p.id,
    recordGame:entry=>records.push(entry),ICONS:['🐶','🐱'],ROSTER_MAX:15};
  const win={HoukagoPlayers:registry,matchMedia:()=>({matches:landscape}),
    addEventListener(name,fn){events['win_'+name]=fn},scrollTo(){},confirm:()=>true};
  const doc={getElementById:id=>id==='pitadome-versus'?root:{style:{},classList:{toggle(){}}},
    addEventListener(name,fn){events['doc_'+name]=fn},visibilityState:'visible'};
  const context={window:win,document:doc,localStorage:{getItem:()=>null,setItem(){}},
    location:{href:''},performance:{now:()=>clock},
    requestAnimationFrame:fn=>{frames.set(++seq,fn);return seq},
    cancelAnimationFrame:id=>frames.delete(id),
    setTimeout:fn=>{timers.set(++seq,fn);return seq},
    clearTimeout:id=>timers.delete(id),
    Math:Object.create(Math)};
  context.Math.random=()=>0.1;
  vm.runInNewContext(rulesJs,{globalThis:win});
  vm.runInNewContext(js,context);
  function click(key,data={}){
    const button={dataset:data,hasAttribute:field=>field===key,closest:selector=>selector==='button'?button:null};
    events.click({target:button});
  }
  function runCountdown(){click('data-start-turn');for(let i=0;i<3;i++){
    const first=timers.entries().next().value;
    assert.ok(first,'expected countdown timer');timers.delete(first[0]);first[1]();
  }}
  function active(){const match=root.innerHTML.match(/class="pv-vs-player is-active" data-side="([01])"/);
    assert.ok(match,'one active player must be shown');return Number(match[1]);
  }
  return {root,events,records,click,runCountdown,active,setLandscape:v=>{landscape=v;events.win_resize()}};
}
test('before starting, the two-player registration screen is preserved',()=>{
  const h=harness();
  assert.match(h.root.innerHTML,/今回のプレイヤー/);
  assert.match(h.root.innerHTML,/data-change="0"/);
  assert.match(h.root.innerHTML,/data-change="1"/);
});
test('landscape play renders one and only one objective, bar, action and result area',()=>{
  const h=harness();h.click('data-begin');
  assert.equal((h.root.innerHTML.match(/class="pv-objective"/g)||[]).length,1);
  assert.equal((h.root.innerHTML.match(/class="pv-meter"/g)||[]).length,1);
  assert.equal((h.root.innerHTML.match(/class="pv-vs-player /g)||[]).length,2);
  assert.equal((h.root.innerHTML.match(/data-start-turn/g)||[]).length,1);
  assert.equal((h.root.innerHTML.match(/data-stop="/g)||[]).length,0);
  assert.match(h.root.innerHTML,/合格/);
  assert.match(h.root.innerHTML,/±15/);
});
test('STOP appears once during the move, then becomes the NEXT button and switches players',()=>{
  const h=harness();h.click('data-begin');
  const first=h.active();
  h.runCountdown();
  assert.equal((h.root.innerHTML.match(/data-stop="/g)||[]).length,1);
  assert.match(h.root.innerHTML,new RegExp('data-stop="'+first+'"'));
  h.click('data-stop',{stop:String(first)});
  assert.match(h.root.innerHTML,/pv-hit-overlay/);
  assert.match(h.root.innerHTML,/猶予あと|超過/);
  assert.equal((h.root.innerHTML.match(/data-next-turn/g)||[]).length,1);
  assert.equal((h.root.innerHTML.match(/data-stop="/g)||[]).length,0);
  h.click('data-next-turn');
  assert.equal(h.active(),1-first);
  assert.match(h.root.innerHTML,/TURN 2/);
  h.runCountdown();h.click('data-stop',{stop:String(1-first)});
  assert.match(h.root.innerHTML,/data-next-turn/);
});
test('portrait overlay prevents starting, landscape allows it',()=>{
  const h=harness();h.click('data-begin');
  h.setLandscape(false);
  assert.equal(h.root.overlay.hidden,false);
  h.click('data-start-turn');
  assert.match(h.root.innerHTML,/準備OK！ START/);
  h.setLandscape(true);
  assert.equal(h.root.overlay.hidden,true);
  h.runCountdown();
  assert.equal((h.root.innerHTML.match(/data-stop="/g)||[]).length,1);
});
test('the duel CSS uses dedicated bounded rows rather than two full game panels',()=>{
  assert.match(css,/\.pv-duel-body\s*\{/);
  assert.match(css,/grid-template-columns:minmax\(100px/);
  assert.match(css,/\.pv-play-center\s*\{/);
  assert.match(css,/\.pv-action-slot\s*\{/);
  assert.match(css,/\.pv-game-action\s*\{/);
  assert.match(css,/\.pv-hit-overlay\s*\{/);
  assert.doesNotMatch(css,/\.pv-battle \.pv-panel\{/);
});
