import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createSabotage,sabotageAction,sabotageView,sabotageRoles,SABOTAGE_COUNTS,sabotageRevealPhase,sabotageHoldMs,sabotageDefaultSettings,sabotageValidateSettings,sabotageChangeSettings} from '../games/sabotage/engine.js';
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
 assert.match(offline,/from '\.\/engine\.js(?:\?v=[^']+)?'/);
 assert.match(online,/from '\.\.\/\.\.\/games\/sabotage\/engine\.js(?:\?v=[^']+)?'/);
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

test('オフライン・オンラインの空振り表示は「反応なし」、内部配線処理はdummyのまま',()=>{
 for(const path of ['games/sabotage/game.js','online/sabotage/game.js']){
  const source=readFileSync(new URL('../'+path,import.meta.url),'utf8');
  assert.match(source,/dummy:'反応なし'/);
  assert.match(source,/sabotageRoleCard|sabotageSlots/);
  assert.match(source,/sabotageRevealBody/);
  assert.doesNotMatch(source,/EMPTY CODE|dummy:'ダミー'|<small>ダミー<\/small>/);
  execFileSync(process.execPath,['--check',new URL('../'+path,import.meta.url).pathname],{stdio:'pipe'});
 }
 const visual=readFileSync(new URL('../games/sabotage/reveal-ui.js',import.meta.url),'utf8');
 assert.match(visual,/何も起きなかった/);
 const g=createSabotage(members(5));
 assert.equal(g.players.flatMap(p=>p.hand).filter(x=>x==='dummy').length,19);
});

