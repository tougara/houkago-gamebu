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
   const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8',
     '.js':'text/javascript; charset=utf-8','.png':'image/png','.jpg':'image/jpeg',
     '.svg':'image/svg+xml','.webp':'image/webp','.webmanifest':'application/manifest+json'}[extname(file)]||'application/octet-stream';
   res.writeHead(200,{'Content-Type':mime});res.end(bytes);
  }catch{res.writeHead(404).end()}
 });
 await new Promise(done=>server.listen(0,'127.0.0.1',done));
 base='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({headless:true,args:['--no-sandbox']});
});
after(async()=>{
 await browser?.close();await new Promise(done=>server?.close(done));
});
async function open(width=390,height=780){
 const context=await browser.newContext({viewport:{width,height},isMobile:width<650,
   hasTouch:width<650,deviceScaleFactor:1});
 const page=await context.newPage(),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.goto(base+'/games/',{waitUntil:'load'});
 await page.locator('.favorite-card-wrap.compact-card-wrap').first().waitFor();
 return {page,context,errors};
}
const visibleCards=p=>p.locator('.compact-card-wrap:not([hidden])');
test('initial page shows exactly 9 real games with clear discovery and a compact featured card',async()=>{
 const {page,context,errors}=await open();
 try{
  assert.equal(await page.locator('#gameCount').textContent(),'9');
  assert.equal(await visibleCards(page).count(),9);
  assert.equal(await page.locator('.games-coming-section').count(),1);
  assert.equal(await page.locator('.coming-card').count(),0);
  const loc=await page.evaluate(()=>{
   const find=selector=>document.querySelector(selector).getBoundingClientRect();
   const search=find('.games-discovery-tools'),featured=find('.featured-game');
   const art=find('.featured-art'),info=find('.featured-info');
   const image=find('.featured-art img');
   return{searchTop:search.top,featuredTop:featured.top,artRight:art.right,
     infoLeft:info.left,featureHeight:featured.height,
     imageLeft:image.left,imageRight:image.right,
     artLeft:art.left,overflow:document.documentElement.scrollWidth-innerWidth};
  });
  assert.ok(loc.searchTop<loc.featuredTop,'search and filters precede the recommendation');
  assert.ok(loc.featureHeight<215,'featured recommendation should not consume the entire screen');
  assert.ok(loc.artRight<=loc.infoLeft+2,'art and description should occupy separate columns');
  assert.ok(loc.imageLeft>=loc.artLeft-1&&loc.imageRight<=loc.artRight+1,'logo is contained');
  assert.ok(loc.overflow<=2,'page must not overflow horizontally');
  assert.deepEqual(errors,[]);
 }finally{await context.close()}
});
test('1/2/3+ person filters count playable games correctly',async()=>{
 const {page,context}=await open();
 try{
  for(const [filter,total] of [['1','2'],['2','5'],['3','6'],['all','9']]){
   await page.locator('[data-player-filter="'+filter+'"]').click();
   assert.equal(await page.locator('#gameCount').textContent(),total,'filter '+filter);
   assert.equal(await visibleCards(page).count(),Number(total));
  }
 }finally{await context.close()}
});
test('genre and game name search can be combined, cleared and restored',async()=>{
 const {page,context}=await open();
 try{
  await page.locator('[data-game-filter="推理"]').click();
  assert.equal(await page.locator('#gameCount').textContent(),'3');
  await page.locator('#gameSearch').fill('オオカミ');
  assert.equal(await page.locator('#gameCount').textContent(),'1');
  assert.equal(await visibleCards(page).first().locator('h2').textContent(),'ことばのオオカミ');
  await page.locator('#gameSearch').fill('存在しないゲーム');
  assert.equal(await page.locator('#gameCount').textContent(),'0');
  assert.equal(await page.locator('#gamesNoResults').isVisible(),true);
  await page.locator('#gameSearchClear').click();
  assert.equal(await page.locator('#gameCount').textContent(),'3');
  await page.locator('[data-game-filter="all"]').click();
  assert.equal(await page.locator('#gameCount').textContent(),'9');
 }finally{await context.close()}
});
test('Sabotage logo also works in featured recommendations',async()=>{
 const {page,context,errors}=await open();
 try{
  const card=page.locator('.compact-card-wrap[data-game-id="sabotage"]');
  assert.equal(await card.locator('img').count(),1);
  await card.locator('.favorite-toggle').click();
  assert.equal(await page.locator('.featured-copy strong').textContent(),'サボタージュ');
  assert.match(await page.locator('.featured-art img').getAttribute('src'),/sabotage_logo[.]png/);
  assert.deepEqual(errors,[]);
 }finally{await context.close()}
});
test('favorites can be saved, filtered and survive reload',async()=>{
 const {page,context}=await open();
 try{
  const card=page.locator('.compact-card-wrap[data-game-id="word-wolf"]');
  await card.locator('.favorite-toggle').click();
  await page.locator('#favoriteOnly').click();
  assert.equal(await visibleCards(page).count(),1);
  assert.equal(await page.locator('#gameCount').textContent(),'1');
  await page.reload({waitUntil:'load'});
  await page.locator('#favoriteOnly').click();
  assert.equal(await visibleCards(page).count(),1);
  assert.equal(await visibleCards(page).first().locator('h2').textContent(),'ことばのオオカミ');
  await visibleCards(page).first().locator('.favorite-toggle').click();
  assert.equal(await page.locator('#favoritesEmpty').isVisible(),true);
 }finally{await context.close()}
});
for(const [name,width,height,columns] of [['small phone',360,690,2],['phone',390,780,2],
 ['tablet',768,850,3],['desktop',1280,900,4]]){
 test('images and card titles fit the grid at '+name,async()=>{
  const {page,context,errors}=await open(width,height);
  try{
   const info=await page.evaluate(()=>{
    const cards=[...document.querySelectorAll('.compact-card-wrap')].filter(el=>!el.hidden);
    const positions=cards.map(wrapper=>{
     const card=wrapper.querySelector('.compact-game-card');
     const art=wrapper.querySelector('.compact-game-art').getBoundingClientRect();
     const logo=wrapper.querySelector('.compact-game-art img').getBoundingClientRect();
     const title=wrapper.querySelector('h2');
     const body=wrapper.querySelector('.compact-game-body').getBoundingClientRect();
     const titleRect=title.getBoundingClientRect();
     return{art:{left:art.left,right:art.right,top:art.top,bottom:art.bottom},
       logo:{left:logo.left,right:logo.right,top:logo.top,bottom:logo.bottom},
       body:{top:body.top,bottom:body.bottom},title:{top:titleRect.top,bottom:titleRect.bottom,height:titleRect.height},
       label:title.textContent};
    });
    return{positions,columns:new Set(positions.slice(0,4).map(x=>Math.round(x.art.left))).size,
      overflow:document.documentElement.scrollWidth-innerWidth};
   });
   assert.equal(info.columns,columns,'expected grid columns');
   assert.ok(info.overflow<=2,'horizontal page overflow');
   for(const card of info.positions){
    if(card.label!=='ことばのオオカミ')assert.ok(card.logo.left>=card.art.left-2&&card.logo.right<=card.art.right+2,'logo cropped: '+card.label);
    assert.ok(card.title.top>=card.body.top-2&&card.title.bottom<=card.body.bottom+2,'title cut off: '+card.label);
    assert.ok(card.title.height<60,'title should be one or two lines: '+card.label);
   }
   assert.deepEqual(errors,[]);
  }finally{await context.close()}
 });
}


