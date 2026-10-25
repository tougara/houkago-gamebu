// Shared round transition for offline handover, online lobby and trial.
export const sabotageRoundIntroMs=1750;
export function sabotageRoundIntroPhase(round,start,now=Date.now()){
 const until=round>1&&Number.isFinite(start)&&start>0?Math.max(0,start+sabotageRoundIntroMs-now):0;
 return {active:until>0,waitMs:until};
}
export function sabotageRoundIntroBody(round){
 const safe=Math.max(2,Math.min(4,Math.trunc(Number(round)||2)));
 return '<section class="sab-round-intro" data-round-intro="'+safe+'" role="status" aria-label="ラウンド切り替え">'+
 '<span class="sab-intro-kicker">CODES RESHUFFLED</span>'+
 '<div class="sab-intro-orbit" aria-hidden="true"><span></span><span></span><span></span></div>'+
 '<div class="sab-intro-number"><small>NEXT ROUND</small><strong>ROUND '+safe+'</strong><span>/ 4</span></div>'+
 '<p>残ったコードをシャッフル・再配布しました</p>'+
 '<span class="sab-intro-foot">新しいコード内訳を確認しよう</span>'+
 '</section>';
}
