/* Shared visual components: identical rules and presentation in offline and online. */
const escapeText=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const sabotageRoleName={crew:'クルーメイト',impostor:'インポスター',jackal:'ジャッカル'};
export const sabotageRoleGoal={
 crew:'解除コードをすべて見つければ勝利！',
 impostor:'BOMBを公開させれば勝利。ジャッカル不在なら時間切れでも勝利。',
 jackal:'全解除もBOMB公開も起こさず、4ラウンドを終わらせれば単独勝利！'
};
export const sabotageWireLabel={repair:'解除',error:'BOMB',dummy:'反応なし'};
/* One visual asset map for offline, live online, and the local online trial. */
export const sabotageCardPath={repair:'../../sabotage_card_repair.png',error:'../../sabotage_card_bomb.png',dummy:'../../sabotage_card_no_response.png'};
/* All hidden code types share exactly the same neutral card back. */
export const sabotageCardBackPath='../../sabotage_card_back.png';
export function sabotageCardBackArtwork(extraClass=''){
 return '<img class="sab-card-art sab-card-back-art '+extraClass+'" src="'+sabotageCardBackPath+'?v=20261025-sabback1" alt="" aria-hidden="true" decoding="async" loading="eager">';
}
export function sabotageCardArtwork(type,alt='',extraClass=''){
 const src=sabotageCardPath[type];
 if(!src)return '';
 return '<img class="sab-card-art '+extraClass+'" src="'+src+'?v=20261024-sabassets1" alt="'+escapeText(alt)+'" decoding="async" loading="eager">';
}
export function sabotageBrandLogo(extraClass=''){
 return '<img class="sab-brand-logo '+extraClass+'" src="../../sabotage_logo.png?v=20261024-sabassets1" alt="サボタージュ" decoding="async">';
}
/* Role illustrations remain private until each player opens their own briefing. */
export const sabotageRoleImagePath={
 crew:'../../sabotage_role_crewmate.png',
 impostor:'../../sabotage_role_impostor.png',
 jackal:'../../sabotage_role_jackal.png'
};
export function sabotageRoleArtwork(role,small=false){
 const src=sabotageRoleImagePath[role],name=sabotageRoleName[role];
 if(!src||!name)return '';
 return '<img class="sab-role-art '+(small?'sab-role-art-mini':'sab-role-art-large')+'" src="'+src+'?v=20261025-sabrole1" alt="'+(small?'':escapeText(name)+'の役職カード')+'" decoding="async" loading="eager">';
}
import {sabotageChangeSettings} from './engine.js?v=20261025-sabroles1';
/* One setting panel is used by offline setup and the host/guests online lobby. */
export function sabotageSettingsPanel(n,settings,editable=true){
 const total=settings.crew+settings.impostor+Number(settings.jackal);
 const control=(role,direction)=>{
  const can=!!sabotageChangeSettings(n,settings,role,direction);
  return editable?'<button type="button" class="sab-setting-step" data-sab-setting="'+role+'" data-value="'+direction+'" aria-label="'+escapeText(sabotageRoleName[role])+(direction>0?'を増やす':'を減らす')+'" '+(can?'':'disabled')+'>'+(direction>0?'+':'−')+'</button>':'';
 };
 const line=role=>{
  const count=settings[role];
  return '<div class="sab-setting-line"><span class="sab-setting-label sab-setting-'+role+'">'+escapeText(sabotageRoleName[role])+'</span><div class="sab-setting-value">'+control(role,-1)+'<strong>'+count+'枚</strong>'+control(role,1)+'</div></div>';
 };
 const toggle=(key,label,checked,desc)=>{
  const next=key==='extra'?(checked?0:1):!checked;
  const enabled=!!sabotageChangeSettings(n,settings,key,next);
  return '<div class="sab-setting-toggle"><div><strong>'+label+'</strong><small>'+desc+'</small></div>'+
   (editable?'<button type="button" data-sab-setting="'+key+'" data-value="'+String(next)+'" aria-pressed="'+String(checked)+'" '+(enabled?'':'disabled')+' class="sab-setting-switch '+(checked?'is-on':'')+'">'+(checked?'ON':'OFF')+'</button>':
   '<span class="sab-setting-readonly">'+(checked?'ON':'OFF')+'</span>')+'</div>';
 };
 return '<section class="sab-settings" aria-label="サボタージュ役職設定"><div class="sab-settings-top"><h2>役職の設定</h2><span>'+n+'人 / 候補'+total+'枚</span></div>'+
 '<p class="sab-settings-description">候補の役職カードを混ぜて、全員に1枚ずつ配ります。</p>'+
 line('crew')+line('impostor')+
 toggle('jackal','ジャッカルを追加',settings.jackal,'ONにするとクルーを1枚減らします')+
 toggle('extra','余りカード1枚',Boolean(settings.extra),'1枚余らせると陣営人数が確定しません')+
 '<p class="sab-settings-note">配布 '+n+'枚 / 非公開で除外 '+settings.extra+'枚。'+(settings.jackal?'ジャッカルも配られない場合があります。':'ジャッカルなし。')+'</p></section>';
}
export function sabotageRoleCard(role,counts=null){
 const c=counts,name=sabotageRoleName[role]||'役職不明';
 return '<div class="sab-secret-content '+(c?'sab-secret-with-counts':'sab-secret-role-only')+'"><p class="sab-kicker">YOUR SECRET</p>'+
 (c?'<div class="sab-role-inline">'+sabotageRoleArtwork(role,true)+'<div class="sab-role '+escapeText(role)+'">'+escapeText(name)+'</div></div>':
 '<div class="sab-role-portrait">'+sabotageRoleArtwork(role)+'</div><span class="sab-role sab-role-visually-hidden">'+escapeText(name)+'</span>')+
 '<div class="sab-role-goal">'+escapeText(sabotageRoleGoal[role]||'')+'</div>'+
 (c?'<div class="sab-counts">'+['repair','error','dummy'].map(type=>'<div class="sab-count-tile sab-count-'+type+'">'+sabotageCardArtwork(type,'','sab-count-art')+'<strong>'+Number(c[type]||0)+'</strong><small>'+escapeText(sabotageWireLabel[type])+'</small></div>').join('')+'</div>':'')+'</div>';
}
export function sabotageSlotLegend(){
 return '<div class="sab-slot-legend" aria-label="公開済みコードの凡例"><span class="repair">✓ 解除</span><span class="error">! BOMB</span><span class="dummy">— 反応なし</span></div>';
}
export function sabotageBadges(required,repaired,animate=false){
 return '<div class="sab-status-badges" aria-label="解除 '+repaired+' / '+required+'">'+
 Array.from({length:required},(_,i)=>{
  const done=i<repaired,last=done&&i===repaired-1&&animate;
  return '<span class="sab-badge '+(done?'is-cleared':'is-locked')+(last?' just-cleared':'')+'" title="'+(done?'解除成功':'未解除')+'">'+
   '<span class="sab-badge-inner"><span class="sab-badge-front">?</span><span class="sab-badge-back">✓</span></span></span>';
 }).join('')+'</div>';
}
const typeIcon={repair:'✓',error:'!',dummy:'—'};
export function sabotageSlots(slots,selectable=false,selected=-1){
 const items=Array.isArray(slots)&&slots.length?slots:Array.from({length:5},()=>({state:'closed'}));
 return '<div class="'+(selectable?'sab-slot-grid':'sab-wires')+'" aria-label="コード5枠">'+
 Array.from({length:5},(_,i)=>{
  const item=items[i]||{state:'inactive'},state=item.state||'closed';
  const opened=state==='opened',active=state==='closed';
  const symbol=opened?typeIcon[item.type]:(state==='inactive'?'—':'');
  const label=opened?sabotageWireLabel[item.type]:(active?'未公開':'配布なし');
  const className='sab-wire sab-slot-'+state+(opened?' sab-slot-'+item.type:'')+(selected===i?' selected':'');
  const art=opened?sabotageCardArtwork(item.type,'','sab-slot-art'):(active?sabotageCardBackArtwork('sab-slot-art sab-slot-back-art'):'');
  if(selectable){
   return '<button type="button" data-wire="'+i+'" class="sab-btn sab-slot-pick '+className+'" '+(!active?'disabled':'')+' aria-label="コード'+(i+1)+' '+label+'">'+
    art+'<span class="sab-wire-symbol">'+symbol+'</span><small>'+ (opened?escapeText(label):'#'+(i+1))+'</small></button>';
  }
  return '<span class="'+className+'" role="img" aria-label="コード'+(i+1)+' '+label+'" title="コード'+(i+1)+' '+label+'">'+art+'<span class="sab-wire-symbol" aria-hidden="true">'+symbol+'</span></span>';
 }).join('')+'</div>';
}
export function sabotageVictory(winner,myRole=null){
 const name=sabotageRoleName[winner],win=winner===myRole;
 const heading={crew:'MISSION CLEAR!',impostor:'SABOTAGE!',jackal:'JACKAL VICTORY!'}[winner];
 const symbol={crew:'✓',impostor:'!',jackal:'◆'}[winner];
 const summary={crew:'宇宙船の全コード解除に成功！',impostor:'BOMBが起動、解除阻止に成功！',jackal:'全解除もBOMB公開も起こさず、4ラウンドが終了！'}[winner];
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
