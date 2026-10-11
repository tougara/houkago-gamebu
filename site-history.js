/* 放課後ゲーム部トップ：全ゲーム共通の更新履歴 UI */
(function(){
  'use strict';
  const button=document.getElementById('openSiteHistory');
  const overlay=document.getElementById('siteHistoryOverlay');
  const closeButton=document.getElementById('closeSiteHistory');
  const content=document.getElementById('siteHistoryContent');
  const data=Array.isArray(window.HOUKAGO_CHANGELOG)?window.HOUKAGO_CHANGELOG.slice():[];
  if(!button||!overlay||!closeButton||!content)return;

  const labels={
    core:'放課後ゲーム部 共通',
    nise:'ニセ転校生を探せ！',
    docchi:'みんなはどっち？',
    meter:'感覚メーター',
    tower:'教科書タワー',
    gesture:'ジェスチャーバトル',
    pitadome:'ピタ止めチャレンジ',
    burst:'リンクバースト！'
  };
  // Reference design: newest date first; oldest->newest within each date.
  data.sort(function(a,b){
    if(a.date!==b.date)return String(b.date).localeCompare(String(a.date));
    return Date.parse(a.datetime)-Date.parse(b.datetime);
  });
  const dates=[...new Set(data.map(function(e){return e.date}).filter(Boolean))];
  let selected='all';
  let majorOnly=false;
  let focusBefore=null;

  function esc(s){
    return String(s==null?'':s).replace(/[&<>"']/g,function(c){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
    });
  }
  function dayLabel(date){
    const parts=String(date).split('-');
    return parts.length===3?Number(parts[1])+'月'+Number(parts[2])+'日':String(date);
  }
  function dateHeading(date){return String(date).replace(/^(\d{4})-(\d{2})-(\d{2})$/,function(_,y,m,d){return y+'年'+Number(m)+'月'+Number(d)+'日'})}

  function render(){
    const picked=data.filter(function(e){return(selected==='all'||e.date===selected)&&(!majorOnly||e.major)});
    const totalMajors=picked.filter(function(e){return e.major}).length;
    const newest=data.length?data.reduce(function(best,e){return Date.parse(e.datetime)>Date.parse(best.datetime)?e:best},data[0]):null;

    const dateTabs='<div class="site-history-dates" role="group" aria-label="日付で絞り込み">'+
      '<button type="button" class="site-history-date '+(selected==='all'?'on':'')+'" data-history-date="all" aria-pressed="'+(selected==='all')+'">すべて</button>'+
      dates.map(function(date){
        return '<button type="button" class="site-history-date '+(selected===date?'on':'')+'" data-history-date="'+esc(date)+'" aria-pressed="'+(selected===date)+'">'+esc(dayLabel(date))+'</button>';
      }).join('')+'</div>';
    const majorToggle='<div class="site-history-toolbar"><div class="site-history-count">'+
      '<strong>'+picked.length+'件</strong>表示中 <span class="site-history-count-separator">／</span> <strong>'+totalMajors+'件</strong>大型更新</div>'+
      '<button class="site-history-major-filter '+(majorOnly?'on':'')+'" type="button" data-history-major aria-pressed="'+majorOnly+'">大型更新のみ</button></div>';

    let prevDate='';
    const records=picked.map(function(e){
      const heading=e.date!==prevDate?'<h3 class="site-history-day">'+esc(dateHeading(e.date))+'</h3>':'';
      prevDate=e.date;
      const changes=Array.isArray(e.changes)?e.changes:[];
      const latest=e===newest;
      return heading+'<article class="site-history-card '+(e.major?'major ':'')+(e.scope==='core'?'shared':'game')+'">'+
        '<div class="site-history-card-head"><div class="site-history-head-main">'+
          '<time datetime="'+esc(e.datetime)+'">'+esc(e.display)+'</time>'+
          '<h4>'+esc(e.title)+'</h4></div>'+
          '<div class="site-history-card-tags">'+
            (e.major?'<span class="site-history-major-tag">大型更新</span>':'')+
            (latest?'<span class="site-history-latest-tag">最新</span>':'')+
          '</div></div>'+
        '<div class="site-history-scope">'+esc(labels[e.scope]||'共通')+'</div>'+
        (changes.length?'<ul class="site-history-changes">'+changes.map(function(t){return '<li>'+esc(t)+'</li>'}).join('')+'</ul>':'')+
        '<div class="site-history-commit">GitHub記録 '+esc(String(e.commit||'').slice(0,8))+'</div>'+
      '</article>';
    }).join('');

    content.innerHTML=
      '<p class="site-history-intro">放課後ゲーム部の誕生から、各ゲームの追加・改善まで。大きな変更を目立たせ、古い記録もすべての日付からたどれます。</p>'+
      dateTabs+majorToggle+
      '<div class="site-history-list">'+(records||'<p class="site-history-empty">この条件の更新はありません。</p>')+'</div>';
  }
  function open(){
    focusBefore=document.activeElement;
    selected='all';majorOnly=false;
    render();
    overlay.hidden=false;
    document.body.classList.add('site-history-open');
    closeButton.focus();
  }
  function close(){
    overlay.hidden=true;
    document.body.classList.remove('site-history-open');
    (focusBefore&&focusBefore.isConnected?focusBefore:button).focus();
  }
  button.addEventListener('click',open);
  closeButton.addEventListener('click',close);
  overlay.addEventListener('click',function(e){
    if(e.target===overlay){close();return}
    const date=e.target.closest('[data-history-date]');
    if(date&&overlay.contains(date)){
      selected=date.dataset.historyDate;
      render();
      const b=content.querySelector('[data-history-date="'+selected+'"]');
      b&&b.focus();
      return;
    }
    const major=e.target.closest('[data-history-major]');
    if(major&&overlay.contains(major)){
      majorOnly=!majorOnly;
      render();
      content.querySelector('[data-history-major]')?.focus();
    }
  });
  overlay.addEventListener('keydown',function(e){
    if(e.key==='Escape'){e.preventDefault();close();return}
    if(e.key!=='Tab')return;
    const focusable=Array.from(overlay.querySelectorAll('button:not([disabled])')).filter(function(el){return el.getClientRects().length>0});
    if(!focusable.length)return;
    const first=focusable[0],last=focusable[focusable.length-1];
    if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}
    else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}
  });
})();
