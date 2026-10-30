import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,sep,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import {createLife,validateSave} from '../games/history-life/engine.js';
import {syncFamily} from '../games/history-life/social.js';
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
  await page.locator('#lotterySkip').click();
  await page.locator('#birthStart').click();
  await page.locator('#clockToggle').click(); // deterministic manual-turn playtest
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
  await page.locator('#lotterySkip').click();
  await page.locator('#birthStart').click();
  await page.locator('#clockToggle').click(); // deterministic manual-turn playtest
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
  await page.locator('#lotterySkip').click();
  await page.locator('#birthStart').click();
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
  await page.locator('#lotterySkip').click();
  await page.locator('#birthStart').click();
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
  await page.locator('#lotterySkip').click();
  await page.locator('#birthStart').click();
  await page.locator('#clockToggle').click(); // deterministic manual-turn playtest
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
  await page.locator('[data-detail-tab="career"]').click();
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
  await page.locator('#lotterySkip').click();
  await page.locator('#birthStart').click();
  const initial=await page.evaluate(()=>window.HistoryLifeDebug.snapshot.age);
  assert.equal(initial,0);
  assert.equal(await page.evaluate(()=>window.HistoryLifeDebug.clock.secondsPerYear),45);
  await page.locator('#clockOptions summary').click();
  await page.locator('#clockDuration').selectOption('30');
  assert.equal(await page.evaluate(()=>window.HistoryLifeDebug.clock.secondsPerYear),22.5);
  await page.locator('#clockSpeed').selectOption('16');
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
  await page.locator('#lotterySkip').click();
  await page.locator('#birthStart').click();
  for(let i=0;i<7;i++)await page.locator('[data-action="child"]').click();
  await page.locator('[data-choice]').first().click();
  let initial=await page.evaluate(()=>window.HistoryLifeDebug.snapshot);
  assert.equal(await page.locator('.money-stat').count(),3);
  await page.locator('[data-detail-tab="money"]').click();
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
  await page.locator('#lotterySkip').click();
  await page.locator('#birthStart').click();
  for(let i=0;i<7;i++)await page.locator('[data-action="child"]').click();
  await page.locator('[data-choice]').first().click();
  await page.locator('#clockSpeed').selectOption('1');
  assert.equal(await page.evaluate(()=>window.HistoryLifeDebug.clock.running),true);
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
  await page.locator('#lotterySkip').click();
  await page.locator('#birthStart').click();
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
  await page.locator('#lotterySkip').click();
  await page.locator('#birthStart').click();
  let clock=await page.evaluate(()=>window.HistoryLifeDebug.clock);
  assert.equal(clock.duration,90);
  assert.equal(clock.secondsPerYear,67.5);
  assert.equal(await page.locator('#clockDuration').inputValue(),'90');
  await page.locator('#clockOptions summary').click();
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
  await page.locator('#lotterySkip').click();
  await page.locator('#birthStart').click();
  assert.equal(await page.locator('#lifeMap .life-tile').count(),1);
  assert.equal(await page.locator('.contemporary').count(),3);
  for(let i=0;i<5;i++)await page.locator('[data-action="child"]').click();
  assert.equal(await page.locator('#reflectionPanel').isVisible(),true);
  await page.locator('#reflectionNote').fill('家族と過ごした日々を忘れない');
  await page.locator('#reflectionForm button').click();
  assert.equal(await page.locator('#reflectionSaved').isVisible(),true);
  assert.equal(await page.locator('#lifeMap .life-tile').count(),6);
  await page.locator('[data-detail-tab="records"]').click();
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
  await page.locator('#lotterySkip').click();
  await page.locator('#birthStart').click();
  await page.locator('#clockNext').click();
  let s=await page.evaluate(()=>window.HistoryLifeDebug.snapshot);
  assert.equal(s.age,7);
  assert.equal(s.phase,'event');
  await page.locator('#decisionClose').click();
  await page.locator('#clockOptions summary').click();
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
  await page.locator('#lotterySkip').click();
  await page.locator('#birthStart').click();
  await page.locator('#clockOptions summary').click();
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
  await page.locator('#lotterySkip').click();
  await page.locator('#birthStart').click();
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