test('Nise and Docchi logos fit their artwork; wolf logo is deliberately enlarged on phones',async()=>{
 for(const [width,height] of [[360,690],[390,780],[768,850]]){
  const {page,context,errors}=await open(width,height);
  try{
   const logos=await page.evaluate(()=>{
    const read=id=>{
     const frame=document.querySelector('.compact-card-wrap[data-game-id="'+id+'"] .compact-game-art');
     const image=frame.querySelector('img');
     const parent=frame.getBoundingClientRect(),rect=image.getBoundingClientRect();
     const css=getComputedStyle(image);
     return {
      frame:{left:parent.left,right:parent.right,top:parent.top,bottom:parent.bottom},
      img:{left:rect.left,right:rect.right,top:rect.top,bottom:rect.bottom},
      fit:css.objectFit,transform:css.transform
     };
    };
    return {nise:read('nise-transfer-student'),docchi:read('minna-wa-docchi'),wolf:read('word-wolf')};
   });
   for(const name of ['nise','docchi']){
    const x=logos[name];
    assert.equal(x.fit,'contain','logo must preserve original ratio');
    assert.ok(x.img.left>=x.frame.left-1&&x.img.right<=x.frame.right+1,'logo horizontal clipping: '+name);
    assert.ok(x.img.top>=x.frame.top+6&&x.img.bottom<=x.frame.bottom-3,'logo vertical clipping: '+name);
   }
   const wolf=logos.wolf;
   assert.equal(wolf.fit,'contain');
   assert.match(wolf.transform,/matrix\(1\.18, 0, 0, 1\.18, 0, 0\)/,
    'wolf lettering should be larger than default logo');
   assert.deepEqual(errors,[]);
  }finally{await context.close()}
 }
});


