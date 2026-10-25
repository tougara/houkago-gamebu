import {sabotageCardArtwork} from './visuals.js?v=20261025-sabrole1';
// The shared finish time is supplied by the server; all screens finish together.
export const sabotageFinaleMs=3900;
export const sabotageBombWarningMs=1450;
export function sabotageBombFinalePhase(start,now=Date.now()){
 const elapsed=Number.isFinite(start)&&start>0?Math.max(0,now-start):sabotageFinaleMs;
 return elapsed<sabotageBombWarningMs
  ?{step:'alert',waitMs:sabotageBombWarningMs-elapsed}
  :{step:'card',waitMs:Math.max(0,sabotageFinaleMs-elapsed)};
}
export function sabotageFinalePhase(start,now=Date.now()){
 const time=Number.isFinite(start)&&start>0?Math.max(0,start+sabotageFinaleMs-now):0;
 return {active:time>0,waitMs:time};
}
export function sabotageFinaleKind(winner,lastCut){
 return winner==='crew'?'crew':lastCut?.type==='error'?'bomb':'timeout';
}
export function sabotageFinaleBody(winner,lastCut,step='card'){
 const kind=sabotageFinaleKind(winner,lastCut);
 const type=kind==='bomb'?'error':kind==='crew'?'repair':lastCut?.type||'dummy';
 const title=kind==='bomb'?['CRITICAL ALERT','BOMB!','緊急警報・システム崩壊']:
  kind==='crew'?['FINAL UNLOCK','ALL CLEAR!','すべての解除コードを発見！']:
  ['ROUND 4 / 4','TIME UP','制限ラウンド終了・最終判定へ'];
 const sparks=Array.from({length:16},(_,i)=>'<i style="--i:'+i+'"></i>').join('');
 const warning=kind==='bomb'&&step==='alert';
 return '<section class="sab-finale sab-finale-'+kind+'" data-finale="'+kind+'" data-finale-step="'+(warning?'alert':'card')+'" role="status" aria-label="決着演出">'+
  '<div class="sab-finale-shock" aria-hidden="true"><span></span><span></span><span></span></div>'+
  '<div class="sab-finale-sparks" aria-hidden="true">'+sparks+'</div>'+
  '<div class="sab-finale-content"><p class="sab-finale-kicker">'+title[0]+'</p>'+
  '<div class="sab-finale-card">'+sabotageCardArtwork(type,'','sab-finale-card-img')+'</div>'+
  (warning?'<strong class="sab-finale-warning">警告・異常コードを検知</strong>':
  '<strong class="sab-finale-heading">'+title[1]+'</strong>'+
  (kind==='bomb'?'<p class="sab-finale-card-label">爆弾（BOMB）</p>':'')+
  '<p class="sab-finale-subtitle">'+title[2]+'</p>')+
  '<p class="sab-finale-loading">最終結果へ移行中</p></div></section>';
}