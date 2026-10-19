/* Common online exit guard: intentionally leave any game, or host-stop into its lobby.
 * Server-owned authenticated HTTP action avoids duplicate WebSockets and reconnect races. */
(()=>{
'use strict';
const $=sel=>document.querySelector(sel);
const isPreview=new URLSearchParams(location.search).get('testPlay')==='1';
const STORE='houkago-online-session-v1';
let session=null;
try{session=JSON.parse(sessionStorage.getItem(STORE)||'null')}catch{}
const nav=$('.top-nav')||$('.topbar');
if(!nav)return;
const button=document.createElement('button');
button.type='button';button.className='hk-exit-button';
button.textContent=isPreview?'試遊終了':'退室';
button.setAttribute('aria-label',isPreview?'試遊を終了してゲーム選択へ':'オンラインルームの終了・退室メニュー');
nav.appendChild(button);
if(isPreview){
 button.addEventListener('click',()=>location.assign('../preview/'));
 return;
}
if(!session||!/^[A-Z2-9]{8}$/.test(session.code)||!/^[a-f0-9]{64}$/.test(session.token)){
 button.disabled=true;return;
}
let room=null,pending=false,dialog=null,target='../';
const base=String(window.HOUKAGO_ONLINE_API_URL||'').replace(/\/$/,'');
window.addEventListener('houkago-online-room-state',e=>{
 if(e.detail&&e.detail.code===session.code)room=e.detail;
});
function dismiss(){
 if(dialog){dialog.remove();dialog=null}
 document.body.classList.remove('hk-exit-open');
}
function linkDestination(a){
 if(!a)return null;
 const href=a.getAttribute('href')||'';
 if(!href||href.startsWith('#'))return null;
 const url=new URL(href,location.href);
 if(url.origin!==location.origin)return null;
 if(url.pathname==='/online/'||url.pathname==='/games/')return url.pathname;
 return null;
}
async function leave(mode,dest){
 if(pending)return;
 pending=true;
 const status=dialog?.querySelector('[data-exit-status]');
 if(status)status.textContent='通信サーバーに確認中…';
 if(dialog)dialog.querySelectorAll('button').forEach(b=>b.disabled=true);
 try{
  const r=await fetch(base+'/api/rooms/'+session.code+'/exit',{
   method:'POST',headers:{'content-type':'application/json'},
   body:JSON.stringify({token:session.token,mode}),cache:'no-store'
  });
  const data=await r.json();
  if(!r.ok||!data.ok)throw Error(data.error||'通信サーバーとの確認に失敗');
  if(mode==='leave')sessionStorage.removeItem(STORE);
  location.replace(dest);
 }catch(e){
  if(status)status.textContent='退出を確定できなかったよ：'+(e.message||'通信エラー');
  if(dialog){
   dialog.querySelectorAll('button').forEach(b=>b.disabled=false);
   const force=dialog.querySelector('[data-exit-local]');
   if(force)force.hidden=false;
  }
  pending=false;
 }
}
function show(dest='../'){
 if(dialog)return;
 target=dest;
 const host=room?.hostId===session.id;
 const overlay=document.createElement('div');
 overlay.className='hk-exit-overlay';
 overlay.innerHTML='<section class="hk-exit-dialog" role="dialog" aria-modal="true" aria-labelledby="hkExitTitle">'+
 '<h2 id="hkExitTitle">ゲームを終了・退室</h2>'+
 '<p>戻り方を選んでね。通信中の部屋でも安全に退出できるよ。</p>'+
 (host?'<button type="button" class="hk-exit-stop" data-exit-stop>対戦を終了してロビーへ</button>'+
 '<small>部屋のメンバーはそのまま。みんなで次のゲームを選べるよ。</small>':'')+
 '<button type="button" class="hk-exit-leave" data-exit-leave>部屋から退室する</button>'+
 '<small>あなたの参加情報を消すよ。進行中の対戦は中断される場合があるよ。</small>'+
 '<button type="button" class="hk-exit-cancel" data-exit-cancel>ゲームを続ける</button>'+
 '<p class="hk-exit-status" data-exit-status role="status"></p>'+
 '<button type="button" class="hk-exit-local" data-exit-local hidden>通信できないので、この端末だけ戻る</button>'+
 '</section>';
 overlay.addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b||pending)return;
  if(b.hasAttribute('data-exit-cancel')){dismiss();return}
  if(b.hasAttribute('data-exit-stop')){void leave('stop','../?room='+encodeURIComponent(session.code));return}
  if(b.hasAttribute('data-exit-leave')){void leave('leave',target);return}
  if(b.hasAttribute('data-exit-local')){
   if(!confirm('サーバー側の退出は未確認。端末の参加情報を消して画面を閉じる？'))return;
   sessionStorage.removeItem(STORE);location.replace(target);
  }
 });
 document.body.append(overlay);dialog=overlay;
 document.body.classList.add('hk-exit-open');
 overlay.querySelector('[data-exit-cancel]')?.focus();
}
button.addEventListener('click',()=>show('../'));
nav.addEventListener('click',e=>{
 const a=e.target.closest('a[href]');
 const dest=linkDestination(a);
 if(!dest)return;
 e.preventDefault();e.stopImmediatePropagation();show(dest);
},true);
document.addEventListener('keydown',e=>{
 if(e.key==='Escape'&&dialog&&!pending){e.preventDefault();dismiss()}
});
})();