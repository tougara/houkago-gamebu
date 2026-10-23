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
  assert.equal(await page.locator('.featured-copy strong').textContent(),'サボタージュ！');
  assert.match(await page.locator('.featured-art img').getAttribute('src'),/sabotage-logo[.]svg/);
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

test('Sabotage offline plays from common roster through first code reveal on a phone',async()=>{
 const {page,context,errors}=await open(390,780);
 try{
  await page.goto(base+'/games/sabotage/',{waitUntil:'load'});
  await page.locator('[data-action="members"]').click();
  assert.equal(await page.locator('.shared-player-editor').count(),1);
  await page.locator('[data-members-done]').click();
  for(let i=0;i<4;i++){
   await page.locator('[data-action="peek"]').click();
   assert.equal(await page.locator('.sab-counts').count(),1);
   await page.locator('[data-action="seen"]').click();
  }
  await page.locator('.sab-play').waitFor();
  assert.equal(await page.locator('.sab-player').count(),4);
  await page.locator('.sab-player[data-target]:not([disabled])').first().click();
  await page.locator('[data-wire="0"]').click();
  page.once('dialog',d=>d.accept());
  await page.locator('[data-action="cut"]').click();
  await page.locator('.sab-result').waitFor();
  assert.equal(await page.locator('.sab-result').count(),1);
  assert.deepEqual(errors,[]);
 }finally{await context.close()}
});
test('Sabotage online trial completes private acknowledgements and reveals a code',async()=>{
 const {page,context,errors}=await open(390,780);
 try{
  await page.goto(base+'/online/sabotage/?testPlay=1',{waitUntil:'load'});
  await page.locator('[data-action="show"]').waitFor();
  for(let i=0;i<4;i++){
   await page.locator('[data-action="show"]').click();
   assert.equal(await page.locator('.sab-counts').count(),1);
   await page.locator('[data-action="seen"]').click();
  }
  await page.locator('.sab-play').waitFor();
  await page.locator('.sab-player[data-target]:not([disabled])').first().click();
  await page.locator('[data-wire="0"]').click();
  page.once('dialog',d=>d.accept());
  await page.locator('[data-action="cut"]').click();
  await page.locator('.sab-result').waitFor();
  assert.deepEqual(errors,[]);
 }finally{await context.close()}
});
