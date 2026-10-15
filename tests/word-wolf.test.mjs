import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext,Script} from 'node:vm';

const questionsJs=readFileSync(new URL('../games/word-wolf/questions.js',import.meta.url),'utf8');
const gameJs=readFileSync(new URL('../games/word-wolf/game.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../games/word-wolf/index.html',import.meta.url),'utf8');
const browser={};
runInNewContext(questionsJs,{window:browser});
const data=browser.HoukagoWordWolfData;

test('150 unique word pairs are distributed across the six categories',()=>{
  assert.equal(data.pairs.length,150);
  const expected=[30,25,20,25,25,25];
  assert.deepEqual(Array.from(data.categories,category=>data.pairs.filter(p=>p.category===category).length),expected);
  assert.equal(new Set(data.pairs.map(p=>[p.a,p.b].sort().join('|'))).size,150);
  for(const p of data.pairs)assert.ok(p.a&&p.b&&p.a!==p.b);
  assert.ok(!data.pairs.some(p=>p.a==='犬'&&p.b==='オオカミ'));
  assert.ok(!data.pairs.some(p=>p.a==='友情'&&p.b==='信頼'));
});
test('public title is ことばのオオカミ while internal IDs and save paths remain compatible',()=>{
  const list=readFileSync(new URL('../games/index.html',import.meta.url),'utf8');
  const logo=readFileSync(new URL('../games/word-wolf/logo.svg',import.meta.url),'utf8');
  const registry=readFileSync(new URL('../player-registry.js',import.meta.url),'utf8');
  const history=readFileSync(new URL('../update-history.js',import.meta.url),'utf8');
  const changelog=readFileSync(new URL('../changelog.js',import.meta.url),'utf8');
  assert.match(html,/ことばのオオカミ｜放課後ゲーム部/);
  assert.match(list,/ことばのオオカミ/);
  assert.match(logo,/aria-label="ことばのオオカミ"/);
  assert.match(logo,/ことばの<\/text>/);
  assert.match(logo,/オオカミ<\/text>/);
  assert.match(gameJs,/class="welcome-title"/);
  assert.match(gameJs,/alt="ことばのオオカミ"/);
  assert.match(gameJs,/title:'ことばのオオカミ',path:'\/games\/word-wolf\/'/);
  assert.match(registry,/'word-wolf':'ことばのオオカミ'/);
  assert.match(history,/wolf:'ことばのオオカミ'/);
  assert.match(changelog,/新作8本目「ことばのオオカミ」/);
  assert.doesNotMatch(gameJs,/ワードウルフ/);
  assert.doesNotMatch(list,/>ワードウルフ</);
  assert.doesNotMatch(html,/<title>ワードウルフ/);
});