test('a deceased life opens a child heir choice and preserves the family across reload',async()=>{
 const {page,context,errors}=await open(390,780,'?seed=444');
 try{
  const parent=createLife({eraId:'sengoku',seed:3344,birthYear:1550,regionId:'tokai'});
  parent.age=55;parent.year=1605;parent.phase='ended';
  parent.death={year:1605,age:55,reason:'生涯の終わり'};
  parent.people.push({id:'npc-'+(++parent.nextPersonId),role:'child',
   name:'小竹',birthYear:1581,trait:'kind',traitLabel:'面倒見がいい',
   closeness:86,alive:true,metYear:1581,notes:[],lastInteractionYear:null});
  syncFamily(parent);
  assert.ok(validateSave(parent));
  await page.evaluate(life=>localStorage.setItem('houkago_history_life_slots_v1',
   JSON.stringify({version:1,slots:[life,null,null],archives:[]})),parent);
  await page.reload({waitUntil:'load'});
  await page.waitForFunction(()=>window.HistoryLifeDebug?.eventCount>=35);
  await page.locator('[data-continue="0"]').click();
  assert.equal(await page.locator('.heir-button').count(),1);
  assert.match(await page.locator('.heir-button').innerText(),/小竹/);
  await page.locator('[data-heir]').click();
  const child=await page.evaluate(()=>window.HistoryLifeDebug.snapshot);
  assert.equal(child.name,'小竹');
  assert.equal(child.age,24);
  assert.equal(child.year,1605);
  assert.equal(child.phase,'living');
  assert.equal(child.lineage.generation,2);
  assert.equal(child.lineage.ancestors[0].name,parent.name);
  assert.ok(await page.locator('#lineageRibbon').isVisible());
  await page.locator('#historyButton').click();
  assert.ok(await page.locator('#ancestorHistory').isVisible());
  assert.match(await page.locator('#ancestorHistory').innerText(),new RegExp(parent.name));
  await page.locator('#closeHistory').click();
  await page.locator('#homeButton').click();
  assert.match(await page.locator('#archiveCount').innerText(),/1人/);
  await page.reload({waitUntil:'load'});
  await page.waitForFunction(()=>window.HistoryLifeDebug?.eventCount>=35);
  await page.locator('[data-continue="0"]').click();
  assert.equal((await page.evaluate(()=>window.HistoryLifeDebug.snapshot)).lineage.generation,2);
  await page.locator('#homeButton').click();
  await page.locator('#archiveButton').click();
  assert.match(await page.locator('#archiveList').innerText(),new RegExp(parent.name));
  assert.deepEqual(errors,[]);
 }finally{await context.close()}
});

test('sourced institution guide appears for the birth year, remains collapsed, and has links on mobile',async()=>{
 const {page,context,errors}=await open(390,780);
 try{
  await page.locator('[name="era"][value="bakumatsu-meiji"]').check();
  await page.locator('#birthYearInput').fill('1873');
  await page.locator('#regionSelect').selectOption('kyushu');
  await page.locator('#newLifeButton').click();
  await page.locator('#lotterySkip').click();
  await page.locator('#birthStart').click();
  assert.match(await page.locator('#institutionSummary').innerText(),/1873年/);
  await page.locator('[data-detail-tab="records"]').click();
  assert.equal(await page.locator('#institutionCard').getAttribute('open'),null,'closed until player opens it');
  const before=await page.evaluate(()=>JSON.stringify(window.HistoryLifeDebug.snapshot));
  await page.locator('#institutionSummary').click();
  const body=await page.locator('#institutionDetails').innerText();
  assert.match(body,/学制/);
  assert.match(body,/地租改正/);
  assert.equal(await page.locator('#institutionDetails a').count(),2);
  assert.match(await page.locator('#institutionCaution').innerText(),/九州/);
  assert.equal(await page.evaluate(()=>JSON.stringify(window.HistoryLifeDebug.snapshot)),before);
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
  assert.ok(overflow<=2,'institution panel must not cause horizontal overflow');
  assert.deepEqual(errors,[]);
 }finally{await context.close()}
});