test('Sabotage uploaded artwork loads on offline and online pages',async()=>{
 const {page,context,errors}=await open(390,780);
 try{
  await page.goto(base+'/games/sabotage/',{waitUntil:'load'});
  assert.match(await page.evaluate(()=>getComputedStyle(document.body).backgroundImage),/sabotage_background[.]png/);
  const title=page.locator('.sab-title-art');
  await title.evaluate(image=>image.decode());
  assert.equal(await title.evaluate(image=>image.naturalWidth>0),true);
  const cardFiles=['sabotage_card_repair.png','sabotage_card_bomb.png','sabotage_card_no_response.png'];
  for(const filename of cardFiles){
   const loaded=await page.evaluate(async file=>{
    const img=new Image();img.src='/'+file;await img.decode();return img.naturalWidth>0;
   },filename);
   assert.equal(loaded,true,filename+' failed to decode');
  }
  await page.goto(base+'/online/sabotage/?testPlay=1',{waitUntil:'load'});
  assert.match(await page.evaluate(()=>getComputedStyle(document.body).backgroundImage),/sabotage_background[.]png/);
  const navLogo=page.locator('.sab-nav-logo');
  await navLogo.evaluate(image=>image.decode());
  assert.equal(await navLogo.evaluate(image=>image.naturalWidth>0),true);
  assert.deepEqual(errors,[]);
 }finally{await context.close()}
});
test('Sabotage offline long-press role, then code, and preserve five visible slots',async()=>{
 const {page,context,errors}=await open(390,780);
 try{
  await page.goto(base+'/games/sabotage/',{waitUntil:'load'});
  await page.locator('[data-action="members"]').click();
  await page.locator('[data-members-done]').click();
  await page.locator('.sab-settings').waitFor();
  assert.match(await page.locator('.sab-settings').textContent(),/候補5枚/);
  await page.locator('[data-sab-setting="jackal"]').click();
  assert.equal(await page.locator('[data-sab-setting="jackal"]').getAttribute('aria-pressed'),'true');
  await page.locator('[data-sab-setting="jackal"]').click();
  await page.locator('[data-action="start"]').click();
  async function hold(){
   const b=page.locator('[data-hold="briefing"]');
   await b.dispatchEvent('pointerdown',{pointerId:1,pointerType:'touch',isPrimary:true});
   await page.waitForTimeout(720);
   await page.locator('[data-action="seen"]').waitFor();
   await page.evaluate(()=>window.dispatchEvent(new PointerEvent('pointerup',{pointerId:1,pointerType:'touch'})));
  }
  for(let i=0;i<4;i++){
   await hold();
   assert.equal(await page.locator('.sab-role-goal').count(),1);
   const portrait=page.locator('.sab-role-art-large');
   assert.equal(await portrait.count(),1);
   await portrait.evaluate(img=>img.decode());
   assert.equal(await portrait.evaluate(img=>img.naturalWidth>0),true);
   await page.locator('[data-action="seen"]').click();
  }
  for(let i=0;i<4;i++){
   await hold();
   assert.equal(await page.locator('.sab-counts').count(),1);
   await page.locator('[data-action="seen"]').click();
  }
  await page.locator('.sab-play').waitFor();
  const positions=await page.evaluate(()=>{const play=document.querySelector('.sab-play').getBoundingClientRect(),roster=document.querySelector('.sab-roster').getBoundingClientRect(),legend=document.querySelector('.sab-slot-legend').getBoundingClientRect();return{rosterBottom:roster.bottom,legendTop:legend.top,legendBottom:legend.bottom,playBottom:play.bottom}});
  assert.ok(positions.legendTop>=positions.rosterBottom-3,'legend must not overlap player cards');
  assert.ok(positions.legendBottom<=positions.playBottom+3,'legend must fit inside the playing screen');
  assert.equal(await page.locator('.sab-player').count(),4);
  assert.equal(await page.locator('.sab-badge').count(),4);
  for(const card of await page.locator('.sab-player').all())assert.equal(await card.locator('.sab-wire').count(),5);
  await page.locator('.sab-player[data-target]:not([disabled])').first().click();
  assert.equal(await page.locator('[data-wire]').count(),5);
  await page.locator('[data-wire="0"]').click();
  await page.locator('[data-action="cut"]').click();
  assert.equal(await page.locator('.sab-confirm-overlay').count(),1);
  await page.locator('[data-confirm-ok]').click();
  await page.locator('[data-reveal-stage="suspense"]').waitFor();
  await page.locator('[data-reveal-stage="ready"]').waitFor();
  await page.locator('[data-action="next"]').click();
  if(await page.locator('.sab-play').count()){
   assert.equal(await page.locator('.sab-slot-opened').count()>0,true);
   assert.equal(await page.locator('.sab-badge').count(),4);
  }else assert.equal(await page.locator('.sab-victory').count(),1);
  assert.deepEqual(errors,[]);
 }finally{await context.close()}
});
test('Sabotage online code-secret confirmation never sits behind help panel on small phones',async()=>{
 for(const [width,height] of [[345,680],[390,700]]){
  const {page,context,errors}=await open(width,height);
  try{
   await page.goto(base+'/online/sabotage/?testPlay=1',{waitUntil:'load'});
   await page.locator('[data-action="show"]').click();
   await page.locator('[data-action="seen"]').click();
   await page.locator('[data-action="show"]').click();
   const before=await page.evaluate(()=>{
    const panel=document.querySelector('.sab-brief'),rules=document.querySelector('.sab-online-root>.sab-more');
    const root=document.querySelector('.sab-online-root');
    const p=panel.getBoundingClientRect(),r=rules.getBoundingClientRect();
    return {panelBottom:p.bottom,rulesTop:r.top,overflow:getComputedStyle(root).overflowY,
      scrollHeight:root.scrollHeight,clientHeight:root.clientHeight};
   });
   assert.ok(before.rulesTop>=before.panelBottom-1,
    'the help panel must remain below the entire secret panel: '+JSON.stringify(before));
   assert.equal(before.overflow,'auto');
   await page.locator('[data-action="seen"]').scrollIntoViewIfNeeded();
   const overlap=await page.evaluate(()=>{
    const button=document.querySelector('[data-action="seen"]').getBoundingClientRect();
    const help=document.querySelector('.sab-online-root>.sab-more').getBoundingClientRect();
    return Math.max(0,Math.min(button.bottom,help.bottom)-Math.max(button.top,help.top));
   });
   assert.equal(overlap,0,'help must not cover the confirmation button');
   await page.locator('[data-action="seen"]').click();
   await page.locator('.sab-play').waitFor();
   assert.deepEqual(errors,[]);
  }finally{await context.close()}
 }
});
test('Sabotage online trial has role-first, private peek, five slots and game confirmation',async()=>{
 const {page,context,errors}=await open(345,680);
 try{
  await page.goto(base+'/online/sabotage/?testPlay=1',{waitUntil:'load'});
  await page.locator('[data-action="show"]').click();
  assert.equal(await page.locator('.sab-role-goal').count(),1);
  const portrait=page.locator('.sab-role-art-large');
  await portrait.evaluate(img=>img.decode());
  assert.equal(await portrait.evaluate(img=>img.naturalWidth>0),true);
  await page.locator('[data-action="seen"]').click();
  await page.locator('[data-action="show"]').click();
  assert.equal(await page.locator('.sab-counts').count(),1);
  await page.locator('[data-action="seen"]').click();
  await page.locator('.sab-play').waitFor();
  const positions=await page.evaluate(()=>{const play=document.querySelector('.sab-play').getBoundingClientRect(),roster=document.querySelector('.sab-roster').getBoundingClientRect(),legend=document.querySelector('.sab-slot-legend').getBoundingClientRect();return{rosterBottom:roster.bottom,legendTop:legend.top,legendBottom:legend.bottom,playBottom:play.bottom}});
  assert.ok(positions.legendTop>=positions.rosterBottom-3,'legend must not overlap player cards');
  assert.ok(positions.legendBottom<=positions.playBottom+3,'legend must fit inside the playing screen');
  assert.equal(await page.locator('.sab-player').count(),4);
  assert.equal(await page.locator('.sab-badge').count(),4);
  for(const card of await page.locator('.sab-player').all())assert.equal(await card.locator('.sab-wire').count(),5);
  await page.locator('[data-action="private"]').click();
  await page.locator('.sab-private-overlay .sab-role-goal').waitFor();
  await page.locator('[data-private-close]').click();
  await page.locator('[data-action="chat"]').click();
  const panel=page.locator('[data-chat-view]');
  await panel.locator('[data-chat="0"]').click();
  await page.locator('[data-chat-log] .sab-chat-line').waitFor();
  assert.equal(await panel.count(),1);
  await panel.locator('[data-action="cancel"]').click();
  await page.locator('.sab-player[data-target]:not([disabled])').first().click();
  assert.equal(await page.locator('[data-wire]').count(),5);
  await page.locator('[data-wire="0"]').click();
  await page.locator('[data-action="cut"]').click();
  assert.equal(await page.locator('.sab-confirm-overlay').count(),1);
  await page.locator('[data-confirm-ok]').click();
  await page.locator('[data-reveal-stage="suspense"]').waitFor();
  await page.locator('[data-reveal-stage="ready"]').waitFor();
  await page.locator('[data-action="next"]').click();
  if(await page.locator('.sab-play').count()){
   assert.ok(await page.locator('.sab-slot-opened').count()>0);
   assert.equal(await page.locator('.sab-badge').count(),4);
  }else assert.equal(await page.locator('.sab-victory').count(),1);
  assert.deepEqual(errors,[]);
 }finally{await context.close()}
});


