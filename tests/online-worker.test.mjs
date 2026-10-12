import {test} from 'node:test';
import assert from 'node:assert/strict';
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
test('room max 10 and automatic expiry; rate limiter rejects repeated creation',async()=>{
 const a=await (await service.fetch(req('/api/rooms',{name:'X'}),env)).json();
 const stub=instances.get('room:'+a.code);
 for(let i=0;i<9;i++){
  const r=await stub.fetch(req('/join',{name:'p'+i}));
  assert.equal(r.status,201);
 }
 assert.equal((await stub.fetch(req('/join',{name:'Over'}))).status,409);
 await stub.obj.alarm();
 assert.equal(stub.obj.room,null);
 assert.equal(stub.storage.data.size,0);
 let limited=false;
 for(let i=0;i<5;i++){
  const r=await service.fetch(req('/api/rooms',{name:'X'}),env);
  if(r.status===429)limited=true;
 }
 assert.ok(limited);
});
