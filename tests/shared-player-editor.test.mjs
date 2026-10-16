import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const playerJS=readFileSync(new URL('../player-registry.js',import.meta.url),'utf8');
const playerCSS=readFileSync(new URL('../player-editor.css',import.meta.url),'utf8');
const niseJS=readFileSync(new URL('../games/nise-transfer-student/game.js',import.meta.url),'utf8');
const oneScreen=readFileSync(new URL('../games/nise-transfer-student/one-screen.css',import.meta.url),'utf8');
const gameHTML=readFileSync(new URL('../games/nise-transfer-student/index.html',import.meta.url),'utf8');

function harness(){
 const values=new Map(),handlers={},events=[];
 const window={
  dispatchEvent(e){events.push(e.type)},
  __houkagoPlayerEditorToggleBound:false
 };
 const document={addEventListener(name,handler){handlers[name]=handler}};
 const localStorage={
  getItem:k=>values.get(k)||null,
  setItem:(k,v)=>{values.set(k,v)},
  removeItem:k=>values.delete(k)
 };
 const CustomEvent=class{constructor(type,opts){this.type=type;this.detail=opts?.detail}};
 const prompts=[];
 new Function('window','document','localStorage','CustomEvent','prompt','alert',playerJS)(
  window,document,localStorage,CustomEvent,()=>prompts.shift()||null,()=>{}
 );
 const click=(selector,dataset={})=>{
  const target={
   dataset,
   closest:sel=>sel===selector?target:null,
   setAttribute(){}
  };
  handlers.click({target});
 };
 return {api:window.HoukagoPlayers,values,events,click,prompts};
}
test('a 10-member game renders 10 selectable chips but only ONE name editor',()=>{
 const h=harness(),api=h.api;
 const html=api.renderEditor({min:3,max:10,count:10,title:'参加メンバー'});
 assert.equal(api.load().activeCount,10);
 assert.equal((html.match(/data-shared-member-edit=/g)||[]).length,10);
 assert.equal((html.match(/data-member-name=/g)||[]).length,1);
 assert.equal((html.match(/data-shared-icon-toggle=/g)||[]).length,1);
 assert.match(html,/shared-active-grid/);
 assert.match(html,/data-members-done/);
 assert.doesNotMatch(html,/shared-player-list/);
 assert.doesNotMatch(html,/shared-roster-grid/,'roster is collapsed by default');
 assert.equal((html.match(/data-member-count=/g)||[]).length,8);
});
test('choosing a participant edits only that person and preserves the names and identity',()=>{
 const h=harness(),api=h.api;
 api.renderEditor({min:3,max:10,count:4});
 const id=api.load().players[2].id;
 h.click('[data-shared-member-edit]',{sharedMemberEdit:id});
 let html=api.renderEditor({min:3,max:10,count:4});
 assert.match(html,/data-member-name="2"/);
 assert.match(html,/shared-active-chip selected/);
 api.setPlayer(2,{name:'なつこ'});
 html=api.renderEditor({min:3,max:10,count:4});
 assert.match(html,/value="なつこ"/);
 assert.equal(api.load().players[2].name,'なつこ');
 assert.ok(h.events.includes('houkago-player-selection-changed'));
});
test('member pool opens only on demand and does not delete unselected members',()=>{
 const h=harness(),api=h.api;
 api.renderEditor({min:3,max:10,count:10});
 const first=api.load().players[0].id;
 h.click('[data-shared-roster-toggle]');
 let html=api.renderEditor({min:3,max:10,count:10});
 assert.match(html,/shared-roster-card is-expanded/);
 assert.equal((html.match(/data-member-pick=/g)||[]).length,10);
 api.setActiveCount(3);
 html=api.renderEditor({min:3,max:10,count:3});
 assert.equal((html.match(/data-shared-member-edit=/g)||[]).length,3);
 assert.equal(api.load().roster.length,10);
 assert.ok(api.load().activeIds.includes(first));
 h.click('[data-shared-roster-toggle]');
 html=api.renderEditor({min:3,max:10,count:3});
 assert.doesNotMatch(html,/shared-roster-grid/);
});
test('shared layout responds to smartphone and desktop without duplicating the entire editor',()=>{
 assert.match(playerCSS,/\.compact-player-editor \.shared-active-grid/);
 assert.match(playerCSS,/@media \(min-width:720px\)/);
 assert.match(playerCSS,/\.compact-player-editor \.shared-player-done/);
 assert.match(oneScreen,/\.game-app\.nise-title-screen/);
 assert.match(oneScreen,/\.game-app\.nise-members-screen/);
 assert.match(oneScreen,/height:100dvh/);
 assert.match(oneScreen,/@media\(min-width:760px\) and \(min-height:490px\)/);
 assert.match(gameHTML,/one-screen\.css\?v=20261016-v3/);
 assert.match(gameHTML,/player-editor\.css\?v=20261016-compact1/);
 assert.match(gameHTML,/player-registry\.js\?v=20261016-compact1/);
 assert.match(niseJS,/state\.screen==='title'\?' nise-title-screen'/);
 assert.match(niseJS,/state\.screen==='players'\?' nise-members-screen'/);
 for(const button of ['startSetup','startOnline'])assert.match(niseJS,new RegExp('id="'+button+'"'));
});
test('shared stylesheet and script cache tags are refreshed in every game that loads the registry',()=>{
 const paths=[
  '../games/nise-transfer-student/index.html',
  '../games/minna-wa-docchi/index.html',
  '../games/kyokasho-tower/index.html',
  '../games/gesture-battle/index.html',
  '../games/word-wolf/index.html',
  '../games/pitadome-challenge/index.html',
  '../games/link-burst/index.html',
  '../games/kankaku-meter/index.html',
  '../index.html'
 ];
 for(const path of paths){
  const html=readFileSync(new URL(path,import.meta.url),'utf8');
  assert.match(html,/player-editor\.css\?v=20261016-compact1/);
  assert.match(html,/player-registry\.js\?v=20261016-compact1/);
 }
});
