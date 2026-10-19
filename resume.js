(function(){
  const PREFIX='houkago_resume_v1_';
  const INDEX='houkago_resume_index_v1';
  const RUNTIME_KEYS=new Set(['timerId','countdownId','rafId','startDelayId']);

  function replacer(key,value){
    if(RUNTIME_KEYS.has(key))return null;
    if(value instanceof Set)return {__hgType:'Set',value:[...value]};
    if(value instanceof Map)return {__hgType:'Map',value:[...value.entries()]};
    return value;
  }
  function reviver(key,value){
    if(value&&value.__hgType==='Set')return new Set(value.value||[]);
    if(value&&value.__hgType==='Map')return new Map(value.value||[]);
    return value;
  }
  function readIndex(){
    try{const x=JSON.parse(localStorage.getItem(INDEX)||'{}');return x&&typeof x==='object'?x:{}}
    catch(e){return{}}
  }
  function writeIndex(x){try{localStorage.setItem(INDEX,JSON.stringify(x))}catch(e){}}
  function save(gameId,meta,state){
    if(!gameId||!state)return null;
    const now=Date.now();
    const payload={version:1,gameId,updatedAt:now,meta:meta||{},state};
    try{
      localStorage.setItem(PREFIX+gameId,JSON.stringify(payload,replacer));
      const idx=readIndex();
      idx[gameId]={gameId,updatedAt:now,title:meta?.title||gameId,path:meta?.path||'',summary:meta?.summary||''};
      writeIndex(idx);
      window.dispatchEvent(new CustomEvent('houkago-resume-change'));
      return payload;
    }catch(e){return null}
  }
  function load(gameId){
    try{
      const raw=localStorage.getItem(PREFIX+gameId);
      return raw?JSON.parse(raw,reviver):null;
    }catch(e){return null}
  }
  function clear(gameId){
    try{localStorage.removeItem(PREFIX+gameId)}catch(e){}
    const idx=readIndex();delete idx[gameId];writeIndex(idx);
    window.dispatchEvent(new CustomEvent('houkago-resume-change'));
  }
  function savedGames(){
    // 古いインデックスだけ残った「続きから」を表示しない。
    const index=readIndex(),items=[];
    for(const [gameId,item] of Object.entries(index)){
      if(!item?.path||!load(gameId)?.state)continue;
      items.push({...item,gameId});
    }
    items.sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0));
    return items;
  }
  function latest(){return savedGames()[0]||null}
  function clearAll(){
    const index=readIndex();
    try{
      // インデックス破損時も実際の保存データを消せるようにする。
      for(let i=localStorage.length-1;i>=0;i--){
        const key=localStorage.key(i);
        if(key&&(key===INDEX||key.startsWith(PREFIX)))localStorage.removeItem(key);
      }
    }catch(e){
      for(const gameId of Object.keys(index))try{localStorage.removeItem(PREFIX+gameId)}catch(_){}
      try{localStorage.removeItem(INDEX)}catch(_){}
    }
    window.dispatchEvent(new CustomEvent('houkago-resume-change'));
  }
  function formatTime(ts){
    if(!ts)return'';
    try{
      return new Intl.DateTimeFormat('ja-JP',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(ts));
    }catch(e){return''}
  }
  function closeOffer(){
    document.querySelector('[data-hg-resume-backdrop]')?.remove();
    document.body.classList.remove('hg-resume-open');
  }
  function offer({gameId,onResume,onNew}){
    const data=load(gameId);
    if(!data?.state)return false;
    closeOffer();
    const title=data.meta?.title||'途中のゲーム';
    const summary=data.meta?.summary||'前回の続きから再開できます。';
    const wrap=document.createElement('div');
    wrap.className='hg-resume-backdrop';
    wrap.setAttribute('data-hg-resume-backdrop','');
    wrap.innerHTML='<section class="hg-resume-modal" role="dialog" aria-modal="true" aria-labelledby="hgResumeTitle">'+
      '<span class="hg-resume-kicker">CONTINUE</span>'+
      '<h2 id="hgResumeTitle">途中のゲームがあります</h2>'+
      '<div class="hg-resume-game"><strong>'+escapeHtml(title)+'</strong><span>'+escapeHtml(summary)+'</span><small>'+escapeHtml(formatTime(data.updatedAt))+' 保存</small></div>'+
      '<div class="hg-resume-actions"><button type="button" class="hg-resume-new" data-hg-resume-new>最初から</button><button type="button" class="hg-resume-continue" data-hg-resume-continue>つづきから</button></div>'+
      '<button type="button" class="hg-resume-delete" data-hg-resume-delete>この続きのセーブを削除</button>'+
    '</section>';
    document.body.appendChild(wrap);
    document.body.classList.add('hg-resume-open');
    wrap.querySelector('[data-hg-resume-continue]')?.addEventListener('click',()=>{closeOffer();onResume?.(data.state,data)});
    wrap.querySelector('[data-hg-resume-new]')?.addEventListener('click',()=>{
      if(!confirm('前回の続きを消して最初から始める？'))return;
      clear(gameId);closeOffer();onNew?.();
    });
    wrap.querySelector('[data-hg-resume-delete]')?.addEventListener('click',()=>{
      if(!confirm('このゲームの「続きから」セーブを削除する？ この操作は元に戻せないよ。'))return;
      clear(gameId);closeOffer();onNew?.();
    });
    return true;
  }
  function escapeHtml(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
  function mountLatest(slot){
    const host=typeof slot==='string'?document.querySelector(slot):slot;
    if(!host)return;
    const item=latest();
    host.innerHTML='';
    host.hidden=!item;
    host.closest('.hero-action-wrap')?.classList.toggle('hg-has-resume',!!item);
    if(!item)return;
    const a=document.createElement('a');
    a.className='hg-resume-home-card';
    a.href=item.path;
    a.innerHTML='<span>▶ つづきから</span><strong>'+escapeHtml(item.title)+'</strong><small>'+escapeHtml(item.summary||'途中のゲーム')+'　'+escapeHtml(formatTime(item.updatedAt))+'</small>';
    host.appendChild(a);
    const manageBtn=document.createElement('button');
    manageBtn.type='button';manageBtn.className='hg-resume-manage-btn';
    manageBtn.textContent='続きのセーブを管理・削除';
    manageBtn.addEventListener('click',manage);
    host.appendChild(manageBtn);
  }
  function manage(){
    closeOffer();
    document.querySelector('[data-hg-resume-manager]')?.remove();
    const wrap=document.createElement('div');
    wrap.className='hg-resume-backdrop';
    wrap.setAttribute('data-hg-resume-manager','');
    wrap.innerHTML='<section class="hg-resume-modal" role="dialog" aria-modal="true" aria-labelledby="hgManageTitle">'+
      '<span class="hg-resume-kicker">SAVED GAMES</span>'+
      '<h2 id="hgManageTitle">続きのセーブ管理</h2>'+
      '<div class="hg-resume-manager-list"></div>'+
      '<div class="hg-resume-manager-actions"><button type="button" data-hg-manager-close>閉じる</button>'+
      '<button type="button" data-hg-manager-all>全ゲームの続きのセーブを削除</button></div></section>';
    function renderItems(){
      const items=savedGames(),list=wrap.querySelector('.hg-resume-manager-list');
      list.replaceChildren();
      if(!items.length){
        const info=document.createElement('p');info.textContent='保存中の続きはありません。';list.appendChild(info);
      }
      for(const item of items){
        const row=document.createElement('div');row.className='hg-resume-manager-item';
        const label=document.createElement('span');
        label.textContent=item.title+'（'+formatTime(item.updatedAt)+'）';
        const remove=document.createElement('button');remove.type='button';
        remove.textContent='削除';remove.setAttribute('aria-label',item.title+'のセーブを削除');
        remove.addEventListener('click',()=>{
          if(!confirm(item.title+'の続きのセーブを削除する？'))return;
          clear(item.gameId);renderItems();
        });
        row.append(label,remove);list.appendChild(row);
      }
      wrap.querySelector('[data-hg-manager-all]').disabled=!items.length;
    }
    const close=()=>{wrap.remove();document.body.classList.remove('hg-resume-open')};
    wrap.querySelector('[data-hg-manager-close]').addEventListener('click',close);
    wrap.querySelector('[data-hg-manager-all]').addEventListener('click',()=>{
      if(!confirm('すべてのゲームの「続きから」セーブを削除する？ ランキングや登録メンバーは消えないよ。'))return;
      clearAll();renderItems();
    });
    document.body.appendChild(wrap);
    document.body.classList.add('hg-resume-open');renderItems();
    wrap.querySelector('[data-hg-manager-close]').focus();
  }
  window.HoukagoResume={PREFIX,INDEX,save,load,clear,clearAll,savedGames,latest,offer,mountLatest,manage};
})();