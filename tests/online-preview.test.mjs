import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const root=new URL('../online/',import.meta.url);
const text=path=>readFileSync(new URL(path,root),'utf8');
const slugs=[
 'minna-wa-docchi','word-wolf','pitadome-challenge','kankaku-meter',
 'kyokasho-tower','link-burst'
];
const simulator=text('offline-preview.js');
const escapeObject=obj=>JSON.parse(JSON.stringify(obj));
function build(slug,search='?testPlay=1'){
 const window={WebSocket:class OriginalWebSocket{}};
 const document={readyState:'loading',addEventListener(){}};
 const location={pathname:'/online/'+slug+'/',search};
 const ctx={window,document,location,URLSearchParams,queueMicrotask,Date,Math,Object,Array,JSON,Number,Set};
 runInNewContext(simulator,ctx);
 return window;
}
test('共通試遊は7作品の選択画面から開けて、各6作品の実際のゲームHTMLに接続',()=>{
 const hub=text('preview/index.html'),lobby=text('index.html');
 const nise=text('nise-transfer-student/index.html');
 assert.match(lobby,/href="\.\/preview\/"/);
 for(const slug of [...slugs,'nise-transfer-student']){
  assert.match(hub,new RegExp(slug+'/\\?testPlay=1'));
 }
 assert.match(nise,/offline-preview\.js\?v=/);
 for(const slug of slugs){
  const page=text(slug+'/index.html'),game=text(slug+'/game.js');
  assert.match(page,/offline-preview\.js\?v=/);
  assert.match(page,/offline-preview\.css\?v=/);
  assert.ok(page.indexOf('offline-preview.js')<page.indexOf('game.js'),'mock must load first: '+slug);
  assert.match(game,/window\.HoukagoOfflinePreview/);
  assert.doesNotThrow(()=>new Function(game));
 }
 assert.doesNotThrow(()=>new Function(simulator));
});
test('試遊用スクリプトは通常のオンラインプレイではWebSocketもセッションも変更しない',()=>{
 for(const slug of slugs){
  const live=build(slug,'');
  assert.equal(live.HoukagoOfflinePreview,undefined);
  assert.equal(live.WebSocket.name,'OriginalWebSocket');
 }
 assert.equal(build('gesture-battle').HoukagoOfflinePreview,undefined);
});
test('6作品で仮プレイヤー、画面一覧、進行ステージの形が合っている',()=>{
 const key={'minna-wa-docchi':'secret','word-wolf':'wolf',
  'pitadome-challenge':'pita','kankaku-meter':'meter',
  'kyokasho-tower':'tower','link-burst':'link'};
 for(const slug of slugs){
  const w=build(slug),demo=w.HoukagoOfflinePreview;
  assert.ok(demo,'preview exists '+slug);
  const snap=escapeObject(demo.snapshot());
  assert.equal(snap.code,'DEMO2026');
  assert.equal(snap.phase,key[slug]);
  assert.equal(snap.hostId,demo.session.id);
  assert.ok(snap.members.length>=2);
  assert.equal(snap.gameId,slug);
  assert.equal(typeof snap[key[slug]],'object');
  for(const stage of Object.keys(demo.labels)){
   demo.choose(stage);
   const next=escapeObject(demo.snapshot());
   assert.equal(next[key[slug]].stage,stage,slug+' / '+stage);
  }
 }
});
test('みんなはどっち：ひみつ投票と読み合いバトルの回答・結果を確認',()=>{
 const demo=build('minna-wa-docchi').HoukagoOfflinePreview;
 demo.handle({type:'secret-mode',mode:'battle'});
 demo.handle({type:'secret-begin'});
 assert.equal(demo.snapshot().secret.stage,'preview');
 demo.handle({type:'secret-accept-question'});
 demo.handle({type:'secret-vote',choice:'a'});
 assert.equal(demo.snapshot().secret.stage,'allAnswered');
 demo.handle({type:'secret-reveal'});
 const result=demo.snapshot().secret;
 assert.equal(result.stage,'result');
 assert.equal(result.mode,'battle');
 assert.ok(result.battleResult.players.length>0);
});
test('オオカミ・ピタ止め・感覚メーター・教科書タワーの主要操作に反応する',()=>{
 const wolf=build('word-wolf').HoukagoOfflinePreview;
 wolf.handle({type:'wolf-begin'});wolf.handle({type:'wolf-word-done'});
 assert.equal(wolf.snapshot().wolf.stage,'discussion');
 wolf.handle({type:'wolf-start-vote'});wolf.handle({type:'wolf-vote',target:'demo-b'});
 wolf.handle({type:'wolf-publish'});assert.equal(wolf.snapshot().wolf.stage,'result');
 const pita=build('pitadome-challenge').HoukagoOfflinePreview;
 pita.handle({type:'pita-begin'});pita.handle({type:'pita-stop',elapsedMs:3000,choice:'heal'});
 assert.equal(pita.snapshot().pita.stage,'review');
 const meter=build('kankaku-meter').HoukagoOfflinePreview;
 meter.handle({type:'meter-begin'});meter.handle({type:'meter-deal'});meter.handle({type:'meter-seen'});
 assert.equal(meter.snapshot().meter.stage,'arrange');
 meter.handle({type:'meter-finalize'});
 meter.handle({type:'meter-show',memberId:'demo-a'});
 assert.equal(meter.snapshot().meter.shownNumbers['demo-a'],72);
 const tower=build('kyokasho-tower').HoukagoOfflinePreview;
 tower.handle({type:'tower-begin'});tower.handle({type:'tower-round-start'});
 const options=tower.snapshot().tower.choices.japanese;
 assert.ok(options.length>0);
 tower.handle({type:'tower-place',subject:'japanese',...options[0]});
 assert.equal(tower.snapshot().tower.board.length,1);
});
test('リンクバースト：2人・盤面13x7・NEXT・操作ボタン確認用にローカル更新',()=>{
 const demo=build('link-burst').HoukagoOfflinePreview;
 demo.choose('playing');
 let view=demo.snapshot().link;
 assert.equal(view.members.length,2);
 assert.equal(view.self.board.length,13);
 assert.ok(view.self.board.every(row=>row.length===7));
 assert.equal(view.opponent.board.length,13);
 assert.equal(view.self.next.length,2);
 const oldX=view.self.piece.x;
 demo.handle({type:'link-control',action:'left',pressed:true});
 view=demo.snapshot().link;
 assert.equal(view.self.piece.x,oldX-1);
 assert.equal(view.stage,'playing');
});

