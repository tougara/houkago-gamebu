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
 assert.equal(r.nise.stage,'night','the FIRST person should start night without waiting');
 assert.equal(niseView(r,outsider).stage,'night');
 for(const m of r.members.slice(1)){
  assert.equal(niseView(r,m.id).stage,'reveal','the others are still viewing their own roles');
  assert.equal(niseView(r,m.id).nightIsMyTurn,false);
  assert.equal(act(r,m.id,{type:'nise-night-done'}),false,'no action before own confirmation');
 }
 assert.equal(act(r,outsider,{type:'nise-reveal-done'}),false);
 for(const m of r.members.slice(1)){
  assert.equal(act(r,m.id,{type:'nise-reveal-done'}),true);
  assert.equal(niseView(r,m.id).stage,'night');
 }
 assert.equal(r.nise.stage,'night');
});

test('本人だけが確認した直後、他の人の確認が終わらなくても調査できる',()=>{
 const r=make(4),g=r.nise;dealNise(g);
 g.initial={p0:'president',p1:'swapper',p2:'fake',p3:'classmate'};
 g.final={...g.initial};g.rest=['fake','classmate'];
 assert.equal(act(r,'p0',{type:'nise-reveal-done'}),true);
 assert.equal(niseView(r,'p0').stage,'night');
 assert.equal(niseView(r,'p1').stage,'reveal');
 assert.equal(act(r,'p0',{type:'nise-night-action',kind:'player',target:'p2'}),true);
 assert.equal(niseView(r,'p0').myIntel.role,'fake');
 assert.equal(act(r,'p0',{type:'nise-night-done'}),true);
 assert.equal(g.stage,'night','other players still need their own actions');
 assert.equal(niseView(r,'p1').stage,'reveal','late confirmer is not skipped');
 assert.equal(act(r,'p1',{type:'nise-night-action',kind:'skip'}),false,'not confirmed yet');
 for(const id of ['p1','p2','p3'])assert.equal(act(r,id,{type:'nise-reveal-done'}),true);
 assert.equal(act(r,'p1',{type:'nise-night-action',kind:'skip'}),true);
 for(const id of ['p1','p2','p3'])assert.equal(act(r,id,{type:'nise-night-done'}),true);
 assert.equal(g.stage,'discussion');
});
test('全員の夜行動は順番を待たずに同時処理し、調査は最初の役職を参照',()=>{
 const r=make(4),g=r.nise;dealNise(g);
 g.initial={p0:'fake',p1:'president',p2:'swapper',p3:'classmate'};
 g.final={...g.initial};g.rest=['fake','classmate'];
 g.stage='night';g.nightDone=[];g.revealed=[...g.memberIds];
 assert.equal(niseView(r,'p1').nightIsMyTurn,true);
 assert.equal(niseView(r,'p2').nightIsMyTurn,true);
 assert.equal(act(r,'p2',{type:'nise-night-action',kind:'swap',target:'p0'}),true);
 assert.equal(g.final.p0,'swapper');
 assert.equal(g.final.p2,'fake');
 assert.equal(niseView(r,'p2').myIntel.originalRole,'swapper');
 assert.equal(niseView(r,'p2').myIntel.role,'fake');
 assert.equal(niseView(r,'p2').myIntel.otherRole,'swapper');
 // The president can examine their target AFTER the swap, but sees its ORIGINAL role.
 assert.equal(act(r,'p1',{type:'nise-night-action',kind:'player',target:'p0'}),true);
 assert.equal(niseView(r,'p1').myIntel.role,'fake');
 assert.equal(niseView(r,'p1').myIntel.target,'p0');
 assert.equal(niseView(r,'p0').myIntel,null);
 assert.equal(act(r,'p1',{type:'nise-night-action',kind:'rest'}),false);
 assert.equal(act(r,'p3',{type:'nise-night-done'}),true);
 assert.equal(niseView(r,'p3').myNightDone,true);
 assert.equal(niseView(r,'p2').myNightDone,false);
 assert.equal(act(r,'p1',{type:'nise-night-done'}),true);
 assert.equal(act(r,'p2',{type:'nise-night-done'}),true);
 assert.equal(act(r,'p0',{type:'nise-night-done'}),true);
 assert.equal(g.stage,'discussion');
 assert.deepEqual(g.nightDone.sort(),['p0','p1','p2','p3']);
 assert.equal(act(r,'p2',{type:'nise-night-done'}),false);
});
test('複数人の同時調査も初期スナップショットを参照する',()=>{
 const r=make(5),g=r.nise;dealNise(g);
 g.initial={p0:'swapper',p1:'observer',p2:'dayDuty',p3:'fake',p4:'president'};
 g.final={...g.initial};g.rest=['fake','classmate'];g.stage='night';g.nightDone=[];g.revealed=[...g.memberIds];
 assert.equal(act(r,'p0',{type:'nise-night-action',kind:'swap',target:'p3'}),true);
 assert.equal(act(r,'p1',{type:'nise-night-action',kind:'compare',targets:['p3','p4']}),true);
 assert.equal(niseView(r,'p1').myIntel.same,false);
 assert.equal(act(r,'p4',{type:'nise-night-action',kind:'player',target:'p3'}),true);
 assert.equal(niseView(r,'p4').myIntel.role,'fake');
 assert.equal(act(r,'p2',{type:'nise-night-action',kind:'rest',index:1}),true);
 assert.deepEqual(niseView(r,'p2').myIntel.roles,['classmate']);
 assert.equal(niseView(r,'p3').myIntel,null);
 for(const id of g.memberIds)assert.equal(act(r,id,{type:'nise-night-done'}),true);
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
 assert.equal(g.stage,'voteComplete');
 assert.equal(g.result,null,'result stays private until host publishes');
 assert.equal(niseView(r,'p1').result,null);
 assert.equal(act(r,'p1',{type:'nise-publish-result'}),false,'guest cannot publish');
 assert.equal(act(r,'p0',{type:'nise-publish-result'}),true);
 assert.equal(g.stage,'result');
 assert.equal(g.result.kind,'real');
 assert.deepEqual(g.result.expelled,['p2']);
 assert.equal(niseView(r,'p3').result.final.p2,'fake');
});

