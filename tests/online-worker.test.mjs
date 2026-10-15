import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import service,{OnlineRoom} from '../worker/src/index.js';

class MemoryStorage{
 constructor(){this.data=new Map();this.alarmTime=null}
 async get(key){return this.data.get(key)}
 async put(key,value){this.data.set(key,structuredClone(value))}
 async setAlarm(time){this.alarmTime=time}
 async deleteAll(){this.data.clear()}
 async deleteAlarm(){this.alarmTime=null}
}
class Stub{
 constructor(){
  this.sockets=[];this.storage=new MemoryStorage();
  this.ctx={storage:this.storage,getWebSockets:()=>this.sockets,
   blockConcurrencyWhile:fn=>fn(),acceptWebSocket:socket=>this.sockets.push(socket)};
  this.obj=new OnlineRoom(this.ctx,{});
 }
 async fetch(req){return this.obj.fetch(req)}
}
const instances=new Map();
const env={ALLOWED_ORIGIN:'https://houkago-gamebu.pages.dev',ROOMS:{
 idFromName:name=>name,
 get:id=>{if(!instances.has(id))instances.set(id,new Stub());return instances.get(id)}
}};
const req=(path,body,origin='https://houkago-gamebu.pages.dev')=>new Request('https://api.test'+path,{
 method:'POST',headers:{Origin:origin,'Content-Type':'application/json','CF-Connecting-IP':'203.0.113.5'},
 body:JSON.stringify(body)
});
const sock=id=>({id,events:[],deserializeAttachment(){return{id}},
 send(text){this.events.push(JSON.parse(text))},close(code){this.closed=code}});

test('unapproved origin blocked; invitation code and token stay distinct',async()=>{
 const denied=await service.fetch(req('/api/rooms',{name:'A'},'https://other.example'),env);
 assert.equal(denied.status,403);
 const created=await service.fetch(req('/api/rooms',{name:'A',icon:'🐯'}),env);
 assert.equal(created.status,201);
 const item=await created.json();
 assert.match(item.code,/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{8}$/);
 assert.match(item.token,/^[a-f0-9]{64}$/);
 assert.equal(item.room.members[0].icon,'🐯');
 assert.ok(!JSON.stringify(item.room).includes(item.token));
 assert.ok(!JSON.stringify(item.room).includes('tokenHash'));
});
test('join, ready and host-only game selection work',async()=>{
 const a=await (await service.fetch(req('/api/rooms',{name:'Host'}),env)).json();
 const b=await (await service.fetch(req('/api/rooms/'+a.code+'/join',{name:'Guest',icon:'🐼'}),env)).json();
 const stub=instances.get('room:'+a.code),host=sock(a.id),guest=sock(b.id);
 assert.notEqual(a.token,b.token);
 stub.sockets.push(host,guest);
 await stub.obj.webSocketMessage(host,JSON.stringify({type:'ready',ready:true}));
 await stub.obj.webSocketMessage(guest,JSON.stringify({type:'ready',ready:true}));
 assert.equal(stub.obj.snapshot().allReady,true);
 await stub.obj.webSocketMessage(guest,JSON.stringify({type:'game',gameId:'kyokasho-tower'}));
 assert.equal(stub.obj.room.gameId,'minna-wa-docchi');
 await stub.obj.webSocketMessage(host,JSON.stringify({type:'game',gameId:'kyokasho-tower'}));
 assert.equal(stub.obj.room.gameId,'kyokasho-tower');
 assert.equal(stub.obj.snapshot().allReady,false);
 await stub.obj.removeMember(a.id);
 assert.equal(stub.obj.room.hostId,b.id);
 await stub.obj.removeMember(b.id);
 assert.equal(stub.obj.room,null);
});

test('room holds ten and permits rapid creation without 4/hour lockout',async()=>{
 const a=await (await service.fetch(req('/api/rooms',{name:'X'}),env)).json();
 const stub=instances.get('room:'+a.code);
 for(let i=0;i<9;i++)assert.equal((await stub.fetch(req('/join',{name:'p'+i}))).status,201);
 assert.equal((await stub.fetch(req('/join',{name:'Over'}))).status,409);
 await stub.obj.alarm();
 assert.equal(stub.obj.room,null);
 for(let i=0;i<5;i++)assert.equal((await service.fetch(req('/api/rooms',{name:'X'}),env)).status,201);
});

test('all 15 standard player icons are accepted',async()=>{
 for(const icon of ['🐶','🐱','🐰','🐼','🦊','🐸','🐧','🐯','🐨','🐵','🦁','🐹','🦍','🦄','👻']){
  const st=new Stub();
  const r=await st.fetch(req('/create',{code:'ABCD2345',name:'Test',gameId:'minna-wa-docchi',icon}));
  assert.equal(r.status,201);
  assert.equal((await r.json()).room.members[0].icon,icon);
 }
});

