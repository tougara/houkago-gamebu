/* 放課後ゲーム部 / オンライン共通UI
   ロビー・各ゲームが同じ表示とアクセシビリティを使うための軽量ヘルパー。
   ゲーム固有の処理、部屋通信、勝敗判定はここには置かない。 */
(()=>{
'use strict';
const escapeHTML=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const element=target=>typeof target==='string'?document.getElementById(target):target;
const CONNECTION={
 waiting:'接続待ち',
 connecting:'接続中…',
 connected:'接続中',
 reconnecting:'再接続中…'
};
function connection(target,phase){
 const el=element(target);if(!el)return;
 const state=Object.prototype.hasOwnProperty.call(CONNECTION,phase)?phase:'waiting';
 el.textContent=CONNECTION[state];
 el.dataset.hkState=state;
 el.classList.toggle('connected',state==='connected');
 el.setAttribute('aria-live','polite');
}
function notice(target,message='',positive=false){
 const el=element(target);if(!el)return;
 el.hidden=!message;
 el.textContent=message||'';
 el.dataset.hkKind=positive?'success':'error';
 el.classList.toggle('ok',Boolean(positive));
 el.classList.toggle('good',Boolean(positive));
}
function progress(label,current,total,{className=''}={}){
 const done=Math.max(0,Number(current)||0);
 const max=Math.max(0,Number(total)||0);
 const extra=/^[a-zA-Z0-9 _-]*$/.test(className)?className.trim():'';
 return '<p class="hk-online-progress'+(extra?' '+extra:'')+'" role="status">'+escapeHTML(label)+' '+done+' / '+max+'人</p>';
}
function memberChips(members,{authorId='',hostId='',chipClass=''}={}){
 const list=Array.isArray(members)?members:[];
 const extra=/^[a-zA-Z0-9 _-]*$/.test(chipClass)?chipClass.trim():'';
 return list.map(m=>{
  const author=Boolean(authorId&&m.id===authorId);
  const host=Boolean(hostId&&m.id===hostId);
  return '<span class="hk-online-member'+(author?' hk-online-author':'')+(extra?' '+extra:'')+'">'+
   escapeHTML(m.icon||'？')+' '+escapeHTML(m.name||'プレイヤー')+
   (author?'（出題者）':host?'［ホスト］':'')+'</span>';
 }).join('');
}
function roster(members,{authorId='',hostId='',title='参加メンバー'}={}){
 const list=Array.isArray(members)?members:[];
 return '<details class="panel hk-online-roster"><summary>'+escapeHTML(title)+' '+list.length+'人（タップして確認）</summary>'+
  '<div class="hk-online-members">'+memberChips(list,{authorId,hostId})+'</div></details>';
}
window.HoukagoOnlineUI=Object.freeze({escapeHTML,connection,notice,progress,memberChips,roster});
})();
