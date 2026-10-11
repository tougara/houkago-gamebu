/* 放課後ゲーム部 / トップの更新履歴。
   Static, commit-backed data; no game state, storage or game scripts touched. */
(function(){
 'use strict';
 const records=Array.isArray(globalThis.HOUKAGO_CHANGELOG)?globalThis.HOUKAGO_CHANGELOG:[];
 const overlay=document.getElementById('homeUpdateHistoryOverlay');
 const openButton=document.getElementById('openUpdateHistory');
 const closeButton=document.getElementById('closeUpdateHistory');
 const dateHost=document.getElementById('homeHistoryDates');
 const categoryHost=document.getElementById('homeHistoryCategories');
 const summary=document.getElementById('homeHistorySummary');
 const list=document.getElementById('homeHistoryEntries');
 const scroll=document.getElementById('homeHistoryScroll');
 if(!overlay||!openButton||!closeButton||!dateHost||!categoryHost||!summary||!list)return;
 const names={
   site:'サイト共通',nise:'ニセ転校生を探せ！',docchi:'みんなはどっち？',
   meter:'感覚メーター',tower:'教科書タワー',
   gesture:'ジェスチャーバトル',pita:'ピタ止めチャレンジ',link:'リンクバースト！'
 };
 const order=['site','nise','docchi','meter','tower','gesture','pita','link'];
 const data=records.slice().filter(x=>x&&x.date&&x.datetime&&x.title).sort((a,b)=>Date.parse(b.datetime)-Date.parse(a.datetime));
 const dates=[...new Set(data.map(x=>x.date))];
 let chosenDate='all',chosenCategory='all';
 let lastFocused=null;
 function esc(value){
   return String(value==null?'':value).replace(/[&<>"']/g,function(char){
     return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char];
   });
 }
 function dateLabel(value){
   const p=String(value).split('-');return p.length===3?Number(p[1])+'/'+p[2]:value;
 }
 function timeLabel(item){
   const d=String(item.datetime||'');
   return d.slice(0,10).replace(/-/g,'/')+' '+d.slice(11,16);
 }
 function update(){
   const visible=data.filter(x=>(chosenDate==='all'||x.date===chosenDate)&&(chosenCategory==='all'||x.category===chosenCategory));
   dateHost.innerHTML='<button type="button" class="hg-history-tab" data-hg-date="all" aria-pressed="'+(chosenDate==='all')+'">すべて</button>'+
     dates.map(function(d){return '<button type="button" class="hg-history-tab" data-hg-date="'+esc(d)+'" aria-pressed="'+(chosenDate===d)+'">'+esc(dateLabel(d))+'</button>'}).join('');
   categoryHost.innerHTML='<button type="button" class="hg-history-tab" data-hg-category="all" aria-pressed="'+(chosenCategory==='all')+'">全作品</button>'+
     order.map(function(key){return '<button type="button" class="hg-history-tab" data-hg-category="'+key+'" aria-pressed="'+(chosenCategory===key)+'">'+esc(names[key])+'</button>'}).join('');
   const majorCount=visible.filter(x=>x.major).length;
   summary.innerHTML='<strong>'+visible.length+'件</strong>の更新を表示　·　<strong>'+majorCount+'件</strong>の大型更新';
   const sorted=visible.slice().sort(function(a,b){
     if(a.date!==b.date)return b.date.localeCompare(a.date);
     return Date.parse(a.datetime)-Date.parse(b.datetime);
   });
   let previousDate='';
   list.innerHTML=sorted.length?sorted.map(function(x){
     const header=x.date===previousDate?'':'<h3 class="hg-history-day">'+esc(x.date.replace(/-/g,'/'))+'</h3>';
     previousDate=x.date;
     const badge='<span class="hg-history-badge">'+esc(names[x.category]||'共通')+'</span>';
     const major=x.major?'<span class="hg-history-badge major">大型更新</span>':'';
     const latest=x===data[0]?'<span class="hg-history-badge latest">最新</span>':'';
     const changes=(Array.isArray(x.changes)?x.changes:[]).map(s=>'<li>'+esc(s)+'</li>').join('');
     const sha=/^[a-f0-9]{40}$/.test(x.commit||'')?x.commit:null;
     const link=sha?'<a class="hg-history-commit" href="https://github.com/tougara/houkago-gamebu/commit/'+sha+'" target="_blank" rel="noopener noreferrer">GitHubの変更を見る ↗</a>':'';
     return header+'<article class="hg-history-card'+(x.major?' major':'')+'">'+
       '<div class="hg-history-meta"><time class="hg-history-time" datetime="'+esc(x.datetime)+'">'+esc(timeLabel(x))+'</time>'+
         '<div class="hg-history-badges">'+latest+major+badge+'</div></div>'+
       '<h3>'+esc(x.title)+'</h3>'+
       (changes?'<ul class="hg-history-changes">'+changes+'</ul>':'')+link+
     '</article>';
   }).join(''):'<div class="hg-history-empty">この条件の更新履歴はありません。</div>';
 }
 function open(){
   lastFocused=document.activeElement;
   chosenDate='all';chosenCategory='all';
   update();
   overlay.hidden=false;
   document.body.classList.add('hg-history-open');
   openButton.setAttribute('aria-expanded','true');
   if(scroll)scroll.scrollTop=0;
   closeButton.focus();
 }
 function close(){
   overlay.hidden=true;
   document.body.classList.remove('hg-history-open');
   openButton.setAttribute('aria-expanded','false');
   if(lastFocused&&typeof lastFocused.focus==='function')lastFocused.focus();
 }
 openButton.addEventListener('click',open);
 closeButton.addEventListener('click',close);
 overlay.addEventListener('click',function(e){
   if(e.target===overlay){close();return}
   const dateButton=e.target.closest('[data-hg-date]');
   const catButton=e.target.closest('[data-hg-category]');
   if(dateButton&&overlay.contains(dateButton)){
     chosenDate=dateButton.dataset.hgDate;update();if(scroll)scroll.scrollTop=0;
   }else if(catButton&&overlay.contains(catButton)){
     chosenCategory=catButton.dataset.hgCategory;update();if(scroll)scroll.scrollTop=0;
   }
 });
 document.addEventListener('keydown',function(e){
   if(overlay.hidden)return;
   if(e.key==='Escape'){e.preventDefault();close();return}
   if(e.key!=='Tab')return;
   const focusable=Array.from(overlay.querySelectorAll('button:not([disabled]),a[href]'))
     .filter(el=>el.getClientRects().length>0);
   if(!focusable.length)return;
   const first=focusable[0],last=focusable[focusable.length-1];
   if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}
   else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}
 });
})();