test('host-only setup offers 10 genres, custom questions and 3/5/7/10 round choices',async()=>{
 const st=new Stub();
 const h=await (await st.fetch(req('/create',{code:'ABCD2345',name:'Host',gameId:'minna-wa-docchi'}))).json();
 const b=await (await st.fetch(req('/join',{name:'Guest'}))).json();
 const host=sock(h.id),guest=sock(b.id);st.sockets.push(host,guest);
 for(const u of [host,guest])await st.obj.webSocketMessage(u,JSON.stringify({type:'ready',ready:true}));
 await st.obj.webSocketMessage(guest,JSON.stringify({type:'secret-start'}));
 assert.equal(st.obj.room.secret,undefined);
 await st.obj.webSocketMessage(host,JSON.stringify({type:'secret-start'}));
 assert.equal(st.obj.snapshot().secret.stage,'setup');
 assert.equal(st.obj.snapshot().secret.categories.length,10);
 assert.equal(st.obj.snapshot().secret.selectedCategories.length,8);
 assert.equal(st.obj.snapshot().secret.modeSelected,false);
 await st.obj.webSocketMessage(host,JSON.stringify({type:'secret-mode',mode:'secret'}));
 await st.obj.webSocketMessage(guest,JSON.stringify({type:'secret-config',roundCount:10,categories:['学校のホンネ'],includeCustom:true}));
 assert.equal(st.obj.snapshot().secret.roundCount,5);
 await st.obj.webSocketMessage(host,JSON.stringify({type:'secret-config',roundCount:3,categories:[],includeCustom:true}));
 assert.equal(st.obj.snapshot().secret.roundCount,3);
 await st.obj.webSocketMessage(host,JSON.stringify({type:'secret-custom-add',question:{q:'好きな数字は？',a:'1',b:'2'}}));
 await st.obj.webSocketMessage(host,JSON.stringify({type:'secret-custom-add',question:{q:'学校で遊ぶなら？',a:'鬼ごっこ',b:'かくれんぼ'}}));
 assert.equal(st.obj.snapshot().secret.customQuestions.length,2);
 await st.obj.webSocketMessage(host,JSON.stringify({type:'secret-begin'}));
 assert.equal(st.obj.snapshot().secret.stage,'setup','two questions cannot fill three rounds');
 await st.obj.webSocketMessage(host,JSON.stringify({type:'secret-config',roundCount:3,categories:['学校のホンネ'],includeCustom:true}));
 await st.obj.webSocketMessage(host,JSON.stringify({type:'secret-begin'}));
 assert.equal(st.obj.snapshot().secret.stage,'preview');
 await st.obj.webSocketMessage(host,JSON.stringify({type:'secret-accept-question'}));
 assert.equal(st.obj.snapshot().secret.stage,'voting');
 assert.equal(st.obj.snapshot().secret.roundCount,3);
 assert.ok(['学校のホンネ','マイお題'].includes(st.obj.snapshot().secret.question.category));
 assert.equal((await st.fetch(req('/join',{name:'Late'}))).status,409);
});

