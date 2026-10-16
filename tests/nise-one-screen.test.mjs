import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const js=readFileSync(new URL('../games/nise-transfer-student/game.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../games/nise-transfer-student/one-screen.css',import.meta.url),'utf8');
const html=readFileSync(new URL('../games/nise-transfer-student/index.html',import.meta.url),'utf8');
const sourceBetween=(begin,end)=>{
 const a=js.indexOf(begin),b=js.indexOf(end,a+1);
 assert.ok(a>=0&&b>a,'source sections exist: '+begin);
 return js.slice(a,b);
};
test('offline game remains valid and loads single-screen overrides after legacy CSS',()=>{
 assert.doesNotThrow(()=>new Function(js));
 assert.match(html,/href="game\.css"/);
 assert.match(html,/href="one-screen\.css\?v=20261016-v3"/);
 assert.ok(html.indexOf('href="one-screen.css')>html.indexOf('href="../../resume.css'));
 assert.match(html,/game\.js\?v=20261016-title-members4/);
 assert.match(css,/\.nise-one-screen \.nise-play-shell/);
 assert.match(css,/@media \(min-width:760px\) and \(min-height:560px\)/);
 assert.match(css,/height:100dvh/);
});
test('role reveal, night action, discussion, vote and result reuse the same three-pane layout',()=>{
 const src=sourceBetween('const ONE_SCREEN_STAGES=','function screenHtml(){');
 for(const stage of ['revealPass','revealRole','nightIntro','nightPass','nightAction','discussion','votePass','vote','result','cover','voteComplete']){
  assert.ok(src.includes("'"+stage+"'"),stage+' uses compact layout');
 }
 assert.match(src,/nise-play-head/);
 assert.match(src,/nise-play-board/);
 assert.match(src,/nise-play-actions/);
 assert.match(src,/activateOneScreenLayout\(\)/);
 assert.match(src,/fitOneScreenCards\(\)/);
});
test('responsive board cards stay within available width for 3–10 members and mobile/desktop viewports',()=>{
 const src=sourceBetween('function fitOneScreenCards(){','function activateOneScreenLayout(){');
 const widths=[320,360,390,430,768,1024,1440];
 for(const n of [3,4,5,6,7,8,9,10]){
  const cols=n<=5?n:n===6?3:n<=8?4:5;
  for(const w of widths){
   for(const h of [570,700,900]){
    let pixels=0;
    const board={style:{
     getPropertyValue:k=>k==='--player-cols'?String(cols):'',
     setProperty(k,v){if(k==='--card-size')pixels=Number(v.replace('px',''))}
    }};
    const app={querySelector:sel=>sel==='.nise-play-board .table-board'?board:null};
    const state={playerCount:n};
    const window={innerWidth:w,innerHeight:h};
    new Function('app','state','window',src+';fitOneScreenCards();')(app,state,window);
    const wide=w>=760&&h>=560;
    const availableWidth=wide?Math.min(w,1080)*.58-25:Math.min(w,1080)-42;
    const maxByWidth=(availableWidth-22-(cols-1)*4)/cols;
    assert.ok(pixels>=28&&pixels<=94, 'size bounds '+n+'/'+w+'/'+h);
    assert.ok(pixels<=Math.floor(maxByWidth)+1, 'no card width overflow '+n+'/'+w+'/'+h+' size '+pixels);
   }
  }
 }
});
test('result screen renders compact victory + final board + collapsed vote detail + replay controls',()=>{
 const fn=sourceBetween('function resultScreen(){','function startGame(){');
 const state={playerCount:4,
   players:[{name:'A',icon:'🐯'},{name:'B',icon:'🐼'},{name:'C',icon:'🐦'},{name:'D',icon:'🐰'}],
   votes:[1,2,1,1]};
 const calcResult=()=>({kind:'real',expelled:[1],max:3,reason:'ニセ転校生を見つけました。',logo:'result.png',winner:'ホンモノサイド勝利'});
 const esc=s=>String(s).replaceAll('<','&lt;');
 const topNav=()=>'<nav></nav>';
 const gameBoard=opts=>'<div class="table-board" data-all="'+!!opts.revealAll+'" data-rest="'+!!opts.revealRest+'"></div>';
 const output=new Function('state','calcResult','esc','topNav','gameBoard',fn+'return resultScreen();')(state,calcResult,esc,topNav,gameBoard);
 assert.match(output,/class="result-logo"/);
 assert.match(output,/data-all="true" data-rest="true"/);
 assert.match(output,/<details class="nise-result-details">/);
 assert.match(output,/<summary>投票結果・誰が誰に投票したか<\/summary>/);
 assert.doesNotMatch(output,/<details[^>]* open/);
 assert.match(output,/id="restartSame"/);
 assert.match(output,/id="restartRoles"/);
 assert.equal((output.match(/vote-detail-row/g)||[]).length,4);
});
test('changing the board after president investigation, seat swap or rest reveal recalculates card size',()=>{
 const instances=js.match(/board\.outerHTML=gameBoard\([^;]+\);fitOneScreenCards\(\);/g)||[];
 assert.equal(instances.length,4);
 assert.match(css,/\.nise-one-screen \.nise-play-actions \.swap-result-cards/);
 assert.match(css,/\.nise-one-screen \.nise-play-board \.table-card-wrap/);
 assert.match(css,/\.nise-one-screen \.nise-result-details\[open\]/);
});

