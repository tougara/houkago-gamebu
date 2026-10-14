/* Shared presentation only: solo scoring and 2P KO rules remain independent. */
(function(global){
  'use strict';
  const TIMING=Object.freeze({
    countdown:1120,start:1500,
    perfect:2950,excellent:2550,great:2250,good:1700,safe:1650,
    out:1850,miss:1850,win:2850,danger:2050
  });
  const LABEL=Object.freeze({
    perfect:'PERFECT！',excellent:'EXCELLENT！',great:'GREAT！',
    good:'GOOD！',safe:'SAFE！',out:'OUT！',miss:'ミス！'
  });
  const escape=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function vibrate(tier,settings){
    const signal=tier==='perfect'?[28,22,70]:tier==='excellent'?[24,18,45]:tier==='great'?24:null;
    if(signal!==null)settings?.vibrate?.(signal);
  }
  function cutinHtml(fx){
    if(!fx)return '';
    const kind=fx.kind,rank=fx.rank||'',isJudge=kind==='judge',isWin=kind==='win';
    const count=isWin||rank==='perfect'?26:rank==='excellent'?16:9;
    const sparks=((isJudge&&['perfect','excellent','great'].includes(rank))||isWin)?
      Array.from({length:count},(_,i)=>'<i style="--n:'+i+';--step:'+(360/count)+'deg"></i>').join(''):'';
    const duration=Number.isFinite(fx.duration)?fx.duration:(TIMING[rank]||TIMING[kind]||2500);
    return '<div class="pv-cutin pv-cutin-'+escape(kind)+' '+(rank?'pv-cutin-'+escape(rank):'')+
      '" style="--cutin-duration:'+duration+'ms" role="status" aria-live="assertive">'+
      '<div class="pv-cutin-dimmer"></div><div class="pv-cutin-beam"></div>'+
      '<div class="pv-cutin-burst" aria-hidden="true">'+sparks+'</div>'+
      '<div class="pv-cutin-content">'+
      (fx.kicker?'<span class="pv-cutin-kicker">'+escape(fx.kicker)+'</span>':'')+
      '<strong class="pv-cutin-title">'+escape(fx.title)+'</strong>'+
      (fx.subtitle?'<span class="pv-cutin-subtitle">'+escape(fx.subtitle)+'</span>':'')+
      (isWin?'<span class="pv-cutin-crown" aria-hidden="true">★ WINNER ★</span>':'')+
      '</div></div>';
  }
  global.PitadomeEffects=Object.freeze({TIMING,LABEL,vibrate,cutinHtml});
})(globalThis);