test('all answered screen hides results until host reveals; full 5 rounds stay anonymous',async()=>{
 const st=new Stub();
 const h=await (await st.fetch(req('/create',{code:'ABCD2345',name:'Host',gameId:'minna-wa-docchi'}))).json();
 const b=await (await st.fetch(req('/join',{name:'B'}))).json();
 const c=await (await st.fetch(req('/join',{name:'C'}))).json();
 const users=[sock(h.id),sock(b.id),sock(c.id)];st.sockets.push(...users);
 for(const u of users)await st.obj.webSocketMessage(u,JSON.stringify({type:'ready',ready:true}));
 await st.obj.webSocketMessage(users[0],JSON.stringify({type:'secret-start'}));
 await st.obj.webSocketMessage(users[0],JSON.stringify({type:'secret-mode',mode:'secret'}));
 await st.obj.webSocketMessage(users[0],JSON.stringify({type:'secret-begin'}));
 assert.equal(st.obj.snapshot().secret.stage,'preview');
 await st.obj.webSocketMessage(users[0],JSON.stringify({type:'secret-accept-question'}));
 assert.equal(st.obj.snapshot().secret.stage,'voting');
 await st.obj.webSocketMessage(users[0],JSON.stringify({type:'secret-vote',choice:'a'}));
 await st.obj.webSocketMessage(users[1],JSON.stringify({type:'secret-vote',choice:'b'}));
 await st.obj.webSocketMessage(users[0],JSON.stringify({type:'secret-vote',choice:'b'}));
 assert.equal(st.obj.snapshot().secret.answered,2);
 await st.obj.webSocketMessage(users[2],JSON.stringify({type:'secret-vote',choice:'a'}));
 assert.equal(st.obj.snapshot().secret.stage,'allAnswered');
 assert.equal(st.obj.snapshot().secret.answered,3);
 assert.equal(st.obj.snapshot().secret.counts,null);
 assert.deepEqual(st.obj.room.secret.votes,{});
 const traffic=JSON.stringify(users.flatMap(u=>u.events));
 assert.ok(!traffic.includes('"votes"')&&!traffic.includes('"indices"')&&!traffic.includes('"roundQuestions"'));
 await st.obj.webSocketMessage(users[1],JSON.stringify({type:'secret-reveal'}));
 assert.equal(st.obj.snapshot().secret.stage,'allAnswered');
 await st.obj.webSocketMessage(users[0],JSON.stringify({type:'secret-reveal'}));
 assert.equal(st.obj.snapshot().secret.counts.a,2);
 assert.equal(st.obj.snapshot().secret.counts.b,1);
 await st.obj.webSocketMessage(users[1],JSON.stringify({type:'secret-next'}));
 assert.equal(st.obj.snapshot().secret.round,1);
 for(let round=2;round<=5;round++){
  await st.obj.webSocketMessage(users[0],JSON.stringify({type:'secret-next'}));
  assert.equal(st.obj.snapshot().secret.stage,'preview');
  assert.equal(st.obj.snapshot().secret.round,round);
  await st.obj.webSocketMessage(users[0],JSON.stringify({type:'secret-accept-question'}));
  assert.equal(st.obj.snapshot().secret.stage,'voting');
  for(const u of users)await st.obj.webSocketMessage(u,JSON.stringify({type:'secret-vote',choice:'a'}));
  assert.equal(st.obj.snapshot().secret.stage,'allAnswered');
  assert.equal(st.obj.snapshot().secret.counts,null);
  await st.obj.webSocketMessage(users[0],JSON.stringify({type:'secret-reveal'}));
  assert.equal(st.obj.snapshot().secret.counts.a,3);
 }
 await st.obj.webSocketMessage(users[0],JSON.stringify({type:'secret-next'}));
 assert.equal(st.obj.snapshot().secret.stage,'finished');
 await st.obj.webSocketMessage(users[0],JSON.stringify({type:'secret-stop'}));
 assert.equal(st.obj.snapshot().phase,'lobby');
 assert.equal(st.obj.snapshot().allReady,false);
});

test('leaving mid-vote resolves to all-answered, never auto-reveals',async()=>{
 const st=new Stub();
 const h=await (await st.fetch(req('/create',{code:'ABCD5678',name:'Host',gameId:'minna-wa-docchi'}))).json();
 const b=await (await st.fetch(req('/join',{name:'Guest'}))).json();
 const c=await (await st.fetch(req('/join',{name:'Guest2'}))).json();
 const users=[sock(h.id),sock(b.id),sock(c.id)];st.sockets.push(...users);
 for(const u of users)await st.obj.webSocketMessage(u,JSON.stringify({type:'ready',ready:true}));
 await st.obj.webSocketMessage(users[0],JSON.stringify({type:'secret-start'}));
 await st.obj.webSocketMessage(users[0],JSON.stringify({type:'secret-mode',mode:'secret'}));
 await st.obj.webSocketMessage(users[0],JSON.stringify({type:'secret-begin'}));
 await st.obj.webSocketMessage(users[0],JSON.stringify({type:'secret-accept-question'}));
 await st.obj.webSocketMessage(users[0],JSON.stringify({type:'secret-vote',choice:'a'}));
 await st.obj.webSocketMessage(users[1],JSON.stringify({type:'secret-vote',choice:'b'}));
 await st.obj.removeMember(c.id);
 assert.equal(st.obj.snapshot().secret.stage,'allAnswered');
 assert.equal(st.obj.snapshot().secret.counts,null);
 await st.obj.webSocketMessage(users[0],JSON.stringify({type:'secret-reveal'}));
 assert.equal(st.obj.snapshot().secret.counts.a,1);
 assert.equal(st.obj.snapshot().secret.counts.b,1);
 await st.obj.removeMember(b.id);
 assert.equal(st.obj.snapshot().phase,'lobby');
});


