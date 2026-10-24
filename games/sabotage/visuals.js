/* Shared visual components: identical rules and presentation in offline and online. */
const escapeText=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const sabotageRoleName={crew:'クルーメイト',impostor:'インポスター',jackal:'ジャッカル'};
export const sabotageRoleGoal={
 crew:'解除コードをすべて見つければ勝利！',
 impostor:'BOMBを公開させれば勝利。ジャッカル不在なら時間切れでも勝利。',
 jackal:'解除成功もBOMBも起こさず、4ラウンドを終わらせれば単独勝利！'
};
export const sabotageWireLabel={repair:'解除',error:'BOMB',dummy:'しーん……'};
export function sabotageRoleCard(role,counts=null){
 const c=counts;
 return '<div class="sab-secret-content"><p class="sab-kicker">YOUR SECRET</p>'+
 '<div class="sab-role '+escapeText(role)+'">'+escapeText(sabotageRoleName[role])+'</div>'+
 '<div class="sab-role-goal">'+escapeText(sabotageRoleGoal[role])+'</div>'+
 (c?'<div class="sab-counts"><div><strong>'+c.repair+'</strong><small>解除</small></div><div><strong>'+c.error+'</strong><small>BOMB</small></div><div><strong>'+c.dummy+'</strong><small>しーん……</small></div></div>':'')+'</div>';
}
export function sabotageSlotLegend(){
 return '<div class="sab-slot-legend" aria-label="公開済みコードの凡例"><span class="repair">✓ 解除</span><span class="error">! BOMB</span><span class="dummy">… しーん……</span></div>';
}
export function sabotageBadges(required,repaired,animate=false){
 return '<div class="sab-status-badges" aria-label="解除 '+repaired+' / '+required+'">'+
 Array.from({length:required},(_,i)=>{
  const done=i<repaired,last=done&&i===repaired-1&&animate;
  return '<span class="sab-badge '+(done?'is-cleared':'is-locked')+(last?' just-cleared':'')+'" title="'+(done?'解除成功':'未解除')+'">'+
   '<span class="sab-badge-inner"><span class="sab-badge-front">?</span><span class="sab-badge-back">✓</span></span></span>';
 }).join('')+'</div>';
}
const typeIcon={repair:'✓',error:'!',dummy:'…'};
export function sabotageSlots(slots,selectable=false,selected=-1){
 const items=Array.isArray(slots)&&slots.length?slots:Array.from({length:5},()=>({state:'closed'}));
 return '<div class="'+(selectable?'sab-slot-grid':'sab-wires')+'" aria-label="コード5枠">'+
 Array.from({length:5},(_,i)=>{
  const item=items[i]||{state:'inactive'},state=item.state||'closed';
  const opened=state==='opened',active=state==='closed';
  const symbol=opened?typeIcon[item.type]:(state==='inactive'?'—':selectable?'▥':'');
  const label=opened?sabotageWireLabel[item.type]:(active?'未公開':'配布なし');
  const className='sab-wire sab-slot-'+state+(opened?' sab-slot-'+item.type:'')+(selected===i?' selected':'');
  if(selectable){
   return '<button type="button" data-wire="'+i+'" class="sab-btn sab-slot-pick '+className+'" '+(!active?'disabled':'')+' aria-label="コード'+(i+1)+' '+label+'">'+
    '<span class="sab-wire-symbol">'+symbol+'</span><small>'+ (opened?escapeText(label):'#'+(i+1))+'</small></button>';
  }
  return '<span class="'+className+'" title="コード'+(i+1)+' '+label+'"><span class="sab-wire-symbol">'+symbol+'</span></span>';
 }).join('')+'</div>';
}
export function sabotageVictory(winner,myRole=null){
 const name=sabotageRoleName[winner],win=winner===myRole;
 const heading={crew:'MISSION CLEAR!',impostor:'SABOTAGE!',jackal:'JACKAL VICTORY!'}[winner];
 const symbol={crew:'✓',impostor:'!',jackal:'◆'}[winner];
 const summary={crew:'宇宙船の全コード解除に成功！',impostor:'BOMBが起動、解除阻止に成功！',jackal:'最後まで正体を隠し、時間切れを勝ち取った！'}[winner];
 return '<section class="sab-victory sab-win-'+winner+'" aria-label="'+name+'の勝利">'+
 '<div class="sab-victory-rays" aria-hidden="true"></div><div class="sab-victory-particles" aria-hidden="true">'+
 Array.from({length:18},(_,i)=>'<i style="--p:'+i+';left:'+(8+i*4.5)+'%;top:'+(12+((i*7)%19)*3.7)+'%;animation-delay:'+(-i*.13)+'s;transform:rotate('+(i*23)+'deg)"></i>').join('')+'</div>'+
 '<p class="sab-victory-top">GAME OVER · FINAL RESULT</p>'+
 '<div class="sab-victory-emblem" aria-hidden="true">'+symbol+'</div>'+
 '<h1 class="sab-victory-heading">'+heading+'</h1>'+
 '<h2 class="sab-victory-winner">'+name+' 勝利！</h2>'+
 (myRole?'<div class="sab-victory-personal">'+(win?'YOU WIN!':'YOU LOSE')+'</div>':'')+
 '<p class="sab-victory-summary">'+summary+'</p></section>';
}
export function sabotageCutConfirm(targetName,slot){
 return '<div class="sab-confirm-overlay" role="dialog" aria-modal="true" aria-label="コード公開の確認">'+
 '<section class="sab-confirm-card"><p class="sab-kicker">FINAL CONFIRMATION</p><h2>コードを公開する？</h2>'+
 '<p class="sab-confirm-target">'+escapeText(targetName)+'　コード #'+(slot+1)+'</p>'+
 '<p class="sab-sub">この操作は取り消せません。</p>'+
 '<div class="sab-confirm-actions"><button type="button" class="sab-btn secondary" data-confirm-cancel>もどる</button>'+
 '<button type="button" class="sab-btn" data-confirm-ok>公開する</button></div></section></div>';
}
