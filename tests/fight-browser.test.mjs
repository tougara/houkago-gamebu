import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,sep,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
const root=resolve(fileURLToPath(new URL('../',import.meta.url)));
let browser,server,base;
before(async()=>{
 server=createServer(async(req,res)=>{
  const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  let file=resolve(root,'.'+path);
  if(!file.startsWith(root+sep)&&file!==root){res.writeHead(403).end();return}
  if(path.endsWith('/'))file=resolve(file,'index.html');
  try{
   const bytes=await readFile(file);
   res.writeHead(200,{'Content-Type':({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png'}[extname(file)]||'application/octet-stream')});res.end(bytes);
  }catch{res.writeHead(404).end()}
 });
 await new Promise(done=>server.listen(0,'127.0.0.1',done));
 base='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({headless:true,args:['--no-sandbox']});
});
after(async()=>{await browser?.close();await new Promise(done=>server?.close(done))});
async function open(w,h){
 const context=await browser.newContext({viewport:{width:w,height:h},isMobile:w<650,hasTouch:w<650});
 const page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/games/houkago-fight/',{waitUntil:'load'});
 return {page,context,errors};
}
test('landscape CPU match displays health bars, 60s round timer, and keyboard',async()=>{
 for(const [w,h] of [[844,390],[1366,768]]){
  const {page,context,errors}=await open(w,h);
  try{
   await page.locator('#startBtn').click();
   assert.equal(await page.locator('#menu').isHidden(),true);
   assert.equal(await page.locator('#p1Name').innerText(),'アオ（あなた）');
   assert.equal(await page.locator('#p1Damage').innerText(),'100');
   assert.equal(await page.locator('#p2Damage').innerText(),'100');
   assert.equal(await page.locator('#p1HpTrack').getAttribute('aria-valuenow'),'100');
   assert.match(await page.locator('#fightRound').innerText(),/ROUND 1/);
   const pixels=await page.locator('#battle').evaluate(c=>Array.from(c.getContext('2d').getImageData(50,50,1,1).data));
   assert.ok(pixels[3]>0);
   await page.keyboard.down('d');await page.waitForTimeout(250);await page.keyboard.up('d');
   await page.keyboard.press('Space');await page.keyboard.press('j');await page.keyboard.press('k');
   await page.waitForTimeout(300);
   assert.match(await page.locator('#fightClock').textContent(),/^\d{1,2}$/);
   assert.ok(await page.locator('#p1State').isVisible());
   await page.locator('#pauseBtn').click();
   assert.ok(await page.locator('#menu').isVisible());
   await page.locator('[data-menu="resume"]').click();
   assert.equal(await page.locator('#menu').isHidden(),true);
   assert.deepEqual(errors,[]);
  }finally{await context.close()}
 }
});
test('six touch controls fit landscape and support two fingers simultaneously',async()=>{
 const {page,context,errors}=await open(844,390);
 try{
  await page.locator('#startBtn').click();
  assert.equal(await page.locator('.fight-controls button').count(),6);
  const geom=await page.evaluate(()=>{
   const rect=document.querySelector('#stage').getBoundingClientRect();
   const b=[...document.querySelectorAll('.fight-controls button')].map(x=>x.getBoundingClientRect());
   return {stage:{top:rect.top,bottom:rect.bottom},b:b.map(r=>({top:r.top,bottom:r.bottom,width:r.width,height:r.height})),over:document.documentElement.scrollWidth-innerWidth};
  });
  assert.ok(geom.over<=2);
  assert.ok(geom.b.every(x=>x.width>=40&&x.height>=36&&x.top>=geom.stage.top-3&&x.bottom<=geom.stage.bottom+3),JSON.stringify(geom));
  const points=await page.evaluate(()=>{
   const r=document.querySelector('[data-key="right"]').getBoundingClientRect();
   const a=document.querySelector('[data-key="light"]').getBoundingClientRect();
   return [{x:r.left+r.width/2,y:r.top+r.height/2,id:11},{x:a.left+a.width/2,y:a.top+a.height/2,id:12}];
  });
  const cdp=await context.newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:points});
  await page.waitForTimeout(100);
  assert.equal(await page.locator('.fight-controls .pressed').count(),2);
  assert.ok((await page.evaluate(()=>window.FightDebug.input)).includes('right'));
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await page.waitForTimeout(90);
  assert.equal(await page.locator('.fight-controls .pressed').count(),0);
  assert.deepEqual(errors,[]);
 }finally{await context.close()}
});
test('portrait guidance works and game still starts when bypassed',async()=>{
 const {page,context,errors}=await open(390,844);
 try{
  assert.equal(await page.locator('#rotateNotice').isVisible(),true);
  await page.locator('#portraitProceed').click();
  assert.equal(await page.locator('#rotateNotice').isVisible(),false);
  await page.locator('#startBtn').click();
  assert.ok(await page.locator('#menu').isHidden());
  assert.equal((await page.evaluate(()=>window.FightDebug.snapshot)).phase,'playing');
  assert.deepEqual(errors,[]);
 }finally{await context.close()}
});
test('HP actually falls when landing real normal attacks and recoveries are shown',async()=>{
 const {page,context,errors}=await open(844,390);
 try{
  await page.locator('#startBtn').click();
  await page.keyboard.down('d');
  await page.waitForTimeout(540);
  await page.keyboard.up('d');
  for(let i=0;i<9;i++){await page.keyboard.press('j');await page.waitForTimeout(230)}
  const snapshot=await page.evaluate(()=>window.FightDebug.snapshot);
  assert.ok(snapshot.fighters.some(f=>f.hp<100),'real browser combat must deal HP damage: '+JSON.stringify(snapshot.fighters.map(f=>({x:f.x,hp:f.hp}))));
  const [a,b]=snapshot.fighters;
  assert.ok(a.x>=76&&a.x<=884&&b.x>=76&&b.x<=884);
  assert.deepEqual(errors,[]);
 }finally{await context.close()}
});