test('host preview accepts, skips and composes a shared question without guest control',async()=>{
 const st=new Stub();
 const h=await (await st.fetch(req('/create',{code:'ABCD2345',name:'Host',gameId:'minna-wa-docchi'}))).json();
 const b=await (await st.fetch(req('/join',{name:'Guest'}))).json();
 const host=sock(h.id),guest=sock(b.id);st.sockets.push(host,guest);
 for(const w of [host,guest])await st.obj.webSocketMessage(w,JSON.stringify({type:'ready',ready:true}));
 await st.obj.webSocketMessage(host,JSON.stringify({type:'secret-start'}));
 await st.obj.webSocketMessage(host,JSON.stringify({type:'secret-mode',mode:'secret'}));
 await st.obj.webSocketMessage(host,JSON.stringify({type:'secret-begin'}));
 const first=st.obj.snapshot().secret;
 assert.equal(first.stage,'preview');
 assert.ok(first.question?.q);
 assert.ok(first.alternatives>0);
 await st.obj.webSocketMessage(guest,JSON.stringify({type:'secret-accept-question'}));
 assert.equal(st.obj.snapshot().secret.stage,'preview','guest cannot approve');
 await st.obj.webSocketMessage(guest,JSON.stringify({type:'secret-change-question'}));
 assert.equal(st.obj.snapshot().secret.question.q,first.question.q,'guest cannot skip');
 await st.obj.webSocketMessage(guest,JSON.stringify({type:'secret-use-question',question:{q:'guest q',a:'a',b:'b'}}));
 assert.equal(st.obj.snapshot().secret.question.q,first.question.q,'guest cannot author');
 await st.obj.webSocketMessage(host,JSON.stringify({type:'secret-change-question'}));
 const changed=st.obj.snapshot().secret;
 assert.notDeepEqual(changed.question,first.question,'a skipped question must change');
 assert.equal(changed.stage,'preview');
 await st.obj.webSocketMessage(host,JSON.stringify({type:'secret-change-question'}));
 assert.notDeepEqual(st.obj.snapshot().secret.question,first.question,'skip does not immediately reuse an old question');
 await st.obj.webSocketMessage(host,JSON.stringify({type:'secret-use-question',question:{q:'放課後に遊ぶなら？',a:'公園',b:'ゲーム'}}));
 const manual=st.obj.snapshot().secret;
 assert.equal(manual.stage,'preview','manual question returns to preview not voting');
 assert.equal(manual.question.q,'放課後に遊ぶなら？');
 assert.equal(manual.question.a,'公園');
 assert.equal(manual.question.b,'ゲーム');
 assert.equal(manual.question.category,'マイお題');
 const traffic=JSON.stringify(guest.events);
 assert.ok(traffic.includes('放課後に遊ぶなら？'),'everyone receives custom question');
 await st.obj.webSocketMessage(host,JSON.stringify({type:'secret-accept-question'}));
 assert.equal(st.obj.snapshot().secret.stage,'voting');
 assert.equal(st.obj.snapshot().secret.answered,0);
 await st.obj.webSocketMessage(host,JSON.stringify({type:'secret-change-question'}));
 assert.equal(st.obj.snapshot().secret.question.q,'放課後に遊ぶなら？','cannot skip during voting');
 await st.obj.webSocketMessage(host,JSON.stringify({type:'secret-vote',choice:'a'}));
 await st.obj.webSocketMessage(guest,JSON.stringify({type:'secret-vote',choice:'b'}));
 assert.equal(st.obj.snapshot().secret.stage,'allAnswered');
 assert.equal(st.obj.snapshot().secret.counts,null,'never automatically reveals');
 await st.obj.webSocketMessage(host,JSON.stringify({type:'secret-reveal'}));
 await st.obj.webSocketMessage(host,JSON.stringify({type:'secret-next'}));
 assert.equal(st.obj.snapshot().secret.stage,'preview','next round must preview a new question');
 assert.equal(st.obj.snapshot().secret.round,2);
 assert.ok(st.obj.snapshot().secret.question?.q);
});