test('phone HUD places five abilities above story and progress spans screen',async()=>{
 const {page,context,errors}=await open(390,780);
 try{
  await page.locator('[name="era"][value="edo"]').check();
  await page.locator('#newLifeButton').click();
  await page.locator('#lotterySkip').click();
  await page.locator('#birthStart').click();
  assert.equal(await page.locator('#statBars .stat-line').count(),5);
  const p=await page.evaluate(()=>{
   const r=q=>document.querySelector(q).getBoundingClientRect();
   const bar=r('#clockProgress'),stats=r('.life-stat-strip'),story=r('.story-box');
   return {barWidth:bar.width,barHeight:bar.height,statTop:stats.top,statBottom:stats.bottom,storyTop:story.top,barTop:bar.top,overflow:document.documentElement.scrollWidth-innerWidth};
  });
  assert.ok(p.barWidth>=300,'clock track width '+p.barWidth);
  assert.ok(p.barHeight>=10,'clock track height '+p.barHeight);
  assert.ok(p.statTop>p.barTop&&p.statBottom<p.storyTop,'stats between clock and story');
  assert.ok(p.overflow<=2,'horizontal overflow '+p.overflow);
  assert.equal(await page.locator('[data-detail-panel]:visible').count(),1);
  await page.locator('[data-detail-tab="money"]').click();
  assert.ok(await page.locator('.money-card').isVisible());
  assert.equal(await page.locator('.people-card').isVisible(),false);
  await page.locator('[data-detail-tab="family"]').click();
  assert.ok(await page.locator('.people-card').isVisible());
  assert.deepEqual(errors,[]);
 }finally{await context.close()}
});
test('time bar moves and pause retains elapsed progress',async()=>{
 const {page,context,errors}=await open(390,780);
 try{
  await page.locator('[name="era"][value="sengoku"]').check();
  await page.locator('#newLifeButton').click();
  await page.locator('#lotterySkip').click();
  await page.locator('#birthStart').click();
  await page.locator('#clockSpeed').selectOption('16');
  assert.equal(await page.evaluate(()=>window.HistoryLifeDebug.clock.running),true);
  await page.waitForTimeout(520);
  await page.locator('#clockToggle').click();
  const fraction=Number(await page.locator('#clockProgress').getAttribute('aria-valuenow'));
  assert.ok(fraction>0&&fraction<100,'progress '+fraction);
  await page.waitForTimeout(220);
  assert.equal(Number(await page.locator('#clockProgress').getAttribute('aria-valuenow')),fraction);
  await page.locator('#clockToggle').click();
  await page.waitForTimeout(340);
  await page.locator('#clockToggle').click();
  const resumed=Number(await page.locator('#clockProgress').getAttribute('aria-valuenow'));
  assert.ok(resumed>fraction,'clock must continue same year');
  assert.deepEqual(errors,[]);
 }finally{await context.close()}
});

