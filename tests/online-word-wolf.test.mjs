import {test} from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {createWolf,wolfView,wolfAction,wolfAnswerMatches,normalizedWolf} from '../worker/src/wolf-engine.js';
import {WOLF_PAIRS,WOLF_CATEGORIES} from '../worker/src/wolf-questions.js';
if(!globalThis.crypto)globalThis.crypto=webcrypto;
const fixture=(n=5)=>{
 const room={hostId:'p0',members:Array.from({length:n},(_,i)=>({id:'p'+i,name:'人'+i,icon:'🐼'}))};
 room.wolf=createWolf(room);return room;
};
const act=(r,id,type,rest={})=>wolfAction(r,id,{type,...rest});
const config=(r,extra={})=>({type:'wolf-config',settings:{...r.wolf.settings,...extra}});
const begin=(r,n=0)=>{assert.equal(act(r,'p0','wolf-begin'),true);assert.equal(r.wolf.stage,'reveal')};
const discuss=r=>{for(const id of r.wolf.activeIds)assert.equal(act(r,id,'wolf-word-done'),true);assert.equal(r.wolf.stage,'discussion')};
const voted=(r,targets)=>{
 assert.equal(act(r,'p0','wolf-start-vote'),true);
 for(const [id,target] of Object.entries(targets))assert.equal(act(r,id,'wolf-vote',{target}),true);
 assert.equal(r.wolf.stage,'voteComplete');
 assert.equal(act(r,'p0','wolf-publish'),true);
};
test('offline 150 pairs and six categories are reused',()=>{
 assert.equal(WOLF_PAIRS.length,150);assert.equal(WOLF_CATEGORIES.length,6);
 assert.equal(new Set(WOLF_PAIRS.map(x=>x.id)).size,150);
 assert.ok(WOLF_PAIRS.every(x=>x.a&&x.b&&WOLF_CATEGORIES.includes(x.category)));
});
test('setup restricted to host, 3-10 players, input validated',()=>{
 for(let n=3;n<=10;n++){
  const r=fixture(n);
  assert.equal(r.wolf.stage,'setup');
  assert.equal(act(r,'p1','wolf-config',{settings:{...r.wolf.settings,mode:'simple'}}),false);
  assert.equal(wolfView(r,'p1').myWord,null);
  assert.equal(act(r,'p0','wolf-config',{settings:{...r.wolf.settings,duration:666}}),false);
  begin(r);
 }
 const r=fixture(3);
 assert.equal(act(r,'p0','wolf-config',{settings:{...r.wolf.settings,source:'custom'}}),true);
 assert.equal(act(r,'p0','wolf-begin'),false,'custom author requires 4 total');
});
test('secret words only reach each player during their reveal',()=>{
 const r=fixture(5);begin(r);
 const g=r.wolf;
 assert.ok(g.majority&&g.minority&&g.majority!==g.minority);
 const words=r.members.map(p=>wolfView(r,p.id).myWord);
 assert.equal(words.filter(w=>w===g.minority).length,1);
 assert.equal(words.filter(w=>w===g.majority).length,4);
 for(const m of r.members){
  const v=wolfView(r,m.id);
  assert.ok(!('wolfId' in v)&&!('majority' in v)&&!('minority' in v)&&!('votes' in v));
  assert.equal(v.result,null);
 }
 assert.equal(act(r,'p1','wolf-word-done'),true);
 assert.equal(act(r,'p1','wolf-word-done'),false);
 discussRemaining(r,['p0','p2','p3','p4']);
 assert.equal(g.stage,'discussion');
 assert.equal(wolfView(r,'p3').myWord,null);
 assert.equal(wolfView(r,'p2').isWolf,false);
});
function discussRemaining(r,ids){for(const id of ids)assert.equal(act(r,id,'wolf-word-done'),true)}
test('discussion timer host-only and voting does not auto disclose totals',()=>{
 const r=fixture(4);begin(r);discuss(r);
 assert.equal(act(r,'p1','wolf-timer',{action:'toggle'}),false);
 assert.equal(act(r,'p0','wolf-timer',{action:'toggle'}),true);
 assert.equal(r.wolf.paused,false);
 assert.equal(act(r,'p0','wolf-timer',{action:'adjust',seconds:30}),true);
 assert.equal(act(r,'p0','wolf-timer',{action:'toggle'}),true);
 assert.equal(r.wolf.paused,true);
 assert.equal(act(r,'p1','wolf-start-vote'),false);
 assert.equal(act(r,'p0','wolf-start-vote'),true);
 assert.equal(act(r,'p1','wolf-vote',{target:'p1'}),false,'no self vote');
 assert.equal(act(r,'p1','wolf-vote',{target:'not-member'}),false);
 assert.equal(act(r,'p1','wolf-vote',{target:'p0'}),true);
 assert.equal(act(r,'p1','wolf-vote',{target:'p2'}),false);
 assert.equal(wolfView(r,'p2').voteCount,1);
 assert.equal(wolfView(r,'p2').firstTally,null);
 assert.equal(act(r,'p0','wolf-publish'),false);
});
test('wrongly expelled civilian gives wolf victory only after host publishes',()=>{
 const r=fixture(4);begin(r);discuss(r);
 r.wolf.wolfId='p3';
 assert.equal(act(r,'p0','wolf-start-vote'),true);
 for(const [id,target] of [['p0','p1'],['p1','p0'],['p2','p1'],['p3','p1']])assert.equal(act(r,id,'wolf-vote',{target}),true);
 assert.equal(r.wolf.stage,'voteComplete');
 assert.equal(wolfView(r,'p2').result,null);
 assert.equal(act(r,'p2','wolf-publish'),false);
 assert.equal(act(r,'p0','wolf-publish'),true);
 assert.equal(r.wolf.stage,'result');assert.equal(r.wolf.result.winner,'wolf');
 assert.equal(r.wolf.result.eliminated,'p1');
});
test('finding wolf in simple mode awards human victory',()=>{
 const r=fixture(3);assert.equal(act(r,'p0','wolf-config',{settings:{...r.wolf.settings,mode:'simple'}}),true);
 begin(r);discuss(r);r.wolf.wolfId='p2';
 voted(r,{p0:'p2',p1:'p2',p2:'p0'});
 assert.equal(r.wolf.stage,'result');assert.equal(r.wolf.result.winner,'human');
});
test('first tie creates runoff; second tie is wolf victory',()=>{
 const r=fixture(4);begin(r);discuss(r);r.wolf.wolfId='p3';
 voted(r,{p0:'p1',p1:'p0',p2:'p1',p3:'p0'});
 assert.equal(r.wolf.stage,'runoffReady');
 assert.equal(wolfView(r,'p1').firstTally.p0,2);
 assert.deepEqual([...r.wolf.candidates].sort(),['p0','p1']);
 assert.equal(act(r,'p2','wolf-runoff'),false);
 assert.equal(act(r,'p0','wolf-runoff'),true);
 assert.equal(act(r,'p2','wolf-vote',{target:'p3'}),false,'runoff candidates only');
 for(const [id,target] of [['p0','p1'],['p1','p0'],['p2','p1'],['p3','p0']])assert.equal(act(r,id,'wolf-vote',{target}),true);
 assert.equal(act(r,'p0','wolf-publish'),true);
 assert.equal(r.wolf.stage,'result');assert.equal(r.wolf.result.winner,'wolf');
 assert.equal(r.wolf.result.runoff,true);
});
test('reverse guess only wolf can submit, aliases work',()=>{
 const r=fixture(4);begin(r);discuss(r);r.wolf.wolfId='p3';
 voted(r,{p0:'p3',p1:'p3',p2:'p3',p3:'p0'});
 assert.equal(r.wolf.stage,'reverse');
 assert.equal(wolfView(r,'p3').isWolf,true);
 assert.equal(wolfView(r,'p0').isWolf,false);
 assert.equal(act(r,'p1','wolf-guess',{guess:'推理'}),false);
 const expected=r.wolf.majority;
 assert.equal(act(r,'p3','wolf-guess',{guess:expected}),true);
 assert.equal(r.wolf.result.winner,'wolf');
 assert.equal(wolfAnswerMatches('カレー','かれー'),true);
 assert.equal(normalizedWolf('カレー'),normalizedWolf('かれー'));
});
test('host can skip reverse guess; next game resets secret fields',()=>{
 const r=fixture(4);begin(r);discuss(r);r.wolf.wolfId='p3';
 voted(r,{p0:'p3',p1:'p3',p2:'p3',p3:'p0'});
 assert.equal(act(r,'p1','wolf-skip-guess'),false);
 assert.equal(act(r,'p0','wolf-skip-guess'),true);
 assert.equal(r.wolf.result.winner,'human');
 assert.equal(act(r,'p1','wolf-again'),false);
 assert.equal(act(r,'p0','wolf-again'),true);
 assert.equal(r.wolf.stage,'setup');assert.equal(r.wolf.wolfId,null);
});
test('custom author does not play, cannot vote, and only author sets words',()=>{
 const r=fixture(4),g=r.wolf;
 assert.equal(act(r,'p0','wolf-config',{settings:{...g.settings,source:'custom',authorId:'p1'}}),true);
 assert.equal(act(r,'p0','wolf-begin'),true);
 assert.equal(g.stage,'customInput');
 assert.equal(wolfView(r,'p1').playing,false);
 assert.equal(act(r,'p0','wolf-custom-topics',{a:'みかん',b:'りんご'}),false);
 assert.equal(act(r,'p1','wolf-custom-topics',{a:'同じ',b:'同じ'}),false);
 assert.equal(act(r,'p1','wolf-custom-topics',{a:'みかん',b:'りんご'}),true);
 assert.equal(g.stage,'reveal');assert.equal(g.activeIds.length,3);
 assert.equal(wolfView(r,'p1').myWord,null);
 for(const id of g.activeIds)assert.equal(act(r,id,'wolf-word-done'),true);
 assert.equal(act(r,'p1','wolf-word-done'),false);
 assert.equal(act(r,'p0','wolf-start-vote'),true);
 assert.equal(act(r,'p1','wolf-vote',{target:'p2'}),false);
});