// PC-specific regression coverage: offline and online use separate navs but the
// same Sabotage card/role components. Keep game content inside its centered pane.
async function sabotageDesktopGeometry(page,stage){
 const info=await page.evaluate(()=>{
  const rect=node=>{
   if(!node)return null;
   const {left,right,top,bottom,width,height}=node.getBoundingClientRect();
   return {left,right,top,bottom,width,height};
  };
  const app=document.querySelector('.sab-app');
  const nav=document.querySelector('.sab-nav');
  const root=document.querySelector('.sab-online-root');
  const visible=[...document.querySelectorAll('.sab-nav > *')]
   .filter(el=>getComputedStyle(el).display!=='none')
   .map(rect);
  const panel=document.querySelector('.sab-online-root > .sab-brief')||
    document.querySelector('.sab-app > .sab-panel')||
    document.querySelector('.sab-play')||
    document.querySelector('.sab-online-root > .sab-play');
  const help=document.querySelector('.sab-online-root > .sab-more');
  const confirm=document.querySelector('[data-action="seen"]');
  const roster=document.querySelector('.sab-roster');
  const legend=document.querySelector('.sab-slot-legend');
  const appR=rect(app),navR=rect(nav);
  return {
   vw:innerWidth,vh:innerHeight,
   horizontalOverflow:document.documentElement.scrollWidth-innerWidth,
   app:appR,nav:navR,navItems:visible,
   panel:rect(panel),help:rect(help),confirm:rect(confirm),
   roster:rect(roster),legend:rect(legend),
   rootScroll:root?{scrollHeight:root.scrollHeight,clientHeight:root.clientHeight}:null
  };
 });
 const prefix=stage+' '+info.vw+'x'+info.vh;
 assert.ok(info.horizontalOverflow<=2,prefix+' horizontal overflow '+JSON.stringify(info));
 assert.ok(info.app.left>=-2&&info.app.right<=info.vw+2,prefix+' app leaves viewport');
 assert.ok(info.app.width<=752,prefix+' game pane should stay centered and <=750px');
 assert.ok(Math.abs((info.app.left+info.app.right)/2-info.vw/2)<4,prefix+' app should be centered');
 assert.ok(info.nav.left>=info.app.left-2&&info.nav.right<=info.app.right+2,prefix+' nav outside pane');
 for(const x of info.navItems){
  assert.ok(x.left>=info.nav.left-2&&x.right<=info.nav.right+2,prefix+' nav item overflows');
 }
 for(let i=1;i<info.navItems.length;i++){
  assert.ok(info.navItems[i].left>=info.navItems[i-1].right-4,prefix+' nav buttons overlap');
 }
 if(info.help&&info.panel)
  assert.ok(info.help.top>=info.panel.bottom-2,prefix+' help overlaps secret panel '+JSON.stringify(info));
 if(info.confirm&&info.help)
  assert.ok(info.help.top>=info.confirm.bottom-1,prefix+' help overlaps confirmation button');
 if(info.legend&&info.roster){
  assert.ok(info.legend.top>=info.roster.bottom-3,prefix+' legend overlaps roster');
  const container=await page.evaluate(()=>document.querySelector('.sab-play').getBoundingClientRect().bottom);
  assert.ok(info.legend.bottom<=container+3,prefix+' legend leaves play container');
 }
 console.log('PC_SABOTAGE_LAYOUT '+prefix+' '+JSON.stringify({
  pane:Math.round(info.app.width),nav:Math.round(info.nav.width),
  panelHeight:Math.round(info.panel?.height||0),
  helpBelow:info.help&&info.panel?Math.round(info.help.top-info.panel.bottom):null,
  horizontalOverflow:info.horizontalOverflow,
  rootScroll:info.rootScroll
 }));
}
test('Sabotage desktop layout audit: offline setup, secret cards, roster and code selection',async()=>{
 for(const [width,height] of [[1024,768],[1366,768],[1920,1080]]){
  const {page,context,errors}=await open(width,height);
  try{
   await page.goto(base+'/games/sabotage/',{waitUntil:'load'});
   await sabotageDesktopGeometry(page,'offline/title');
   const logo=page.locator('.sab-title-art');
   await logo.evaluate(image=>image.decode());
   await page.locator('[data-action="members"]').click();
   await sabotageDesktopGeometry(page,'offline/members');
   await page.locator('[data-members-done]').click();
   await page.locator('.sab-settings').waitFor();
   await sabotageDesktopGeometry(page,'offline/settings');
   await page.locator('[data-action="start"]').click();
   const hold=async()=>{
    const button=page.locator('[data-hold="briefing"]');
    await button.dispatchEvent('pointerdown',{pointerId:1,pointerType:'mouse',isPrimary:true});
    await page.waitForTimeout(720);
    await page.locator('[data-action="seen"]').waitFor();
    await page.evaluate(()=>dispatchEvent(new PointerEvent('pointerup',{pointerId:1,pointerType:'mouse'})));
   };
   await hold();
   await sabotageDesktopGeometry(page,'offline/role');
   await page.locator('.sab-role-art-large').evaluate(image=>image.decode());
   await page.locator('[data-action="seen"]').click();
   for(let i=1;i<4;i++){await hold();await page.locator('[data-action="seen"]').click()}
   await hold();
   await sabotageDesktopGeometry(page,'offline/code-secret');
   await page.locator('[data-action="seen"]').click();
   for(let i=1;i<4;i++){await hold();await page.locator('[data-action="seen"]').click()}
   await page.locator('.sab-play').waitFor();
   await sabotageDesktopGeometry(page,'offline/board');
   await page.locator('.sab-player[data-target]:not([disabled])').first().click();
   await sabotageDesktopGeometry(page,'offline/code-selection');
   assert.equal(await page.locator('[data-wire]').count(),5);
   await page.locator('[data-wire="0"]').click();
   await page.locator('[data-action="cut"]').click();
   assert.ok(await page.locator('[data-confirm-ok]').isVisible());
   assert.deepEqual(errors,[],'offline browser errors at '+width);
  }finally{await context.close()}
 }
});
test('Sabotage desktop layout audit: online role, code, board, chat and selection',async()=>{
 for(const [width,height] of [[1024,768],[1366,768],[1920,1080]]){
  const {page,context,errors}=await open(width,height);
  try{
   await page.goto(base+'/online/sabotage/?testPlay=1',{waitUntil:'load'});
   await sabotageDesktopGeometry(page,'online/role-hidden');
   await page.locator('[data-action="show"]').click();
   await sabotageDesktopGeometry(page,'online/role');
   await page.locator('.sab-role-art-large').evaluate(image=>image.decode());
   await page.locator('[data-action="seen"]').click();
   await page.locator('[data-action="show"]').click();
   await sabotageDesktopGeometry(page,'online/code-secret');
   await page.locator('[data-action="seen"]').scrollIntoViewIfNeeded();
   await page.locator('[data-action="seen"]').click();
   await page.locator('.sab-play').waitFor();
   await sabotageDesktopGeometry(page,'online/board');
   await page.locator('[data-action="chat"]').click();
   await sabotageDesktopGeometry(page,'online/chat');
   const quick=page.locator('.sab-quick-grid [data-chat]');
   assert.equal(await quick.count(),8);
   const sizes=await quick.evaluateAll(els=>els.map(el=>el.getBoundingClientRect().width));
   assert.ok(sizes.every(x=>x>80),'desktop chat quick buttons must fit');
   await page.locator('[data-action="cancel"]').click();
   await page.locator('.sab-player[data-target]:not([disabled])').first().click();
   await sabotageDesktopGeometry(page,'online/code-selection');
   assert.equal(await page.locator('[data-wire]').count(),5);
   await page.locator('[data-wire="0"]').click();
   await page.locator('[data-action="cut"]').click();
   assert.ok(await page.locator('[data-confirm-ok]').isVisible());
   assert.deepEqual(errors,[],'online browser errors at '+width);
  }finally{await context.close()}
 }
});