test('new birth starts with the person and parents, and resume does not replay the reveal',async()=>{
 const {page,context,errors}=await open(390,780,'?seed=444');
 try{
  await page.locator('[name="era"][value="edo"]').check();
  await page.locator('#birthYearInput').fill('1750');
  await page.locator('#regionSelect').selectOption('kanto');
  await page.locator('#newLifeButton').click();
  assert.ok(await page.locator('#lotteryScreen').isVisible());
  await page.locator('#lotterySkip').click();
  assert.equal(await page.locator('#birthScreen').isVisible(),true);
  assert.match(await page.locator('#birthTitle').innerText(),/江戸・関東/);
  assert.match(await page.locator('#birthYear').innerText(),/1750年/);
  assert.equal(await page.locator('.birth-family-person').count(),2);
  assert.match(await page.locator('#birthIdentityDetail').innerText(),/家/);
  assert.match(await page.locator('.birth-disclaimer').innerText(),/ゲーム内/);
  const before=JSON.stringify(await page.evaluate(()=>window.HistoryLifeDebug.snapshot));
  await page.locator('#birthStart').click();
  assert.equal(await page.locator('#birthScreen').isVisible(),false);
  assert.equal(JSON.stringify(await page.evaluate(()=>window.HistoryLifeDebug.snapshot)),before);
  await page.locator('#homeButton').click();
  await page.locator('[data-continue="0"]').click();
  assert.equal(await page.locator('#birthScreen').isVisible(),false);
  assert.deepEqual(errors,[]);
 }finally{await context.close()}
});
test('recent chronicle remains readable without changing tabs and full history opens',async()=>{
 const {page,context,errors}=await open(390,780);
 try{
  await page.locator('[name="era"][value="sengoku"]').check();
  await page.locator('#newLifeButton').click();
  await page.locator('#lotterySkip').click();
  await page.locator('#birthStart').click();
  assert.equal(await page.locator('#chronicleRecent .log-row').count(),1);
  await page.locator('[data-action="child"]').click();
  assert.ok(await page.locator('#chronicleRecent .log-row').count()>=1);
  assert.ok(await page.locator('#chronicleRecent').isVisible());
  assert.equal(await page.locator('.people-card').isVisible(),true);
  await page.locator('#chronicleAll').click();
  assert.ok(await page.locator('#historyModal').isVisible());
  assert.deepEqual(errors,[]);
 }finally{await context.close()}
});
test('ended life displays a dignified result and keeps the original heir options',async()=>{
 const {page,context,errors}=await open(390,780);
 try{
  const life=createLife({eraId:'edo',seed:230,birthYear:1750,regionId:'kanto'});
  life.age=54;life.year=1804;life.phase='ended';
  life.death={year:1804,age:54,reason:'生涯の終わり'};
  life.people.push({id:'npc-'+(++life.nextPersonId),role:'child',name:'千代',birthYear:1778,trait:'kind',traitLabel:'面倒見がいい',closeness:80,alive:true,metYear:1778,notes:[],lastInteractionYear:null});
  syncFamily(life);
  assert.ok(validateSave(life));
  await page.evaluate(x=>localStorage.setItem('houkago_history_life_slots_v1',JSON.stringify({version:1,slots:[x,null,null],archives:[]})),life);
  await page.reload({waitUntil:'load'});
  await page.waitForFunction(()=>window.HistoryLifeDebug?.eventCount>=35);
  await page.locator('[data-continue="0"]').click();
  assert.ok(await page.locator('#endingScene').isVisible());
  assert.match(await page.locator('#endingYears').innerText(),/1750.*1804/);
  assert.ok(await page.locator('.heir-button').isVisible());
  await page.locator('#endingRead').click();
  assert.ok(await page.locator('#historyModal').isVisible());
  assert.deepEqual(errors,[]);
 }finally{await context.close()}
});

test('age, time progress and playback controls stay together when scrolling on phone',async()=>{
 const {page,context,errors}=await open(390,780);
 try{
  await page.locator('[name="era"][value="edo"]').check();
  await page.locator('#newLifeButton').click();
  await page.locator('#lotterySkip').click();
  await page.locator('#birthStart').click();
  assert.ok(await page.locator('.game-play-top').isVisible());
  await page.evaluate(()=>window.scrollTo({top:700,behavior:'instant'}));
  await page.waitForTimeout(150);
  const result=await page.evaluate(()=>{
   const header=document.querySelector('.game-play-top').getBoundingClientRect();
   const progress=document.querySelector('#clockProgress').getBoundingClientRect();
   const age=document.querySelector('#ageText').getBoundingClientRect();
   return {scrollY:window.scrollY,top:header.top,progressBottom:progress.bottom,ageTop:age.top,overflow:document.documentElement.scrollWidth-innerWidth};
  });
  assert.ok(result.scrollY>80,'must scroll past initial view');
  assert.ok(Math.abs(result.top)<3,'whole controls header should remain on screen');
  assert.ok(result.ageTop>=-1&&result.progressBottom<780,'age and progress should both be visible');
  const ageFont=await page.locator('#ageText').evaluate(el=>parseFloat(getComputedStyle(el).fontSize));
  assert.ok(ageFont>=22,'age must be prominent, actual '+ageFont+'px');
  assert.ok(result.overflow<=2);
  assert.deepEqual(errors,[]);
 }finally{await context.close()}
});

