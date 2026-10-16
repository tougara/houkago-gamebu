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
