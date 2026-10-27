import {createArtRoom} from './scene.js';
/* A stand-alone single-player exploration + freehand paint prototype. */
const $=id=>document.getElementById(id),palette=[
 '#f8f4df','#ffffff','#202e41','#6c7b85','#e67277','#f5a788','#f5cd73',
 '#83b785','#66c1b2','#75c7e2','#477aa1','#ad8bc4','#d5bba4','#9e674e',
 '#5a6d55','#d878a1','#ffc5bb','#accac9','#e2c9f1','#c5dd8d','#ef913f'
];
const STORAGE='houkago_nurikakure_paint_v1',BASE='#f8f4df';
const canvas=$('paintCanvas'),ctx=canvas.getContext('2d',{willReadFrequently:true});
const modal=$('paintModal'),paletteRoot=$('colorPalette'),loading=$('loading');
const brushValue=$('brushValue'),sizeInput=$('brushSize'),paintStatus=$('saveStatus');
let world=null,active=false,painting=false,paintPointer=null,activeColor='#e67277',tool='brush',radius=22,history=[],snapshotBusy=false;
const held=new Set(),stick={x:0,z:0},cameraDrag={id:null,x:0,y:0},baseCtx=ctx;
function baseCoat(){ctx.fillStyle=BASE;ctx.fillRect(0,0,canvas.width,canvas.height)}
function note(msg){paintStatus.textContent=msg}
function pick(color){
 activeColor=color;
 $('customColor').value=color;
 $('colorSample').style.backgroundColor=color;
 paletteRoot.querySelectorAll('[data-color]').forEach(b=>{
  const selected=b.dataset.color.toLowerCase()===color.toLowerCase();
  b.classList.toggle('selected',selected);b.setAttribute('aria-pressed',String(selected));
 });
 if(tool!=='brush')selectTool('brush');
}
function selectTool(value){
 tool=value;
 for(const [name,id] of [['brush','brushTool'],['eraser','eraserTool']]){
  const button=$(id);button.classList.toggle('selected',tool===name);button.setAttribute('aria-pressed',String(tool===name));
 }
}
for(const color of palette){
 const button=document.createElement('button');button.type='button';button.className='color-swatch';
 button.dataset.color=color;button.setAttribute('aria-label','色 '+color);button.title=color;button.style.backgroundColor=color;
 button.addEventListener('click',()=>pick(color));paletteRoot.appendChild(button);
}
$('customColor').addEventListener('input',e=>pick(e.target.value));
sizeInput.addEventListener('input',()=>{radius=Number(sizeInput.value);brushValue.textContent=String(radius)});
$('brushTool').addEventListener('click',()=>selectTool('brush'));
$('eraserTool').addEventListener('click',()=>selectTool('eraser'));
function point(e){
 const r=canvas.getBoundingClientRect();
 return {x:(e.clientX-r.left)*canvas.width/r.width,y:(e.clientY-r.top)*canvas.height/r.height};
}
function pushHistory(){history.push(canvas.toDataURL('image/png'));if(history.length>10)history.shift()}
function daub(x,y){
 const color=tool==='eraser'?BASE:activeColor;
 ctx.fillStyle=color;ctx.beginPath();ctx.arc(x,y,radius/2,0,Math.PI*2);ctx.fill();
 world?.refreshPaint();
}
function paintLine(a,b){
 ctx.strokeStyle=tool==='eraser'?BASE:activeColor;ctx.lineWidth=radius;
 ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
 world?.refreshPaint();
}
let lastPoint=null;
canvas.addEventListener('pointerdown',e=>{
 if(!active||snapshotBusy||painting)return;
 e.preventDefault();painting=true;paintPointer=e.pointerId;
 try{canvas.setPointerCapture(e.pointerId)}catch{}
 pushHistory();
 lastPoint=point(e);daub(lastPoint.x,lastPoint.y);
 note('ペイント中…');
});
canvas.addEventListener('pointermove',e=>{
 if(!painting||e.pointerId!==paintPointer)return;
 e.preventDefault();const p=point(e);paintLine(lastPoint,p);lastPoint=p;
});
function save(){
 try{localStorage.setItem(STORAGE,canvas.toDataURL('image/png'));note('保存しました！')}catch{note('保存できませんでした。端末の空き容量を確認してね。')}
}
function stopPainting(e){
 if(!painting||e.pointerId!==paintPointer)return;
 painting=false;paintPointer=null;lastPoint=null;save();
}
for(const name of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(name,stopPainting);
async function restoreData(encoded){
 const img=new Image();img.src=encoded;
 try{await img.decode()}catch{return false}
 ctx.clearRect(0,0,canvas.width,canvas.height);
 ctx.drawImage(img,0,0,canvas.width,canvas.height);
 world?.refreshPaint();return true;
}
$('undoPaint').addEventListener('click',async()=>{
 if(snapshotBusy||painting||!history.length){note('戻せる操作はありません');return}
 snapshotBusy=true;
 const src=history.pop();
 const ok=await restoreData(src);
 snapshotBusy=false;if(ok)save();
});
$('resetPaint').addEventListener('click',()=>{
 if(painting)return;
 if(!window.confirm('描いた模様をすべて消して、元の色に戻す？'))return;
 pushHistory();baseCoat();world?.refreshPaint();save();
});
function setPaintMode(value){
 if(!world||painting)return;
 active=!!value;modal.hidden=!value;world.setPaintMode(!!value);
 if(value){clearMovement();note('変更は自動保存されます');requestAnimationFrame(()=>world?.setViewport())}
 else{world.setViewport()}
}
$('openPaint').addEventListener('click',()=>setPaintMode(true));
$('closePaint').addEventListener('click',()=>setPaintMode(false));
$('finishPaint').addEventListener('click',()=>setPaintMode(false));
$('helpButton').addEventListener('click',()=>{$('helpModal').hidden=false;clearMovement()});
$('closeHelp').addEventListener('click',()=>$('helpModal').hidden=true);
function clearMovement(){held.clear();stick.x=0;stick.z=0;$('joystickThumb').style.transform=''}
const keys={KeyW:'up',ArrowUp:'up',KeyS:'down',ArrowDown:'down',KeyA:'left',ArrowLeft:'left',KeyD:'right',ArrowRight:'right'};
window.addEventListener('keydown',e=>{
 if(e.key==='Escape'){if(!$('helpModal').hidden){$('helpModal').hidden=true}else if(active)setPaintMode(false);return}
 if(!keys[e.code]||active||!$('helpModal').hidden||e.target.closest('input'))return;
 e.preventDefault();held.add(keys[e.code]);
});
window.addEventListener('keyup',e=>{if(keys[e.code]){held.delete(keys[e.code]);if(!active)e.preventDefault()}});
window.addEventListener('blur',clearMovement);
document.addEventListener('visibilitychange',()=>{if(document.hidden)clearMovement()});
const joy=$('joystick'),thumb=$('joystickThumb');let joyPointer=null;
function joyMove(e){
 const r=joy.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2;
 const dx=e.clientX-cx,dy=e.clientY-cy,max=r.width*.31,len=Math.hypot(dx,dy);
 stick.x=Math.max(-1,Math.min(1,dx/max));
 stick.z=Math.max(-1,Math.min(1,-dy/max));
 if(len>max){stick.x=dx/len;stick.z=-dy/len}
 thumb.style.transform='translate('+(stick.x*max)+'px,'+(-stick.z*max)+'px)';
}
joy.addEventListener('pointerdown',e=>{
 e.preventDefault();if(joyPointer!==null)return;joyPointer=e.pointerId;
 try{joy.setPointerCapture(e.pointerId)}catch{}
 joyMove(e);
});
joy.addEventListener('pointermove',e=>{if(e.pointerId===joyPointer)joyMove(e)});
const joyEnd=e=>{if(e.pointerId!==joyPointer)return;joyPointer=null;stick.x=0;stick.z=0;thumb.style.transform=''};
for(const name of ['pointerup','pointercancel','lostpointercapture'])joy.addEventListener(name,joyEnd);
const worldCanvas=$('world');
worldCanvas.addEventListener('pointerdown',e=>{
 if(!world||active||!$('helpModal').hidden)return;
 cameraDrag.id=e.pointerId;cameraDrag.x=e.clientX;cameraDrag.y=e.clientY;
 try{worldCanvas.setPointerCapture(e.pointerId)}catch{}
});
worldCanvas.addEventListener('pointermove',e=>{
 if(!world||cameraDrag.id!==e.pointerId)return;
 world.orbit(e.clientX-cameraDrag.x,e.clientY-cameraDrag.y);
 cameraDrag.x=e.clientX;cameraDrag.y=e.clientY;
});
for(const name of ['pointerup','pointercancel','lostpointercapture'])worldCanvas.addEventListener(name,e=>{if(cameraDrag.id===e.pointerId)cameraDrag.id=null});
worldCanvas.addEventListener('wheel',e=>{if(!world)return;e.preventDefault();world.zoomView(e.deltaY>0?.36:-.36)},{passive:false});
$('frontButton').addEventListener('click',()=>world?.centerView());
let last=performance.now();
function frame(now){
 const dt=Math.min((now-last)/1000,.05);last=now;
 if(world){
  const move={x:Number(held.has('right'))-Number(held.has('left'))+stick.x,
   z:Number(held.has('up'))-Number(held.has('down'))+stick.z};
  world.update(dt,active?{x:0,z:0}:move);world.draw();
 }
 requestAnimationFrame(frame);
}
function showError(reason){
 loading.classList.add('error');
 loading.innerHTML='<strong>3D美術室を読み込めませんでした</strong><span>'+reason+'</span><button class="soft-btn" type="button" id="retry3D">もう一度読み込む</button>';
 $('retry3D').addEventListener('click',()=>location.reload());
}
async function loadPattern(){
 baseCoat();
 try{const stored=localStorage.getItem(STORAGE);if(stored)await restoreData(stored)}catch{}
 pick(activeColor);selectTool('brush');radius=Number(sizeInput.value);
}
async function start(){
 await loadPattern();
 let THREE=null;
 try{THREE=await import('https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js')}
 catch{try{THREE=await import('https://unpkg.com/three@0.160.0/build/three.module.js')}
 catch{showError('インターネット接続を確認して、再度試してください。');return}}
 try{
  world=createArtRoom(THREE,worldCanvas,$('characterPreview'),canvas);
  loading.hidden=true;
  const resize=()=>world?.setViewport();
  window.addEventListener('resize',resize);
  new ResizeObserver(resize).observe($('viewport'));
  new ResizeObserver(resize).observe($('characterPreview'));
  requestAnimationFrame(t=>{last=t;requestAnimationFrame(frame)});
  $('roomHint').textContent='ペイントボタンで自分の体に模様を描こう！';
 }catch(e){console.error(e);showError('この端末では3D描画が利用できない可能性があります。')}
}
start();
