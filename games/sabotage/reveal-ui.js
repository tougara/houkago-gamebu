import {sabotageBadges} from './visuals.js?v=20261024-noreaction1';
/* Shared presentation for offline, live online, and online trial. Never show outcome before suspense expires. */
export function sabotageRevealBody(type,stage,repaired,required){
 if(stage==='suspense'){
  return '<div class="sab-tension" data-reveal-stage="suspense" role="status">'+
   '<div class="sab-closed-code" aria-hidden="true"><span>?</span></div>'+
   '<p class="sab-tension-label">コードを確認中</p>'+
   '<div class="sab-wait-dots" aria-hidden="true"><i></i><i></i><i></i></div>'+
   '<p class="sab-wait-ellipsis">……</p>'+
   '<p class="sab-tension-hint">何が出るかは、まだ分からない。</p></div>';
 }
 const repair=type==='repair',bomb=type==='error';
 const title=repair?'解除成功！':bomb?'BOMB!':'反応なし';
 const caption=repair?'システムの解除に成功！':bomb?'緊急警報！ 爆弾が見つかった！':'何も起きなかった……';
 const remaining=Math.max(0,required-repaired);
 const progress=repair?'<p class="sab-remaining">残りあと <strong>'+remaining+'</strong> 個！</p>':
   bomb?'<p class="sab-remaining sab-danger-text">サボタージュ成功！</p>':'<p class="sab-remaining sab-quiet-text">次のコードへ進もう</p>';
 return '<div class="sab-reveal-visual '+type+'" data-reveal-stage="'+stage+'" role="status">'+
  (bomb?'<div class="sab-bomb-banner">EMERGENCY!</div>':'')+
  '<div class="sab-outcome-card"><span class="sab-outcome-symbol" aria-hidden="true">'+
  (repair?'✓':bomb?'!':'—')+'</span><div class="sab-result '+type+'">'+title+'</div></div>'+
  '<p class="sab-outcome-caption">'+caption+'</p>'+progress+
  (repair?sabotageBadges(required,repaired,stage==='result'): '')+
  (bomb?'<div class="sab-bomb-hold">WARNING · SYSTEM DOWN</div>':'')+'</div>';
}
