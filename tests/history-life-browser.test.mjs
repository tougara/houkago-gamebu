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
async function open(width=390,height=780,query='?seed=444'){
 const context=await browser.newContext({viewport:{width,height},isMobile:width<650,hasTouch:width<650,deviceScaleFactor:1});
 const page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/games/history-life/'+query,{waitUntil:'load'});
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
 const {page,context,errors}=await open(390,780,'?seed=19');
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
  // A second life event in the same year must not be lost after the historical card.
  for(let i=0;i<5;i++){
   const state=await page.evaluate(()=>window.HistoryLifeDebug.snapshot);
   if(state.phase!=='event')break;
   assert.equal(state.year,1560,'queued choice must not advance year');
   await page.locator('[data-choice]').first().click();
  }
  const after=await page.evaluate(()=>window.HistoryLifeDebug.snapshot);
  assert.equal(after.phase,'living');
  assert.equal(after.year,1560);
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
  assert.ok(await page.locator('.job-row').count()>=7,'Sengoku has 7 career paths');
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

test('time flow auto-advances, pauses, speeds up and skips to next real milestone',async()=>{
 const {page,context,errors}=await open(390,780);
 try{
  await page.locator('[name="era"][value="sengoku"]').check();
  await page.locator('#birthYearInput').fill('1544');
  await page.locator('#newLifeButton').click();
  const initial=await page.evaluate(()=>window.HistoryLifeDebug.snapshot.age);
  assert.equal(initial,0);
  assert.equal(await page.evaluate(()=>window.HistoryLifeDebug.clock.secondsPerYear),45);
  await page.locator('#clockDuration').selectOption('30');
  assert.equal(await page.evaluate(()=>window.HistoryLifeDebug.clock.secondsPerYear),22.5);
  await page.locator('#clockSpeed').selectOption('16');
  await page.locator('#clockToggle').click();
  assert.equal(await page.evaluate(()=>window.HistoryLifeDebug.clock.running),true);
  await page.waitForTimeout(2250);
  let age=await page.evaluate(()=>window.HistoryLifeDebug.snapshot.age);
  assert.ok(age>=1&&age<=6,'fast clock advanced '+age+' years');
  await page.locator('#clockToggle').click();
  assert.equal(await page.evaluate(()=>window.HistoryLifeDebug.clock.running),false);
  const paused=await page.evaluate(()=>window.HistoryLifeDebug.snapshot.age);
  await page.waitForTimeout(850);
  assert.equal(await page.evaluate(()=>window.HistoryLifeDebug.snapshot.age),paused);
  await page.locator('#clockNext').click();
  const result=await page.evaluate(()=>window.HistoryLifeDebug.snapshot);
  assert.equal(result.age,7);
  assert.equal(result.phase,'event');
  assert.equal(await page.evaluate(()=>window.HistoryLifeDebug.clock.running),false);
  assert.deepEqual(errors,[]);
 }finally{await context.close()}
});
test('cash flow, shopping, saved money ledger and debt display work on phone',async()=>{
 const {page,context,errors}=await open(390,780);
 try{
  await page.locator('[name="era"][value="edo"]').check();
  await page.locator('#newLifeButton').click();
  for(let i=0;i<7;i++)await page.locator('[data-action="child"]').click();
  await page.locator('[data-choice]').first().click();
  let initial=await page.evaluate(()=>window.HistoryLifeDebug.snapshot);
  assert.equal(await page.locator('.money-stat').count(),3);
  assert.equal(await page.locator('#moneyFlow').isVisible(),true);
  await page.locator('[data-money="food"]').click();
  const result=await page.evaluate(()=>window.HistoryLifeDebug.snapshot);
  assert.equal(result.money.lastSpendYear,result.year);
  assert.ok(result.money.ledger.some(e=>e.label.includes('食べ物')));
  assert.equal(await page.locator('[data-money="tools"]').isDisabled(),true);
  await page.locator('#homeButton').click();
  await page.reload({waitUntil:'load'});
  await page.waitForFunction(()=>window.HistoryLifeDebug?.eventCount>=35);
  await page.locator('[data-continue="0"]').click();
  const restored=await page.evaluate(()=>window.HistoryLifeDebug.snapshot);
  assert.deepEqual(restored.money,result.money);
  assert.equal(restored.year,initial.year);
  assert.deepEqual(errors,[]);
 }finally{await context.close()}
});

test('annual focus can be changed during automatic flow without advancing an extra year',async()=>{
 const {page,context,errors}=await open(390,780);
 try{
  await page.locator('[name="era"][value="sengoku"]').check();
  await page.locator('#birthYearInput').fill('1544');
  await page.locator('#newLifeButton').click();
  for(let i=0;i<7;i++)await page.locator('[data-action="child"]').click();
  await page.locator('[data-choice]').first().click();
  await page.locator('#clockSpeed').selectOption('1');
  await page.locator('#clockToggle').click();
  const age=await page.evaluate(()=>window.HistoryLifeDebug.snapshot.age);
  await page.locator('[data-focus="learn"]').click();
  const state=await page.evaluate(()=>window.HistoryLifeDebug.snapshot);
  assert.equal(state.age,age,'changing focus while running must not skip a year');
  assert.equal(state.autoFocus,'learn');
  assert.ok(await page.locator('[data-focus="learn"]').evaluate(x=>x.classList.contains('focus-active')));
  assert.equal(await page.evaluate(()=>window.HistoryLifeDebug.clock.running),true);
  await page.locator('#clockToggle').click();
  assert.deepEqual(errors,[]);
 }finally{await context.close()}
});

test('historical coins and indicative modern-yen comparisons change when Meiji yen begins',async()=>{
 const {page,context,errors}=await open(390,780,'?seed=19');
 try{
  await page.locator('[name="era"][value="bakumatsu-meiji"]').check();
  await page.locator('#birthYearInput').fill('1865');
  await page.locator('#newLifeButton').click();
  assert.match(await page.locator('#moneyEraUnits').innerText(),/両/);
  assert.match(await page.locator('#currencyExample').innerText(),/1両/);
  assert.match(await page.locator('.money-stat').first().innerText(),/円目安/);
  for(let i=0;i<6;i++){
   const s=await page.evaluate(()=>window.HistoryLifeDebug.snapshot);
   if(s.phase==='event')await page.locator('[data-choice]').first().click();
   else await page.locator('[data-action="child"]').click();
  }
  const state=await page.evaluate(()=>window.HistoryLifeDebug.snapshot);
  assert.equal(state.year,1871);
  assert.match(await page.locator('#moneyEraUnits').innerText(),/円・銭/);
  assert.match(await page.locator('#currencyExample').innerText(),/1円/);
  const href=await page.locator('#currencySource').getAttribute('href');
  assert.match(href,/^https:\/\//);
  assert.deepEqual(errors,[]);
 }finally{await context.close()}
});
test('life duration is selectable, persists across reload and stays synchronized on game screen',async()=>{
 const {page,context,errors}=await open(390,780);
 try{
  await page.locator('#lifeDuration').selectOption('90');
  await page.locator('[name="era"][value="edo"]').check();
  await page.locator('#newLifeButton').click();
  let clock=await page.evaluate(()=>window.HistoryLifeDebug.clock);
  assert.equal(clock.duration,90);
  assert.equal(clock.secondsPerYear,67.5);
  assert.equal(await page.locator('#clockDuration').inputValue(),'90');
  await page.locator('#clockDuration').selectOption('30');
  clock=await page.evaluate(()=>window.HistoryLifeDebug.clock);
  assert.equal(clock.secondsPerYear,22.5);
  await page.locator('#homeButton').click();
  assert.equal(await page.locator('#lifeDuration').inputValue(),'30');
  await page.reload({waitUntil:'load'});
  await page.waitForFunction(()=>window.HistoryLifeDebug?.eventCount>=35);
  assert.equal(await page.locator('#lifeDuration').inputValue(),'30');
  assert.deepEqual(errors,[]);
 }finally{await context.close()}
});

test('life-map, peers and reflection survive reopening the saved life',async()=>{
 const {page,context,errors}=await open(390,780,'?seed=74');
 try{
  await page.locator('[name="era"][value="edo"]').check();
  await page.locator('#newLifeButton').click();
  assert.equal(await page.locator('#lifeMap .life-tile').count(),1);
  assert.equal(await page.locator('.contemporary').count(),3);
  for(let i=0;i<5;i++)await page.locator('[data-action="child"]').click();
  assert.equal(await page.locator('#reflectionPanel').isVisible(),true);
  await page.locator('#reflectionNote').fill('家族と過ごした日々を忘れない');
  await page.locator('#reflectionForm button').click();
  assert.equal(await page.locator('#reflectionSaved').isVisible(),true);
  assert.equal(await page.locator('#lifeMap .life-tile').count(),6);
  await page.locator('[data-life-age="3"]').click();
  assert.match(await page.locator('#lifeMapDetail').innerText(),/3歳/);
  await page.locator('#homeButton').click();
  await page.reload({waitUntil:'load'});
  await page.waitForFunction(()=>window.HistoryLifeDebug?.eventCount>=35);
  await page.locator('[data-continue="0"]').click();
  const state=await page.evaluate(()=>window.HistoryLifeDebug.snapshot);
  assert.equal(state.reflections['5'],'家族と過ごした日々を忘れない');
  assert.equal(await page.locator('#lifeMap .life-tile').count(),6);
  assert.equal(await page.locator('.contemporary').count(),3);
  assert.deepEqual(errors,[]);
 }finally{await context.close()}
});
test('manual event auto-choice clears pending events and allows pausing anytime',async()=>{
 const {page,context,errors}=await open(390,780,'?seed=61');
 try{
  await page.locator('[name="era"][value="sengoku"]').check();
  await page.locator('#newLifeButton').click();
  await page.locator('#clockNext').click();
  let s=await page.evaluate(()=>window.HistoryLifeDebug.snapshot);
  assert.equal(s.age,7);
  assert.equal(s.phase,'event');
  await page.locator('#autoDecisions').check();
  s=await page.evaluate(()=>window.HistoryLifeDebug.snapshot);
  assert.equal(s.phase,'living');
  assert.ok(s.specialChoices>0);
  assert.equal(await page.evaluate(()=>window.HistoryLifeDebug.clock.autoDecisions),true);
  await page.locator('#clockSpeed').selectOption('16');
  await page.locator('#clockToggle').click();
  assert.equal(await page.evaluate(()=>window.HistoryLifeDebug.clock.running),true);
  await page.locator('#clockToggle').click();
  assert.equal(await page.evaluate(()=>window.HistoryLifeDebug.clock.running),false);
  assert.deepEqual(errors,[]);
 }finally{await context.close()}
});
test('completed life goes to local archives, and invalid backups are rejected',async()=>{
 const {page,context,errors}=await open(390,780,'?seed=46');
 try{
  await page.locator('[name="era"][value="edo"]').check();
  await page.locator('#newLifeButton').click();
  await page.locator('#autoDecisions').check();
  await page.locator('#clockNext').click();
  const s=await page.evaluate(()=>window.HistoryLifeDebug.snapshot);
  assert.equal(s.phase,'ended');
  await page.locator('#homeButton').click();
  await page.locator('#archiveButton').click();
  assert.ok(await page.locator('[data-archive-view]').count()>=1);
  await page.locator('[data-archive-view]').first().click();
  assert.equal(await page.locator('#historyModal').isVisible(),true);
  assert.match(await page.locator('#fullLog').innerText(),/人生の終わり/);
  await page.locator('#closeHistory').click();
  await page.locator('#archiveButton').click();
  const bad={name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{"wrong":1}')};
  await page.locator('#importLivesFile').setInputFiles(bad);
  await page.waitForFunction(()=>document.getElementById('archiveFeedback').textContent.includes('対応する人生記録ではありません'));
  assert.match(await page.locator('#archiveFeedback').innerText(),/対応する人生記録ではありません/);
  assert.deepEqual(errors,[]);
 }finally{await context.close()}
});

test('life archive JSON export/import round-trip restores all three slots without an account',async()=>{
 const {page,context,errors}=await open(390,780,'?seed=34');
 try{
  await page.locator('[name="era"][value="edo"]').check();
  await page.locator('#newLifeButton').click();
  for(let i=0;i<5;i++)await page.locator('[data-action="child"]').click();
  await page.locator('#reflectionNote').fill('家族の思い出を覚えておこう');
  await page.locator('#reflectionForm button').click();
  const original=await page.evaluate(()=>window.HistoryLifeDebug.snapshot);
  await page.locator('#homeButton').click();
  await page.locator('#archiveButton').click();
  const downloaded=page.waitForEvent('download');
  await page.locator('#exportLives').click();
  const download=await downloaded;
  assert.equal(download.suggestedFilename(),'history-life-backup.json');
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('houkago_history_life_slots_v1')));
  const payload={format:'houkago-history-life-backup',version:1,slots:saved.slots,archives:saved.archives};
  await page.evaluate(()=>{localStorage.removeItem('houkago_history_life_slots_v1')});
  await page.reload({waitUntil:'load'});
  await page.waitForFunction(()=>window.HistoryLifeDebug?.eventCount>=35);
  assert.equal(await page.locator('[data-continue]').count(),0);
  await page.locator('#archiveButton').click();
  await page.locator('#importLivesFile').setInputFiles({
   name:'saved-lives.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(payload))
  });
  await page.waitForFunction(()=>document.getElementById('archiveFeedback').textContent.includes('取り込みました'));
  await page.locator('#closeArchive').click();
  await page.locator('[data-continue="0"]').click();
  const restored=await page.evaluate(()=>window.HistoryLifeDebug.snapshot);
  assert.equal(restored.year,original.year);
  assert.equal(restored.reflections['5'],'家族の思い出を覚えておこう');
  assert.equal(restored.meta.originSeed,original.meta.originSeed);
  assert.deepEqual(errors,[]);
 }finally{await context.close()}
});