test('era and birthplace spin simultaneously and automatically settle on the actual newborn',async()=>{
 const {page,context,errors}=await open(390,780,'?seed=718');
 try{
  await page.locator('#newLifeButton').click();
  assert.ok(await page.locator('#lotteryScreen').isVisible());
  assert.equal(await page.locator('#birthScreen').isVisible(),false);
  const initial=await page.evaluate(()=>({
   era:document.getElementById('lotteryEraValue').textContent,
   region:document.getElementById('lotteryRegionValue').textContent,
   phase:document.getElementById('lotteryScreen').dataset.phase,
   step:Number(document.getElementById('lotteryScreen').dataset.steps)
  }));
  assert.equal(initial.phase,'rolling');
  assert.equal(await page.locator('#lotteryEraStatus').innerText(),'抽選中');
  assert.equal(await page.locator('#lotteryRegionStatus').innerText(),'抽選中');
  await page.waitForFunction(()=>Number(document.getElementById('lotteryScreen').dataset.steps)>=3);
  assert.ok(await page.locator('#lotteryEraValue').isVisible());
  assert.ok(await page.locator('#lotteryRegionValue').isVisible());
  const state=JSON.stringify(await page.evaluate(()=>window.HistoryLifeDebug.snapshot));
  const beforeSettle=await page.evaluate(()=>performance.now());
  await page.waitForFunction(()=>document.getElementById('lotteryScreen').dataset.phase==='settled',{timeout:10000});
  const elapsed=await page.evaluate(t=>performance.now()-t,beforeSettle);
  assert.ok(elapsed>=3500,'roulette should stay noticeably longer: '+elapsed+'ms');
  assert.equal(await page.locator('#lotteryEraStatus').innerText(),'決定');
  assert.equal(await page.locator('#lotteryRegionStatus').innerText(),'決定');
  const target=await page.evaluate(()=>window.HistoryLifeDebug.snapshot);
  assert.equal(await page.locator('#lotteryEraValue').innerText(),({sengoku:'戦国〜安土桃山',edo:'江戸時代','bakumatsu-meiji':'幕末〜明治'})[target.eraId]);
  assert.equal(await page.locator('#lotteryRegionValue').innerText(),({tokai:'尾張・東海',kinai:'京・近畿',kanto:'江戸・関東',tohoku:'東北地方',kyushu:'九州地方',setouchi:'瀬戸内地方'})[target.regionId]);
  await page.locator('#birthScreen').waitFor({state:'visible',timeout:3000});
  assert.equal(await page.locator('#lotteryScreen').isVisible(),false);
  assert.equal(JSON.stringify(await page.evaluate(()=>window.HistoryLifeDebug.snapshot)),state,'roulette must not alter the life or RNG');
  assert.deepEqual(errors,[]);
 }finally{await context.close()}
});
test('specified era and birthplace are both shown together and skip reaches birth safely',async()=>{
 const {page,context,errors}=await open(375,720);
 try{
  await page.locator('[name="era"][value="edo"]').check();
  await page.locator('#regionSelect').selectOption('kanto');
  await page.locator('#birthYearInput').fill('1750');
  await page.locator('#newLifeButton').click();
  assert.ok(await page.locator('#lotteryScreen').isVisible());
  assert.equal(await page.locator('#lotteryEraValue').innerText(),'江戸時代');
  assert.equal(await page.locator('#lotteryRegionValue').innerText(),'江戸・関東');
  assert.equal(await page.locator('#lotteryEraStatus').innerText(),'指定');
  assert.equal(await page.locator('#lotteryRegionStatus').innerText(),'指定');
  const before=JSON.stringify(await page.evaluate(()=>window.HistoryLifeDebug.snapshot));
  await page.locator('#lotterySkip').click();
  assert.equal(await page.locator('#lotteryScreen').isVisible(),false);
  assert.ok(await page.locator('#birthScreen').isVisible());
  assert.equal(JSON.stringify(await page.evaluate(()=>window.HistoryLifeDebug.snapshot)),before);
  await page.locator('#birthStart').click();
  await page.locator('#homeButton').click();
  await page.locator('[data-continue="0"]').click();
  assert.equal(await page.locator('#lotteryScreen').isVisible(),false,'resuming must not replay lottery');
  assert.deepEqual(errors,[]);
 }finally{await context.close()}
});
test('when only birthplace is chosen, region remains fixed while era rolls',async()=>{
 const {page,context,errors}=await open(390,780,'?seed=2026');
 try{
  await page.locator('#regionSelect').selectOption('kyushu');
  await page.locator('#newLifeButton').click();
  assert.equal(await page.locator('#lotteryRegionValue').innerText(),'九州地方');
  assert.equal(await page.locator('#lotteryRegionStatus').innerText(),'指定');
  assert.equal(await page.locator('#lotteryEraStatus').innerText(),'抽選中');
  await page.waitForFunction(()=>Number(document.getElementById('lotteryScreen').dataset.steps)>=3);
  assert.equal(await page.locator('#lotteryRegionValue').innerText(),'九州地方');
  await page.locator('#lotterySkip').click();
  assert.equal((await page.evaluate(()=>window.HistoryLifeDebug.snapshot)).regionId,'kyushu');
  assert.ok(await page.locator('#birthScreen').isVisible());
  assert.deepEqual(errors,[]);
 }finally{await context.close()}
});

