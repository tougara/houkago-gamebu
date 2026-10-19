import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {webcrypto} from 'node:crypto';
import {OnlineRoom} from '../worker/src/index.js';
if(!globalThis.crypto)globalThis.crypto=webcrypto;
const repo=new URL('../',import.meta.url);
const get=p=>readFileSync(new URL(p,repo),'utf8');
const offline=['nise-transfer-student','minna-wa-docchi','word-wolf',
 'kankaku-meter','kyokasho-tower','gesture-battle','pitadome-challenge','link-burst'];
const online=offline.filter(x=>x!=='gesture-battle');
const store=()=>{const data=new Map();return {
 getItem:k=>data.has(k)?data.get(k):null,setItem:(k,v)=>data.set(k,String(v)),
 removeItem:k=>data.delete(k),key:i=>[...data.keys()][i]??null,
 get length(){return data.size},data
}};
function resume(){
 const storage=store(),events=[];
 const window={dispatchEvent:e=>events.push(e.type)};
 class CustomEvent{constructor(type){this.type=type}}
 const document={querySelector:()=>null,body:{classList:{add(){},remove(){}}}};
 runInNewContext(get('resume.js'),{window,document,localStorage:storage,CustomEvent,Date,JSON,Set,Map,Intl,confirm:()=>true});
 return {api:window.HoukagoResume,storage,events};
}
test('オフライン8作品で途中保存・復元・バック保護・タイトル復帰を確認',()=>{
 for(const game of offline){
  const html=get('games/'+game+'/index.html'),js=get('games/'+game+'/game.js');
  assert.match(html,/resume\.js/,'resume loaded: '+game);
  assert.match(html,/game-back-guard\.js/,'back guard loaded: '+game);
  assert.match(js,/HoukagoResume/,'resume API: '+game);
  assert.match(js,/\.offer(?:\?\.)?\(/,'resume offer: '+game);
  assert.match(js,/pagehide/,'pagehide save: '+game);
  assert.doesNotThrow(()=>new Function(js),'valid JS: '+game);
 }
 const guard=get('game-back-guard.js');
 assert.match(guard,/location\.replace\(defaultExit\)/);
 assert.match(guard,/hg-back-discard/);
 assert.match(guard,/HoukagoResume\?\.discard/);
 assert.doesNotMatch(guard,/history\.go\(-2\)/);
});
test('セーブ8作品の個別削除と全削除はランキングなど別データを残す',()=>{
 const {api,storage}=resume();
 for(const game of offline)api.save(game,{title:game,path:'/games/'+game+'/'},{screen:'playing'});
 storage.setItem('houkago-rankings','do not delete');
 assert.equal(api.savedGames().length,8);
 api.clear('word-wolf');
 assert.equal(api.savedGames().length,7);
 assert.equal(api.load('word-wolf'),null);
 assert.equal(storage.getItem('houkago-rankings'),'do not delete');
 api.clearAll();
 assert.equal(api.savedGames().length,0);
 assert.equal(api.latest(),null);
 assert.equal(storage.getItem('houkago-rankings'),'do not delete');
});
test('離脱時に破棄指定した保存はページを閉じるオートセーブで復活しない',()=>{
 const {api}=resume();
 api.save('link-burst',{title:'リンクバースト！',path:'/games/link-burst/'},{screen:'playing'});
 assert.ok(api.latest());
 api.discard('link-burst');
 assert.equal(api.load('link-burst'),null);
 assert.equal(api.save('link-burst',{title:'link'},{screen:'playing'}),null);
 assert.equal(api.latest(),null);
});
test('破損・古いインデックスによる実体のない「続きから」は表示しない',()=>{
 const {api,storage}=resume();
 storage.setItem('houkago_resume_index_v1',JSON.stringify({'ghost':{title:'消したセーブ',path:'/games/ghost/',updatedAt:9}}));
 assert.equal(api.latest(),null);
 api.save('gesture-battle',{title:'ジェスチャー',path:'/games/gesture-battle/'},{screen:'play'});
 storage.removeItem('houkago_resume_v1_gesture-battle');
 assert.equal(api.savedGames().length,0);
 assert.equal(api.latest(),null);
});
test('セーブを管理・削除する入口はホームと確認画面の両方にある',()=>{
 const js=get('resume.js'),css=get('resume.css'),home=get('home.js');
 assert.match(js,/続きのセーブを管理・削除/);
 assert.match(js,/この続きのセーブを削除/);
 assert.match(js,/全ゲームの続きのセーブを削除/);
 assert.match(css,/hg-resume-manager-item/);
 assert.match(home,/mountLatest/);
 const list=get('games/index.html');
 assert.match(list,/id="openSavedGames"/);
 assert.match(list,/HoukagoResume\?\.manage/);
});
test('オンライン7作品すべてに退室ボタンと両方の戻る導線がある',()=>{
 const control=get('online/exit-control.js'),css=get('online/exit-control.css');
 assert.doesNotThrow(()=>new Function(control));
 assert.match(control,/data-exit-stop/);assert.match(control,/data-exit-leave/);
 assert.match(control,/data-exit-local/);
 assert.match(control,/stopImmediatePropagation/);
 assert.match(control,/api\/rooms\//);
 assert.match(css,/hk-exit-button/);assert.match(css,/hk-exit-overlay/);
 for(const game of online){
  const html=get('online/'+game+'/index.html');
  const js=get('online/'+game+'/game.js');
  assert.match(html,/exit-control\.css/,'exit CSS: '+game);
  assert.match(html,/exit-control\.js/,'exit script: '+game);
  assert.match(js,/houkago-online-room-state/,'sync host: '+game);
 }
});
async function fixture(){
 const stored=new Map(),sockets=[];
 const storage={
  get:async k=>stored.get(k),
  put:async(k,v)=>stored.set(k,structuredClone(v)),
  deleteAll:async()=>stored.clear(),deleteAlarm:async()=>{},
  setAlarm:async()=>{}
 };
 const worker=new OnlineRoom({storage,getWebSockets:()=>sockets,blockConcurrencyWhile:fn=>fn()},{});
 const req=(path,data)=>new Request('https://internal'+path,{method:'POST',body:JSON.stringify(data)});
 const a=await(await worker.fetch(req('/create',{code:'ABCD2345',name:'host',gameId:'pitadome-challenge'}))).json();
 const b=await(await worker.fetch(req('/join',{name:'guest'}))).json();
 return {worker,a,b,req,stored};
}
test('HTTP退出は偽トークン・ゲストの対戦終了を拒否し、本人のみ退出',async()=>{
 const {worker,a,b,req}=await fixture();
 let response=await worker.fetch(req('/exit',{token:'0'.repeat(64),mode:'leave'}));
 assert.equal(response.status,401);
 response=await worker.fetch(req('/exit',{token:b.token,mode:'stop'}));
 assert.equal(response.status,403);
 assert.equal(worker.room.members.length,2);
 response=await worker.fetch(req('/exit',{token:b.token,mode:'leave'}));
 assert.equal(response.status,200);
 assert.equal(worker.room.members.length,1);
 assert.equal(worker.room.members[0].id,a.id);
});
test('ホストの汎用対戦終了は7フェーズで部屋メンバーを残しロビーへ戻す',async()=>{
 const phases=['secret','nise','wolf','pita','meter','tower','link'];
 for(const phase of phases){
  const {worker,a,req}=await fixture();
  worker.broadcast=()=>{}; // test isolated shared cleanup, not individual game rendering
  worker.room[phase]={stage:'playing'};
  worker.room.members.forEach(m=>m.ready=true);
  const r=await worker.fetch(req('/exit',{token:a.token,mode:'stop'}));
  assert.equal(r.status,200,phase);
  assert.equal(worker.room.members.length,2);
  assert.ok(phases.every(p=>!worker.room[p]),'room phases cleared: '+phase);
  assert.ok(worker.room.members.every(m=>m.ready===false));
 }
});
test('公開Workerルートは認証済みの退出コマンドのみ受け付ける',()=>{
 const source=get('worker/src/index.js');
 assert.match(source,/join\|ws\|exit/);
 assert.match(source,/TOKEN\.test\(body\?\.token\)/);
 assert.match(source,/X-Room-Token|digest\(body\.token\)/);
 assert.match(source,/data\.type==='room-stop'/);
});

test('独立した2人対戦3画面も戻る保護があり、ソロセーブと対戦セーブを混同しない',()=>{
 const pages=[
  'games/pitadome-challenge/versus/index.html',
  'games/link-burst/versus/index.html',
  'games/link-burst/versus/play.html'
 ];
 for(const path of pages){
  const html=get(path);
  assert.match(html,/game-back-guard\.js\?v=20261019-exit2/);
 }
 assert.match(get('games/pitadome-challenge/versus/index.html'),/resume\.js\?v=/);
 assert.match(get('games/link-burst/versus/play.html'),/resume\.js\?v=/);
 const guard=get('game-back-guard.js');
 assert.match(guard,/pitadome-versus/);
 assert.match(guard,/link-burst-versus/);
 const {api}=resume();
 api.save('link-burst',{title:'solo',path:'/games/link-burst/'},{test:'solo'});
 api.save('link-burst-versus',{title:'versus',path:'/games/link-burst/versus/play.html'},{test:'vs'});
 api.discard('link-burst-versus');
 assert.equal(api.load('link-burst-versus'),null);
 assert.ok(api.load('link-burst'));
});