test('word-wolf scripts compile, and scripts are loaded after the common player and save APIs',()=>{
  new Script(gameJs,{filename:'word-wolf/game.js'});
  const scripts=['player-registry.js','settings.js','resume.js','game-back-guard.js','questions.js','game.js'];
  let previous=-1;
  for(const filename of scripts){
    const next=html.indexOf('src="'+(filename==='questions.js'||filename==='game.js'?filename:'../../'+filename));
    assert.ok(next>previous,filename+' is out of order or missing');previous=next;
  }
});
function createHarness(activeCount=4){
  const keys=new Map(),events={},records=[],players=Array.from({length:4},(_,i)=>({id:'p'+i,name:'人'+i,icon:'🐱'}));
  const word={classList:{toggle(){}},replaceChildren(){},appendChild(node){this.text=node.textContent}};
  const hold={classList:{toggle(){}},setPointerCapture(){}};
  const done={disabled:true};
  const clockNote={textContent:''};
  const clockDisplay={textContent:''};
  const pauseButton={textContent:''};
  const topicError={textContent:''};
  let modal=null;
  const app={
    className:'',_html:'',set innerHTML(s){this._html=s;done.disabled=true},get innerHTML(){return this._html},
    addEventListener(type,cb){events[type]=cb},contains(){return true},
    querySelector(sel){return sel==='[data-word-value]'?word:sel==='[data-hold-word]'?hold:sel==='[data-word-done]'?done:sel==='[data-clock-note]'?clockNote:sel==='[data-clock]'?clockDisplay:sel==='[data-pause]'?pauseButton:sel==='[data-topic-error]'?topicError:null}
  };
  const document={
    getElementById:()=>app,addEventListener(){},visibilityState:'visible',
    createElement(){return {innerHTML:'',textContent:'',handlers:{},querySelector(sel){return {addEventListener:(type,cb)=>this.handlers[sel]=cb}},remove(){}}},
    body:{appendChild(value){modal=value}}
  };
  const window={
    HoukagoWordWolfData:data,
    HoukagoPlayers:{load:()=>({activeCount,players}),renderEditor:()=>'<div>メンバー</div>',recordGame:v=>records.push(v)},
    HoukagoResume:{save(id,meta,state){keys.set(id,JSON.parse(JSON.stringify(state)))},clear(id){keys.delete(id)},offer(){}},
    scrollTo(){},addEventListener(){},crypto:null
  };
  const localStorage={getItem:k=>keys.get('local:'+k)||null,setItem:(k,v)=>keys.set('local:'+k,v)};
  const fakeMath={random:()=>0,floor:Math.floor,ceil:Math.ceil,max:Math.max};
  const boot=new Function('window','document','localStorage','setInterval','clearInterval','Math',gameJs);
  boot(window,document,localStorage,()=>1,()=>{},fakeMath);
  const act=(name,dataset={})=>{
    const button={dataset,disabled:false,matches:selector=>selector==='['+name+']'};
    events.click({target:{closest:selector=>selector==='button'?button:null}});
    return app.className;
  };
  const reveal=()=>{
    const target={closest:selector=>selector==='[data-hold-word]'?hold:null,setPointerCapture(){}};
    events.pointerdown({target,preventDefault(){},pointerId:1});
    events.pointerup({target});
    assert.equal(done.disabled,false);
  };
  const vote=i=>{
    act('data-open-vote');
    assert.equal(keys.get('word-wolf').screen,'votePass');
    act('data-vote',{vote:String(i)});
    assert.ok(modal?.handlers['[data-yes]']);
    modal.handlers['[data-yes]']();
  };
  return {app,keys,records,events,act,reveal,vote,clockNote,clockDisplay,topicError};
}
function playToVote(h){
  h.act('data-start');h.act('data-members-done');h.act('data-begin');
  for(let i=0;i<4;i++){
    h.act('data-open-word');
    assert.equal(h.keys.get('word-wolf').screen,'pass','secret word must be masked in saved snapshot');
    h.reveal();h.act('data-word-done');
  }
  assert.match(h.app.className,/screen-discussion$/);
  h.act('data-go-vote');
}
test('the complete game flow: wolf is found, guesses correctly, and earns one record',()=>{
  const h=createHarness();playToVote(h);
  [1,0,0,0].forEach(h.vote);
  assert.match(h.app.className,/screen-wolfPass$/);
  h.act('data-open-answer');
  assert.equal(h.keys.get('word-wolf').screen,'wolfPass','free text screen must be masked in saved snapshot');
  h.events.submit({target:{matches:s=>s==='[data-answer-form]',elements:{answer:{value:'しちゅー'}}},preventDefault(){}});
  assert.match(h.app.className,/screen-result$/);
  assert.equal(h.records.length,1);
  assert.deepEqual(h.records[0].winners,['p0']);
});
test('tied election starts exactly one runoff; bad free answer goes through the appeal screen',()=>{
  const h=createHarness();playToVote(h);
  [1,0,1,0].forEach(h.vote);
  assert.match(h.app.className,/screen-tally$/);
  h.act('data-start-runoff');[1,0,0,0].forEach(h.vote);
  assert.match(h.app.className,/screen-wolfPass$/);
  h.act('data-open-answer');
  h.events.submit({target:{matches:s=>s==='[data-answer-form]',elements:{answer:{value:'ラーメン'}}},preventDefault(){}});
  assert.match(h.app.className,/screen-appeal$/);
  h.act('data-reject-appeal');
  assert.match(h.app.className,/screen-result$/);
  assert.deepEqual(h.records[0].winners,['p1','p2','p3']);
});

