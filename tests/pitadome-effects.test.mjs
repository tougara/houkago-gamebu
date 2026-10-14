import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const game=readFileSync(new URL('../games/pitadome-challenge/game.js',import.meta.url),'utf8');
const effectsJs=readFileSync(new URL('../games/pitadome-challenge/effects.js',import.meta.url),'utf8');
const effectsCss=readFileSync(new URL('../games/pitadome-challenge/effects.css',import.meta.url),'utf8');
const soloHtml=readFileSync(new URL('../games/pitadome-challenge/index.html',import.meta.url),'utf8');
const versusHtml=readFileSync(new URL('../games/pitadome-challenge/versus/index.html',import.meta.url),'utf8');

function soloHarness(locationData={}){
  const timers=new Map(),frames=new Map(),elements=new Map(),resumes=[],events={};
  let seq=0,currentOverlay='',countNumber=null;
  const app={
    className:'',_html:'',
    get innerHTML(){return this._html},
    set innerHTML(value){this._html=value;elements.clear();currentOverlay=value.includes('countdown-overlay')?value:'';countNumber=currentOverlay?'3':null}
  };
  const player={id:'one',name:'テスト',icon:'🐶'};
  const registry={load:()=>({roster:[player],players:[player]}),resolveId:p=>p.id,ICONS:['🐶'],ROSTER_MAX:15};
  const settings={vibrate(){}};
  const resume={save(...args){resumes.push(args)},clear(){}};
  const win={HoukagoPlayers:registry,HoukagoSettings:settings,HoukagoResume:resume,
    addEventListener(n,fn){events[n]=fn},scrollTo(){}};
  function element(selector){
    if(selector==='.pv-cutin'){
      if(!currentOverlay.includes('pv-cutin'))return null;
      return {get outerHTML(){return currentOverlay},set outerHTML(x){currentOverlay=x},
        remove(){currentOverlay=''}};
    }
    const key=selector.startsWith('[')?selector.slice(1,-1):selector;
    if(!app.innerHTML.includes(key))return null;
    if(!elements.has(selector))elements.set(selector,{
      isConnected:true,disabled:false,dataset:{mode:'ten',difficulty:'normal'},
      addEventListener(n,fn){this[n]=fn},remove(){this.isConnected=false},
      classList:{add(){},remove(){},toggle(){}}
    });
    return elements.get(selector);
  }
  const document={
    addEventListener(n,cb){events['doc_'+n]=cb},
    getElementById(id){
      if(id==='app')return app;
      if(id==='countdownOverlay')return currentOverlay?{remove(){currentOverlay=''}}:null;
      if(id==='countdownNumber')return currentOverlay?{
        get textContent(){return countNumber},
        set textContent(v){countNumber=String(v)},
        classList:{add(){}}
      }:null;
      return null;
    },
    querySelector:element,querySelectorAll:selector=>{
      if(selector==='[data-rules-tab]')return ['common','solo','versus'].map(tab=>{
        const node=element('[data-rules-tab="'+tab+'"]');
        if(node)node.dataset.rulesTab=tab;
        return node;
      }).filter(Boolean);
      const node=element(selector);return node?[node]:[];
    }};
  const context={window:win,document,location:{href:'',...locationData},localStorage:{getItem:()=>null,setItem(){}},
    Math:Object.create(Math),performance:{now:()=>100},
    setTimeout:fn=>{timers.set(++seq,fn);return seq},
    clearTimeout:id=>timers.delete(id),
    requestAnimationFrame:fn=>{frames.set(++seq,fn);return seq},
    cancelAnimationFrame:id=>frames.delete(id)};
  context.Math.random=()=>.1;
  vm.runInNewContext(effectsJs,{globalThis:win});
  vm.runInNewContext(game,context);
  function press(selector,dataset={}){
    const node=element(selector);assert.ok(node,'button missing '+selector);
    Object.assign(node.dataset,dataset);
    assert.ok(node.click||node.pointerdown,'no listener '+selector);
    if(node.click)node.click({currentTarget:node,preventDefault(){}});
    else node.pointerdown({preventDefault(){},currentTarget:node});
  }
  function stepTimer(){
    const entry=timers.entries().next().value;assert.ok(entry,'expected timer');
    timers.delete(entry[0]);entry[1]();
  }
  function key(key='Enter',target={tagName:'BODY'},repeat=false){
    let prevented=false;
    events.doc_keydown?.({key,target,repeat,preventDefault(){prevented=true}});
    return prevented;
  }
  return {app,win,press,key,stepTimer,timers,frames,resumes,
    get overlay(){return currentOverlay},get countNumber(){return countNumber}};
}

