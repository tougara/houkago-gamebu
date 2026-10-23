import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createSabotage,sabotageAction,sabotageView,sabotageRoles,SABOTAGE_COUNTS,sabotageRevealPhase,sabotageHoldMs} from '../games/sabotage/engine.js';
const members=n=>Array.from({length:n},(_,i)=>({id:'p'+i,name:'参加者'+i,icon:'🐶'}));
const revealAll=g=>{if(g.stage==='roles'){for(const p of g.players)assert.equal(sabotageAction(g,p.id,{type:'sabotage-role-seen'}),true);assert.equal(g.stage,'briefing')}for(const p of g.players)assert.equal(sabotageAction(g,p.id,{type:'sabotage-seen'}),true);assert.equal(g.stage,'playing')};
const cut=g=>{const target=g.players.find(p=>p.id!==g.currentId&&p.hand.length);assert.ok(target);const desired=Math.max(0,target.hand.indexOf('dummy'));let remaining=0,index=0;for(let i=0;i<5;i++)if(target.slots[i].state==='closed'){if(remaining===desired){index=i;break}remaining++}return {target,index}};
const advance=g=>{if(g.lastCut)g.lastCut.startedAt=Date.now()-10000;return sabotageAction(g,g.currentId,{type:'sabotage-next'})};
test('4〜10人の人数別コード・陣営候補・秘匿表示',()=>{
 for(let n=4;n<=10;n++){
  const c=SABOTAGE_COUNTS[n];assert.ok(c);
  for(let sample=0;sample<12;sample++){
   const g=createSabotage(members(n));
   assert.equal(g.players.length,n);
   assert.equal(g.stage,'roles');
   assert.equal(g.round,1);assert.equal(g.required,c.repair);
   const all=g.players.flatMap(p=>p.hand);
   assert.equal(all.length,n*5);
   assert.equal(all.filter(x=>x==='repair').length,c.repair);
   assert.equal(all.filter(x=>x==='error').length,1);
   assert.equal(all.filter(x=>x==='dummy').length,n*5-c.repair-1);
   assert.ok(g.players.some(p=>p.role==='crew'));
   assert.ok(g.players.some(p=>p.role==='impostor'));
   assert.ok(g.players.filter(p=>p.role==='jackal').length<=1);
   const v=sabotageView(g,g.players[0].id);
   assert.equal(v.myRole,g.players[0].role);
   assert.equal(v.myCounts.repair+v.myCounts.error+v.myCounts.dummy,5);
   assert.ok(v.members.every(p=>!('role' in p)&&!('hand' in p)));
   assert.ok(!('hand' in v)&&!('players' in v));
   const encoded=JSON.stringify(v);assert.ok(!encoded.includes('"hand":'));
  }
 }
});
test('配線公開は現在の選択者が他人に一度だけ行える',()=>{
 const g=createSabotage(members(10));
 assert.equal(sabotageAction(g,g.players[0].id,{type:'sabotage-cut',targetId:g.players[1].id,index:0}),false);
 revealAll(g);
 const id=g.currentId,t=g.players.find(p=>p.id!==id);
 assert.equal(sabotageAction(g,id,{type:'sabotage-cut',targetId:id,index:0}),false);
 assert.equal(sabotageAction(g,t.id,{type:'sabotage-cut',targetId:id,index:0}),false);
 assert.equal(sabotageAction(g,id,{type:'sabotage-cut',targetId:t.id,index:999}),false);
 const original=t.hand.length;
 assert.equal(sabotageAction(g,id,{type:'sabotage-cut',targetId:t.id,index:0}),true);
 assert.equal(t.hand.length,original-1);
 assert.equal(g.currentId,t.id);
 assert.equal(g.stage,'reveal');
 assert.equal(sabotageAction(g,id,{type:'sabotage-cut',targetId:t.id,index:0}),false);
});
test('ラウンド移行後は全員同数に再配布し直前の対象者から開始',()=>{
 const g=createSabotage(members(9));revealAll(g);
 let lastTarget=null;
 for(let turn=0;turn<9;turn++){
  const {target,index}=cut(g),id=g.currentId;
  // 正常な手番進行を9回繰り返す。コードは毎回実際に除去する。
  const remainingIndex=target.slots.slice(0,index).filter(s=>s.state==='closed').length;
  if(target.hand[remainingIndex]!=='dummy')target.hand[remainingIndex]='dummy';
  assert.equal(sabotageAction(g,id,{type:'sabotage-cut',targetId:target.id,index}),true);
  assert.equal(g.stage,'reveal');
  lastTarget=target.id;
  assert.equal(advance(g),true);
 }
 assert.equal(g.round,2);
 assert.equal(g.stage,'briefing');
 assert.equal(g.currentId,lastTarget);
 assert.ok(g.players.every(p=>p.hand.length===4&&!p.seen));
 revealAll(g);assert.equal(g.stage,'playing');
});
test('危険・全修復・ジャッカル・ジャッカル不在の勝利分岐',()=>{
 const g=createSabotage(members(8));revealAll(g);
 let t=g.players.find(p=>p.id!==g.currentId);t.hand[0]='error';
 assert.equal(sabotageAction(g,g.currentId,{type:'sabotage-cut',targetId:t.id,index:0}),true);
 assert.equal(g.pendingResult,'impostor');advance(g);
 assert.equal(g.winner,'impostor');
 let v=sabotageView(g,g.players[0].id);assert.ok(v.members.every(p=>p.role));assert.equal(v.hasJackal,g.players.some(p=>p.role==='jackal'));
 const h=createSabotage(members(10));revealAll(h);h.repaired=h.required-1;t=h.players.find(p=>p.id!==h.currentId);t.hand[0]='repair';
 sabotageAction(h,h.currentId,{type:'sabotage-cut',targetId:t.id,index:0});
 assert.equal(h.pendingResult,'crew');advance(h);assert.equal(h.winner,'crew');
 for(const hasSpy of [false,true]){
  const x=createSabotage(members(9));revealAll(x);
  x.players[0].role=hasSpy?'jackal':'crew';for(const p of x.players.slice(1))if(p.role==='jackal')p.role='crew';
  x.round=4;x.cuts=8;
  const c=cut(x);c.target.hand[c.index]='dummy';
  sabotageAction(x,x.currentId,{type:'sabotage-cut',targetId:c.target.id,index:c.index});
  assert.equal(x.pendingResult,hasSpy?'jackal':'impostor');
  advance(x);
  assert.equal(x.stage,'finished');
 }
});
test('定型チャットは進行中だけ許可、送信時の秘密を含まない',()=>{
 const g=createSabotage(members(4));const id=g.players[0].id;
 assert.equal(sabotageAction(g,id,{type:'sabotage-chat',key:0}),false);
 revealAll(g);
 assert.equal(sabotageAction(g,id,{type:'sabotage-chat',key:2}),true);
 assert.equal(sabotageAction(g,id,{type:'sabotage-chat',key:2}),false);
 assert.equal(sabotageView(g,id).chat.length,1);
 assert.equal(sabotageAction(g,id,{type:'sabotage-chat',key:999}),false);
});
test('オフラインとオンラインは同一ルールエンジンを使用',()=>{
 const offline=readFileSync(new URL('../games/sabotage/game.js',import.meta.url),'utf8');
 const online=readFileSync(new URL('../online/sabotage/game.js',import.meta.url),'utf8');
 const worker=readFileSync(new URL('../worker/src/index.js',import.meta.url),'utf8');
 assert.match(offline,/from '\.\/engine\.js'/);
 assert.match(online,/from '\.\.\/\.\.\/games\/sabotage\/engine\.js'/);
 assert.match(worker,/from '\.\.\/\.\.\/games\/sabotage\/engine\.js'/);
 for(const path of ['games/sabotage/engine.js','games/sabotage/game.js','online/sabotage/game.js','worker/src/index.js']){
  execFileSync(process.execPath,['--check',new URL('../'+path,import.meta.url).pathname],{stdio:'pipe'});
 }
});