test('automatic time is on by default only after birth; pause remains a manual choice',async()=>{
 const {page,context,errors}=await open(390,780,'?seed=217');
 try{
  await page.locator('[name="era"][value="edo"]').check();
  await page.locator('#newLifeButton').click();
  assert.equal(await page.evaluate(()=>window.HistoryLifeDebug.clock.running),false,'roulette must not start time');
  await page.locator('#lotterySkip').click();
  assert.equal(await page.evaluate(()=>window.HistoryLifeDebug.clock.running),false,'birth introduction must not start time');
  await page.locator('#birthStart').click();
  assert.equal(await page.evaluate(()=>window.HistoryLifeDebug.clock.running),true,'birthStart activates automatic flow');
  assert.equal(await page.locator('#clockToggle').getAttribute('aria-pressed'),'true');
  assert.match(await page.locator('#clockToggle').innerText(),/一時停止/);
  await page.locator('#clockToggle').click();
  assert.equal(await page.evaluate(()=>window.HistoryLifeDebug.clock.running),false);
  const progress=await page.evaluate(()=>window.HistoryLifeDebug.clock.progress);
  await page.waitForTimeout(180);
  assert.equal(await page.evaluate(()=>window.HistoryLifeDebug.clock.progress),progress,'manual pause must stay stopped');
  await page.locator('#clockToggle').click();
  assert.equal(await page.evaluate(()=>window.HistoryLifeDebug.clock.running),true,'player can resume');
  assert.deepEqual(errors,[]);
 }finally{await context.close()}
});

test('continue resumes automatic time for living saves; ended lives stay stopped',async()=>{
 const {page,context,errors}=await open(390,780,'?seed=222');
 try{
  await page.locator('[name="era"][value="edo"]').check();
  await page.locator('#newLifeButton').click();
  await page.locator('#lotterySkip').click();
  await page.locator('#birthStart').click();
  await page.locator('#clockToggle').click();
  assert.equal(await page.evaluate(()=>window.HistoryLifeDebug.clock.running),false);
  await page.locator('#homeButton').click();
  assert.equal(await page.evaluate(()=>window.HistoryLifeDebug.clock.running),false);
  await page.locator('[data-continue="0"]').click();
  assert.equal(await page.evaluate(()=>window.HistoryLifeDebug.clock.running),true,'continuing a living save starts automatically');
  assert.equal(await page.locator('#lotteryScreen').isVisible(),false);
  assert.equal(await page.locator('#birthScreen').isVisible(),false);
  await page.locator('#homeButton').click();
  const life=createLife({eraId:'edo',seed:913,birthYear:1750,regionId:'kanto'});
  life.phase='ended';life.year=1750;life.age=0;life.death={year:1750,age:0,reason:'生涯の終わり'};
  assert.ok(validateSave(life));
  await page.evaluate(x=>localStorage.setItem('houkago_history_life_slots_v1',JSON.stringify({version:1,slots:[x,null,null],archives:[]})),life);
  await page.reload({waitUntil:'load'});
  await page.waitForFunction(()=>window.HistoryLifeDebug?.eventCount>=35);
  await page.locator('[data-continue="0"]').click();
  assert.equal(await page.evaluate(()=>window.HistoryLifeDebug.clock.running),false,'ended life cannot restart');
  assert.equal(await page.locator('#clockToggle').isDisabled(),true);
  assert.deepEqual(errors,[]);
 }finally{await context.close()}
});