test('discussion timer has reset and +/-10-second controls; reset preserves running or paused state',()=>{
  const h=createHarness();
  h.act('data-start');h.act('data-members-done');h.act('data-begin');
  for(let i=0;i<4;i++){h.act('data-open-word');h.reveal();h.act('data-word-done')}
  assert.match(h.app.className,/screen-discussion$/);
  for(const action of ['data-pause','data-reset','data-plus','data-minus','data-plus10','data-minus10']){
    assert.match(h.app.innerHTML,new RegExp(action));
  }
  assert.equal(h.keys.get('word-wolf').minutes,3);
  h.act('data-pause');
  assert.equal(h.keys.get('word-wolf').paused,true);
  h.act('data-minus10');
  assert.equal(h.keys.get('word-wolf').seconds,170);
  h.act('data-plus10');
  assert.equal(h.keys.get('word-wolf').seconds,180);
  h.act('data-plus');
  assert.equal(h.keys.get('word-wolf').seconds,210);
  h.act('data-reset');
  assert.equal(h.keys.get('word-wolf').seconds,180);
  assert.equal(h.keys.get('word-wolf').paused,true);
  h.act('data-pause');
  assert.equal(h.clockNote.textContent,'話し合い中');
  h.act('data-minus');
  assert.ok(h.keys.get('word-wolf').seconds>=149&&h.keys.get('word-wolf').seconds<=150);
  h.act('data-reset');
  assert.ok(h.keys.get('word-wolf').seconds>=179&&h.keys.get('word-wolf').seconds<=180);
  assert.equal(h.clockNote.textContent,'話し合い中');
  assert.equal(h.keys.get('word-wolf').paused,true,'save snapshot is always paused so resumed games never skip the timer');
});

test('uploaded night background and transparent PNG logo are referenced by the title and game selection card',()=>{
  const list=readFileSync(new URL('../games/index.html',import.meta.url),'utf8');
  const css=readFileSync(new URL('../games/word-wolf/game.css',import.meta.url),'utf8');
  const styles=readFileSync(new URL('../styles.css',import.meta.url),'utf8');
  const pngSignature='89504e470d0a1a0a';
  const logoPng=readFileSync(new URL('../kotoba_no_ookami_logo_transparent.png',import.meta.url));
  const backgroundPng=readFileSync(new URL('../kotoba_no_ookami_night_background.png',import.meta.url));
  assert.equal(logoPng.subarray(0,8).toString('hex'),pngSignature);
  assert.equal(backgroundPng.subarray(0,8).toString('hex'),pngSignature);
  assert.ok([4,6].includes(logoPng[25]),'the title image must have a PNG alpha channel');
  assert.match(gameJs,/src="\.\.\/\.\.\/kotoba_no_ookami_logo_transparent\.png\?v=20261015-art1"/);
  assert.match(css,/kotoba_no_ookami_night_background\.png/);
  assert.match(css,/welcome-logo/);
  assert.match(list,/src="\.\.\/kotoba_no_ookami_logo_transparent\.png\?v=20261015-art1"/);
  assert.match(styles,/url\("kotoba_no_ookami_night_background\.png"\)/);
  assert.match(html,/game\.css\?v=20261015-logo3/);
  assert.match(html,/game\.js\?v=20261015-art1/);
});