test('battle uses offline 10 genres; private predictions and 1 point scoring for majorities and minorities',async()=>{
 const st=new Stub();
 const h=await (await st.fetch(req('/create',{code:'ABCD2345',name:'Host',gameId:'minna-wa-docchi'}))).json();
 const b=await (await st.fetch(req('/join',{name:'B'}))).json();
 const c=await (await st.fetch(req('/join',{name:'C'}))).json();
 const us=[sock(h.id),sock(b.id),sock(c.id)];st.sockets.push(...us);
 for(const u of us)await st.obj.webSocketMessage(u,JSON.stringify({type:'ready',ready:true}));
 await st.obj.webSocketMessage(us[0],JSON.stringify({type:'secret-start'}));
 assert.equal(st.obj.snapshot().secret.modeSelected,false);
 await st.obj.webSocketMessage(us[1],JSON.stringify({type:'secret-mode',mode:'battle'}));
 assert.equal(st.obj.snapshot().secret.modeSelected,false,'guest cannot pick mode');
 await st.obj.webSocketMessage(us[0],JSON.stringify({type:'secret-mode',mode:'battle'}));
 assert.equal(st.obj.snapshot().secret.mode,'battle');
 assert.equal(st.obj.snapshot().secret.categories.length,10);
 assert.equal(st.obj.snapshot().secret.poolCount,200);
 await st.obj.webSocketMessage(us[0],JSON.stringify({type:'secret-begin'}));
 assert.equal(st.obj.snapshot().secret.stage,'preview');
 assert.equal(st.obj.snapshot().secret.question.category.length>0,true);
 await st.obj.webSocketMessage(us[0],JSON.stringify({type:'secret-accept-question'}));
 await st.obj.webSocketMessage(us[0],JSON.stringify({type:'secret-vote',choice:'a'}));
 await st.obj.webSocketMessage(us[1],JSON.stringify({type:'secret-vote',choice:'a'}));
 await st.obj.webSocketMessage(us[2],JSON.stringify({type:'secret-vote',choice:'b'}));
 assert.equal(st.obj.snapshot().secret.stage,'voting','battle waits for predictions');
 assert.equal(st.obj.snapshot().secret.answered,0,'answer progress counts completed predictions');
 const lastHost=us[0].events.at(-1),lastGuest=us[1].events.at(-1);
 assert.equal(lastHost.myChoice,'a');
 assert.equal(lastGuest.myChoice,'a');
 assert.equal(lastGuest.room.secret.counts,null,'majority not disclosed');
 assert.equal(JSON.stringify(lastGuest).includes('predictions'),false,'other predictions not broadcast');
 await st.obj.webSocketMessage(us[1],JSON.stringify({type:'battle-predict',prediction:'minority'}));
 await st.obj.webSocketMessage(us[0],JSON.stringify({type:'battle-predict',prediction:'majority'}));
 await st.obj.webSocketMessage(us[2],JSON.stringify({type:'battle-predict',prediction:'minority'}));
 const waiting=st.obj.snapshot();
 assert.equal(waiting.secret.stage,'allAnswered');
 assert.equal(waiting.secret.counts,null);
 assert.equal(waiting.secret.battleResult,null);
 assert.equal(waiting.secret.scores,null);
 assert.deepEqual(st.obj.room.secret.votes,{});
 assert.deepEqual(st.obj.room.secret.predictions,{});
 const leaked=JSON.stringify(us.flatMap(u=>u.events));
 assert.equal(leaked.includes('"battleResult":{"tie"'),false,'battle result stays secret until reveal');
 await st.obj.webSocketMessage(us[1],JSON.stringify({type:'secret-reveal'}));
 assert.equal(st.obj.snapshot().secret.stage,'allAnswered');
 await st.obj.webSocketMessage(us[0],JSON.stringify({type:'secret-reveal'}));
 const result=st.obj.snapshot().secret;
 assert.equal(result.stage,'result');
 assert.deepEqual(result.counts,{a:2,b:1});
 const rows=result.battleResult.players;
 assert.equal(rows[0].gain,1,'A majority correctly predicts majority');
 assert.equal(rows[1].gain,0,'A majority incorrectly predicts minority');
 assert.equal(rows[2].gain,1,'B minority correctly predicts minority');
 assert.equal(result.scores[h.id],1);
 assert.equal(result.scores[b.id],0);
 assert.equal(result.scores[c.id],1);
 await st.obj.webSocketMessage(us[0],JSON.stringify({type:'secret-next'}));
 assert.equal(st.obj.snapshot().secret.stage,'preview');
 assert.equal(st.obj.snapshot().secret.scores,null,'next round hides previous totals while answering');
});