test('shared timing & vibrate API preserves existing stronger PERFECT feedback',()=>{
  const w={};vm.runInNewContext(effectsJs,{globalThis:w});
  assert.equal(w.PitadomeEffects.TIMING.countdown,1120);
  assert.equal(w.PitadomeEffects.TIMING.start,1500);
  assert.equal(w.PitadomeEffects.TIMING.out,1850);
  assert.ok(w.PitadomeEffects.TIMING.perfect>w.PitadomeEffects.TIMING.excellent);
  assert.ok(w.PitadomeEffects.TIMING.excellent>w.PitadomeEffects.TIMING.great);
  const fired=[];
  for(const tier of ['perfect','excellent','great','good','out'])w.PitadomeEffects.vibrate(tier,{vibrate:x=>fired.push(x)});
  assert.equal(fired.length,3);
  assert.deepEqual(fired[0],[28,22,70]);
  assert.equal(fired[2],24);
});
test('both modes load the same effects module and style sheet',()=>{
  assert.doesNotMatch(soloHtml,/src="effects\.js"/);
  assert.doesNotMatch(soloHtml,/href="effects\.css"/);
  assert.match(versusHtml,/src="\.\.\/effects\.js"/);
  assert.match(versusHtml,/href="\.\.\/effects\.css"/);
  assert.match(effectsCss,/\.pitadome-app \.pv-cutin/);
  assert.doesNotMatch(game,/resultCutin|effects\.cutinHtml|window\.PitadomeEffects/);
});

test('solo first-round intro shares the 3-2-1-START durations with VS',()=>{
  const h=soloHarness();h.press('[data-start-title]');
  h.press('[data-solo-modes]');
  h.press('[data-mode]',{mode:'ten'});
  h.press('[data-difficulty]',{difficulty:'normal'});
  assert.match(h.app.className,/screen-play/);
  assert.match(h.app.innerHTML,/countdown-overlay/);
  assert.equal(h.countNumber,'3');
  h.stepTimer();assert.equal(h.countNumber,'2');
  h.stepTimer();assert.equal(h.countNumber,'1');
  h.stepTimer();assert.equal(h.countNumber,'START!');
  h.stepTimer();
  assert.equal(h.overlay,'');
  assert.ok(h.app.innerHTML.includes('data-stop'));
  assert.doesNotMatch(h.app.innerHTML,/pv-cutin/);
});

test('solo keeps its scoring and combo cards but reveals them AFTER a full-screen hit',()=>{
  const h=soloHarness();h.press('[data-start-title]');
  h.press('[data-solo-modes]');
  h.press('[data-mode]',{mode:'ten'});
  h.press('[data-difficulty]',{difficulty:'normal'});
  for(let i=0;i<4;i++)h.stepTimer();
  h.press('[data-stop]');
  assert.match(h.app.className,/screen-roundResult/);
  assert.doesNotMatch(h.app.innerHTML,/solo-result-pending|pv-cutin/);
  assert.match(h.app.innerHTML,/result-stats/);
  assert.match(h.app.innerHTML,/score-slam/);
  assert.match(h.app.innerHTML,/data-next-round/);
  assert.ok(h.resumes.some(x=>x[2]?.score>=10),'original scoring still accumulates');
  h.stepTimer(); // original 700ms next-round gate
  h.press('[data-next-round]');
  assert.match(h.app.className,/screen-play/);
  assert.doesNotMatch(h.app.innerHTML,/pv-cutin/);
});

test('misjudgement in solo has restrained 1.85s pause and never changes game mode',()=>{
  const h=soloHarness();h.press('[data-start-title]');
  h.press('[data-solo-modes]');
  h.press('[data-mode]',{mode:'endless'});
  h.press('[data-difficulty]',{difficulty:'normal'});
  for(let i=0;i<4;i++)h.stepTimer();
  h.press('[data-stop]');
  assert.match(h.app.className,/screen-roundResult/);
  assert.doesNotMatch(h.app.innerHTML,/pv-cutin|solo-result-pending/);
  assert.match(h.app.innerHTML,/result-stats/);
  assert.match(h.app.innerHTML,/エンドレス/);
  assert.match(h.app.innerHTML,/ミス|MISS|OUT/);
});

