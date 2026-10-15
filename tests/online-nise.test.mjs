import {test} from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {createNise,defaultNiseCounts,validNiseCounts,dealNise,niseView,niseAction,niseVoteResult} from '../worker/src/nise-engine.js';
if(!globalThis.crypto)globalThis.crypto=webcrypto;
const room=(n=4)=>({
 hostId:'p0',
 members:Array.from({length:n},(_,i)=>({id:'p'+i,name:'人'+i,icon:'🐼'})),
 nise:null
});
const act=(r,id,info)=>niseAction(r,id,info);
const make=n=>{const r=room(n);r.nise=createNise(r);return r};

test('3〜10人 + おやすみ2枚、役職の枚数制限はオフライン準拠',()=>{
 for(let n=3;n<=10;n++){
  const r=make(n),g=r.nise;
  assert.equal(Object.values(g.counts).reduce((a,b)=>a+b,0),n+2);
  assert.ok(validNiseCounts(g.counts,n));
  assert.equal(defaultNiseCounts(n).fake,2);
  assert.equal(dealNise(g),true);
  assert.equal(g.rest.length,2);
  assert.equal(Object.keys(g.initial).length,n);
 }
 const r=make(4);
 assert.equal(act(r,'p1',{type:'nise-config',duration:420}),false);
 assert.equal(act(r,'p0',{type:'nise-config',duration:420}),true);
 assert.equal(r.nise.duration,420);
 assert.equal(act(r,'p0',{type:'nise-config',counts:{...r.nise.counts,fake:3}}),false);
});

test('役職確認は本人だけ、他人の役職・おやすみ・投票先は結果まで非公開',()=>{
 const r=make(4);act(r,'p0',{type:'nise-begin'});
 const roles=r.nise.initial,rest=r.nise.rest;
 for(const p of r.members){
  const view=niseView(r,p.id);
  assert.equal(view.myRole,roles[p.id]);
  assert.equal(view.result,null);
  assert.ok(!('initial' in view)&&!('final' in view)&&!('rest' in view)&&!('votes' in view));
  assert.ok(!JSON.stringify(view).includes('"tokenHash"'));
 }
 const guest=niseView(r,'not-member');
 assert.equal(guest.myRole,null);
 assert.equal(guest.myIntel,null);
 const outsider=r.members[0].id;
 assert.equal(act(r,outsider,{type:'nise-reveal-done'}),true);
 assert.equal(act(r,outsider,{type:'nise-reveal-done'}),false);
 for(const m of r.members.slice(1))assert.equal(act(r,m.id,{type:'nise-reveal-done'}),true);
 assert.equal(r.nise.stage,'night');
});

test('学級委員が確認したおやすみ2枚は学級委員以外には送られない',()=>{
 const r=make(4);const g=r.nise;dealNise(g);
 g.initial={p0:'fake',p1:'president',p2:'swapper',p3:'classmate'};
 g.final={...g.initial};g.rest=['fake','classmate'];
 g.stage='night';g.nightOrder=['p0','p1','p2','p3'];g.nightCursor=0;
 assert.equal(act(r,'p1',{type:'nise-night-action',kind:'rest'}),false,'not your turn');
 assert.equal(act(r,'p0',{type:'nise-night-done'}),true);
 assert.equal(act(r,'p1',{type:'nise-night-action',kind:'rest'}),true);
 assert.deepEqual(niseView(r,'p1').myIntel.roles,['fake','classmate']);
 assert.equal(niseView(r,'p0').myIntel,null);
 assert.equal(niseView(r,'p2').myIntel,null);
 assert.equal(act(r,'p1',{type:'nise-night-action',kind:'player',target:'p0'}),false,'one investigation only');
 assert.equal(act(r,'p1',{type:'nise-night-done'}),true);
 assert.equal(act(r,'p2',{type:'nise-night-action',kind:'swap',target:'p0'}),true);
 assert.equal(g.final.p0,'swapper');
 assert.equal(g.final.p2,'fake');
 assert.equal(niseView(r,'p2').myIntel.role,'fake');
 assert.equal(niseView(r,'p1').myIntel,null);
 assert.equal(act(r,'p2',{type:'nise-night-done'}),true);
 assert.equal(act(r,'p3',{type:'nise-night-done'}),true);
 assert.equal(g.stage,'discussion');
});

test('秘密投票は1人1票。最多票・席替え後の役職で勝敗が決まる',()=>{
 const r=make(4);const g=r.nise;dealNise(g);
 g.stage='voting';g.initial={p0:'fake',p1:'president',p2:'swapper',p3:'classmate'};
 g.final={p0:'swapper',p1:'president',p2:'fake',p3:'classmate'};
 assert.equal(act(r,'p0',{type:'nise-vote',target:'p0'}),false);
 assert.equal(act(r,'p0',{type:'nise-vote',target:'p2'}),true);
 assert.equal(act(r,'p0',{type:'nise-vote',target:'p1'}),false,'no double vote');
 assert.equal(niseView(r,'p3').votedCount,1);
 assert.equal(niseView(r,'p3').result,null);
 for(const [id,target] of [['p1','p2'],['p2','p1'],['p3','p2']])act(r,id,{type:'nise-vote',target});
 assert.equal(g.stage,'result');
 assert.equal(g.result.kind,'real');
 assert.deepEqual(g.result.expelled,['p2']);
 assert.equal(niseView(r,'p3').result.final.p2,'fake');
});

test('同票最多が全員対象・いたずらっ子勝利・無投票相当の平和も判定',()=>{
 const r=make(4),g=r.nise;dealNise(g);
 g.final={p0:'fake',p1:'trickster',p2:'classmate',p3:'president'};
 g.votes={p0:'p1',p1:'p2',p2:'p1',p3:'p2'};
 assert.equal(niseVoteResult(g,r).kind,'trick');
 assert.deepEqual(niseVoteResult(g,r).expelled,['p1','p2']);
 g.final={p0:'classmate',p1:'president',p2:'swapper',p3:'dayDuty'};
 g.votes={p0:'p1',p1:'p2',p2:'p3',p3:'p0'};
 assert.equal(niseVoteResult(g,r).kind,'peace');
 assert.deepEqual(niseVoteResult(g,r).expelled,[]);
});

test('対戦ルームの秘密配布・ロビー再接続導線がHTMLとWorkerにある',()=>{
 const server=readFileSync(new URL('../worker/src/index.js',import.meta.url),'utf8');
 const client=readFileSync(new URL('../online/nise-transfer-student/game.js',import.meta.url),'utf8');
 const lobby=readFileSync(new URL('../online/lobby.js',import.meta.url),'utf8');
 const offline=readFileSync(new URL('../games/nise-transfer-student/game.js',import.meta.url),'utf8');
 assert.match(server,/nise:niseView\(this\.room,id\)/);
 assert.match(server,/nise:niseView\(this\.room,player\.id\)/);
 assert.match(server,/room\.nise\?'nise'/);
 assert.match(client,/nise-night-action/);
 assert.match(client,/nise-reveal-done/);
 assert.match(client,/nise-rematch/);
 assert.match(client,/data-timer-adjust/);
 assert.match(lobby,/nise-start/);
 assert.match(lobby,/nise-transfer-student/);
 assert.match(offline,/id="startOnline"/);
});