test('playtest: the entire sticky HUD includes five stats and leaves useful room for the story',async()=>{
 for(const width of [320,375,390,430]){
  const {page,context,errors}=await open(width,780,'?seed=444');
  try{
   await page.locator('[name="era"][value="edo"]').check();
   await page.locator('#newLifeButton').click();
   await page.locator('#lotterySkip').click();
   await page.locator('#birthStart').click();
   // Full-page scroll and actual layout measurements, not a static CSS assertion.
   await page.evaluate(()=>window.scrollTo({top:640,behavior:'instant'}));
   await page.waitForTimeout(110);
   const metrics=await page.evaluate(()=>{
    const r=q=>document.querySelector(q).getBoundingClientRect();
    const hud=r('.game-play-top'),stat=r('.life-stat-strip'),clock=r('#clockProgress'),ribbon=r('.game-ribbon');
    const buttons=[...document.querySelectorAll('.game-play-top button')].filter(b=>b.getClientRects().length).map(b=>({
     title:b.textContent.trim(),w:b.getBoundingClientRect().width,h:b.getBoundingClientRect().height
    }));
    return {top:hud.top,bottom:hud.bottom,height:hud.height,statBottom:stat.bottom,
      clockWidth:clock.width,ribbonHeight:ribbon.height,scrollX:document.documentElement.scrollWidth-innerWidth,buttons};
   });
   console.log('UI_PLAYTEST '+JSON.stringify({width,...metrics}));
   assert.ok(Math.abs(metrics.top)<=3,'sticky header top '+width);
   assert.ok(Math.abs(metrics.bottom-metrics.statBottom)<=12,'stats not inside sticky HUD '+width);
   assert.ok(metrics.height<260,'sticky HUD too tall '+width+': '+metrics.height);
   assert.ok(metrics.clockWidth>=width-60,'progress bar clipped '+width);
   assert.ok(metrics.scrollX<=2,'horizontal overflow '+width);
   assert.ok(metrics.buttons.filter(b=>b.title.includes('一時停止')||b.title.includes('決断')).every(b=>b.h>=32),'buttons too small '+width);
   assert.deepEqual(errors,[]);
  }finally{await context.close()}
 }
});

test('career shortcut makes age-15 work discoverable without opening detail tabs',async()=>{
 const {page,context,errors}=await open(390,780,'?seed=422');
 try{
  await page.locator('[name="era"][value="edo"]').check();
  await page.locator('#newLifeButton').click();
  await page.locator('#lotterySkip').click();
  await page.locator('#birthStart').click();
  await page.locator('#clockToggle').click();
  // Advance through childhood and resolve milestone events.
  for(let i=0;i<15;i++){
   const s=await page.evaluate(()=>window.HistoryLifeDebug.snapshot);
   if(s.phase==='event'){await page.locator('[data-choice]').first().click();i--;continue}
   await page.locator(s.age<7?'[data-action="child"]':'[data-focus="learn"]').click();
  }
  let s=await page.evaluate(()=>window.HistoryLifeDebug.snapshot);
  while(s.phase==='event'){await page.locator('[data-choice]').first().click();s=await page.evaluate(()=>window.HistoryLifeDebug.snapshot)}
  assert.equal(s.age,15);
  if(s.career.jobId==='dependent'){
   assert.ok(await page.locator('.career-prompt').isVisible(),'work CTA should appear on primary play screen');
   await page.locator('.career-prompt button').click();
   assert.ok(await page.locator('#careerModal').isVisible());
  }
  assert.deepEqual(errors,[]);
 }finally{await context.close()}
});
test('autoplay pauses on a real decision and continues after the player chooses',async()=>{
 const {page,context,errors}=await open(390,780,'?seed=431');
 try{
  await page.locator('[name="era"][value="sengoku"]').check();
  await page.locator('#newLifeButton').click();
  await page.locator('#lotterySkip').click();
  await page.locator('#birthStart').click();
  assert.equal(await page.evaluate(()=>window.HistoryLifeDebug.clock.running),true);
  await page.locator('#clockNext').click();
  let s=await page.evaluate(()=>window.HistoryLifeDebug.snapshot);
  assert.equal(s.phase,'event');
  assert.equal(await page.evaluate(()=>window.HistoryLifeDebug.clock.running),false);
  let loops=0;
  while(s.phase==='event'&&loops++<12){
   await page.locator('[data-choice]').first().click();
   s=await page.evaluate(()=>window.HistoryLifeDebug.snapshot);
  }
  assert.equal(s.phase,'living');
  assert.equal(await page.evaluate(()=>window.HistoryLifeDebug.clock.running),true,'automatic clock resumes after the decision');
  await page.locator('#clockToggle').click();
  assert.equal(await page.evaluate(()=>window.HistoryLifeDebug.clock.running),false,'manual pause remains respected');
  assert.deepEqual(errors,[]);
 }finally{await context.close()}
});