test('battle A/B tie is zero points for everyone; full game produces final score totals',async()=>{
 const st=new Stub(),h=await (await st.fetch(req('/create',{code:'ABCD2345',name:'Host',gameId:'minna-wa-docchi'}))).json();
 const b=await (await st.fetch(req('/join',{name:'B'}))).json();
 const c=await (await st.fetch(req('/join',{name:'C'}))).json();
 const d=await (await st.fetch(req('/join',{name:'D'}))).json();
 const us=[sock(h.id),sock(b.id),sock(c.id),sock(d.id)];st.sockets.push(...us);
 for(const u of us)await st.obj.webSocketMessage(u,JSON.stringify({type:'ready',ready:true}));
 await st.obj.webSocketMessage(us[0],JSON.stringify({type:'secret-start'}));
 await st.obj.webSocketMessage(us[0],JSON.stringify({type:'secret-mode',mode:'battle'}));
 await st.obj.webSocketMessage(us[0],JSON.stringify({type:'secret-config',roundCount:3,categories:['学校'],includeCustom:false}));
 await st.obj.webSocketMessage(us[0],JSON.stringify({type:'secret-begin'}));
 for(let round=1;round<=3;round++){
   assert.equal(st.obj.snapshot().secret.stage,'preview');
   await st.obj.webSocketMessage(us[0],JSON.stringify({type:'secret-accept-question'}));
   for(let i=0;i<4;i++){
     await st.obj.webSocketMessage(us[i],JSON.stringify({type:'secret-vote',choice:i<2?'a':'b'}));
     await st.obj.webSocketMessage(us[i],JSON.stringify({type:'battle-predict',prediction:i%2?'minority':'majority'}));
   }
   assert.equal(st.obj.snapshot().secret.stage,'allAnswered');
   await st.obj.webSocketMessage(us[0],JSON.stringify({type:'secret-reveal'}));
   const r=st.obj.snapshot().secret;
   assert.equal(r.battleResult.tie,true);
   assert.ok(r.battleResult.players.every(p=>p.gain===0));
   assert.ok(Object.values(r.scores).every(score=>score===0));
   await st.obj.webSocketMessage(us[0],JSON.stringify({type:'secret-next'}));
 }
 assert.equal(st.obj.snapshot().secret.stage,'finished');
 assert.ok(Object.values(st.obj.snapshot().secret.scores).every(x=>x===0));
});

