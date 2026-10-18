/* 放課後ゲーム部 共通オンラインルーム Worker (ひみつ投票を先行対応) */
import {SECRET_QUESTIONS} from './secret-questions.js';
import {BATTLE_QUESTIONS} from './battle-questions.js';
import {createNise,niseView,niseAction} from './nise-engine.js';
import {createWolf,wolfView,wolfAction} from './wolf-engine.js';
import {createPita,pitaView,pitaAction} from './pita-engine.js';
import {createMeter,meterView,meterAction} from './meter-engine.js';
import {createTower,towerView,towerAction} from './tower-engine.js';
const TTL=2*60*60*1000, MAX=10;
const ROUND_OPTIONS=[3,5,7,10], DEFAULT_ROUNDS=5;
const CATEGORIES=[...new Set(SECRET_QUESTIONS.map(q=>q.category))];
const BATTLE_CATEGORIES=[...new Set(BATTLE_QUESTIONS.map(q=>q.category))];
const DEFAULT_CATEGORIES=CATEGORIES.filter(c=>!['恋バナ','ちょっとディープ'].includes(c));
const questionsFor=g=>g.mode==='battle'?BATTLE_QUESTIONS:SECRET_QUESTIONS;
const categoriesFor=g=>g.mode==='battle'?BATTLE_CATEGORIES:CATEGORIES;
const defaultCategoriesFor=mode=>mode==='battle'?[...BATTLE_CATEGORIES]:[...DEFAULT_CATEGORIES];
const ALPHABET='23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const CODE=/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{8}$/;
const TOKEN=/^[a-f0-9]{64}$/;
const GAMES=new Set(['minna-wa-docchi','kyokasho-tower','kankaku-meter','pitadome-challenge','link-burst','nise-transfer-student','gesture-battle','word-wolf']);
const ICONS=new Set(['🐶','🐱','🐰','🐼','🦊','🐸','🐧','🐯','🐨','🐵','🦁','🐹','🦍','🦄','👻']);
const response=(data,status=200,headers={})=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json;charset=utf-8','cache-control':'no-store',...headers}});
const err=(text,status=400)=>response({ok:false,error:text},status);
const safeName=x=>typeof x==='string'?x.trim().replace(/[\u0000-\u001f\u007f<>]/g,'').slice(0,16):'';
const randomCode=()=>{let a=new Uint8Array(8);crypto.getRandomValues(a);return [...a].map(b=>ALPHABET[b%ALPHABET.length]).join('')};
const randomToken=()=>{let a=new Uint8Array(32);crypto.getRandomValues(a);return [...a].map(b=>b.toString(16).padStart(2,'0')).join('')};
async function digest(s){const v=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s));return [...new Uint8Array(v)].map(x=>x.toString(16).padStart(2,'0')).join('')}
const cleanQuestion=x=>{
 if(!x||typeof x!=='object')return null;
 const fields=['q','a','b'].map(k=>typeof x[k]==='string'?x[k].trim().replace(/[\u0000-\u001f\u007f<>]/g,''):'');
 if(!fields[0]||!fields[1]||!fields[2]||fields[0].length>70||fields[1].length>30||fields[2].length>30)return null;
 return {category:'マイお題',q:fields[0],a:fields[1],b:fields[2]};
};
const questionKey=q=>JSON.stringify([q.category,q.q,q.a,q.b]);
const availablePreviewQuestions=g=>{
 const pool=questionsFor(g).filter(q=>g.settings.categories.includes(q.category))
  .concat(g.settings.includeCustom?g.customQuestions:[]);
 const reserved=new Set((g.roundQuestions||[]).map(questionKey));
 for(const key of g.skippedKeys||[])reserved.add(key);
 return pool.filter(q=>!reserved.has(questionKey(q)));
};
const secretView=room=>{
 if(!room.secret)return null;
 const g=room.secret,questions=g.roundQuestions||g.indices?.map(i=>SECRET_QUESTIONS[i])||[];
 const question=g.stage==='setup'?null:questions[g.round]||null;
 return {
   stage:g.stage,mode:g.mode||'secret',modeSelected:g.mode!==null,
   round:g.stage==='setup'?0:g.round+1,roundCount:g.settings?.roundCount||DEFAULT_ROUNDS,
   categories:categoriesFor(g),selectedCategories:g.settings?.categories||defaultCategoriesFor(g.mode),
   includeCustom:g.settings?.includeCustom??true,customQuestions:g.customQuestions||[],
   poolCount:questionsFor(g).filter(q=>(g.settings?.categories||defaultCategoriesFor(g.mode)).includes(q.category)).length+
    ((g.settings?.includeCustom??true)?(g.customQuestions?.length||0):0),
   question,alternatives:g.stage==='preview'?availablePreviewQuestions(g).length:0,
   answered:g.stage==='voting'?(g.mode==='battle'?Object.keys(g.predictions||{}).length:Object.keys(g.votes||{}).length):g.answeredCount||room.members.length,
   total:room.members.length,counts:g.stage==='result'?g.counts:null,
   battleResult:g.mode==='battle'&&g.stage==='result'?g.battleResult:null,
   scores:g.mode==='battle'&&['result','finished'].includes(g.stage)?g.scores:null
 };
};
const view=room=>({code:room.code,gameId:room.gameId,hostId:room.hostId,
  expiresAt:room.expiresAt,phase:room.tower?'tower':room.meter?'meter':room.pita?'pita':room.wolf?'wolf':room.nise?'nise':room.secret?'secret':'lobby',secret:secretView(room),
  maxPlayers:MAX,members:room.members.map(({id,name,icon,ready})=>({id,name,icon,ready}))});