test('Sabotage offline navigation stays on one row on narrow phones',async()=>{
 for(const [width,height] of [[345,700],[390,780]]){
  const {page,context,errors}=await open(width,height);
  try{
   await page.goto(base+'/games/sabotage/',{waitUntil:'load'});
   const x=await page.evaluate(()=>{
    const nav=document.querySelector('.sab-nav').getBoundingClientRect();
    const items=[...document.querySelector('.sab-nav').children].map(el=>el.getBoundingClientRect());
    return {nav:{left:nav.left,right:nav.right},items:items.map(r=>({left:r.left,right:r.right,top:r.top,bottom:r.bottom})),overflow:document.documentElement.scrollWidth-innerWidth};
   });
   assert.ok(x.overflow<=2,'navigation horizontally overflows on '+width);
   assert.equal(x.items.length,4,'back, logo, home and settings should all exist');
   for(let i=0;i<x.items.length;i++){
    assert.ok(x.items[i].left>=x.nav.left-2&&x.items[i].right<=x.nav.right+2,
      'nav item outside screen '+JSON.stringify(x));
    if(i>0)assert.ok(x.items[i].left>=x.items[i-1].right-2,'nav items overlap '+JSON.stringify(x));
   }
   const tops=x.items.map(item=>Math.round(item.top));
   assert.ok(Math.max(...tops)-Math.min(...tops)<6,'nav is wrapped on '+width);
   assert.deepEqual(errors,[]);
  }finally{await context.close()}
 }
});