test('solo original judgement visuals remain sourced from the existing game.css',()=>{
 const soloCss=readFileSync(new URL('../games/pitadome-challenge/game.css',import.meta.url),'utf8');
 assert.match(soloCss,/\.hit-fx|\.impact-rays|\.result-card/);
 assert.doesNotMatch(game,/resultFxTimer|setCutin\(/);
});

test('entry screen groups solo challenges under one button next to 2-player KO',()=>{
 const h=soloHarness();h.press('[data-start-title]');
 assert.match(h.app.innerHTML,/data-solo-modes/);
 assert.match(h.app.innerHTML,/data-versus-mode/);
 assert.doesNotMatch(h.app.innerHTML,/data-mode="ten"/);
 assert.doesNotMatch(h.app.innerHTML,/data-mode="endless"/);
 h.press('[data-solo-modes]');
 assert.match(h.app.innerHTML,/10ラウンドチャレンジ/);
 assert.match(h.app.innerHTML,/エンドレスチャレンジ/);
 assert.match(h.app.innerHTML,/data-change-player/);
 h.press('[data-mode]',{mode:'ten'});
 assert.match(h.app.innerHTML,/むずかしさを選ぼう/);
 assert.match(h.app.innerHTML,/小学校低学年にもおすすめ/);
});
test('rules screen offers common, solo and versus tabs',()=>{
 const h=soloHarness();h.press('[data-rules]');
 for(const tab of ['common','solo','versus'])assert.match(h.app.innerHTML,new RegExp('data-rules-tab="'+tab+'"'));
 assert.match(h.app.innerHTML,/id="common-rules" role="tabpanel" aria-labelledby="common-rules-tab">/);
 assert.match(h.app.innerHTML,/id="solo-rules" role="tabpanel" aria-labelledby="solo-rules-tab" hidden/);
 assert.match(h.app.innerHTML,/id="versus-rules" role="tabpanel" aria-labelledby="versus-rules-tab" hidden/);
 assert.match(h.app.innerHTML,/共通の遊び方/);
 assert.match(h.app.innerHTML,/むずかしさ/);
 assert.match(h.app.innerHTML,/PERFECTで回復＆妨害/);
 assert.match(h.app.innerHTML,/回復ゲージ350点/);
});
test('common solo versus panels switch visibility and selection',()=>{
 const h=soloHarness();h.press('[data-rules]');
 h.press('[data-rules-tab="solo"]');
 assert.match(h.app.innerHTML,/id="solo-rules" role="tabpanel" aria-labelledby="solo-rules-tab">/);
 assert.match(h.app.innerHTML,/id="common-rules" role="tabpanel" aria-labelledby="common-rules-tab" hidden/);
 h.press('[data-rules-tab="versus"]');
 assert.match(h.app.innerHTML,/id="versus-rules" role="tabpanel" aria-labelledby="versus-rules-tab">/);
 assert.match(h.app.innerHTML,/aria-selected="true" aria-controls="versus-rules"/);
 h.press('[data-rules-tab="common"]');
 assert.match(h.app.innerHTML,/id="common-rules" role="tabpanel" aria-labelledby="common-rules-tab">/);
 assert.match(h.app.innerHTML,/id="versus-rules" role="tabpanel" aria-labelledby="versus-rules-tab" hidden/);
});

test('versus rules deep link selects the duel tab immediately',()=>{
  const h=soloHarness({search:'?view=rules',hash:'#versus-rules'});
  assert.match(h.app.className,/screen-rules/);
  assert.match(h.app.innerHTML,/aria-selected="true" aria-controls="versus-rules"/);
  assert.match(h.app.innerHTML,/id="versus-rules" role="tabpanel" aria-labelledby="versus-rules-tab">/);
  assert.match(h.app.innerHTML,/id="solo-rules" role="tabpanel" aria-labelledby="solo-rules-tab" hidden/);
});

test('redundant instructions are absent from setup screens',()=>{
 const h=soloHarness();
 assert.match(h.app.innerHTML,/data-rules/);
 h.press('[data-start-title]');
 assert.doesNotMatch(h.app.innerHTML,/data-rules>/);
 h.press('[data-solo-modes]');
 assert.doesNotMatch(h.app.innerHTML,/data-rules>/);
 h.press('[data-mode]',{mode:'ten'});
 assert.doesNotMatch(h.app.innerHTML,/data-rules>/);
});

test('PC Enter/Space controls the original solo STOP and next round without touching score rules',()=>{
 const h=soloHarness();
 assert.equal(h.key('Enter'),true);
 assert.match(h.app.className,/screen-mode/);
 h.press('[data-solo-modes]');
 h.press('[data-mode]',{mode:'ten'});
 h.press('[data-difficulty]',{difficulty:'normal'});
 assert.match(h.app.innerHTML,/countdown-overlay/);
 assert.equal(h.key(' '),false); // Cannot stop during countdown.
 for(let i=0;i<4;i++)h.stepTimer();
 assert.equal(h.key(' ',{tagName:'INPUT'}),false);
 assert.equal(h.key(' ',{tagName:'BODY'},true),false); // Held key ignored.
 assert.equal(h.key(' '),true);
 assert.match(h.app.className,/screen-roundResult/);
 assert.match(h.app.innerHTML,/result-stats/);
 assert.equal(h.key('Enter'),true);
 assert.match(h.app.className,/screen-play/);
});