test('空振りは解除・BOMBと区別して「反応なし」で表示する',()=>{
 const visual=readFileSync(new URL('../games/sabotage/visuals.js',import.meta.url),'utf8');
 const reveal=readFileSync(new URL('../games/sabotage/reveal-ui.js',import.meta.url),'utf8');
 assert.match(visual,/dummy:'反応なし'/);
 assert.match(visual,/— 反応なし/);
 assert.match(reveal,/bomb\?'BOMB!':'反応なし'/);
 assert.match(reveal,/何も起きなかった……/);
 for(const path of ['games/sabotage/visuals.js','games/sabotage/reveal-ui.js'])
  execFileSync(process.execPath,['--check',new URL('../'+path,import.meta.url).pathname],{stdio:'pipe'});
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
 assert.match(script,/反応なし/);
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

test('ジャッカル勝利条件の表示とオンライン試遊の再戦操作',()=>{
 const visual=readFileSync(new URL('../games/sabotage/visuals.js',import.meta.url),'utf8');
 const online=readFileSync(new URL('../online/sabotage/game.js',import.meta.url),'utf8');
 assert.match(visual,/全解除もBOMB公開も起こさず、4ラウンドを終わらせれば単独勝利/);
 assert.doesNotMatch(visual,/解除成功もBOMBも起こさず/);
 assert.match(online,/case 'demo-restart'/);
 assert.match(online,/もう一度試遊する/);
 assert.match(online,/demoGame=createSabotage\(demoPeople\)/);
 execFileSync(process.execPath,['--check',new URL('../online/sabotage/game.js',import.meta.url).pathname],{stdio:'pipe'});
});

test('サボタージュ画像5点を両モードの共通UIに接続し秘匿状態は維持',()=>{
 const assets=['sabotage_logo.png','sabotage_background.png','sabotage_card_repair.png','sabotage_card_bomb.png','sabotage_card_no_response.png'];
 for(const f of assets)assert.ok(statSync(new URL('../'+f,import.meta.url)).size>10000,f+' must exist in repo root');
 const visual=readFileSync(new URL('../games/sabotage/visuals.js',import.meta.url),'utf8');
 const reveal=readFileSync(new URL('../games/sabotage/reveal-ui.js',import.meta.url),'utf8');
 const css=readFileSync(new URL('../games/sabotage/game.css',import.meta.url),'utf8');
 const offline=readFileSync(new URL('../games/sabotage/game.js',import.meta.url),'utf8');
 const online=readFileSync(new URL('../online/sabotage/game.js',import.meta.url),'utf8');
 const onlineHtml=readFileSync(new URL('../online/sabotage/index.html',import.meta.url),'utf8');
 const listing=readFileSync(new URL('../games/index.html',import.meta.url),'utf8');
 assert.match(visual,/export function sabotageCardArtwork/);
 assert.match(visual,/export function sabotageBrandLogo/);
 for(const file of assets.filter(f=>f.includes('card_')))assert.ok(visual.includes(file));
 assert.match(visual,/const art=opened\?sabotageCardArtwork/);
 assert.match(visual,/sabotageCardArtwork\(type,'','sab-count-art'\)/);
 assert.match(reveal,/sabotageCardArtwork\(type,title,'sab-outcome-art'\)/);
 assert.match(css,/sabotage_background\.png/);
 assert.match(offline,/sabotageBrandLogo\('sab-title-art'\)/);
 assert.match(onlineHtml,/sabotage_logo\.png/);
 assert.match(listing,/sabotage_logo\.png/);
 assert.match(offline,/sabotageRevealBody/);
 assert.match(online,/sabotageRevealBody/);
 const game=createSabotage(members(4));const publicView=sabotageView(game,game.players[0].id);
 assert.ok(publicView.members.every(p=>p.slots.every(s=>s.state!=='opened'&&!('type' in s))));
 for(const file of ['games/sabotage/visuals.js','games/sabotage/reveal-ui.js','games/sabotage/game.js','online/sabotage/game.js'])
  execFileSync(process.execPath,['--check',new URL('../'+file,import.meta.url).pathname],{stdio:'pipe'});
});

test('役職カード3枚をオフライン・オンライン共通の役職表示に接続',async()=>{
 const {sabotageRoleCard,sabotageRoleImagePath}=await import('../games/sabotage/visuals.js');
 const names={crew:'クルーメイト',impostor:'インポスター',jackal:'ジャッカル'};
 for(const role of Object.keys(names)){
  const filename='sabotage_role_'+(role==='crew'?'crewmate':role)+'.png';
  assert.ok(statSync(new URL('../'+filename,import.meta.url)).size>10000,filename+' should exist');
  assert.ok(sabotageRoleImagePath[role]?.endsWith(filename));
  const revealed=sabotageRoleCard(role);
  assert.match(revealed,new RegExp(filename.replaceAll('.','\\.')));
  assert.match(revealed,/sab-role-art-large/);
  assert.ok(revealed.includes('sab-role-goal'));
  assert.doesNotMatch(revealed,/sab-counts/);
  const counts=sabotageRoleCard(role,{repair:1,error:1,dummy:3});
  assert.match(counts,/sab-role-art-mini/);
  assert.match(counts,/sab-counts/);
 }
 const offline=readFileSync(new URL('../games/sabotage/game.js',import.meta.url),'utf8');
 const online=readFileSync(new URL('../online/sabotage/game.js',import.meta.url),'utf8');
 assert.match(offline,/sabotageRoleCard\(p.role,roles\?null:v.myCounts\)/);
 assert.match(online,/roleStage\?sabotageRoleCard\(d.myRole\)/);
 const css=readFileSync(new URL('../games/sabotage/game.css',import.meta.url),'utf8');
 assert.match(css,/sab-role-art-large/);
 assert.match(css,/sab-role-art-mini/);
});

test('タイムボムを参考にした4〜10人用役職プールと余りカード',()=>{
 const expected={4:[3,2,1],5:[3,2,0],6:[4,2,0],7:[5,3,1],8:[5,3,0],9:[7,3,1],10:[8,3,1]};
 for(let n=4;n<=10;n++){
  const [crew,impostor,extra]=expected[n],settings=sabotageDefaultSettings(n);
  assert.deepEqual(settings,{crew,impostor,jackal:false,extra});
  assert.equal(crew+impostor,n+extra);
  const on=sabotageChangeSettings(n,settings,'jackal',true);
  assert.deepEqual(on,{crew:crew-1,impostor,jackal:true,extra});
  assert.equal(on.crew+on.impostor+Number(on.jackal),n+extra);
  assert.deepEqual(sabotageChangeSettings(n,on,'jackal',false),settings);
  const game=createSabotage(members(n),settings);
  assert.equal(game.players.length,n);
  assert.equal(game.players.filter(p=>p.role==='jackal').length,0);
  assert.deepEqual(game.roleSettings,settings);
  assert.equal(sabotageRoles(n,settings).length,n);
  const roleView=sabotageView(game,game.players[0].id);
  assert.ok(roleView.members.every(p=>!('role' in p)));
 }
 assert.deepEqual(sabotageChangeSettings(10,sabotageDefaultSettings(10),'jackal',true),{crew:7,impostor:3,jackal:true,extra:1});
});
test('役職候補枚数編集・余りカード切替・不正値ブロック',()=>{
 let c=sabotageDefaultSettings(7);
 assert.deepEqual(sabotageChangeSettings(7,c,'impostor',-1),{crew:6,impostor:2,jackal:false,extra:1});
 c=sabotageChangeSettings(7,c,'extra',0);
 assert.deepEqual(c,{crew:4,impostor:3,jackal:false,extra:0});
 assert.deepEqual(sabotageChangeSettings(7,c,'extra',1),sabotageDefaultSettings(7));
 c=sabotageChangeSettings(7,c,'crew',1);
 assert.deepEqual(c,{crew:5,impostor:2,jackal:false,extra:0});
 assert.equal(sabotageChangeSettings(7,c,'crew',100),null);
 assert.throws(()=>sabotageValidateSettings(7,{crew:7,impostor:0,jackal:false,extra:0}));
 assert.throws(()=>sabotageValidateSettings(7,{crew:3,impostor:3,jackal:false,extra:0}));
 assert.throws(()=>sabotageValidateSettings(7,{crew:3.2,impostor:3,jackal:true,extra:0}));
 assert.throws(()=>sabotageValidateSettings(7,{crew:4,impostor:3,jackal:false,extra:2}));
 assert.equal(sabotageChangeSettings(4,{crew:2,impostor:2,jackal:true,extra:1},'crew',-1),null);
 for(let i=0;i<100;i++){
  const game=createSabotage(members(10),{crew:7,impostor:3,jackal:true,extra:1});
  assert.equal(game.players.length,10);
  assert.ok(game.players.filter(p=>p.role==='crew').length>=6);
  assert.ok(game.players.filter(p=>p.role==='impostor').length>=2);
  assert.ok(game.players.filter(p=>p.role==='jackal').length<=1);
 }
});
test('共通役職設定UIは候補枚数だけ表示し配布結果を含まない',async()=>{
 const {sabotageSettingsPanel}=await import('../games/sabotage/visuals.js');
 const cfg=sabotageChangeSettings(10,sabotageDefaultSettings(10),'jackal',true);
 const html=sabotageSettingsPanel(10,cfg);
 assert.match(html,/候補11枚/);
 assert.match(html,/ジャッカルを追加/);
 assert.match(html,/data-sab-setting="crew"/);
 assert.match(html,/data-sab-setting="impostor"/);
 assert.match(html,/data-sab-setting="jackal"/);
 assert.match(html,/data-sab-setting="extra"/);
 assert.match(html,/配布 10枚/);
 const readonly=sabotageSettingsPanel(10,cfg,false);
 assert.doesNotMatch(readonly,/data-sab-setting=/);
 const offline=readFileSync(new URL('../games/sabotage/game.js',import.meta.url),'utf8');
 const lobby=readFileSync(new URL('../online/lobby.js',import.meta.url),'utf8');
 const worker=readFileSync(new URL('../worker/src/index.js',import.meta.url),'utf8');
 assert.match(offline,/sabotageSettingsPanel\(n,settings\)/);
 assert.match(lobby,/sabotageSettingsPanel\(room.members.length,room.sabotageSettings/);
 assert.match(worker,/sabotageValidateSettings\(this.room.members.length,data.settings\)/);
 for(const path of ['games/sabotage/game.js','online/lobby.js','games/sabotage/engine.js','games/sabotage/visuals.js','worker/src/index.js'])
  execFileSync(process.execPath,['--check',new URL('../'+path,import.meta.url).pathname],{stdio:'pipe'});
});

test('決着カットインは勝者公開より先、3種類の演出はオフライン・オンライン共通',async()=>{
 const {sabotageFinaleBody,sabotageFinalePhase,sabotageFinaleKind,sabotageFinaleMs}=await import('../games/sabotage/finale-ui.js');
 for(const [winner,type,kind,asset] of [
  ['impostor','error','bomb','sabotage_card_bomb.png'],
  ['crew','repair','crew','sabotage_card_repair.png'],
  ['jackal','dummy','timeout','sabotage_card_no_response.png'],
  ['impostor','dummy','timeout','sabotage_card_no_response.png']
 ]){
  assert.equal(sabotageFinaleKind(winner,{type}),kind);
  const html=sabotageFinaleBody(winner,{type});
  assert.match(html,new RegExp('data-finale="'+kind+'"'));
  assert.ok(html.includes(asset));
  assert.doesNotMatch(html,/勝利！|YOU WIN/);
 }
 assert.deepEqual(sabotageFinalePhase(5000,5000),{active:true,waitMs:sabotageFinaleMs});
 assert.deepEqual(sabotageFinalePhase(5000,5000+sabotageFinaleMs),{active:false,waitMs:0});
 assert.deepEqual(sabotageFinalePhase(null,5000),{active:false,waitMs:0});
 const game=createSabotage(members(4));revealAll(game);
 game.currentId=game.players.find(p=>!p.hand.includes('error')).id;
 const target=game.players.find(p=>p.id!==game.currentId&&p.hand.includes('error'));
 const index=target.hand.indexOf('error');
 assert.ok(sabotageAction(game,game.currentId,{type:'sabotage-cut',targetId:target.id,index}));
 assert.equal(game.finishedAt,undefined);
 assert.ok(advance(game));
 assert.equal(game.stage,'finished');
 assert.ok(game.finishedAt>0);
 assert.equal(sabotageView(game,game.players[0].id).finishedAt,game.finishedAt);
 for(const p of ['games/sabotage/finale-ui.js','games/sabotage/game.js','online/sabotage/game.js'])
  execFileSync(process.execPath,['--check',new URL('../'+p,import.meta.url).pathname],{stdio:'pipe'});
});

test('未公開コードは共通のグレー裏面、公開されたコードは対応する表面',async()=>{
 const {sabotageSlots,sabotageCardBackArtwork,sabotageCardBackPath}=await import('../games/sabotage/visuals.js');
 const {sabotageRevealBody}=await import('../games/sabotage/reveal-ui.js');
 assert.equal(sabotageCardBackPath,'../../sabotage_card_back.png');
 assert.ok(statSync(new URL('../sabotage_card_back.png',import.meta.url)).size>100000);
 const slots=[{state:'closed'},{state:'closed'},{state:'opened',type:'repair'},{state:'opened',type:'error'},{state:'inactive'}];
 for(const selectable of [true,false]){
  const html=sabotageSlots(slots,selectable);
  assert.equal(html.split('sabotage_card_back.png').length-1,2);
  assert.equal(html.split('sab-slot-back-art').length-1,2);
  assert.match(html,/sabotage_card_repair.png/);
  assert.match(html,/sabotage_card_bomb.png/);
  assert.match(html,/配布なし/);
 }
 const concealed=sabotageRevealBody('error','suspense',0,4);
 assert.match(concealed,/sabotage_card_back.png/);
 assert.doesNotMatch(concealed,/sabotage_card_bomb.png|BOMB!/);
 for(const type of ['repair','error','dummy'])
  assert.doesNotMatch(sabotageRevealBody(type,'ready',1,4),/sabotage_card_back.png/);
 assert.match(sabotageCardBackArtwork('demo'),/aria-hidden="true"/);
 for(const file of ['games/sabotage/visuals.js','games/sabotage/reveal-ui.js'])
  execFileSync(process.execPath,['--check',new URL('../'+file,import.meta.url).pathname],{stdio:'pipe'});
});

test('オフラインの決着後タイマーは render 内で毎回登録される',()=>{
 const code=readFileSync(new URL('../games/sabotage/game.js',import.meta.url),'utf8');
 const start=code.indexOf('function render(){');
 const end=code.indexOf('\nfunction begin(){',start);
 assert.ok(start>=0&&end>start);
 const renderBlock=code.slice(start,end);
 assert.match(renderBlock,/if\(g\?\.stage==='finished'&&screen==='result'\)/);
 assert.match(renderBlock,/if\(finale.active\)\s*\{/);
 assert.match(renderBlock,/revealTimer=setTimeout/);
 assert.match(renderBlock,/Math.ceil\(waitMs\)\+30/);
 assert.match(renderBlock,/clearTimeout\(revealTimer\)/);
 assert.doesNotMatch(code.slice(end,end+120),/sabotageFinalePhase/);
 const css=readFileSync(new URL('../games/sabotage/game.css',import.meta.url),'utf8');
 assert.match(css,/\.sab-reveal-visual\.repair \.sab-status-badges/);
 assert.match(css,/\.sab-badge\.is-cleared \.sab-badge-front/);
});

test('ラウンド移行時は共有された再配布時刻が先に見え、役職やコード内訳は露出しない',async()=>{
 const {sabotageRoundIntroPhase,sabotageRoundIntroBody,sabotageRoundIntroMs}=await import('../games/sabotage/transition-ui.js');
 const g=createSabotage(members(4));revealAll(g);
 const view1=sabotageView(g,g.players[0].id);
 assert.equal(view1.roundIntroAt,null,'first round has no transition');
 for(let turn=0;turn<4;turn++){
  const {target,index}=cut(g);
  const ix=target.slots.slice(0,index).filter(s=>s.state==='closed').length;
  target.hand[ix]='dummy';
  assert.ok(sabotageAction(g,g.currentId,{type:'sabotage-cut',targetId:target.id,index}));
  assert.ok(advance(g));
 }
 assert.equal(g.stage,'briefing');
 assert.equal(g.round,2);
 assert.ok(Number.isFinite(g.roundIntroAt));
 const view=sabotageView(g,g.players[0].id);
 assert.equal(view.roundIntroAt,g.roundIntroAt);
 assert.ok(view.members.every(p=>!('role' in p)));
 assert.deepEqual(sabotageRoundIntroPhase(2,g.roundIntroAt,g.roundIntroAt),{active:true,waitMs:sabotageRoundIntroMs});
 assert.deepEqual(sabotageRoundIntroPhase(2,g.roundIntroAt,g.roundIntroAt+sabotageRoundIntroMs),{active:false,waitMs:0});
 assert.deepEqual(sabotageRoundIntroPhase(1,g.roundIntroAt,g.roundIntroAt),{active:false,waitMs:0});
 const html=sabotageRoundIntroBody(2);
 assert.match(html,/ROUND 2/);assert.match(html,/CODES RESHUFFLED/);
 assert.match(html,/シャッフル・再配布/);
 assert.doesNotMatch(html,/myCounts|impostor|repairCount|BOMB/);
 for(const path of ['games/sabotage/transition-ui.js','games/sabotage/game.js','online/sabotage/game.js'])
  execFileSync(process.execPath,['--check',new URL('../'+path,import.meta.url).pathname],{stdio:'pipe'});
 const offline=readFileSync(new URL('../games/sabotage/game.js',import.meta.url),'utf8');
 const online=readFileSync(new URL('../online/sabotage/game.js',import.meta.url),'utf8');
 assert.match(offline,/sabotageRoundIntroPhase\(g\.round,g\.roundIntroAt\)/);
 assert.match(online,/sabotageRoundIntroPhase\(d\.round,d\.roundIntroAt\)/);
});
test('BOMBは警報→爆弾カード確定→勝利画面の順で時刻同期する',async()=>{
 const {sabotageBombFinalePhase,sabotageBombWarningMs,sabotageFinaleMs,
        sabotageFinaleBody}=await import('../games/sabotage/finale-ui.js');
 const start=10000;
 assert.equal(sabotageBombFinalePhase(start,start).step,'alert');
 assert.deepEqual(sabotageBombFinalePhase(start,start),{step:'alert',waitMs:sabotageBombWarningMs});
 assert.equal(sabotageBombFinalePhase(start,start+sabotageBombWarningMs).step,'card');
 assert.deepEqual(sabotageBombFinalePhase(start,start+sabotageFinaleMs),{step:'card',waitMs:0});
 const alert=sabotageFinaleBody('impostor',{type:'error'},'alert');
 const card=sabotageFinaleBody('impostor',{type:'error'},'card');
 assert.match(alert,/data-finale-step="alert"/);
 assert.match(alert,/CRITICAL ALERT/);
 assert.match(alert,/sab-finale-warning/);
 assert.doesNotMatch(alert,/class="sab-finale-heading"|sab-finale-card-label|YOU WIN!/);
 assert.match(card,/data-finale-step="card"/);
 assert.match(card,/class="sab-finale-heading">BOMB!/);
 assert.match(card,/爆弾（BOMB）/);
 assert.doesNotMatch(card,/YOU WIN!/);
 const crew=sabotageFinaleBody('crew',{type:'repair'});
 assert.match(crew,/ALL CLEAR!/);
 const offline=readFileSync(new URL('../games/sabotage/game.js',import.meta.url),'utf8');
 const online=readFileSync(new URL('../online/sabotage/game.js',import.meta.url),'utf8');
 for(const s of [offline,online]){
  assert.match(s,/sabotageBombFinalePhase/);
  assert.match(s,/sabotageFinaleBody/);
  assert.match(s,/Math\.min\(finale\.waitMs,bomb\.waitMs\|\|finale\.waitMs\)/);
 }
});
