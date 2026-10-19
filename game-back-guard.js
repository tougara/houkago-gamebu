/* Shared browser Back protection for all Houkago game pages.
 * The extra history entry intercepts an accidental Back while an active
 * round is open. The player can resume the same live JS state or explicitly
 * leave; existing game's pagehide autosave remains the source of durability. */
(function(){
  'use strict';
  if(!window.history||!history.pushState||!history.replaceState)return;
  const ROOT='/games/';
  const path=location.pathname;
  const after=path.split('/').filter(Boolean);
  // Standalone 2-player pages have their own save slots, separate from solo games.
  const gameId=after[0]!=='games'?null:
    after[2]==='versus'&&after[1]==='pitadome-challenge'?'pitadome-versus':
    after[2]==='versus'&&after[1]==='link-burst'&&after[3]==='play.html'?'link-burst-versus':
    after[1];
  const defaultExit=path.startsWith('/online/')?'/online/':ROOT;
  const guardFlag='__houkagoBackGuard';
  let manualActive=null,modal=null,leaving=false;
  const dispatch=(name)=>{try{window.dispatchEvent(new CustomEvent(name))}catch(e){}};
  const isActive=()=>{
    if(manualActive!==null)return manualActive;
    if(document.querySelector('.screen-play,.screen-battle,.match-arenas,.screen-discussion'))return true;
    if(gameId&&window.HoukagoResume?.load?.(gameId)?.state)return true;
    // Online lobbies need Back protection while any room is connected.
    if(path.startsWith('/online/')&&document.querySelector('[data-room-code],.online-round,.online-docchi.screen-round'))return true;
    return false;
  };
  function exitPage(discardSave=false){
    leaving=true;
    if(discardSave&&gameId){
      window.HoukagoResume?.discard?.(gameId);
    }else dispatch('houkago-back-guard-save');
    // A deterministic destination avoids returning to the protected same-page entry.
    location.replace(defaultExit);
  }
  function closeModal(continuePlaying=true){
    if(modal){modal.remove();modal=null}
    document.body.classList.remove('hg-back-open');
    // The protective history entry was already restored in popstate.
    if(continuePlaying)dispatch('houkago-back-guard-stay');
    dispatch('houkago-back-guard-close');
  }
  function showModal(){
    if(modal)return;
    dispatch('houkago-back-guard-open');
    const overlay=document.createElement('div');
    overlay.className='hg-back-guard-overlay';
    overlay.innerHTML='<section class="hg-back-guard-dialog" role="alertdialog" aria-modal="true" aria-labelledby="hgBackTitle">'+
      '<h2 id="hgBackTitle">ゲームを中断する？</h2>'+
      '<p>間違えて戻った場合は「ゲームを続ける」を押してね。現在の画面からそのまま再開できるよ。</p>'+
      '<button type="button" class="hg-back-stay">ゲームを続ける</button>'+
      '<button type="button" class="hg-back-leave">途中のセーブを残して戻る</button>'+
      (gameId?'<button type="button" class="hg-back-discard">途中のセーブを削除して戻る</button>':'')+
      '</section>';
    const styleId='hg-back-guard-style';
    if(!document.getElementById(styleId)){
      const st=document.createElement('style');
      st.id=styleId;
      st.textContent='.hg-back-guard-overlay{position:fixed;inset:0;z-index:2147483600;display:grid;place-items:center;padding:22px;background:rgba(3,10,27,.82);font-family:system-ui,sans-serif}.hg-back-guard-dialog{box-sizing:border-box;width:min(460px,100%);padding:24px 18px;border-radius:22px;border:2px solid #f4d477;background:#0c1a34;color:#fff;box-shadow:0 14px 45px #0009;text-align:center}.hg-back-guard-dialog h2{margin:0 0 10px;font-size:clamp(22px,5vw,30px)}.hg-back-guard-dialog p{margin:0 0 19px;font-size:15px;line-height:1.65}.hg-back-guard-dialog button{display:block;box-sizing:border-box;width:100%;min-height:57px;margin-top:10px;border-radius:15px;border:2px solid #fff9;font-size:17px;font-weight:900;color:#14223a}.hg-back-stay{background:linear-gradient(#fff690,#ffb82d)}.hg-back-guard-dialog .hg-back-leave{background:#dfe4ee;border-color:#aab4c9}.hg-back-guard-dialog .hg-back-discard{background:#fff0f1;border-color:#b84a63;color:#922641}.hg-back-guard-dialog button:focus-visible{outline:3px solid #7fdcff;outline-offset:3px}';
      document.head.appendChild(st);
    }
    document.body.appendChild(overlay);
    modal=overlay;
    overlay.querySelector('.hg-back-stay').addEventListener('click',()=>closeModal(true));
    overlay.querySelector('.hg-back-leave').addEventListener('click',()=>{closeModal(false);exitPage(false)});
    overlay.querySelector('.hg-back-discard')?.addEventListener('click',()=>{
      if(!confirm('今の続きのセーブを削除してゲーム一覧へ戻る？'))return;
      closeModal(false);exitPage(true);
    });
    overlay.querySelector('.hg-back-stay')?.focus();
  }
  try{
    history.replaceState(Object.assign({},history.state||{},{[guardFlag]:false}),'',location.href);
    history.pushState(Object.assign({},history.state||{},{[guardFlag]:true}),'',location.href);
  }catch(e){return}
  window.addEventListener('popstate',function(){
    if(leaving)return;
    if(!isActive()){
      leaving=true;
      location.replace(defaultExit);
      return;
    }
    try{history.pushState(Object.assign({},history.state||{},{[guardFlag]:true}),'',location.href)}catch(e){}
    showModal();
  });
  window.addEventListener('pagehide',()=>dispatch('houkago-back-guard-save'));
  window.HoukagoBackGuard={
    setActive:(v)=>{manualActive=typeof v==='boolean'?v:null},
    isActive,close:()=>closeModal(true)
  };
})();