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
   const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8',
     '.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8',
     '.png':'image/png'}[extname(file)]||'application/octet-stream';
   res.writeHead(200,{'Content-Type':mime});res.end(bytes);
  }catch{res.writeHead(404).end()}
 });
 await new Promise(done=>server.listen(0,'127.0.0.1',done));
 base='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({headless:true,args:['--no-sandbox']});
});
after(async()=>{await browser?.close();await new Promise(done=>server?.close(done))});
async function open(width=390,height=780){
 const context=await browser.newContext({viewport:{width,height},isMobile:width<650,hasTouch:width<650,deviceScaleFactor:1});
 const page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/games/history-life/',{waitUntil:'load'});
 await page.waitForFunction(()=>window.HistoryLifeDebug&&window.HistoryLifeDebug.eventCount>=35);
 return {page,context,errors};
}
test('standalone game opens three eras and 3 save slots on mobile and desktop',async()=>{
 for(const [w,h] of [[375,720],[390,780],[1366,768]]){
  const {page,context,errors}=await open(w,h);
  try{
   assert.equal(await page.locator('[name="era"]').count(),4);
   assert.equal(await page.locator('#slotSelect option').count(),3);
   assert.equal(await page.locator('#setupView').isVisible(),true);
   assert.ok((await page.locator('#savesList').textContent()).includes('空きスロット'));
   const scroll=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
   assert.ok(scroll<=2,'horizontal overflow width '+w+' px: '+scroll);
   assert.deepEqual(errors,[]);
  }finally{await context.close()}
 }
});
test('birth -> childhood -> first milestone -> focused year -> save and continue',async()=>{
 const {page,context,errors}=await open();
 try{
  await page.locator('[name="era"][value="sengoku"]').check();
  await page.locator('#birthYearInput').fill('1548');
  await page.locator('#regionSelect').selectOption('tokai');
  await page.locator('#newLifeButton').click();
  assert.equal(await page.locator('#gameView').isVisible(),true);
  let s=await page.evaluate(()=>window.HistoryLifeDebug.snapshot);
  assert.equal(s.birthYear,1548);assert.equal(s.age,0);
  for(let i=0;i<7;i++)await page.locator('[data-action="child"]').click();
  s=await page.evaluate(()=>window.HistoryLifeDebug.snapshot);
  assert.equal(s.age,7);assert.equal(s.pending.id,'milestone-7');
  assert.equal(await page.locator('[data-choice]').count(),3);
  await page.locator('[data-choice="seek"]').click();
  await page.locator('[data-focus="learn"]').click();
  s=await page.evaluate(()=>window.HistoryLifeDebug.snapshot);
  assert.equal(s.age,8);
  assert.equal(s.choices,1);
  await page.locator('#homeButton').click();
  assert.equal(await page.locator('#setupView').isVisible(),true);
  assert.equal(await page.locator('[data-continue]').count(),1);
  await page.reload({waitUntil:'load'});
  await page.waitForFunction(()=>window.HistoryLifeDebug?.eventCount>=35);
  await page.locator('[data-continue="0"]').click();
  s=await page.evaluate(()=>window.HistoryLifeDebug.snapshot);
  assert.equal(s.age,8);assert.equal(s.stats.knowledge>10,true);
  await page.locator('#historyButton').click();
  assert.equal(await page.locator('#historyModal').isVisible(),true);
  await page.locator('#closeHistory').click();
  assert.deepEqual(errors,[]);
 }finally{await context.close()}
});
test('Owari citizen sees 1560 event as a local history card with independently linked source',async()=>{
 const {page,context,errors}=await open(390,780);
 try{
  await page.locator('[name="era"][value="sengoku"]').check();
  await page.locator('#birthYearInput').fill('1548');
  await page.locator('#regionSelect').selectOption('tokai');
  await page.locator('#newLifeButton').click();
  for(let n=0;n<24;n++){
   const data=await page.evaluate(()=>window.HistoryLifeDebug.snapshot);
   if(data.year===1560)break;
   if(data.phase==='event')await page.locator('[data-choice]').first().click();
   else if(data.age<7)await page.locator('[data-action="child"]').click();
   else await page.locator('[data-focus="family"]').click();
  }
  const result=await page.evaluate(()=>window.HistoryLifeDebug.snapshot);
  assert.equal(result.year,1560);
  assert.equal(result.pending?.kind,'history');
  assert.match(await page.locator('#storyTitle').innerText(),/桶狭間/);
  const href=await page.locator('#storySource a').getAttribute('href');
  assert.match(href,/^https:\/\//);
  await page.locator('[data-choice="observe"]').click();
  assert.equal((await page.evaluate(()=>window.HistoryLifeDebug.snapshot)).phase,'living');
  assert.deepEqual(errors,[]);
 }finally{await context.close()}
});
test('5-year travel, archive and end-of-life view never allow unintended extra years',async()=>{
 const {page,context,errors}=await open(1366,768);
 try{
  await page.locator('[name="era"][value="edo"]').check();
  await page.locator('#newLifeButton').click();
  for(let i=0;i<7;i++)await page.locator('[data-action="child"]').click();
  await page.locator('[data-choice]').first().click();
  await page.locator('[data-focus="work"]').click();
  await page.locator('[data-action="auto5"]').click();
  const s=await page.evaluate(()=>window.HistoryLifeDebug.snapshot);
  assert.ok(s.age>=9&&s.age<=14);
  if(s.phase==='event')await page.locator('[data-choice]').first().click();
  assert.equal(await page.locator('#statBars .stat-line').count(),5);
  assert.ok((await page.locator('#miniLog').textContent()).length>10);
  assert.deepEqual(errors,[]);
 }finally{await context.close()}
});

test('v0.2 mobile relationship interaction survives a reload and blocks a second interaction',async()=>{
 const {page,context,errors}=await open(390,780);
 try{
  await page.locator('[name="era"][value="sengoku"]').check();
  await page.locator('#birthYearInput').fill('1544');
  await page.locator('#newLifeButton').click();
  let attempts=0;
  while((await page.evaluate(()=>window.HistoryLifeDebug.snapshot.age))<7&&attempts++<9)
    await page.locator('[data-action="child"]').click();
  assert.equal(await page.locator('[data-choice]').count(),3);
  await page.locator('[data-choice]').first().click();
  assert.ok(await page.locator('.person-row').count()>=2);
  const before=await page.evaluate(()=>window.HistoryLifeDebug.snapshot);
  const button=page.locator('[data-social-action="talk"]').first();
  await button.click();
  const after=await page.evaluate(()=>window.HistoryLifeDebug.snapshot);
  assert.equal(after.lastSocialYear,after.year);
  assert.equal(after.people.length,before.people.length);
  assert.ok(after.log.some(e=>e.kind==='relationship'));
  assert.equal(await page.locator('[data-social-action="talk"]').count(),0,'no extra interaction in same year');
  await page.locator('#homeButton').click();
  await page.reload({waitUntil:'load'});
  await page.waitForFunction(()=>window.HistoryLifeDebug?.eventCount>=35);
  await page.locator('[data-continue="0"]').click();
  const persisted=await page.evaluate(()=>window.HistoryLifeDebug.snapshot);
  assert.equal(persisted.lastSocialYear,persisted.year);
  assert.equal(persisted.people.length,after.people.length);
  assert.deepEqual(errors,[]);
 }finally{await context.close()}
});
test('career picker works after age 15; job skills and options survive save/reload',async()=>{
 const {page,context,errors}=await open(390,780);
 try{
  await page.locator('[name="era"][value="sengoku"]').check();
  await page.locator('#birthYearInput').fill('1544');
  await page.locator('#newLifeButton').click();
  let attempts=0;
  while(attempts++<70){
   const s=await page.evaluate(()=>window.HistoryLifeDebug.snapshot);
   if(s.age>=15&&s.phase==='living')break;
   if(s.phase==='event')await page.locator('[data-choice]').first().click();
   else if(s.age<7)await page.locator('[data-action="child"]').click();
   else await page.locator('[data-focus="work"]').click();
  }
  const before=await page.evaluate(()=>window.HistoryLifeDebug.snapshot);
  assert.ok(before.age>=15);
  assert.ok(before.career.jobId!=='dependent');
  await page.locator('#careerButton').click();
  assert.ok(await page.locator('#careerModal').isVisible());
  assert.ok(await page.locator('.job-row').count()>=8);
  const available=page.locator('.job-row button:not(:disabled)').first();
  assert.ok(await available.count()>0);
  await available.click();
  const after=await page.evaluate(()=>window.HistoryLifeDebug.snapshot);
  assert.equal(after.career.lastSwitchYear,after.year);
  await page.locator('#homeButton').click();
  await page.reload({waitUntil:'load'});
  await page.waitForFunction(()=>window.HistoryLifeDebug?.eventCount>=35);
  await page.locator('[data-continue="0"]').click();
  const restored=await page.evaluate(()=>window.HistoryLifeDebug.snapshot);
  assert.deepEqual(restored.career,after.career);
  assert.deepEqual(errors,[]);
 }finally{await context.close()}
});