test('online phases render question and answers with offline layout and no blank voting view',()=>{
 const html=readFileSync(new URL('../online/minna-wa-docchi/index.html',import.meta.url),'utf8');
 const js=readFileSync(new URL('../online/minna-wa-docchi/game.js',import.meta.url),'utf8');
 const css=readFileSync(new URL('../online/minna-wa-docchi/game.css',import.meta.url),'utf8');
 const offline=readFileSync(new URL('../games/minna-wa-docchi/game.css',import.meta.url),'utf8');
 assert.ok(html.includes('../../games/minna-wa-docchi/game.css'));
 assert.ok(html.includes('class="docchi-app online-docchi screen-options"'));
 assert.ok(html.includes('id="vote-stage"'));
 assert.ok(css.includes('minna_wa_docchi_background.png'));
 assert.ok(offline.includes('minna_wa_docchi_background.png'));
 assert.ok(css.includes('[hidden]{display:none!important}'));
 assert.ok(js.includes("voting:'vote-stage'"));
 assert.doesNotThrow(()=>new Function(js));
 const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
 assert.equal(new Set(ids).size,ids.length,'no duplicate HTML IDs');
 for(const id of [...js.matchAll(/\$\('([^']+)'\)/g)].map(m=>m[1]))
   assert.ok(ids.includes(id),'JS refers to missing HTML element: '+id);
 const make=()=>({
   hidden:false,disabled:false,value:'',textContent:'',className:'',style:{},children:[],
   classList:{toggle(){},add(){},remove(){}},handlers:{},
   append(...nodes){this.children.push(...nodes)},
   replaceChildren(...nodes){this.children=[...nodes]},
   addEventListener(type,fn){this.handlers[type]=fn},
   querySelector(){return make()}
 });
 const els=Object.fromEntries(ids.map(id=>[id,make()]));
 const doc={
   getElementById:id=>els[id],
   querySelector:selector=>selector==='.online-docchi'?els.app:null,
   createElement:()=>make(),createTextNode:text=>({textContent:text})
 };
 class MockQuery{get(){return 'ABCD2345'}}
 const navigation=[];
 const location={search:'?room=ABCD2345',replace:url=>navigation.push(url),assign:url=>navigation.push(url)};
 const storage={
   getItem:key=>key==='houkago-online-session-v1'?
     JSON.stringify({code:'ABCD2345',token:'a'.repeat(64),id:'p1'}):'[]',
   setItem(){},removeItem(){}
 };
 const sockets=[];
 class MockSocket{
   static OPEN=1;
   constructor(){this.readyState=1;this.sent=[];sockets.push(this)}
   send(text){this.sent.push(JSON.parse(text))}close(){}
 }
 const win={HOUKAGO_ONLINE_API_URL:'https://houkago-online-api.example.workers.dev',
   addEventListener(){}};
 new Function('window','document','location','sessionStorage','localStorage','WebSocket',
   'URLSearchParams','setTimeout','clearTimeout','confirm',js)(
     win,doc,location,storage,storage,MockSocket,MockQuery,()=>{},()=>{},()=>true);
 const sock=sockets[0];sock.onopen();
 const question={q:'放課後に遊ぶなら？',a:'公園',b:'ゲーム',category:'友だち'};
 const screens={setup:'setup-stage',preview:'question-stage',voting:'vote-stage',allAnswered:'all-answered-stage',
   result:'result-stage',finished:'finished-stage'};
 for(const [stage,visible] of Object.entries(screens)){
  const room={code:'ABCD2345',phase:'secret',hostId:'p1',
    members:[{id:'p1',icon:'🐯',name:'ホスト'},{id:'p2',icon:'🐼',name:'ゲスト'}],
    secret:{stage,mode:'secret',modeSelected:true,question,round:1,roundCount:5,categories:['友だち'],
      selectedCategories:['友だち'],customQuestions:[],includeCustom:true,
      poolCount:20,alternatives:5,answered:1,total:2,counts:stage==='result'?{a:1,b:1}:null}};
  assert.doesNotThrow(()=>sock.onmessage({data:JSON.stringify({type:'room',room,voted:false})}),stage);
  assert.equal(els[visible].hidden,false,'expected visible stage '+stage);
  if(stage==='preview'){
    assert.equal(els['preview-question'].textContent,question.q);
    assert.equal(els['preview-a'].textContent,question.a);
    assert.equal(els['preview-b'].textContent,question.b);
    assert.equal(els['preview-host-controls'].hidden,false);
    assert.equal(els['preview-guest-wait'].hidden,true);
    assert.equal(els['change-question'].disabled,false);
    els['change-question'].handlers.click();
    assert.equal(sock.sent.at(-1).type,'secret-change-question');
    els['compose-question'].handlers.click();
    assert.equal(els['compose-stage'].hidden,false);
    els['round-q'].value='お昼に行くなら？';
    els['round-a'].value='教室';
    els['round-b'].value='校庭';
    els['round-question-form'].handlers.submit({preventDefault(){}});
    assert.equal(sock.sent.at(-1).type,'secret-use-question');
    assert.equal(sock.sent.at(-1).question.q,'お昼に行くなら？');
    assert.equal(els['question-stage'].hidden,false);
    els['accept-question'].handlers.click();
    assert.equal(sock.sent.at(-1).type,'secret-accept-question');
  }
  if(stage==='voting'){
    assert.equal(els['question-text'].textContent,question.q);
    assert.equal(els['vote-a-label'].textContent,question.a);
    assert.equal(els['vote-b-label'].textContent,question.b);
  }
  if(stage==='result'){
    assert.equal(els['result-a-count'].textContent,'1人');
    assert.equal(els['result-b-count'].textContent,'1人');
  }
 }
 const members=[{id:'p1',icon:'🐯',name:'ホスト'},{id:'p2',icon:'🐼',name:'ゲスト'}];
 const battleRoom=(stage,extras={})=>({code:'ABCD2345',phase:'secret',hostId:'p1',members,
  secret:{stage,mode:'battle',modeSelected:true,round:1,roundCount:3,question,answered:0,total:2,
   selectedCategories:['学校'],categories:['学校'],customQuestions:[],includeCustom:false,poolCount:20,
   counts:stage==='result'?{a:1,b:1}:null,...extras}});
 sock.onmessage({data:JSON.stringify({type:'room',room:battleRoom('setup',{mode:null,modeSelected:false}),voted:false})});
 assert.equal(els['mode-stage'].hidden,false,'online mode selector must display');
 assert.equal(els['setup-stage'].hidden,true,'genre selection only after mode chosen');
 els['choose-battle'].handlers.click();
 assert.equal(sock.sent.at(-1).type,'secret-mode');
 assert.equal(sock.sent.at(-1).mode,'battle');
 sock.onmessage({data:JSON.stringify({type:'room',room:battleRoom('voting'),voted:false})});
 assert.equal(els['vote-stage'].hidden,false);
 sock.onmessage({data:JSON.stringify({type:'room',room:battleRoom('voting'),voted:true,myChoice:'a',predicted:false})});
 assert.equal(els['vote-stage'].hidden,true);
 assert.equal(els['predict-stage'].hidden,false,'battle prediction appears after own vote');
 assert.ok(els['predict-selected'].textContent.includes('公園'));
 els['predict-majority'].handlers.click();
 assert.equal(sock.sent.at(-1).type,'battle-predict');
 assert.equal(sock.sent.at(-1).prediction,'majority');
 assert.equal(els['prediction-wait-stage'].hidden,false,'prediction confirmation waits for everyone');
 sock.onmessage({data:JSON.stringify({type:'room',room:battleRoom('result',{
  battleResult:{tie:true,players:[
   {id:'p1',name:'ホスト',icon:'🐯',answer:'a',prediction:'majority',gain:0,score:0},
   {id:'p2',name:'ゲスト',icon:'🐼',answer:'b',prediction:'minority',gain:0,score:0}
  ]},scores:{p1:0,p2:0}}),voted:false})});
 assert.equal(els['battle-result-details'].hidden,false);
 assert.equal(els['anonymous-banner'].hidden,true);
 assert.ok(els['battle-result-list'].children.length>=3,'battle individual result rows appear');
 sock.onmessage({data:JSON.stringify({type:'room',room:battleRoom('finished',{scores:{p1:3,p2:1}}),voted:false})});
 assert.equal(els['battle-ranking'].hidden,false,'final battle standings appear');
 assert.equal(els['battle-ranking'].children.length,2);
 assert.deepEqual(navigation,[],'game stage updates should not leave game URL');
});


test('ニセ転校生オンライン: 役職秘匿・3人以上の開始・休み時間・投票・ロビー復帰',async()=>{
 const st=new Stub();
 const hostRes=await st.fetch(req('/create',{code:'ABCD2345',name:'ホスト',gameId:'nise-transfer-student',icon:'🐯'}));
 assert.equal(hostRes.status,201);
 const hostInfo=await hostRes.json();
 const members=[hostInfo];
 for(let i=1;i<4;i++){
  const res=await st.fetch(req('/join',{name:'人'+i,icon:'🐼'}));
  assert.equal(res.status,201);
  members.push(await res.json());
 }
 const sockets=members.map(m=>sock(m.id));
 st.sockets.push(...sockets);
 const send=(i,data)=>st.obj.webSocketMessage(sockets[i],JSON.stringify(data));
 for(let i=0;i<4;i++)await send(i,{type:'ready',ready:true});
 await send(1,{type:'nise-start'});
 assert.equal(st.obj.room.nise,undefined,'only host can start');
 await send(0,{type:'nise-start'});
 assert.equal(st.obj.snapshot().phase,'nise');
 assert.equal(st.obj.room.nise.stage,'setup');
 await send(1,{type:'nise-begin'});
 assert.equal(st.obj.room.nise.stage,'setup','only host can deal');
 await send(0,{type:'nise-begin'});
 const raw=st.obj.room.nise;
 assert.equal(raw.stage,'reveal');
 assert.equal(raw.rest.length,2);
 for(let i=0;i<4;i++){
  const seen=sockets[i].events.at(-1).room.nise;
  assert.equal(seen.myRole,raw.initial[members[i].id]);
  assert.equal(seen.result,null);
  assert.ok(!Object.hasOwn(seen,'initial'));
  assert.ok(!Object.hasOwn(seen,'final'));
  assert.ok(!Object.hasOwn(seen,'votes'));
 }
 for(let i=0;i<4;i++)await send(i,{type:'nise-reveal-done'});
 assert.equal(raw.stage,'night');
 let turns=0;
 while(raw.stage==='night'&&turns++<12){
  const id=raw.nightOrder[raw.nightCursor];
  const i=members.findIndex(m=>m.id===id);
  const role=raw.initial[id];
  if(role==='president')await send(i,{type:'nise-night-action',kind:'rest'});
  else if(role==='dayDuty')await send(i,{type:'nise-night-action',kind:'rest',index:0});
  else if(role==='observer')await send(i,{type:'nise-night-action',kind:'compare',
    targets:raw.memberIds.filter(x=>x!==id).slice(0,2)});
  else if(role==='swapper')await send(i,{type:'nise-night-action',kind:'skip'});
  await send(i,{type:'nise-night-done'});
 }
 assert.equal(raw.stage,'discussion');
 await send(1,{type:'nise-start-vote'});
 assert.equal(raw.stage,'discussion');
 await send(0,{type:'nise-start-vote'});
 assert.equal(raw.stage,'voting');
 for(let i=0;i<3;i++)await send(i,{type:'nise-vote',target:members[(i+1)%4].id});
 assert.equal(raw.stage,'voting');
 assert.equal(sockets[3].events.at(-1).room.nise.result,null);
 await send(3,{type:'nise-vote',target:members[0].id});
 assert.equal(raw.stage,'result');
 assert.ok(raw.result&&raw.result.final);
 await send(1,{type:'nise-stop'});
 assert.equal(st.obj.snapshot().phase,'nise','guest cannot end host game');
 await send(0,{type:'nise-stop'});
 assert.equal(st.obj.snapshot().phase,'lobby');
 assert.equal(st.obj.room.nise,null);
});
