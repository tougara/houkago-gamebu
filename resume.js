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
  function latest(){
    const list=Object.values(readIndex()).filter(x=>x&&x.path);
    list.sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0));
    return list[0]||null;
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
    '</section>';
    document.body.appendChild(wrap);
    document.body.classList.add('hg-resume-open');
    wrap.querySelector('[data-hg-resume-continue]')?.addEventListener('click',()=>{closeOffer();onResume?.(data.state,data)});
    wrap.querySelector('[data-hg-resume-new]')?.addEventListener('click',()=>{clear(gameId);closeOffer();onNew?.()});
    return true;
  }
  function escapeHtml(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
  function mountLatest(slot){
    const host=typeof slot==='string'?document.querySelector(slot):slot;
    if(!host)return;
    const item=latest();
    host.innerHTML='';
    host.hidden=!item;
    if(!item)return;
    const a=document.createElement('a');
    a.className='hg-resume-home-card';
    a.href=item.path;
    a.innerHTML='<span>▶ つづきから</span><strong>'+escapeHtml(item.title)+'</strong><small>'+escapeHtml(item.summary||'途中のゲーム')+'　'+escapeHtml(formatTime(item.updatedAt))+'</small>';
    host.appendChild(a);
  }
  window.HoukagoResume={PREFIX,INDEX,save,load,clear,latest,offer,mountLatest};
})();