const cors=origin=>({'access-control-allow-origin':origin,'vary':'Origin','access-control-allow-methods':'GET,POST,OPTIONS','access-control-allow-headers':'Content-Type'});
async function readBody(request){
  if(Number(request.headers.get('content-length'))>1024)return null;
  const text=await request.text();if(text.length>1024)return null;
  try{return text?JSON.parse(text):{}}catch{return null}
}
async function admit(env,request,kind){
  const hash=await digest('online-rate-v1:'+(request.headers.get('CF-Connecting-IP')||'local'));
  const obj=env.ROOMS.get(env.ROOMS.idFromName('gate:'+hash));
  const r=await obj.fetch(new Request('https://internal/limit',{method:'POST',body:JSON.stringify({kind})}));
  return r.ok;
}
export default {
  async fetch(request,env){
    const url=new URL(request.url),origin=request.headers.get('Origin');
    const allowed=[env.ALLOWED_ORIGIN,'http://localhost:8788','http://127.0.0.1:8788'].filter(Boolean);
    if(request.method==='GET'&&url.pathname==='/api/health')
      return response({ok:true,mode:'lobby-secret-nise-wolf-pita-meter-tower',version:8},200,allowed.includes(origin)?cors(origin):{});
    if(!allowed.includes(origin))return err('許可されていないアクセスです',403);
    const headers=cors(origin),reply=(data,status=200)=>response(data,status,headers);
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
    if(request.method==='POST'&&url.pathname==='/api/rooms'){
      const body=await readBody(request),name=safeName(body?.name),gameId=body?.gameId||'minna-wa-docchi';
      if(!name||!GAMES.has(gameId))return reply({ok:false,error:'名前かゲームを確認してね'},400);
      if(!await admit(env,request,'create'))return reply({ok:false,error:'作成回数が多すぎます。時間をおいてね'},429);
      for(let i=0;i<4;i++){
        const code=randomCode(),obj=env.ROOMS.get(env.ROOMS.idFromName('room:'+code));
        const r=await obj.fetch(new Request('https://internal/create',{method:'POST',
          body:JSON.stringify({code,name,gameId,icon:ICONS.has(body.icon)?body.icon:'🎮'})}));
        if(r.status===409)continue;
        return reply(await r.json(),r.status);
      }
      return reply({ok:false,error:'部屋を作成できませんでした'},503);
    }
    const path=url.pathname.match(/^\/api\/rooms\/([A-Z2-9]{8})\/(join|ws)$/);
    if(!path||!CODE.test(path[1]))return reply({ok:false,error:'部屋が見つかりません'},404);
    const [,code,action]=path,obj=env.ROOMS.get(env.ROOMS.idFromName('room:'+code));
    if(action==='join'&&request.method==='POST'){
      const body=await readBody(request),name=safeName(body?.name);
      if(!name)return reply({ok:false,error:'名前を入力してね'},400);
      if(!await admit(env,request,'join'))return reply({ok:false,error:'参加操作が多すぎます'},429);
      const r=await obj.fetch(new Request('https://internal/join',{method:'POST',
        body:JSON.stringify({name,icon:ICONS.has(body.icon)?body.icon:'🎮'})}));
      return reply(await r.json(),r.status);
    }
    if(action==='ws'&&request.method==='GET'){
      if(request.headers.get('Upgrade')?.toLowerCase()!=='websocket')return reply({ok:false,error:'WebSocketが必要です'},426);
      const token=url.searchParams.get('token')||'';
      if(!TOKEN.test(token))return reply({ok:false,error:'接続情報が無効です'},401);
      return obj.fetch(new Request('https://internal/ws',{headers:{Upgrade:'websocket','X-Room-Token':token}}));
    }
    return reply({ok:false,error:'対応していない操作です'},404);
  }
};
export class OnlineRoom{
  constructor(ctx,env){
    this.ctx=ctx;this.env=env;this.room=null;
    ctx.blockConcurrencyWhile(async()=>{this.room=await ctx.storage.get('room')||null});
  }
  async fetch(request){
    const path=new URL(request.url).pathname;
    if(path==='/limit')return this.limit(request);
    if(path==='/create')return this.create(request);
    if(path==='/join')return this.join(request);
    if(path==='/ws')return this.connect(request);
    return err('not found',404);
  }
  async limit(request){
    const {kind}=await request.json();
    if(!['create','join'].includes(kind))return err('bad input');
    const now=Date.now(),period=kind==='create'?60000:600000,max=kind==='create'?60:40;
    const items=(await this.ctx.storage.get(kind)||[]).filter(t=>t>now-period);
    if(items.length>=max)return err('rate limited',429);
    items.push(now);await this.ctx.storage.put(kind,items);
    await this.ctx.storage.setAlarm(now+3600000);
    return response({ok:true});
  }
  active(){return this.room&&this.room.expiresAt>Date.now()}
  async create(request){
    if(this.active())return err('room exists',409);
    const {code,name,gameId,icon}=await request.json();
    if(!CODE.test(code)||!safeName(name)||!GAMES.has(gameId))return err('bad input');
    const token=randomToken(),id=crypto.randomUUID(),now=Date.now();
    this.room={code,gameId,hostId:id,createdAt:now,expiresAt:now+TTL,
      members:[{id,name:safeName(name),icon:ICONS.has(icon)?icon:'🎮',ready:false,tokenHash:await digest(token)}]};
    await this.ctx.storage.put('room',this.room);
    await this.ctx.storage.setAlarm(this.room.expiresAt);
    return response({ok:true,code,id,token,room:view(this.room)},201);
  }
  async join(request){
    if(!this.active())return err('部屋が見つからないか期限切れです',404);
    if(this.room.secret||this.room.nise||this.room.wolf||this.room.pita||this.room.meter||this.room.tower)return err('ゲーム中は新しく参加できません。終了後に試してね',409);
    if(this.room.members.length>=MAX)return err('満員です',409);
    const {name,icon}=await request.json();
    if(!safeName(name))return err('名前が必要です',400);
    const token=randomToken(),id=crypto.randomUUID();
    this.room.members.push({id,name:safeName(name),icon:ICONS.has(icon)?icon:'🎮',ready:false,tokenHash:await digest(token)});
    await this.ctx.storage.put('room',this.room);this.broadcast();
    return response({ok:true,code:this.room.code,id,token,room:view(this.room)},201);
  }
  sockets(){return this.ctx.getWebSockets()}
  snapshot(){
    const connected=new Set(this.sockets().map(s=>s.deserializeAttachment()?.id).filter(Boolean));
    const room=view(this.room);
    room.members=room.members.map(m=>({...m,connected:connected.has(m.id)}));
    room.allReady=room.members.length>=2&&room.members.every(m=>m.ready&&m.connected);
    return room;
  }
  send(ws,data){try{ws.send(JSON.stringify(data))}catch{}}
  broadcast(){
    if(!this.room)return;
    const room=this.snapshot();
    for(const ws of this.sockets()){
      const id=ws.deserializeAttachment()?.id;
      this.send(ws,{type:'room',room:{...room,nise:niseView(this.room,id),wolf:wolfView(this.room,id),pita:pitaView(this.room,id),meter:meterView(this.room,id),tower:towerView(this.room,id)},voted:!!this.room.secret?.votes?.[id],
        myChoice:this.room.secret?.mode==='battle'&&this.room.secret?.stage==='voting'?
          (this.room.secret.votes?.[id]||null):null,
        predicted:!!this.room.secret?.predictions?.[id]});
    }
  }
  async saveAndBroadcast(){
    await this.ctx.storage.put('room',this.room);
    this.broadcast();
  }
  finishVotingIfReady(){
    const g=this.room?.secret;
    if(!g||g.stage!=='voting'||Object.keys(g.votes).length!==this.room.members.length)return;
    if(g.mode==='battle'&&Object.keys(g.predictions||{}).length!==this.room.members.length)return;
    g.counts={a:Object.values(g.votes).filter(v=>v==='a').length,
      b:Object.values(g.votes).filter(v=>v==='b').length};
    if(g.mode==='battle'){
      const tie=g.counts.a===g.counts.b,majority=tie?null:(g.counts.a>g.counts.b?'a':'b');
      const players=this.room.members.map(m=>{
        const answer=g.votes[m.id],prediction=g.predictions[m.id];
        const actual=answer===majority?'majority':'minority';
        const gain=!tie&&prediction===actual?1:0;
        g.scores[m.id]=(g.scores[m.id]||0)+gain;
        return {id:m.id,name:m.name,icon:m.icon,answer,prediction,gain,score:g.scores[m.id]};
      });
      g.battleResult={tie,majority,players};
      g.predictions={};
    }
    g.answeredCount=this.room.members.length;
    g.votes={};
    // Do not expose the count, predictions, answer identities or scores until host reveal.
    g.stage='allAnswered';
  }
  startSecret(){
    this.room.secret={
      stage:'setup',mode:null,round:0,settings:{roundCount:DEFAULT_ROUNDS,
        categories:[...DEFAULT_CATEGORIES],includeCustom:true},
      customQuestions:[],roundQuestions:[],votes:{},predictions:{},counts:null,answeredCount:0,
      scores:{},battleResult:null
    };
  }
  beginSecret(){
    const g=this.room.secret;
    if(!['secret','battle'].includes(g.mode))return false;
    const pool=questionsFor(g).filter(q=>g.settings.categories.includes(q.category))
      .concat(g.settings.includeCustom?g.customQuestions:[]);
    if(pool.length<g.settings.roundCount)return false;
    const random=new Uint32Array(pool.length);
    crypto.getRandomValues(random);
    const shuffled=pool.map((_,i)=>i);
    shuffled.sort((a,b)=>random[a]-random[b]);
    g.roundQuestions=shuffled.slice(0,g.settings.roundCount).map(i=>pool[i]);
    g.stage='preview';g.round=0;g.skippedKeys=[];g.votes={};g.predictions={};
    g.scores=Object.fromEntries(this.room.members.map(m=>[m.id,0]));
    g.battleResult=null;g.counts=null;g.answeredCount=0;
    return true;
  }
  async connect(request){
    if(!this.active())return err('部屋が見つからないか期限切れです',404);
    const token=request.headers.get('X-Room-Token')||'';
    const hash=TOKEN.test(token)?await digest(token):'';
    const player=this.room.members.find(m=>m.tokenHash===hash);
    if(!player)return err('接続情報が無効です',401);
    for(const old of this.sockets())if(old.deserializeAttachment()?.id===player.id)try{old.close(4001,'reconnected')}catch{}
    const [client,server]=Object.values(new WebSocketPair());
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({id:player.id});
    this.send(server,{type:'welcome',selfId:player.id,room:{...this.snapshot(),nise:niseView(this.room,player.id),wolf:wolfView(this.room,player.id),pita:pitaView(this.room,player.id),meter:meterView(this.room,player.id),tower:towerView(this.room,player.id)},
      voted:!!this.room.secret?.votes?.[player.id],
      myChoice:this.room.secret?.mode==='battle'&&this.room.secret?.stage==='voting'?
        (this.room.secret.votes?.[player.id]||null):null,
      predicted:!!this.room.secret?.predictions?.[player.id]});
    this.broadcast();
    return new Response(null,{status:101,webSocket:client});
  }
  async webSocketMessage(ws,message){
    if(!this.active())return void ws.close(4000,'expired');
    if(typeof message!=='string'||message.length>512)return;
    let data;try{data=JSON.parse(message)}catch{return}
    const id=ws.deserializeAttachment()?.id,player=this.room.members.find(m=>m.id===id);
    if(!player)return void ws.close(4003,'unauthorized');
    if(data.type==='ready'){
      if(this.room.secret||this.room.nise||this.room.wolf||this.room.pita||this.room.meter||this.room.tower||typeof data.ready!=='boolean')return;
      player.ready=data.ready;await this.ctx.storage.put('room',this.room);this.broadcast();return;
    }
    if(data.type==='game'){
      if(this.room.secret||this.room.nise||this.room.wolf||this.room.pita||this.room.meter||this.room.tower||this.room.hostId!==id||!GAMES.has(data.gameId))return;
      this.room.gameId=data.gameId;
      for(const m of this.room.members)m.ready=false;
      await this.ctx.storage.put('room',this.room);this.broadcast();return;
    }
    if(data.type==='nise-stop'){
      if(!this.room.nise||id!==this.room.hostId)return;
      this.room.nise=null;
      for(const member of this.room.members)member.ready=false;
      await this.saveAndBroadcast();return;
    }
    if(data.type==='nise-start'){
      if(this.room.nise||this.room.secret||this.room.wolf||this.room.pita||this.room.meter||this.room.tower||this.room.hostId!==id||this.room.gameId!=='nise-transfer-student'||
         this.room.members.length<3||!this.snapshot().allReady)return;
      this.room.nise=createNise(this.room);
      await this.saveAndBroadcast();return;
    }
    if(data.type?.startsWith('nise-')){
      if(!this.room.nise)return;
      if(niseAction(this.room,id,data))await this.saveAndBroadcast();
      return;
    }
    if(data.type==='wolf-start'){
      if(this.room.wolf||this.room.nise||this.room.secret||this.room.pita||this.room.meter||this.room.tower||id!==this.room.hostId||
         this.room.gameId!=='word-wolf'||this.room.members.length<3||!this.snapshot().allReady)return;
      this.room.wolf=createWolf(this.room);await this.saveAndBroadcast();return;
    }
    if(data.type==='wolf-stop'){
      if(!this.room.wolf||id!==this.room.hostId)return;
      this.room.wolf=null;
      for(const member of this.room.members)member.ready=false;
      await this.saveAndBroadcast();return;
    }
    if(data.type?.startsWith('wolf-')){
      if(this.room.wolf&&wolfAction(this.room,id,data))await this.saveAndBroadcast();
      return;
    }
    if(data.type==='tower-start'){
      if(this.room.tower||this.room.meter||this.room.secret||this.room.nise||this.room.wolf||this.room.pita||
         id!==this.room.hostId||this.room.gameId!=='kyokasho-tower'||
         this.room.members.length<2||this.room.members.length>6||!this.snapshot().allReady)return;
      this.room.tower=createTower(this.room);await this.saveAndBroadcast();return;
    }
    if(data.type==='tower-stop'){
      if(!this.room.tower||id!==this.room.hostId)return;
      this.room.tower=null;
      for(const member of this.room.members)member.ready=false;
      await this.saveAndBroadcast();return;
    }
    if(data.type?.startsWith('tower-')){
      if(this.room.tower&&towerAction(this.room,id,data))await this.saveAndBroadcast();
      return;
    }
    if(data.type==='meter-start'){
      if(this.room.meter||this.room.secret||this.room.nise||this.room.wolf||this.room.pita||this.room.tower||
         id!==this.room.hostId||this.room.gameId!=='kankaku-meter'||
         this.room.members.length<2||!this.snapshot().allReady)return;
      this.room.meter=createMeter(this.room);await this.saveAndBroadcast();return;
    }
    if(data.type==='meter-stop'){
      if(!this.room.meter||id!==this.room.hostId)return;
      this.room.meter=null;
      for(const member of this.room.members)member.ready=false;
      await this.saveAndBroadcast();return;
    }
    if(data.type?.startsWith('meter-')){
      if(this.room.meter&&meterAction(this.room,id,data))await this.saveAndBroadcast();
      return;
    }
    if(data.type==='pita-start'){
      if(this.room.pita||this.room.secret||this.room.nise||this.room.wolf||this.room.meter||this.room.tower||
         id!==this.room.hostId||this.room.gameId!=='pitadome-challenge'||
         this.room.members.length<2||!this.snapshot().allReady)return;
      this.room.pita=createPita(this.room);await this.saveAndBroadcast();return;
    }
    if(data.type==='pita-stop-game'){
      if(!this.room.pita||id!==this.room.hostId)return;
      this.room.pita=null;
      for(const member of this.room.members)member.ready=false;
      await this.saveAndBroadcast();return;
    }
    if(data.type?.startsWith('pita-')){
      if(this.room.pita&&pitaAction(this.room,id,data))await this.saveAndBroadcast();
      return;
    }
    if(data.type==='secret-start'){
      if(this.room.secret||this.room.nise||this.room.wolf||this.room.pita||this.room.meter||this.room.tower||this.room.hostId!==id||this.room.gameId!=='minna-wa-docchi'||!this.snapshot().allReady)return;
      this.startSecret();
      await this.saveAndBroadcast();return;
    }
    if(data.type==='secret-mode'){
      const g=this.room.secret;
      if(!g||g.stage!=='setup'||id!==this.room.hostId||
         ![null,'secret','battle'].includes(data.mode))return;
      g.mode=data.mode;
      g.settings.categories=defaultCategoriesFor(g.mode);
      if(g.mode===null)g.settings.includeCustom=false;
      await this.saveAndBroadcast();return;
    }
    if(data.type==='secret-config'){
      const g=this.room.secret;
      if(!g||g.stage!=='setup'||id!==this.room.hostId||!g.mode)return;
      const categories=data.categories,valid=categoriesFor(g);
      if(!Array.isArray(categories)||categories.length>valid.length||
         categories.some(c=>typeof c!=='string'||!valid.includes(c))||
         !ROUND_OPTIONS.includes(data.roundCount)||typeof data.includeCustom!=='boolean')return;
      g.settings={roundCount:data.roundCount,categories:[...new Set(categories)],includeCustom:data.includeCustom};
      await this.saveAndBroadcast();return;
    }
    if(data.type==='secret-custom-add'){
      const g=this.room.secret;
      if(!g||g.stage!=='setup'||id!==this.room.hostId||g.customQuestions.length>=20)return;
      const q=cleanQuestion(data.question);if(!q)return;
      if(g.customQuestions.some(x=>x.q===q.q&&x.a===q.a&&x.b===q.b))return;
      g.customQuestions.push(q);
      await this.saveAndBroadcast();return;
    }
    if(data.type==='secret-custom-delete'){
      const g=this.room.secret;
      if(!g||g.stage!=='setup'||id!==this.room.hostId||
         !Number.isInteger(data.index)||data.index<0||data.index>=g.customQuestions.length)return;
      g.customQuestions.splice(data.index,1);await this.saveAndBroadcast();return;
    }
    if(data.type==='secret-begin'){
      if(!this.room.secret||this.room.secret.stage!=='setup'||id!==this.room.hostId)return;
      if(this.beginSecret())await this.saveAndBroadcast();return;
    }
    if(data.type==='secret-accept-question'){
      const g=this.room.secret;
      if(!g||g.stage!=='preview'||id!==this.room.hostId)return;
      g.stage='voting';g.votes={};g.predictions={};g.counts=null;g.answeredCount=0;
      await this.saveAndBroadcast();return;
    }
    if(data.type==='secret-change-question'){
      const g=this.room.secret;
      if(!g||g.stage!=='preview'||id!==this.room.hostId)return;
      const choices=availablePreviewQuestions(g);
      if(!choices.length)return;
      const current=g.roundQuestions[g.round];
      if(current)g.skippedKeys.push(questionKey(current));
      const random=new Uint32Array(1);
      crypto.getRandomValues(random);
      g.roundQuestions[g.round]=choices[random[0]%choices.length];
      await this.saveAndBroadcast();return;
    }
    if(data.type==='secret-use-question'){
      const g=this.room.secret;
      if(!g||g.stage!=='preview'||id!==this.room.hostId)return;
      const q=cleanQuestion(data.question);if(!q)return;
      // An original question returns everyone to the preview, as in offline mode.
      // Do not auto-reveal a vote or disclose any participant answer.
      g.roundQuestions[g.round]=q;
      await this.saveAndBroadcast();return;
    }
    if(data.type==='secret-vote'){
      const g=this.room.secret;
      if(!g||g.stage!=='voting'||!['a','b'].includes(data.choice)||g.votes[id])return;
      g.votes[id]=data.choice;
      this.finishVotingIfReady();
      await this.saveAndBroadcast();return;
    }
    if(data.type==='battle-predict'){
      const g=this.room.secret;
      if(!g||g.mode!=='battle'||g.stage!=='voting'||
        !g.votes[id]||g.predictions[id]||!['majority','minority'].includes(data.prediction))return;
      g.predictions[id]=data.prediction;
      this.finishVotingIfReady();
      await this.saveAndBroadcast();return;
    }
    if(data.type==='secret-reveal'){
      const g=this.room.secret;
      if(!g||id!==this.room.hostId||g.stage!=='allAnswered')return;
      g.stage='result';await this.saveAndBroadcast();return;
    }
    if(data.type==='secret-next'){
      const g=this.room.secret;
      if(!g||this.room.hostId!==id||g.stage!=='result')return;
      if(g.round+1>=(g.settings?.roundCount||DEFAULT_ROUNDS))g.stage='finished';
      else{g.round++;g.stage='preview';g.votes={};g.predictions={};g.battleResult=null;g.counts=null;g.answeredCount=0}
      await this.saveAndBroadcast();return;
    }
    if(data.type==='secret-stop'){
      if(!this.room.secret||this.room.hostId!==id)return;
      this.room.secret=null;
      for(const member of this.room.members)member.ready=false;
      await this.saveAndBroadcast();return;
    }
    if(data.type==='remove'){
      if(id!==this.room.hostId||data.memberId===id||typeof data.memberId!=='string')return;
      return this.removeMember(data.memberId);
    }
    if(data.type==='leave')return this.removeMember(id);
  }
  async removeMember(id){
    if(!this.room||!this.room.members.some(m=>m.id===id))return;
    this.room.members=this.room.members.filter(m=>m.id!==id);
    if(this.room.hostId===id)this.room.hostId=this.room.members[0]?.id||null;
    if(this.room.wolf){
      // お題配布・投票中の退出では秘密情報を保持せずロビーへ戻す。
      this.room.wolf=null;
      for(const member of this.room.members)member.ready=false;
    }
    if(this.room.nise){
      // 途中での人数変更は秘密情報と投票の整合性を崩すため、安全にロビーへ戻す。
      this.room.nise=null;
      for(const member of this.room.members)member.ready=false;
    }
    if(this.room.tower){
      // 秘密の手札・配布枚数の整合性を守るため人数が変わったらロビーへ戻す。
      this.room.tower=null;
      for(const member of this.room.members)member.ready=false;
    }
    if(this.room.meter){
      // 数字の秘密と人数・採点の整合性を守るため途中退出時は全員ロビーへ戻す。
      this.room.meter=null;
      for(const member of this.room.members)member.ready=false;
    }
    if(this.room.pita){
      // 対戦途中に人数が変わると全員の同期条件が崩れるため、ロビーへ安全に戻す。
      this.room.pita=null;
      for(const member of this.room.members)member.ready=false;
    }
    if(this.room.secret){
      delete this.room.secret.votes[id];
      if(this.room.secret.predictions)delete this.room.secret.predictions[id];
      if(this.room.secret.scores)delete this.room.secret.scores[id];
      if(this.room.members.length<2){
        this.room.secret=null;
        for(const member of this.room.members)member.ready=false;
      }else this.finishVotingIfReady();
    }
    for(const ws of this.sockets())if(ws.deserializeAttachment()?.id===id){
      this.send(ws,{type:'left'});try{ws.close(4002,'left')}catch{}
    }
    if(!this.room.members.length){
      for(const ws of this.sockets())try{ws.close(4000,'empty')}catch{}
      this.room=null;await this.ctx.storage.deleteAll();await this.ctx.storage.deleteAlarm();
    }else{
      await this.ctx.storage.put('room',this.room);this.broadcast();
    }
  }
  webSocketClose(){this.broadcast()}
  webSocketError(){this.broadcast()}
  async alarm(){
    for(const ws of this.sockets())try{ws.close(4000,'expired')}catch{}
    this.room=null;await this.ctx.storage.deleteAll();
  }
}
