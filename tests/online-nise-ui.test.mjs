import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,extname,sep} from 'node:path';
import {chromium} from 'playwright';

const root=resolve(fileURLToPath(new URL('../',import.meta.url)));
let server,browser,base;
before(async()=>{
 server=createServer(async(req,res)=>{
  const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  let path=resolve(root,'.'+name);
  if(!path.startsWith(root+sep)&&path!==root){res.writeHead(403).end();return}
  if(name.endsWith('/'))path=resolve(path,'index.html');
  try{
   const body=await readFile(path),ext=extname(path);
   const type={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8',
    '.js':'text/javascript; charset=utf-8','.png':'image/png',
    '.svg':'image/svg+xml','.jpg':'image/jpeg','.webp':'image/webp'}[ext]||'application/octet-stream';
   res.writeHead(200,{'Content-Type':type});res.end(body);
  }catch{res.writeHead(404).end()}
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 base='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({headless:true,args:['--no-sandbox']});
});
after(async()=>{await browser?.close();await new Promise(done=>server?.close(done))});
const counts=n=>({classmate:n-2,fake:2,president:1,swapper:1,observer:0,dayDuty:0,collaborator:0,trickster:0});
const people=n=>Array.from({length:n},(_,i)=>({id:'p'+i,name:'プレイヤー'+(i+1),icon:['🐯','🐼','🦊','🐸','🐧','🐰','🦄','🐨','🐱','🐵'][i]}));
function room(stage,n=4,extra={}){
 const members=people(n);
 const roles=['classmate','fake','president','swapper'];
 const votes=Object.fromEntries(members.map((m,i)=>[m.id,members[(i+1)%n].id]));
 const tally=Object.fromEntries(members.map(m=>[m.id,1]));
 return {code:'ABCD2345',phase:'nise',hostId:'p0',members,gameId:'nise-transfer-student',
  nise:{stage,count:n,members,duration:180,counts:counts(n),
   myRole:'president',revealedCount:0,myRevealed:false,
   nightIsMyTurn:true,myIntel:null,nightWaiting:false,
   timerRemaining:180,deadline:0,chat:[],votedCount:0,myVoted:false,
   result:stage==='result'?{
    kind:'real',winner:'ホンモノサイド勝利',expelled:['p1'],max:2,
    votes,tally,
    final:Object.fromEntries(members.map((m,i)=>[m.id,roles[i%4]])),
    rest:['classmate','fake']}:null,
   ...extra}};
}
async function open(width,height){
 const context=await browser.newContext({viewport:{width,height},isMobile:width<650,
  hasTouch:width<650,deviceScaleFactor:1});
 const page=await context.newPage(),errors=[];
 page.on('pageerror',err=>errors.push(err.message));
 await page.addInitScript(()=>{
  sessionStorage.setItem('houkago-online-session-v1',JSON.stringify({
   code:'ABCD2345',token:'a'.repeat(64),id:'p0',name:'プレイヤー1'}));
  class FakeWebSocket{
   static OPEN=1;
   constructor(url){this.url=url;this.readyState=1;this.sent=[];window.__onlineFakeWS=this;
    queueMicrotask(()=>this.onopen?.({}));
   }
   send(text){this.sent.push(JSON.parse(text))}
   close(){this.readyState=3}
  }
  window.WebSocket=FakeWebSocket;
  window.__pushOnlineRoom=room=>window.__onlineFakeWS?.onmessage?.({
   data:JSON.stringify({type:'room',room})
  });
 });
 await page.goto(base+'/online/nise-transfer-student/?room=ABCD2345',{waitUntil:'load'});
 await page.waitForFunction(()=>!!window.__onlineFakeWS);
 const push=async(info)=>{
  await page.evaluate(x=>window.__pushOnlineRoom(x),info);
  await page.locator('#game-root .title, #game-root .result-hero').first().waitFor();
 };
 return {page,context,errors,push};
}
async function bounds(page){
 return page.evaluate(()=>{
  const card=el=>{if(!el)return null;const r=el.getBoundingClientRect();return{
   top:r.top,bottom:r.bottom,left:r.left,right:r.right,width:r.width,height:r.height,
   scrollHeight:el.scrollHeight,clientHeight:el.clientHeight}};
  return {app:card(document.querySelector('.nise-online-app')),
   root:card(document.getElementById('game-root')),
   head:card(document.querySelector('.nise-play-head')),
   board:card(document.querySelector('.nise-play-board')),
   actions:card(document.querySelector('.nise-play-actions')),
   viewport:{w:innerWidth,h:innerHeight}};
 });
}
function inViewport(r,msg){
 assert.ok(r&&r.top>=-2&&r.bottom<=r.viewportH+2,msg+' '+JSON.stringify(r));
}
for(const [name,w,h] of [['small phone',360,620],['phone',390,740],['desktop',1280,800]]){
 test('four-role tabs, time selector and ready button fit: '+name,async()=>{
  const {page,context,errors,push}=await open(w,h);
  try{
   await push(room('setup',10));
   assert.equal(await page.locator('.role-reg-group .role-row').count(),4);
   const measure=()=>page.locator('.role-reg-group').evaluate(area=>{
    const rect=area.getBoundingClientRect();
    return{bottom:rect.bottom,rows:[...area.querySelectorAll('.role-row')].map(el=>{
     const r=el.getBoundingClientRect(),b=el.querySelector('button')?.getBoundingClientRect();
     return{top:r.top,bottom:r.bottom,height:r.height,buttonHeight:b?.height}})};
   });
   let a=await measure();for(const row of a.rows){
    assert.ok(row.height>=33,'role not visible: '+name+' '+JSON.stringify(a));
    assert.ok(row.bottom<=a.bottom+2,'role row clipped: '+name);
   }
   const tabs=page.locator('[data-role-tab]');
   await tabs.nth(1).click();
   assert.deepEqual(await page.locator('.role-reg-group .role-title').allTextContents(),
    ['観察係','日直','秘密の協力者','いたずらっ子']);
   await tabs.nth(0).click();
   assert.deepEqual(await page.locator('.role-reg-group .role-title').allTextContents(),
    ['クラスメイト','ニセ転校生','学級委員','席替え係']);
   const b=await page.locator('[data-game-begin]').boundingBox();
   assert.ok(b&&b.y+b.height<=h+1,'deal roles button must remain visible');
   assert.equal(await page.locator('[data-role-tab]').count(),2);
   await page.locator('.online-setup-members summary').click();
   assert.equal(await page.locator('.online-member-list span').count(),10);
   assert.deepEqual(errors,[]);
  }finally{await context.close()}
 });
 test('offline-like game board, actions and secret vote fit: '+name,async()=>{
  const {page,context,errors,push}=await open(w,h);
  try{
   for(const stage of ['reveal','night','discussion','voting','result']){
    await push(room(stage,10,{myRole:stage==='night'?'observer':'president'}));
    assert.equal(await page.locator('.nise-play-shell .nise-play-board').count(),1);
    assert.equal(await page.locator('.nise-play-shell .nise-play-actions').count(),1);
    const b=await bounds(page);
    assert.ok(b.root.bottom<=h+2,'game root extends below viewport '+stage+' '+JSON.stringify(b));
    assert.ok(b.board.height>90,'board too small '+stage+' '+JSON.stringify(b));
    assert.ok(b.actions.height>25,'missing actions '+stage+' '+JSON.stringify(b));
    assert.equal(await page.locator('.table-player-row .table-card-wrap').count(),10);
    const card=await page.locator('.table-player-row .table-card').first().boundingBox();
    assert.ok(card.width>=27,'cards not tappable '+stage+' '+JSON.stringify(b));
   }
   await push(room('voting',4));
   await page.locator('[data-target="p1"]').click();
   assert.equal(await page.locator('[data-confirm-vote]').count(),1);
   await page.locator('[data-confirm-vote]').click();
   const sent=await page.evaluate(()=>window.__onlineFakeWS.sent);
   assert.ok(sent.some(x=>x.type==='nise-vote'&&x.target==='p1'));
   await push(room('result',4));
   assert.equal(await page.locator('.nise-result-details[open]').count(),0);
   await page.locator('.nise-result-details summary').click();
   assert.equal(await page.locator('.online-results-votes>div').count(),4);
   assert.deepEqual(errors,[]);
  }finally{await context.close()}
 });
}
test('role secrecy on hold, chatting on demand and key accessibility are preserved',async()=>{
 const {page,context,errors,push}=await open(390,740);
 try{
  await push(room('reveal',4,{myRole:'fake'}));
  const role=page.locator('.online-secret-info').first();
  assert.equal(await role.isVisible(),false,'role must start hidden');
  await page.locator('[data-hold-secret]').first().dispatchEvent('pointerdown',{pointerId:7});
  assert.equal(await role.isVisible(),true,'role visible only while holding');
  await page.locator('[data-hold-secret]').first().dispatchEvent('pointerup',{pointerId:7});
  assert.equal(await role.isVisible(),false,'role hidden on release');
  await push(room('discussion',4));
  assert.equal(await page.locator('.online-chat-panel[open]').count(),0);
  await page.locator('.online-chat-panel summary').click();
  await page.locator('#chat-input').fill('こんにちは');
  await page.locator('.online-chat-form button').click();
  assert.ok((await page.evaluate(()=>window.__onlineFakeWS.sent)).some(
   x=>x.type==='nise-chat'&&x.text==='こんにちは'));
  await push(room('voting',4));
  const card=page.locator('[data-target="p1"]');
  await card.focus();
  await page.keyboard.press('Enter');
  assert.equal(await page.locator('[data-confirm-vote]').count(),1);
  assert.deepEqual(errors,[]);
 }finally{await context.close()}
});