test('オフライン・オンラインで解除／爆弾の表示名を統一',()=>{
 for(const path of ['games/sabotage/game.js','online/sabotage/game.js']){
  const source=readFileSync(new URL('../'+path,import.meta.url),'utf8');
  assert.match(source,/解除コード/);
  assert.match(source,/爆弾（BOMB）/);
  assert.match(source,/sabotageRevealBody/);
  assert.doesNotMatch(source,/致命的エラー|SYSTEM ERROR!|REPAIRED!/);
 }
 const visual=readFileSync(new URL('../games/sabotage/reveal-ui.js',import.meta.url),'utf8');
 assert.match(visual,/'BOMB!'/);
 const engine=readFileSync(new URL('../games/sabotage/engine.js',import.meta.url),'utf8');
 assert.match(engine,/解除コードがある！/);
 assert.match(engine,/爆弾があるかも/);
});

test('オフライン・オンラインの空振り表示は「しーん……」、内部配線処理はdummyのまま',()=>{
 for(const path of ['games/sabotage/game.js','online/sabotage/game.js']){
  const source=readFileSync(new URL('../'+path,import.meta.url),'utf8');
  assert.match(source,/dummy:'しーん……'/);
  assert.match(source,/<small>しーん……<\/small>/);
  assert.match(source,/sabotageRevealBody/);
  assert.doesNotMatch(source,/EMPTY CODE|dummy:'ダミー'|<small>ダミー<\/small>/);
  execFileSync(process.execPath,['--check',new URL('../'+path,import.meta.url).pathname],{stdio:'pipe'});
 }
 const visual=readFileSync(new URL('../games/sabotage/reveal-ui.js',import.meta.url),'utf8');
 assert.match(visual,/何も起きなかった/);
 const g=createSabotage(members(5));
 assert.equal(g.players.flatMap(p=>p.hand).filter(x=>x==='dummy').length,19);
});