test('結果発表前は投票先と勝敗を見せず、公開操作は一度きり',()=>{
 const r=make(3),g=r.nise;dealNise(g);
 g.stage='voting';g.initial={p0:'classmate',p1:'fake',p2:'president'};
 g.final={...g.initial};
 const votes=[['p0','p1'],['p1','p0'],['p2','p1']];
 for(const [id,target] of votes)assert.equal(act(r,id,{type:'nise-vote',target}),true);
 assert.equal(g.stage,'voteComplete');
 for(const id of g.memberIds){
  const view=niseView(r,id);
  assert.equal(view.result,null);
  assert.ok(!('votes' in view));
  assert.ok(!('final' in view));
 }
 assert.equal(act(r,'p0',{type:'nise-publish-result'}),true);
 assert.equal(act(r,'p0',{type:'nise-publish-result'}),false);
 assert.equal(g.result.kind,'real');
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

test('online-only chat never reveals secret role data and can be sent only during discussion',()=>{
 const r=make(4),g=r.nise;dealNise(g);
 assert.equal(act(r,'p0',{type:'nise-chat',text:'始めよう'}),false);
 g.stage='discussion';
 assert.equal(act(r,'p0',{type:'nise-chat',text:'だれが怪しい？'}),true);
 assert.equal(niseView(r,'p1').chat[0].text,'だれが怪しい？');
 assert.equal(niseView(r,'p2').chat.length,1);
 assert.equal(act(r,'p0',{type:'nise-chat',text:'すぐ連続投稿'}),false);
 g.stage='voting';
 assert.equal(niseView(r,'p1').chat.length,0);
 assert.equal(act(r,'p1',{type:'nise-chat',text:'投票中です'}),false);
});

test('online Nise offers all eight illustrated role guides in setup and during play without exposing other roles',()=>{
 const html=readFileSync(new URL('../online/nise-transfer-student/index.html',import.meta.url),'utf8');
 const css=readFileSync(new URL('../online/nise-transfer-student/game.css',import.meta.url),'utf8');
 const client=readFileSync(new URL('../online/nise-transfer-student/game.js',import.meta.url),'utf8');
 assert.doesNotThrow(()=>new Function(client),'client script is syntactically valid');
 assert.match(html,/id="role-guide-open"/);
 assert.match(html,/id="role-guide-content"/);
 assert.match(html,/role="dialog" aria-modal="true"/);
 assert.match(html,/game\.js\?v=20261018-role-guide1/);
 assert.match(css,/\.nise-guide-grid/);
 assert.match(css,/\.nise-guide-large-image/);
 assert.match(client,/function roleGuideList\(/);
 assert.match(client,/function roleGuideDetail\(/);
 assert.match(client,/function openGuide\(/);
 assert.match(client,/data-role-detail="\x27\+k\+/,'setup role icon opens details');
 assert.match(client,/sideNames\[d\.side\]/);
 assert.match(client,/roleGuide\.hidden=true/);
 const imageNames=['role_classmate.png','role_fake_transfer_student.png',
  'role_class_representative.png','role_seat_changer.png','role_observer.png',
  'role_day_duty.png','role_secret_collaborator.png','role_trickster.png'];
 for(const image of imageNames)assert.ok(client.includes(image),'missing '+image);
 const r=make(6);
 act(r,'p0',{type:'nise-begin'});
 const publicView=niseView(r,'p1');
 assert.ok(publicView.counts,'the publicly configured deck counts can be shown in guide');
 assert.ok(!('initial' in publicView),'guide must not receive all private identities');
 assert.ok(!('final' in publicView),'guide must not receive other private identities');
 assert.ok(!('rest' in publicView),'guide must not receive hidden rest cards');
});
