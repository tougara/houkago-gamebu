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
  await page.locator('.nise-role-list-scroll').waitFor({state:'visible'});
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
for(const [label,size,isMobile] of [
  ['phone portrait',{width:390,height:700},true],
  ['desktop',{width:1280,height:800},false],
]){
  test('roles and member editor scroll without hiding actions: '+label,async()=>{
    const {page,context,failures}=await visit(size,isMobile);
    try{
      const roles=page.locator('.nise-role-list-scroll');
      await scrollAndVerify(roles,page.locator('.nise-role-list-scroll .role-row').last(),{mustScroll:isMobile});
      assert.equal(await footerIsVisible(page,'.role-select-actions'),true,'deal role action stays visible');
      await page.locator('#editPlayersFromRoles').click();
      await page.locator('[data-member-count="10"]').click();
      const members=page.locator('.shared-editor-workspace');
      await scrollAndVerify(members,page.locator('.shared-roster-card'),{mustScroll:isMobile});
      assert.equal(await footerIsVisible(page,'.shared-player-done'),true,'member confirm stays visible');
      assert.deepEqual(failures,[],'browser JS should not throw');
    }finally{await context.close()}
  });
}
