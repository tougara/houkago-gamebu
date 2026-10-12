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
    secret:{stage,question,round:1,roundCount:5,categories:['友だち'],
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
 assert.deepEqual(navigation,[],'game stage updates should not leave game URL');
});