test('automatic choice popup shows milestone effects and can be closed and reopened without altering life',async()=>{
 const {page,context,errors}=await open(390,780,'?seed=551');
 try{
  await page.locator('[name="era"][value="sengoku"]').check();
  await page.locator('#birthYearInput').fill('1544');
  await page.locator('#newLifeButton').click();await page.locator('#lotterySkip').click();await page.locator('#birthStart').click();
  await page.locator('#clockToggle').click();
  for(let i=0;i<7;i++)await page.locator('[data-action="child"]').click();
  assert.ok(await page.locator('#decisionModal').isVisible());
  assert.equal(await page.locator('#decisionOptions [data-choice]').count(),3);
  assert.match(await page.locator('#decisionOptions').innerText(),/知恵\+8/);
  assert.match(await page.locator('#decisionOptions').innerText(),/家計−3生活点/);
  const before=JSON.stringify(await page.evaluate(()=>window.HistoryLifeDebug.snapshot));
  await page.locator('#decisionClose').click();
  assert.equal(await page.locator('#decisionModal').isVisible(),false);
  assert.equal(JSON.stringify(await page.evaluate(()=>window.HistoryLifeDebug.snapshot)),before);
  await page.locator('.decision-reopen').click();
  await page.locator('#decisionOptions [data-choice="seek"]').click();
  assert.equal(await page.locator('#decisionModal').isVisible(),false);
  assert.deepEqual(errors,[]);
 }finally{await context.close()}
});
test('risky historical choice popup shows both numeric outcomes and actual game chance',async()=>{
 const {page,context,errors}=await open(390,780,'?seed=19');
 try{
  await page.locator('[name="era"][value="sengoku"]').check();
  await page.locator('#birthYearInput').fill('1548');await page.locator('#regionSelect').selectOption('tokai');
  await page.locator('#newLifeButton').click();await page.locator('#lotterySkip').click();await page.locator('#birthStart').click();
  await page.locator('#clockToggle').click();
  for(let i=0;i<12;i++){
   const state=await page.evaluate(()=>window.HistoryLifeDebug.snapshot);
   if(state.phase==='event'){await page.locator('#decisionOptions [data-choice]').first().click();i--;continue}
   await page.locator(state.age<7?'[data-action="child"]':'[data-focus="family"]').click();
  }
  const state=await page.evaluate(()=>window.HistoryLifeDebug.snapshot);
  assert.equal(state.year,1560);
  const text=await page.locator('#decisionOptions [data-choice="adapt"]').innerText();
  assert.match(text,/成功 48%/);assert.match(text,/失敗 52%/);
  assert.match(text,/家計\+5生活点/);assert.match(text,/家計−6生活点/);
  assert.deepEqual(errors,[]);
 }finally{await context.close()}
});
test('everyday focus choices show precise numeric success and ordinary changes',async()=>{
 const {page,context,errors}=await open(390,780);
 try{
  await page.locator('[name="era"][value="edo"]').check();
  await page.locator('#newLifeButton').click();await page.locator('#lotterySkip').click();await page.locator('#birthStart').click();
  await page.locator('#clockToggle').click();
  for(let i=0;i<7;i++)await page.locator('[data-action="child"]').click();
  await page.locator('#decisionOptions [data-choice]').first().click();
  assert.match(await page.locator('[data-focus="work"]').innerText(),/家計\+7生活点/);
  assert.match(await page.locator('[data-focus="family"]').innerText(),/関係\+7/);
  assert.deepEqual(errors,[]);
 }finally{await context.close()}
});