test('ピタ止めのオフライン試遊で通常・かんたん、オフライン版10種類のメーター変化を比較できる',()=>{
 const demo=build('pitadome-challenge').HoukagoOfflinePreview;
 assert.equal(demo.snapshot().pita.difficulty,'normal');
 demo.handle({type:'pita-difficulty',difficulty:'easy'});
 assert.equal(demo.snapshot().pita.difficulty,'easy');
 assert.equal(demo.snapshot().pita.profile.minValue,1);
 demo.handle({type:'pita-difficulty',difficulty:'normal'});
 const cases={
  basic:p=>p.maxValue===100&&p.refPoint===50,
  short:p=>p.barScale===.58,
  long:p=>p.barScale===1,
  blind:p=>p.blind===true,
  fast:p=>p.speed>=118,
  variable:p=>p.movement==='change',
  reverse:p=>p.movement==='reverse',
  reference:p=>p.refPoint===72,
  '150':p=>p.maxValue===150,
  '200':p=>p.maxValue===200
 };
 for(const [key,expected] of Object.entries(cases)){
  assert.equal(demo.choosePitaVariant(key),true);
  const p=demo.snapshot().pita;
  assert.equal(p.stage,'playing');
  assert.ok(expected(p.profile),key);
  assert.equal(p.speed,p.profile.speed);
 }
 assert.equal(demo.choosePitaVariant('invalid'),false);
 const script=text('offline-preview.js');
 assert.ok(script.includes('data-demo-pita'));
});

test('ピタ止め試遊もオフラインと同じカウントダウンで毎ラウンド目標を変える',()=>{
 const d=build('pitadome-challenge').HoukagoOfflinePreview;
 d.handle({type:'pita-begin'});
 const before=d.snapshot().pita;
 assert.ok(Math.abs(before.startedAt-Date.now()-4860)<200);
 const first=before.target;
 d.handle({type:'pita-stop',elapsedMs:1000});
 d.handle({type:'pita-next'});
 const after=d.snapshot().pita;
 assert.notEqual(after.target,first);
 assert.ok(Math.abs(after.startedAt-Date.now()-4860)<200);
 assert.equal(d.choosePitaVariant('150'),true);
 assert.ok(d.snapshot().pita.target>=12&&d.snapshot().pita.target<=138);
 assert.equal(d.choosePitaVariant('200'),true);
 assert.ok(d.snapshot().pita.target>=16&&d.snapshot().pita.target<=184);
 d.choose('setup');
 d.handle({type:'pita-difficulty',difficulty:'easy'});
 d.choose('playing');
 assert.ok(d.snapshot().pita.target>=1&&d.snapshot().pita.target<=100);
});