test('the word-wolf logo stays large and centered on both screens without clipping, with the duplicate moon cropped away',()=>{
  const css=readFileSync(new URL('../games/word-wolf/game.css',import.meta.url),'utf8');
  const styles=readFileSync(new URL('../styles.css',import.meta.url),'utf8');
  const list=readFileSync(new URL('../games/index.html',import.meta.url),'utf8');
  assert.match(css,/\.welcome\{[^}]*url\("\.\.\/\.\.\/kotoba_no_ookami_night_background\.png"\) center 78%\/120% auto no-repeat/);
  assert.match(css,/\.welcome \.welcome-title\{[^}]*margin:clamp\(32px,5dvh,52px\) auto auto;[^}]*width:min\(100%,610px\);max-width:610px/);
  assert.match(css,/\.welcome \.welcome-logo\{[^}]*max-height:none;[^}]*margin:0 auto/);
  assert.match(styles,/\.compact-game-art\.word-wolf-card-art img\{width:128%;max-width:none;max-height:150px/);
  assert.match(html,/game\.css\?v=20261015-logo3/);
  assert.match(list,/styles\.css\?v=20261015-wordwolf-logo2/);
});

test('4 people can choose a nonplaying topic author; only the other 3 vote and earn records',()=>{
  const h=createHarness(4);
  h.act('data-start');h.act('data-members-done');
  h.act('data-topic-source',{topicSource:'custom'});
  assert.match(h.app.innerHTML,/お題を決める人は？/);
  h.act('data-host-id',{hostId:'p2'});
  assert.match(h.app.innerHTML,/4人中 3人でプレイ/);
  h.act('data-mode',{mode:'simple'});
  h.act('data-begin');
  assert.match(h.app.className,/screen-customTopics$/);
  assert.match(h.app.innerHTML,/人でプレイ/);
  const submit=(a,b)=>h.events.submit({target:{
    matches:s=>s==='[data-custom-topic-form]',
    elements:{majority:{value:a},minority:{value:b}}
  },preventDefault(){}});
  submit('カレー','ｶﾚｰ');
  assert.match(h.app.className,/screen-customTopics$/);
  assert.match(h.topicError.textContent,/違うお題/);
  submit('カレー','シチュー');
  assert.match(h.app.className,/screen-pass$/);
  const saved=h.keys.get('word-wolf');
  assert.deepEqual(saved.players.map(p=>p.id),['p0','p1','p3']);
  assert.equal(saved.host.id,'p2');
  assert.equal(saved.majority,'カレー');
  assert.equal(saved.minority,'シチュー');
  for(let i=0;i<3;i++){h.act('data-open-word');h.reveal();h.act('data-word-done')}
  assert.match(h.app.className,/screen-discussion$/);
  assert.match(h.app.innerHTML,/出題者/);
  h.act('data-go-vote');
  [1,0,0].forEach(h.vote);
  assert.match(h.app.className,/screen-result$/);
  assert.equal(h.records.length,1);
  assert.deepEqual(h.records[0].participants,['p0','p1','p3']);
  assert.deepEqual(h.records[0].winners,['p1','p3']);
  h.act('data-again');
  assert.match(h.app.className,/screen-customTopics$/);
  assert.match(h.app.innerHTML,/3人でプレイ/);
});
test('custom topic author cannot start a 3-member roster, while automatic topics still can',()=>{
  const h=createHarness(3);
  h.act('data-start');h.act('data-members-done');h.act('data-topic-source',{topicSource:'custom'});
  h.act('data-host-id',{hostId:'p1'});
  assert.match(h.app.innerHTML,/4人以上必要/);
  assert.match(h.app.innerHTML,/data-begin disabled/);
  h.act('data-begin');
  assert.match(h.app.className,/screen-setup$/);
  h.act('data-topic-source',{topicSource:'auto'});
  h.act('data-begin');
  assert.match(h.app.className,/screen-pass$/);
  assert.equal(h.keys.get('word-wolf').players.length,3);
  assert.equal(h.keys.get('word-wolf').host,null);
});