test('公開前は結果を伏せ、ランダムな「……」の後に3種類をめくる',()=>{
 const cut={type:'dummy',startedAt:1000,suspenseMs:2050};
 assert.deepEqual(sabotageRevealPhase(cut,1000),{stage:'suspense',waitMs:2050});
 assert.deepEqual(sabotageRevealPhase(cut,3049),{stage:'suspense',waitMs:1});
 assert.deepEqual(sabotageRevealPhase(cut,3050),{stage:'result',waitMs:sabotageHoldMs('dummy')});
 assert.deepEqual(sabotageRevealPhase(cut,3050+sabotageHoldMs('dummy')),{stage:'ready',waitMs:0});
 assert.ok(sabotageHoldMs('error')>sabotageHoldMs('repair'));
 assert.ok(sabotageHoldMs('error')>sabotageHoldMs('dummy'));
 for(const type of ['repair','error','dummy']){
  const x={type,startedAt:1000,suspenseMs:2050};
  assert.equal(sabotageRevealPhase(x,3049).stage,'suspense');
  assert.equal(sabotageRevealPhase(x,3050).stage,'result');
 }
});
test('演出中の「次へ」はサーバー側でも拒否し、公開後なら進める',()=>{
 const g=createSabotage(members(5));revealAll(g);
 const {target,index}=cut(g),by=g.currentId;
 assert.equal(sabotageAction(g,by,{type:'sabotage-cut',targetId:target.id,index}),true);
 assert.ok(g.lastCut.suspenseMs>=1550);
 assert.ok(g.lastCut.suspenseMs<=3650);
 assert.equal(sabotageAction(g,g.currentId,{type:'sabotage-next'}),false);
 assert.equal(g.stage,'reveal');
 assert.equal(advance(g),true);
});
test('解除・しーん・BOMBの3結果は共通演出を使用',()=>{
 const script=readFileSync(new URL('../games/sabotage/reveal-ui.js',import.meta.url),'utf8');
 assert.match(script,/data-reveal-stage="suspense"/);
 assert.match(script,/解除成功！/);
 assert.match(script,/しーん……/);
 assert.match(script,/BOMB!/);
 const offline=readFileSync(new URL('../games/sabotage/game.js',import.meta.url),'utf8');
 const online=readFileSync(new URL('../online/sabotage/game.js',import.meta.url),'utf8');
 assert.match(offline,/sabotageRevealBody\(/);
 assert.match(online,/sabotageRevealBody\(/);
 for(const path of ['games/sabotage/engine.js','games/sabotage/reveal-ui.js','games/sabotage/game.js','online/sabotage/game.js'])
  execFileSync(process.execPath,['--check',new URL('../'+path,import.meta.url).pathname],{stdio:'pipe'});
});

test('役職だけを先に公開し全員確認後ROUND1のコード内訳へ進む',()=>{
 const g=createSabotage(members(6));
 assert.equal(g.stage,'roles');
 assert.equal(sabotageAction(g,g.players[0].id,{type:'sabotage-seen'}),false);
 for(const p of g.players)assert.equal(sabotageAction(g,p.id,{type:'sabotage-role-seen'}),true);
 assert.equal(g.stage,'briefing');
 const v=sabotageView(g,g.players[0].id);
 assert.equal(v.myRole,g.players[0].role);
 assert.equal(v.myCounts.repair+v.myCounts.error+v.myCounts.dummy,5);
 revealAll(g);
});
test('5つの位置は公開後も固定。表返りカード種のみ全員に見える',()=>{
 const g=createSabotage(members(5));revealAll(g);
 const from=g.currentId,p=g.players.find(x=>x.id!==from);
 const before=sabotageView(g,from).members.find(x=>x.id===p.id);
 assert.equal(before.slots.length,5);
 assert.ok(before.slots.every(x=>x.state==='closed'));
 p.hand[2]='repair';
 assert.equal(sabotageAction(g,from,{type:'sabotage-cut',targetId:p.id,index:2}),true);
 const v=sabotageView(g,from),slots=v.members.find(x=>x.id===p.id).slots;
 assert.equal(slots.length,5);
 assert.equal(slots[2].state,'opened');
 assert.equal(slots[2].type,'repair');
 assert.equal(slots.filter(x=>x.state==='closed').length,4);
 assert.ok(slots.filter(x=>x.state==='closed').every(x=>!('type' in x)));
 assert.equal(sabotageAction(g,from,{type:'sabotage-cut',targetId:p.id,index:2}),false);
});
test('5枠表示・解除バッジ・秘密再確認・勝利演出は両モードで共有',()=>{
 const visual=readFileSync(new URL('../games/sabotage/visuals.js',import.meta.url),'utf8');
 for(const name of ['sabotageSlots','sabotageBadges','sabotageVictory','sabotageRoleCard','sabotageCutConfirm'])assert.match(visual,new RegExp('function '+name));
 for(const path of ['games/sabotage/game.js','online/sabotage/game.js']){
  const src=readFileSync(new URL('../'+path,import.meta.url),'utf8');
  for(const name of ['sabotageSlots','sabotageBadges','sabotageVictory','sabotageRoleCard','sabotageCutConfirm'])assert.match(src,new RegExp(name+'\\('));
 }
 const offline=readFileSync(new URL('../games/sabotage/game.js',import.meta.url),'utf8');
 const online=readFileSync(new URL('../online/sabotage/game.js',import.meta.url),'utf8');
 assert.match(offline,/data-hold="briefing"/);
 assert.match(offline,/data-hold="review"/);
 assert.match(online,/case 'private'/);
 for(const path of ['games/sabotage/engine.js','games/sabotage/visuals.js','games/sabotage/game.js','online/sabotage/game.js','games/sabotage/reveal-ui.js'])
  execFileSync(process.execPath,['--check',new URL('../'+path,import.meta.url).pathname],{stdio:'pipe'});
});
