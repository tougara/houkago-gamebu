import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,sep,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
const root=resolve(fileURLToPath(new URL('../',import.meta.url)));
let server,browser,base;
before(async()=>{
 server=createServer(async(req,res)=>{
  const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  let file=resolve(root,'.'+path);
  if(!file.startsWith(root+sep)&&file!==root){res.writeHead(403).end();return}
  if(path.endsWith('/'))file=resolve(file,'index.html');
  try{
   const bytes=await readFile(file);
   res.writeHead(200,{'Content-Type':({'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png'}[extname(file)]||'application/octet-stream')});res.end(bytes);
  }catch{res.writeHead(404).end()}
 });
 await new Promise(done=>server.listen(0,'127.0.0.1',done));
 base='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({headless:true,args:['--no-sandbox','--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
});
after(async()=>{await browser?.close();await new Promise(done=>server?.close(done))});
async function open(width,height){
 const context=await browser.newContext({viewport:{width,height},isMobile:width<700,hasTouch:width<700});
 const page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/games/nurikakure/',{waitUntil:'load'});
 await page.locator('#loading').waitFor({state:'hidden',timeout:30000});
 return {page,context,errors};
}
test('3D art classroom loads and walking + orbit works on PC',async()=>{
 const {page,context,errors}=await open(1366,768);
 try{
  const before=await page.evaluate(()=>({...window.NurikakureDebug.position,camera:window.NurikakureDebug.camera.yaw}));
  assert.ok(Number.isFinite(before.x)&&Number.isFinite(before.z));
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(600);
  await page.keyboard.up('KeyW');
  const after=await page.evaluate(()=>({...window.NurikakureDebug.position,camera:window.NurikakureDebug.camera.yaw}));
  assert.ok(Math.hypot(after.x-before.x,after.z-before.z)>.25,'keyboard must move avatar');
  const area=page.locator('#world'),rect=await area.boundingBox();
  await page.mouse.move(rect.x+rect.width*.55,rect.y+rect.height*.40);
  await page.mouse.down();await page.mouse.move(rect.x+rect.width*.68,rect.y+rect.height*.50,{steps:8});await page.mouse.up();
  const yaw=await page.evaluate(()=>window.NurikakureDebug.camera.yaw);
  assert.ok(Math.abs(yaw-before.camera)>.1,'drag must orbit camera');
  assert.ok(await page.locator('#openPaint').isVisible());
  assert.deepEqual(errors,[]);
 }finally{await context.close()}
});
test('paint strokes update texture and persist after refresh with undo and reset',async()=>{
 const {page,context,errors}=await open(1000,700);
 try{
  await page.locator('#openPaint').click();
  assert.ok(await page.locator('#paintModal').isVisible());
  assert.equal(await page.evaluate(()=>window.NurikakureDebug.painting),true);
  const pick=page.locator('[data-color="#e67277"]');await pick.click();
  const board=page.locator('#paintCanvas'),b=await board.boundingBox();
  const point={x:b.x+b.width*.45,y:b.y+b.height*.45};
  const pixels=await page.evaluate(()=>{
   const c=document.querySelector('#paintCanvas'),ctx=c.getContext('2d');
   return [...ctx.getImageData(230,230,1,1).data];
  });
  await page.mouse.move(point.x,point.y);await page.mouse.down();
  await page.mouse.move(point.x+4,point.y+18,{steps:7});await page.mouse.up();
  const after=await page.evaluate(()=>{
   const c=document.querySelector('#paintCanvas'),ctx=c.getContext('2d');
   return [...ctx.getImageData(230,230,1,1).data];
  });
  assert.notDeepEqual(after,pixels,'drawn stroke must alter canvas');
  const saved=await page.evaluate(()=>localStorage.getItem('houkago_nurikakure_paint_v1'));
  assert.ok(saved?.startsWith('data:image/png;base64,'));
  await page.locator('#undoPaint').click();
  const undo=await page.evaluate(()=>[...document.querySelector('#paintCanvas').getContext('2d').getImageData(230,230,1,1).data]);
  assert.deepEqual(undo,pixels,'undo should restore previous pixel');
  await page.locator('#paintCanvas').click({position:{x:b.width*.55,y:b.height*.42}});
  await page.locator('#finishPaint').click();
  assert.equal(await page.locator('#paintModal').isHidden(),true);
  await page.reload({waitUntil:'load'});
  await page.locator('#loading').waitFor({state:'hidden',timeout:30000});
  const restored=await page.evaluate(()=>localStorage.getItem('houkago_nurikakure_paint_v1')?.startsWith('data:image/png;base64,'));
  assert.equal(restored,true);
  assert.deepEqual(errors,[]);
 }finally{await context.close()}
});
test('touch joystick and freehand mobile drawing work in landscape',async()=>{
 const {page,context,errors}=await open(844,390);
 try{
  const before=await page.evaluate(()=>window.NurikakureDebug.position);
  const joy=await page.locator('#joystick').boundingBox();
  const y=joy.y+joy.height*.5,x=joy.x+joy.width*.5;
  const cdp=await context.newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y-joy.height*.26,id:1}]});
  await page.waitForTimeout(450);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  const after=await page.evaluate(()=>window.NurikakureDebug.position);
  assert.ok(Math.hypot(after.x-before.x,after.z-before.z)>.12,'joystick must move character');
  await page.locator('#openPaint').click();
  const modal=page.locator('#paintModal');assert.ok(await modal.isVisible());
  const box=await page.locator('#paintCanvas').boundingBox();
  assert.ok(box.width>110&&box.height>110,'mobile paint must have usable canvas');
  const p={x:box.x+box.width*.32,y:box.y+box.height*.56,id:3};
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[p]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:p.x+18,y:p.y+10,id:3}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  assert.ok(await page.evaluate(()=>!!localStorage.getItem('houkago_nurikakure_paint_v1')));
  const preview=await page.locator('#characterPreview').boundingBox();
  assert.ok(preview.width>100&&preview.height>50);
  assert.deepEqual(errors,[]);
 }finally{await context.close()}
});
test('portrait phone has usable 3D stage, painting tool and no horizontal overflow',async()=>{
 const {page,context,errors}=await open(390,844);
 try{
  assert.ok(await page.locator('#openPaint').isVisible());
  await page.locator('#openPaint').click();
  assert.ok(await page.locator('#characterPreview').isVisible());
  assert.ok(await page.locator('#brushSize').isVisible());
  const geom=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,viewport:innerWidth}));
  assert.ok(geom.scroll<=geom.viewport+2,'page should not scroll horizontally');
  await page.locator('#finishPaint').click();
  assert.equal(await page.locator('#paintModal').isHidden(),true);
  assert.deepEqual(errors,[]);
 }finally{await context.close()}
});