test('role setup switches between four basic and four advanced roles without losing the role counts',()=>{
 const rolesScreenSource=sourceBetween('function rolesScreen(){','function revealPassScreen(){');
 assert.match(rolesScreenSource,/data-role-tab="basic"/);
 assert.match(rolesScreenSource,/data-role-tab="advanced"/);
 assert.match(rolesScreenSource,/state\.roleTab==='advanced'\?ADVANCED_ROLE_KEYS:BASIC_ROLE_KEYS/);
 assert.match(js,/state\.roleTab=b\.dataset\.roleTab==='advanced'\?'advanced':'basic'/);
 assert.match(js,/state\.screen==='roles'\?' nise-role-setup'/);
 assert.match(css,/\.game-app\.nise-role-setup/);
 assert.match(css,/\.nise-role-setup \.role-select-card/);
 const state={
  playerCount:4,roleTab:'basic',
  players:Array.from({length:4},(_,i)=>({id:'p'+i,name:'P'+i,icon:'🐼'})),
  roleCounts:{classmate:2,fake:2,president:1,swapper:1,dayDuty:0,observer:0,collaborator:0,trickster:0}
 };
 const basicKeys=['classmate','fake','president','swapper'],advancedKeys=['observer','dayDuty','collaborator','trickster'];
 const ROLE_DEFS=Object.fromEntries([...basicKeys,...advancedKeys].map(k=>[k,{name:k,side:'real',image:k+'.png',max:k==='classmate'?10:2}]));
 const fn=new Function('state','ROLE_DEFS','BASIC_ROLE_KEYS','ADVANCED_ROLE_KEYS','roleMax','roleMin','needCards','totalCards','topNav','heading','sideLabel','esc','window',
   rolesScreenSource+'return rolesScreen;');
 const build=fn(state,ROLE_DEFS,basicKeys,advancedKeys,()=>2,()=>0,()=>6,()=>6,()=>'<nav/>',t=>t,()=>'',String,{});
 const a=build();
 assert.match(a,/classmate/);assert.match(a,/swapper/);
 assert.doesNotMatch(a,/class="role-title">observer/);
 state.roleTab='advanced';
 const b=build();
 assert.match(b,/class="role-title">observer/);
 assert.match(b,/class="role-title">trickster/);
 assert.doesNotMatch(b,/class="role-title">classmate/);
 assert.equal(state.roleCounts.fake,2);
});
