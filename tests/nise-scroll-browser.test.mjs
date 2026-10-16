import {test,after,before} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,sep,extname} from 'node:path';
import {chromium} from 'playwright';

const root=resolve(fileURLToPath(new URL('../',import.meta.url)));
let server,browser;
let base;

before(async()=>{
  server=createServer(async(req,res)=>{
    let pathname;
    try{pathname=decodeURIComponent(new URL(req.url,'http://localhost/').pathname)}catch{
      res.writeHead(400).end();return;
    }
    let name=resolve(root,'.'+pathname);
    if(!name.startsWith(root+sep)&&name!==root){res.writeHead(403).end();return}
    if(pathname.endsWith('/'))name=resolve(name,'index.html');
    try{
      const bytes=await readFile(name);
      const ext=extname(name).toLowerCase();
      const type={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8',
        '.js':'text/javascript; charset=utf-8','.json':'application/json',
        '.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.svg':'image/svg+xml'}[ext]||'application/octet-stream';
      res.writeHead(200,{'Content-Type':type});res.end(bytes);
    }catch{res.writeHead(404).end()}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  base='http://127.0.0.1:'+server.address().port;
  browser=await chromium.launch({headless:true,args:['--no-sandbox']});
});

after(async()=>{
  await browser?.close();
  await new Promise(resolve=>server?.close(resolve));
});

async function visit(size,isMobile){
  const context=await browser.newContext({viewport:size,isMobile,hasTouch:isMobile,deviceScaleFactor:1});
  const page=await context.newPage();
  const failures=[];
  page.on('pageerror',error=>failures.push(String(error)));
  await page.goto(base+'/games/nise-transfer-student/',{waitUntil:'load'});
  await page.locator('#startSetup').click();
  // 実際に報告された10人構成で、役職設定に戻った状態を検証する。
  await page.locator('#editPlayersFromRoles').click();
  await page.locator('[data-member-count="10"]').click();
  await page.locator('[data-members-done]').click();
  await page.locator('.role-reg-group .role-row').first().waitFor({state:'visible'});
  return {page,context,failures};
}
const measure=locator=>locator.evaluate(el=>{
  const box=el.getBoundingClientRect();
  return {clientHeight:el.clientHeight,scrollHeight:el.scrollHeight,top:el.scrollTop,
    boundingTop:box.top,boundingBottom:box.bottom,overflow:getComputedStyle(el).overflowY};
});
async function scrollAndVerify(container,lastRow,{mustScroll=false}={}){
  const before=await measure(container);
  assert.ok(before.clientHeight>40,'scroll container needs a meaningful height');
  assert.equal(before.overflow,'auto','inner region must allow vertical scrolling');
  // 内容がすべて見える場合はスクロール不要。見切れている場合だけ実際にスクロールできることを検証。
  await container.evaluate(el=>{el.scrollTop=el.scrollHeight});
  const after=await measure(container);
  if(before.scrollHeight>before.clientHeight+3){
    assert.ok(after.top>3,'scrollTop must change after scroll');
  }
  const visible=await lastRow.evaluate(el=>({top:el.getBoundingClientRect().top,bottom:el.getBoundingClientRect().bottom}));
  assert.ok(visible.bottom<=after.boundingBottom+5,
    'last card must not be clipped below the scroll viewport');
  assert.ok(visible.top>=after.boundingTop-8,
    'last card must be reachable inside the scroll viewport');
}
function footerIsVisible(page,selector){
  return page.locator(selector).evaluate(el=>{
    const box=el.getBoundingClientRect();
    return box.top>=0&&box.bottom<=innerHeight+1&&box.height>20;
  });
}
async function verifyTenMembers(page){
 const names=page.locator('.nise-role-members .member-chip');
 assert.equal(await names.count(),10,'all ten members must be rendered at once');
 const layout=await page.locator('.nise-role-members').evaluate(area=>{
  const parent=area.getBoundingClientRect();
  const elements=[...area.querySelectorAll('.member-chip')].map(chip=>{
   const bounds=chip.getBoundingClientRect();
   const name=chip.querySelector('.member-chip-name');
   return {text:name.textContent.trim(),top:bounds.top,bottom:bounds.bottom,
      left:bounds.left,right:bounds.right,clientWidth:chip.clientWidth,
      scrollWidth:chip.scrollWidth,nameClientHeight:name.clientHeight,
      nameScrollHeight:name.scrollHeight};
  });
  return {area:{top:parent.top,bottom:parent.bottom,left:parent.left,right:parent.right},elements};
 });
 assert.equal(new Set(layout.elements.map(x=>x.text)).size,10,'all ten participant names must be distinct');
 for(const chip of layout.elements){
  assert.ok(chip.top>=layout.area.top-1&&chip.bottom<=layout.area.bottom+1,
    'name clipped vertically '+chip.text+' '+JSON.stringify(layout));
  assert.ok(chip.left>=layout.area.left-1&&chip.right<=layout.area.right+1,
    'name clipped horizontally '+chip.text+' '+JSON.stringify(layout));
  assert.ok(chip.scrollWidth<=chip.clientWidth+2,'participant text hidden: '+chip.text);
  assert.ok(chip.nameScrollHeight<=chip.nameClientHeight+2,'participant name cut off: '+chip.text);
 }
 const columns=await names.evaluateAll(nodes=>new Set(nodes.map(x=>Math.round(x.getBoundingClientRect().left))).size);
 assert.ok(columns>=2,'names must use multiple visible columns, not horizontal swipe');
}
async function verifyFourRoles(page,expected){
 const roles=page.locator('.role-reg-group .role-row');
 assert.equal(await roles.count(),4,'each tab must show exactly four roles');
 const actual=await roles.locator('.role-title').allTextContents();
 assert.deepEqual(actual,expected);
 const bounds=await page.locator('.role-select-card').evaluate(card=>{
  const cardRect=card.getBoundingClientRect();
  const els=[...card.querySelectorAll('.role-reg-group .role-row')];
  const tabs=card.querySelector('.nise-role-tabs')?.getBoundingClientRect();
  const items=els.map(el=>{
    const rect=el.getBoundingClientRect(),button=el.querySelector('.role-step')?.getBoundingClientRect();
    return {top:rect.top,bottom:rect.bottom,height:rect.height,
      buttonHeight:button?.height||0};
  });
  return {top:cardRect.top,bottom:cardRect.bottom,overflow:getComputedStyle(card).overflowY,
    tabsBottom:tabs?.bottom,items};
 });
 for(const [i,row] of bounds.items.entries()){
  assert.ok(row.height>=43,expected[i]+' role row too compressed: '+JSON.stringify(bounds));
  assert.ok(row.buttonHeight>=31,'button must stay tappable: '+JSON.stringify(row));
  assert.ok(row.top>=bounds.top-1,'role row clipped at top: '+JSON.stringify(bounds));
  assert.ok(row.bottom<=bounds.bottom+2,'role row clipped at bottom: '+JSON.stringify(bounds));
  assert.ok(row.top>=bounds.tabsBottom-2,'role row overlaps tabs: '+JSON.stringify(bounds));
 }
 assert.equal(await footerIsVisible(page,'.role-select-actions'),true,
   'the deal button must remain visible');
 assert.equal(await page.locator('.nise-role-list-scroll').count(),0,
   'there should be no scrollable role list inside each tab');
}
for(const [label,size,isMobile] of [
 ['small phone',{width:360,height:620},true],
 ['phone portrait',{width:390,height:700},true],
 ['desktop',{width:1280,height:800},false],
]){
 test('four basic and four advanced roles all visible; member editor scrolls: '+label,async()=>{
  const {page,context,failures}=await visit(size,isMobile);
  try{
   await verifyTenMembers(page);
   await verifyFourRoles(page,['クラスメイト','ニセ転校生','学級委員','席替え係']);
   await page.locator('[data-role-tab="advanced"]').click();
   await verifyFourRoles(page,['観察係','日直','秘密の協力者','いたずらっ子']);
   await page.locator('[data-role-tab="basic"]').click();
   await verifyFourRoles(page,['クラスメイト','ニセ転校生','学級委員','席替え係']);
   await page.locator('#editPlayersFromRoles').click();
   const members=page.locator('.shared-editor-workspace');
   await scrollAndVerify(members,page.locator('.shared-roster-card'));
   assert.equal(await footerIsVisible(page,'.shared-player-done'),true,
     'member confirm stays visible');
   assert.deepEqual(failures,[],'browser JS should not throw');
  }finally{await context.close()}
 });
}

for(const [label,size,mobile,desktopSplit] of [
 ['small phone portrait',{width:360,height:700},true,false],
 ['phone portrait',{width:390,height:780},true,false],
 ['tablet portrait',{width:820,height:1180},true,false],
 ['compact PC',{width:1024,height:768},false,true],
 ['notebook PC',{width:1366,height:650},false,true],
 ['desktop PC',{width:1920,height:1080},false,true],
]){
 test('title logo and actions stay centered, visible and usable: '+label,async()=>{
  const context=await browser.newContext({viewport:size,isMobile:mobile,hasTouch:mobile,deviceScaleFactor:1});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(String(e)));
  try{
   await page.goto(base+'/games/nise-transfer-student/',{waitUntil:'load'});
   await page.locator('#startSetup').waitFor({state:'visible'});
   const dims=await page.evaluate(()=>{
    const rect=selector=>{
     const el=document.querySelector(selector),r=el.getBoundingClientRect();
     return {x:r.x,y:r.y,left:r.left,right:r.right,top:r.top,bottom:r.bottom,
       width:r.width,height:r.height,font:getComputedStyle(el).fontSize,display:getComputedStyle(el).display};
    };
    return {hero:rect('.nise-title-screen>.game-title-card'),
      logo:rect('.game-title-card .game-brand'),group:rect('.nise-title-actions'),
      subtitle:rect('.game-title-card .subtitle'),actions:rect('.game-title-card .stack'),
      buttons:['#startSetup','[data-open="rules"]','[data-open="roles"]','#startOnline'].map(rect),
      width:innerWidth,height:innerHeight,docWidth:document.documentElement.scrollWidth};
   });
   assert.ok(dims.docWidth<=size.width+2,'horizontal overflow '+JSON.stringify(dims));
   assert.ok(dims.hero.top>=0&&dims.hero.bottom<=dims.height+2,'whole hero must fit screen: '+JSON.stringify(dims));
   assert.ok(dims.logo.width>160&&dims.logo.height>65,'logo must remain prominent: '+JSON.stringify(dims));
   assert.ok(dims.logo.left>=dims.hero.left-2&&dims.logo.right<=dims.hero.right+2,'logo horizontal clip');
   assert.ok(dims.subtitle.left>=dims.hero.left-2&&dims.subtitle.right<=dims.hero.right+2,'subtitle horizontal clip');
   assert.ok(dims.subtitle.top>=dims.hero.top-2&&dims.subtitle.bottom<=dims.hero.bottom+2,'subtitle vertical clip');
   for(const [i,b] of dims.buttons.entries()){
    assert.ok(b.height>=37&&b.width>75,'action too small: '+i+' '+JSON.stringify(dims));
    assert.ok(b.top>=dims.hero.top-2&&b.bottom<=dims.hero.bottom+2,'action outside hero: '+i+' '+JSON.stringify(dims));
   }
   if(desktopSplit){
    assert.equal(dims.group.display,'flex','desktop info/action must be one grouped column');
    assert.ok(dims.logo.right<=dims.group.left+3,'logo and buttons must not overlap');
    const heroCenter=(dims.hero.top+dims.hero.bottom)/2;
    const groupCenter=(dims.group.top+dims.group.bottom)/2;
    assert.ok(Math.abs(groupCenter-heroCenter)<dims.hero.height*.16,
      'info and buttons must be vertically centered, not pushed to bottom: '+JSON.stringify(dims));
    assert.ok(dims.logo.width>=Math.min(320,dims.hero.width*.29),'desktop logo should be large');
    assert.ok(dims.buttons[0].height>=56,'desktop main action should be prominent');
    assert.ok(parseFloat(dims.subtitle.font)>=17,'desktop description must be legible');
   }else{
    assert.ok(dims.logo.bottom<=dims.subtitle.top+6,'portrait logo should be above description');
    assert.ok(dims.subtitle.bottom<=dims.buttons[0].top+6,'description above actions');
   }
   assert.deepEqual(errors,[],'page JS errors');
  }finally{await context.close()}
 });
}
