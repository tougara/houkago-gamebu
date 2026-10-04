(()=>{
const DB=window.DOCCHI_QUESTIONS;
const modeButtons=[...document.querySelectorAll('[data-lab-mode]')];
const category=document.getElementById('questionCategory');
const draw=document.getElementById('drawQuestion');
const card=document.getElementById('questionLabCard');
const qEl=document.getElementById('labQuestion');
const aEl=document.getElementById('labA');
const bEl=document.getElementById('labB');
const countEl=document.getElementById('labCount');
const customForm=document.getElementById('customQuestionForm');
const customQ=document.getElementById('customQuestion');
const customA=document.getElementById('customA');
const customB=document.getElementById('customB');
const customCount=document.getElementById('customCount');
const drawCustom=document.getElementById('drawCustomQuestion');
let mode='battle';
let lastKey='';
const STORE='houkago_docchi_custom_v1';

function customItems(){try{return JSON.parse(localStorage.getItem(STORE)||'[]')}catch(e){return[]}}
function saveCustom(items){localStorage.setItem(STORE,JSON.stringify(items.slice(-50)))}
function refreshCustomCount(){const n=customItems().length;customCount.textContent='保存中のマイお題：'+n+'問';drawCustom.disabled=n===0}
function categories(){return Object.keys(DB[mode])}
function refreshCategories(){
  category.innerHTML='<option value="all">すべてのジャンル</option>'+categories().map(c=>'<option value="'+c+'">'+c+'</option>').join('');
  countEl.textContent='収録：200問 ／ '+categories().length+'ジャンル';
}
function pool(){
 const c=category.value;
 return c==='all'?categories().flatMap(k=>DB[mode][k].map(x=>({...x,category:k}))):DB[mode][c].map(x=>({...x,category:c}));
}
function show(x,prefix=''){
  qEl.textContent=x.q;
  aEl.textContent=x.a;
  bEl.textContent=x.b;
  card.dataset.mode=mode;
  document.getElementById('labCategoryLabel').textContent=prefix||(x.category||'オリジナル');
}
function drawOne(){
 const p=pool();
 if(!p.length)return;
 let i=Math.floor(Math.random()*p.length),key='';
 for(let n=0;n<6;n++){
   const x=p[i];key=x.q+'|'+x.a+'|'+x.b;
   if(key!==lastKey||p.length===1)break;
   i=Math.floor(Math.random()*p.length);
 }
 lastKey=key;show(p[i]);
}
modeButtons.forEach(btn=>btn.addEventListener('click',()=>{
 mode=btn.dataset.labMode;
 modeButtons.forEach(x=>x.classList.toggle('selected',x===btn));
 document.getElementById('questionLabTitle').textContent=mode==='battle'?'よみあいバトルのお題':'ひみつ投票のお題';
 document.getElementById('secretPassNote').hidden=mode!=='secret';
 refreshCategories();drawOne();
}));
category.addEventListener('change',drawOne);
draw.addEventListener('click',drawOne);
customForm.addEventListener('submit',e=>{
 e.preventDefault();
 const q=customQ.value.trim(),a=customA.value.trim(),b=customB.value.trim();
 if(!q||!a||!b)return;
 const items=customItems();
 items.push({q,a,b,category:'マイお題'});
 saveCustom(items);customForm.reset();refreshCustomCount();show(items[items.length-1],'マイお題');
});
drawCustom.addEventListener('click',()=>{
 const items=customItems();
 if(!items.length)return;
 show(items[Math.floor(Math.random()*items.length)],'マイお題');
});
document.getElementById('clearCustomQuestions').addEventListener('click',()=>{
 if(!customItems().length)return;
 if(confirm('保存したマイお題をすべて消しますか？')){localStorage.removeItem(STORE);refreshCustomCount()}
});
refreshCategories();refreshCustomCount();drawOne();
})();