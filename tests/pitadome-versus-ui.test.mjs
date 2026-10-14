import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const js=readFileSync(new URL('../games/pitadome-challenge/versus/versus.js',import.meta.url),'utf8');
const rulesJs=readFileSync(new URL('../games/pitadome-challenge/versus/versus-rules.js',import.meta.url),'utf8');
const effectsJs=readFileSync(new URL('../games/pitadome-challenge/effects.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../games/pitadome-challenge/versus/versus.css',import.meta.url),'utf8')+
  readFileSync(new URL('../games/pitadome-challenge/effects.css',import.meta.url),'utf8');

function harness(forcedError=null){
  let error=forcedError;
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
  vm.runInNewContext(effectsJs,{globalThis:win});
  // Fix the practice target to 50 so immediate-stop KO tests are deterministic.
  const originalProfile=win.PitadomeVersusRules.roundProfile;
  win.PitadomeVersusRules.roundProfile=(...args)=>({...originalProfile(...args),target:50});
  if(forcedError!==null){
    const original=win.PitadomeVersusRules.evaluateStop;
    win.PitadomeVersusRules.evaluateStop=(value,target,previous,safe)=>original(target+error,target,previous,safe);
  }
  vm.runInNewContext(js,context);
  function click(key,data={}){
    const button={dataset:data,hasAttribute:field=>field===key,closest:selector=>selector==='button'?button:null};
    events.click({target:button});
  }
  function runCountdown(){
    click('data-start-turn');
    // An armed one-life warning plays before the countdown on the player's next turn.
    if(root.innerHTML.includes('pv-cutin-danger'))stepTimer();
    for(let i=0;i<4;i++){
    const first=timers.entries().next().value;
    assert.ok(first,'expected countdown timer');timers.delete(first[0]);first[1]();
  }}
  function active(){const match=root.innerHTML.match(/class="pv-vs-player is-active" data-side="([01])"/);
    assert.ok(match,'one active player must be shown');return Number(match[1]);
  }
  function stepTimer(){
    const item=timers.entries().next().value;
    assert.ok(item,'a pending animation timer must be set');
    timers.delete(item[0]);item[1]();
  }
  function finishImpact(){
    // Danger cut-in can follow the judgement cut-in when health reaches one.
    for(let n=0;n<3;n++){
      if(!timers.size)break;
      stepTimer();
    }
  }
  return {root,events,records,click,stepTimer,runCountdown,finishImpact,active,setError:v=>{error=v},setLandscape:v=>{landscape=v;events.win_resize()}};
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
  const h=harness(1);h.click('data-begin');const first=h.active();
  h.runCountdown();
  assert.equal((h.root.innerHTML.match(/data-stop="/g)||[]).length,1);
  h.click('data-stop',{stop:String(first)});
  assert.match(h.root.innerHTML,/pv-cutin-judge/);
  assert.doesNotMatch(h.root.innerHTML,/pv-round-result/);
  assert.doesNotMatch(h.root.innerHTML,/data-next-turn/);
  assert.match(h.root.innerHTML,/pv-action-hold/);
  h.click('data-next-turn');assert.equal(h.active(),first);
  h.finishImpact();
  assert.doesNotMatch(h.root.innerHTML,/pv-cutin-judge/);
  assert.match(h.root.innerHTML,/pv-round-result/);
  assert.match(h.root.innerHTML,/STOP <b>/);
  assert.match(h.root.innerHTML,/残り猶予|超過/);
  assert.equal((h.root.innerHTML.match(/data-next-turn/g)||[]).length,1);
  h.click('data-next-turn');
  assert.equal(h.active(),1-first);
  assert.match(h.root.innerHTML,/TURN 2/);
  h.runCountdown();h.click('data-stop',{stop:String(1-first)});
  assert.match(h.root.innerHTML,/pv-cutin-judge/);
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
  assert.match(css,/\.pv-round-result\s*\{/);
  assert.doesNotMatch(css,/\.pv-battle \.pv-panel\{/);
});

test('START button clearly identifies whose turn it is, also after swapping players',()=>{
  const h=harness();h.click('data-begin');
  const first=h.active(),name=first===0?'アルファ':'ベータ';
  assert.match(h.root.innerHTML,new RegExp((first+1)+'P.*'+name+' の準備'));
  assert.match(h.root.innerHTML,/準備OK！ START/);
  h.runCountdown();
  h.click('data-stop',{stop:String(first)});
  h.finishImpact();
  h.click('data-next-turn');
  const second=1-first;
  assert.match(h.root.innerHTML,new RegExp((second+1)+'P.*'+(second===0?'アルファ':'ベータ')+' の準備'));
});
test('result panel persists after effect timer and offers detailed solo-style stats',()=>{
  const h=harness(1);h.click('data-begin');h.runCountdown();
  h.click('data-stop',{stop:String(h.active())});
  assert.match(h.root.innerHTML,/pv-cutin-judge/);
  assert.doesNotMatch(h.root.innerHTML,/pv-result-mainline/);
  h.finishImpact();
  assert.match(h.root.innerHTML,/pv-result-mainline/);
  assert.match(h.root.innerHTML,/pv-result-stats/);
  assert.match(h.root.innerHTML,/目標 <b>/);
  assert.match(h.root.innerHTML,/誤差 <b>/);
  assert.match(h.root.innerHTML,/pv-round-result/);
  assert.match(h.root.innerHTML,/TURN 1/);
  assert.match(css,/\.pv-play-center\.is-result/);
});
test('a knockout also keeps its last hit result on-screen until acknowledged',()=>{
  const h=harness();h.click('data-begin');
  for(let turn=1;turn<=5;turn++){
    if(turn===5){
      h.click('data-start-turn');
      assert.match(h.root.innerHTML,/pv-cutin-danger/);
      assert.doesNotMatch(h.root.innerHTML,/pv-cutin-countdown/);
      h.stepTimer(); // Danger completes, then countdown begins.
      assert.match(h.root.innerHTML,/pv-cutin-title">3</);
      for(let i=0;i<4;i++)h.stepTimer();
    }else h.runCountdown();
    h.click('data-stop',{stop:String(h.active())});
    assert.doesNotMatch(h.root.innerHTML,/pv-cutin-danger/);
    h.finishImpact();
    assert.match(h.root.innerHTML,/pv-round-result/);
    if(turn<5)h.click('data-next-turn');
  }
  assert.match(h.root.innerHTML,/勝敗結果を見る/);
  assert.equal(h.records.length,0);
  h.click('data-next-turn');
  assert.match(h.root.innerHTML,/pv-cutin-win/);
  assert.equal(h.records.length,1);
});
test('solo-style persistent scoring uses staged visual effects and never auto-hides',()=>{
  assert.match(css,/\.pv-result-mainline/);
  assert.match(css,/@keyframes pvResultWordLand/);
  assert.match(css,/@keyframes pvResultScoreLand/);
  assert.match(css,/\.pv-result-spark/);
  assert.doesNotMatch(css,/pvResultReveal/);
});

test('KO result stays landscape with winner, dual scores and three visible actions',()=>{
  const h=harness();h.click('data-begin');
  for(let turn=1;turn<=5;turn++){
    h.runCountdown();h.click('data-stop',{stop:String(h.active())});
    h.finishImpact();h.click('data-next-turn');
  }
  assert.match(h.root.innerHTML,/pv-cutin-win/);
  assert.doesNotMatch(h.root.innerHTML,/pv-final-landscape/);
  h.stepTimer();
  assert.match(h.root.innerHTML,/pv-final-landscape/);
  assert.match(h.root.innerHTML,/pv-final-victory/);
  assert.match(h.root.innerHTML,/pv-final-detail/);
  assert.match(h.root.innerHTML,/pv-final-players/);
  assert.match(h.root.innerHTML,/pv-final-decisive/);
  assert.match(h.root.innerHTML,/同じ2人でもう一度/);
  assert.match(h.root.innerHTML,/プレイヤーを変更/);
  assert.match(h.root.innerHTML,/ゲームをえらぶ/);
  assert.equal((h.root.innerHTML.match(/class="pv-final-player /g)||[]).length,2);
  assert.equal(h.records.length,1);
});
test('KO result maintains portrait rotation guidance until the user rotates back',()=>{
  const h=harness();h.click('data-begin');
  for(let turn=1;turn<=5;turn++){
    h.runCountdown();h.click('data-stop',{stop:String(h.active())});
    h.finishImpact();h.click('data-next-turn');
  }
  h.stepTimer();
  assert.match(h.root.innerHTML,/勝利画面も横画面専用です/);
  h.setLandscape(false);assert.equal(h.root.overlay.hidden,false);
  h.setLandscape(true);assert.equal(h.root.overlay.hidden,true);
});
test('horizontal KO screen uses dedicated CSS overriding solo portrait result layout',()=>{
  assert.match(css,/\.pitadome-app\.pv-app\.screen-final\s*\{/);
  assert.match(css,/\.pv-final-landscape\s*\{/);
  assert.match(css,/grid-template-columns:minmax\(195px/);
  assert.match(css,/\.pv-final-actions\s*\{/);
  assert.match(css,/@media\(max-height:390px\) and \(orientation:landscape\)/);
  assert.match(css,/@media\(orientation:portrait\)/);
});

test('huge 3-2-1-START overlay is centered above gameplay before the bar begins',()=>{
  const h=harness();h.click('data-begin');h.click('data-start-turn');
  assert.match(h.root.innerHTML,/pv-cutin-countdown/);
  assert.match(h.root.innerHTML,/pv-cutin-title">3</);
  h.stepTimer();assert.match(h.root.innerHTML,/pv-cutin-title">2</);
  h.stepTimer();assert.match(h.root.innerHTML,/pv-cutin-title">1</);
  h.stepTimer();assert.match(h.root.innerHTML,/pv-cutin-start/);
  assert.match(h.root.innerHTML,/START！/);
  h.stepTimer();assert.match(h.root.innerHTML,/data-stop="/);
  assert.doesNotMatch(h.root.innerHTML,/pv-cutin-countdown/);
});
test('heal gauge is the primary status and the score is secondary',()=>{
  const h=harness();h.click('data-begin');
  assert.equal((h.root.innerHTML.match(/pv-vs-recovery-title/g)||[]).length,2);
  assert.equal((h.root.innerHTML.match(/pv-vs-recovery-bar/g)||[]).length,2);
  assert.match(h.root.innerHTML,/回復ゲージ/);
  assert.match(h.root.innerHTML,/0 \/ 350/);
  assert.match(h.root.innerHTML,/pv-vs-score-secondary/);
});
test('ranked judgement cut-in appears ahead of persistent verdict and then clears',()=>{
  const h=harness(1);h.click('data-begin');h.runCountdown();
  h.click('data-stop',{stop:String(h.active())});
  assert.match(h.root.innerHTML,/pv-cutin-judge/);
  assert.doesNotMatch(h.root.innerHTML,/pv-round-result/);
  assert.doesNotMatch(h.root.innerHTML,/pv-result-mainline/);
  assert.match(h.root.innerHTML,/pv-meter-zone/);
  h.finishImpact();
  assert.doesNotMatch(h.root.innerHTML,/pv-cutin-judge/);
  assert.match(h.root.innerHTML,/pv-round-result/);
});
test('remaining one life triggers a danger cut-in after the rank cut-in',()=>{
  const h=harness();h.click('data-begin');
  for(let turn=1;turn<=4;turn++){
    h.runCountdown();h.click('data-stop',{stop:String(h.active())});
    assert.doesNotMatch(h.root.innerHTML,/pv-cutin-danger/);
    h.finishImpact();
    assert.match(h.root.innerHTML,/pv-round-result/);
    h.click('data-next-turn');
  }
  // Player 1 is now at one life. The warning must happen BEFORE round 5.
  assert.match(h.root.innerHTML,/TURN 5/);
  assert.match(h.root.innerHTML,/準備OK！ START/);
  h.click('data-start-turn');
  assert.match(h.root.innerHTML,/pv-cutin-danger/);
  assert.match(h.root.innerHTML,/残りライフ 1！/);
  assert.match(h.root.innerHTML,/次に判定外ならKO/);
  assert.doesNotMatch(h.root.innerHTML,/pv-cutin-countdown/);
  h.click('data-start-turn'); // Can't skip the warning by tapping twice.
  assert.match(h.root.innerHTML,/pv-cutin-danger/);
  h.stepTimer();
  assert.doesNotMatch(h.root.innerHTML,/pv-cutin-danger/);
  assert.match(h.root.innerHTML,/pv-cutin-title">3</);
  for(let i=0;i<4;i++)h.stepTimer();
  assert.match(h.root.innerHTML,/data-stop="/);
});
test('win cut-in blocks rematch until victory introduction finishes',()=>{
  const h=harness();h.click('data-begin');
  for(let turn=1;turn<=5;turn++){
    h.runCountdown();h.click('data-stop',{stop:String(h.active())});
    h.finishImpact();h.click('data-next-turn');
  }
  assert.match(h.root.innerHTML,/pv-cutin-win/);
  assert.match(h.root.innerHTML,/WIN！/);
  assert.doesNotMatch(h.root.innerHTML,/pv-final-landscape/);
  h.click('data-rematch');assert.match(h.root.innerHTML,/pv-cutin-win/);
  h.stepTimer();
  assert.doesNotMatch(h.root.innerHTML,/pv-cutin-win/);
  assert.match(h.root.innerHTML,/pv-final-landscape/);
  h.click('data-rematch');assert.match(h.root.innerHTML,/pv-duel/);
});
test('cinematic tier hierarchy and danger emphasis live above the full game',()=>{
  assert.match(css,/\.pitadome-app \.pv-cutin\s*\{/);
  assert.match(css,/position:fixed;inset:0;z-index:80/);
  assert.match(css,/\.pv-cutin-perfect/);
  assert.match(css,/\.pv-cutin-excellent/);
  assert.match(css,/\.pv-cutin-great/);
  assert.match(css,/\.pv-cutin-danger/);
  assert.match(css,/\.pv-cutin-win/);
  assert.match(css,/\.pv-vs-recovery-bar/);
});

test('PERFECT > EXCELLENT > GREAT full-screen judgement tiers are independently rendered',()=>{
  for(const [error,tier,title] of [[0,'perfect','PERFECT！'],[1,'excellent','EXCELLENT！'],[2,'great','GREAT！']]){
    const h=harness(error);h.click('data-begin');h.runCountdown();
    h.click('data-stop',{stop:String(h.active())});
    assert.match(h.root.innerHTML,new RegExp('pv-cutin-judge pv-cutin-'+tier));
    assert.match(h.root.innerHTML,new RegExp(title));
    assert.match(h.root.innerHTML,/pv-cutin-burst/);
    h.finishImpact();assert.match(h.root.innerHTML,/pv-round-result/);
  }
});

test('350-point recovery is visibly converted to MAX and reverts to progress later',()=>{
  const h=harness(0);h.click('data-begin');
  let sawMax=false;
  for(let turn=1;turn<=7;turn++){
    h.runCountdown();h.click('data-stop',{stop:String(h.active())});
    if(h.root.innerHTML.includes('MAX！効果発動')){
      sawMax=true;
      assert.match(h.root.innerHTML,/pv-vs-recovery is-max/);
      assert.match(h.root.innerHTML,/pv-vs-recovery-bar/);
    }
    h.finishImpact();h.click('data-next-turn');
  }
  assert.equal(sawMax,true);
  assert.match(h.root.innerHTML,/回復ゲージ/);
  assert.doesNotMatch(h.root.innerHTML,/MAX！効果発動/);
});

test('brisk 3-2-1-START pacing keeps grade animation order',()=>{
  const h=harness(1);h.click('data-begin');h.click('data-start-turn');
  assert.match(h.root.innerHTML,/--cutin-duration:650ms/);
  h.stepTimer();assert.match(h.root.innerHTML,/pv-cutin-title">2</);
  h.stepTimer();assert.match(h.root.innerHTML,/pv-cutin-title">1</);
  h.stepTimer();assert.match(h.root.innerHTML,/--cutin-duration:650ms/);
  h.stepTimer();h.click('data-stop',{stop:String(h.active())});
  assert.match(h.root.innerHTML,/--cutin-duration:2550ms/);
  assert.match(css,/@keyframes pvCinematicHold/);
  assert.doesNotMatch(h.root.innerHTML,/pv-result-mainline/);
  h.finishImpact();assert.match(h.root.innerHTML,/pv-result-mainline/);
});

test('ready and countdown do not duplicate instructions or player names under the number',()=>{
 const h=harness();h.click('data-begin');
 assert.match(h.root.innerHTML,/準備OK！ START/);
 assert.doesNotMatch(h.root.innerHTML,/準備ができたらスタート/);
 h.click('data-start-turn');
 assert.match(h.root.innerHTML,/pv-cutin-title">3</);
 assert.doesNotMatch(h.root.innerHTML,/チャレンジ/);
 assert.doesNotMatch(h.root.innerHTML,/バーが動いたらSTOP/);
 assert.doesNotMatch(h.root.innerHTML,/pv-result-strip/);
 h.stepTimer();assert.doesNotMatch(h.root.innerHTML,/チャレンジ/);
 h.stepTimer();assert.doesNotMatch(h.root.innerHTML,/チャレンジ/);
 h.stepTimer();assert.match(h.root.innerHTML,/pv-cutin-start/);
 assert.doesNotMatch(h.root.innerHTML,/STOPの準備/);
});
test('OUT has a restrained 1.85s cut-in, then shows the persistent verdict',()=>{
 const h=harness();h.click('data-begin');h.runCountdown();
 h.click('data-stop',{stop:String(h.active())});
 assert.match(h.root.innerHTML,/pv-cutin-judge pv-cutin-out/);
 assert.match(h.root.innerHTML,/--cutin-duration:1850ms/);
 assert.doesNotMatch(h.root.innerHTML,/pv-cutin-spark/);
 assert.doesNotMatch(h.root.innerHTML,/pv-round-result is-out/);
 assert.doesNotMatch(h.root.innerHTML,/data-next-turn/);
 h.finishImpact();
 assert.match(h.root.innerHTML,/pv-round-result is-out/);
 assert.match(h.root.innerHTML,/data-next-turn/);
});

test('target number uses the largest readable scale with a dedicated objective row',()=>{
 assert.match(css,/\.pv-play-center:not\(\.is-result\) \.pv-objective>strong/);
 assert.match(css,/clamp\(60px,22dvh,132px\)/);
 assert.match(css,/\.pv-play-center\.is-no-footer/);
});

test('critical warning is shown once per life-one episode and re-arms after recovery',()=>{
  const h=harness(45);h.click('data-begin');
  function play(error,warn=false){
    h.setError(error);
    h.click('data-start-turn');
    if(warn){
      assert.match(h.root.innerHTML,/pv-cutin-danger/);
      h.stepTimer();
    }else assert.doesNotMatch(h.root.innerHTML,/pv-cutin-danger/);
    assert.match(h.root.innerHTML,/pv-cutin-title">3</);
    for(let i=0;i<4;i++)h.stepTimer();
    h.click('data-stop',{stop:String(h.active())});
    assert.doesNotMatch(h.root.innerHTML,/pv-cutin-danger/);
    h.finishImpact();
    h.click('data-next-turn');
  }
  play(45); // first 1P: 3 -> 2
  play(4);  // 2P safe
  play(45); // first 1P: 2 -> 1, no immediate warning
  play(4);
  play(4,true); // first 1P: warn, but stays at 1 life
  play(4);
  play(0); // first 1P still at 1: no repeat, PERFECT heals to 2
  play(4);
  play(45); // first 1P: 2 -> 1 again
  play(4);
  h.setError(4);
  h.click('data-start-turn');
  assert.match(h.root.innerHTML,/pv-cutin-danger/); // Re-armed after healing
  h.stepTimer();assert.match(h.root.innerHTML,/pv-cutin-title">3</);
});
test('orientation or background interruption preserves the pending one-life warning',()=>{
  const h=harness(45);h.click('data-begin');
  for(let turn=1;turn<=4;turn++){
    h.runCountdown();h.click('data-stop',{stop:String(h.active())});
    h.finishImpact();h.click('data-next-turn');
  }
  h.click('data-start-turn');
  assert.match(h.root.innerHTML,/pv-cutin-danger/);
  h.setLandscape(false);
  assert.equal(h.root.overlay.hidden,false);
  h.setLandscape(true);
  h.click('data-start-turn');
  assert.match(h.root.innerHTML,/pv-cutin-danger/);
  h.stepTimer();
  assert.match(h.root.innerHTML,/pv-cutin-countdown/);
});
test('duel begin button matches the brighter yellow STOP style',()=>{
  assert.match(css,/\.pv-app\.screen-select \.pv-action\[data-begin\]/);
  assert.match(css,/#fff99d/);
  assert.match(css,/#ffdc3c/);
  assert.match(css,/#ffb500/);
});

test('duel setup matches solo difficulty cards without redundant rules link',()=>{
  const h=harness();
  assert.match(h.root.innerHTML,/2人で対戦/);
  assert.match(h.root.innerHTML,/data-diff="easy"/);
  assert.match(h.root.innerHTML,/data-diff="normal"/);
  assert.match(h.root.innerHTML,/class="mode-card easy-mode-card pv-difficulty-card/);
  assert.match(h.root.innerHTML,/小学校低学年にもおすすめ/);
  assert.match(h.root.innerHTML,/いつものルール/);
  assert.doesNotMatch(h.root.innerHTML,/pv-howto|あそびかた・勝ち方を見る/);
  assert.doesNotMatch(h.root.innerHTML,/<h2>勝ち方<\/h2>/);
  h.click('data-diff',{diff:'easy'});
  assert.match(h.root.innerHTML,/data-diff="easy" aria-pressed="true"/);
  assert.match(h.root.innerHTML,/data-diff="normal" aria-pressed="false"/);
  h.click('data-diff',{diff:'normal'});
  assert.match(h.root.innerHTML,/data-diff="normal" aria-pressed="true"/);
  assert.match(css,/\.pv-app\.screen-select \.pv-difficulty-card\.selected/);
});
test('landscape victory displays WIN only once without repeated WINNER labels',()=>{
  const h=harness();h.click('data-begin');
  for(let turn=1;turn<=5;turn++){
    h.runCountdown();h.click('data-stop',{stop:String(h.active())});
    h.finishImpact();h.click('data-next-turn');
  }
  h.stepTimer();
  assert.match(h.root.innerHTML,/<h1>WIN！<\/h1>/);
  assert.doesNotMatch(h.root.innerHTML,/WINNER/);
  assert.equal((h.root.innerHTML.match(/<h1>WIN！<\/h1>/g)||[]).length,1);
  assert.equal((h.root.innerHTML.match(/class="pv-final-player /g)||[]).length,2);
  assert.match(h.root.innerHTML,/決着：TURN/);
});

test('GOOD SAFE OUT show English cut-in before a numeric result',()=>{
 for(const [error,label,rank] of [[5,'GOOD！','good'],[10,'SAFE！','safe'],[45,'OUT！','out']]){
   const h=harness(error);h.click('data-begin');h.runCountdown();
   h.click('data-stop',{stop:String(h.active())});
   assert.match(h.root.innerHTML,new RegExp('pv-cutin-judge pv-cutin-'+rank));
   assert.match(h.root.innerHTML,new RegExp(label));
   assert.doesNotMatch(h.root.innerHTML,/判定中…/);
   assert.doesNotMatch(h.root.innerHTML,/pv-result-mainline/);
   h.finishImpact();
   assert.doesNotMatch(h.root.innerHTML,/pv-cutin-judge/);
   assert.doesNotMatch(h.root.innerHTML,new RegExp(label));
   assert.match(h.root.innerHTML,/判定結果/);
   assert.match(h.root.innerHTML,/pv-result-stats/);
   assert.match(h.root.innerHTML,/目標 <b>/);
 }
});

test('high tiers use grade on cut-in and neutral heading on detailed results',()=>{
 for(const [error,label] of [[0,'PERFECT！'],[1,'EXCELLENT！'],[2,'GREAT！']]){
   const h=harness(error);h.click('data-begin');h.runCountdown();
   h.click('data-stop',{stop:String(h.active())});
   assert.match(h.root.innerHTML,new RegExp(label));
   assert.doesNotMatch(h.root.innerHTML,/pv-result-mainline/);
   h.finishImpact();
   assert.match(h.root.innerHTML,/pv-result-mainline/);
   assert.match(h.root.innerHTML,/判定結果/);
   assert.doesNotMatch(h.root.innerHTML,new RegExp(label));
   assert.match(h.root.innerHTML,/data-next-turn/);
 }
});
