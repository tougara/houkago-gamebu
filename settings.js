(function(){
  const KEY='houkago_common_settings_v1';
  const DEFAULTS={vibration:true,motion:'standard',keepAwake:false};
  let wakeLock=null;

  function normalize(raw){
    const s=raw&&typeof raw==='object'?raw:{};
    return {
      vibration:s.vibration!==false,
      motion:s.motion==='reduced'?'reduced':'standard',
      keepAwake:s.keepAwake===true
    };
  }
  function load(){
    try{return normalize(JSON.parse(localStorage.getItem(KEY)||'{}'))}
    catch(e){return {...DEFAULTS}}
  }
  function apply(settings=load()){
    const root=document.documentElement;
    root.dataset.hgMotion=settings.motion;
    root.dataset.hgVibration=settings.vibration?'on':'off';
    root.dataset.hgKeepAwake=settings.keepAwake?'on':'off';
  }
  function emit(settings){
    window.dispatchEvent(new CustomEvent('houkago-settings-change',{detail:settings}));
  }
  async function requestWakeLock(){
    const s=load();
    if(!s.keepAwake||document.visibilityState!=='visible'||!('wakeLock' in navigator))return false;
    try{
      if(wakeLock)return true;
      wakeLock=await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release',()=>{wakeLock=null},{once:true});
      return true;
    }catch(e){wakeLock=null;return false}
  }
  async function releaseWakeLock(){
    if(!wakeLock)return;
    try{await wakeLock.release()}catch(e){}
    wakeLock=null;
  }
  function save(patch){
    const next=normalize({...load(),...patch});
    try{localStorage.setItem(KEY,JSON.stringify(next))}catch(e){}
    apply(next);
    if(next.keepAwake)requestWakeLock();else releaseWakeLock();
    emit(next);
    refreshModal();
    return next;
  }
  function reset(){
    try{localStorage.removeItem(KEY)}catch(e){}
    const next={...DEFAULTS};
    apply(next);releaseWakeLock();emit(next);refreshModal();
    return next;
  }
  function vibrate(pattern){
    if(!load().vibration||!navigator.vibrate)return false;
    try{return navigator.vibrate(pattern)}catch(e){return false}
  }
  function settingButton(label,key,value,current){
    const selected=current===value;
    return '<button type="button" class="hg-setting-choice '+(selected?'selected':'')+'" data-hg-setting="'+key+'" data-hg-value="'+value+'" aria-pressed="'+selected+'">'+label+'</button>';
  }
  function modalMarkup(){
    const s=load();
    const vibSupported=typeof navigator.vibrate==='function';
    const wakeSupported='wakeLock' in navigator;
    return '<div class="hg-settings-backdrop" data-hg-settings-backdrop>'+
      '<section class="hg-settings-modal" role="dialog" aria-modal="true" aria-labelledby="hgSettingsTitle">'+
        '<header class="hg-settings-head"><div><span>COMMON SETTINGS</span><h2 id="hgSettingsTitle">共通設定</h2><p>ここで変えた設定は、放課後ゲーム部の全ゲームに反映されます。</p></div><button type="button" class="hg-settings-close" data-hg-settings-close aria-label="閉じる">×</button></header>'+
        '<div class="hg-settings-list">'+
          '<section class="hg-setting-card"><div class="hg-setting-copy"><strong>振動フィードバック</strong><span>PERFECTなどの手応えを振動で伝えます。'+(vibSupported?'':' この端末では非対応です。')+'</span></div><div class="hg-setting-options">'+
            '<button type="button" class="hg-setting-choice '+(s.vibration?'selected':'')+'" data-hg-toggle="vibration" data-hg-value="true" '+(vibSupported?'':'disabled')+' aria-pressed="'+s.vibration+'">ON</button>'+
            '<button type="button" class="hg-setting-choice '+(!s.vibration?'selected':'')+'" data-hg-toggle="vibration" data-hg-value="false" '+(vibSupported?'':'disabled')+' aria-pressed="'+(!s.vibration)+'">OFF</button>'+
          '</div></section>'+
          '<section class="hg-setting-card"><div class="hg-setting-copy"><strong>画面演出</strong><span>光・揺れ・アニメーションが苦手なときは「ひかえめ」にできます。</span></div><div class="hg-setting-options">'+
            settingButton('標準','motion','standard',s.motion)+settingButton('ひかえめ','motion','reduced',s.motion)+
          '</div></section>'+
          '<section class="hg-setting-card"><div class="hg-setting-copy"><strong>画面スリープ防止</strong><span>プレイ中に画面が暗くなりにくくします。'+(wakeSupported?'':' この端末では非対応です。')+'</span></div><div class="hg-setting-options">'+
            '<button type="button" class="hg-setting-choice '+(s.keepAwake?'selected':'')+'" data-hg-toggle="keepAwake" data-hg-value="true" '+(wakeSupported?'':'disabled')+' aria-pressed="'+s.keepAwake+'">ON</button>'+
            '<button type="button" class="hg-setting-choice '+(!s.keepAwake?'selected':'')+'" data-hg-toggle="keepAwake" data-hg-value="false" '+(wakeSupported?'':'disabled')+' aria-pressed="'+(!s.keepAwake)+'">OFF</button>'+
          '</div></section>'+
        '</div>'+
        '<div class="hg-settings-note">音量設定は、共通BGM・効果音を導入するときに追加します。今は実際に効果がある設定だけに絞っています。</div>'+
        '<div class="hg-settings-actions"><button type="button" class="hg-settings-reset" data-hg-settings-reset>初期設定にもどす</button><button type="button" class="hg-settings-done" data-hg-settings-close>設定をおわる</button></div>'+
      '</section></div>';
  }
  function open(){
    document.querySelector('[data-hg-settings-backdrop]')?.remove();
    document.body.insertAdjacentHTML('beforeend',modalMarkup());
    document.body.classList.add('hg-settings-open');
  }
  function close(){
    document.querySelector('[data-hg-settings-backdrop]')?.remove();
    document.body.classList.remove('hg-settings-open');
  }
  function refreshModal(){
    if(!document.querySelector('[data-hg-settings-backdrop]'))return;
    close();open();
  }
  function ensureNavButtons(){
    document.querySelectorAll('.top-nav').forEach(nav=>{
      if(nav.querySelector('[data-hg-settings-open]'))return;
      const b=document.createElement('button');
      b.type='button';
      b.className='hg-settings-nav-btn';
      b.setAttribute('data-hg-settings-open','');
      b.setAttribute('aria-label','共通設定');
      b.textContent='⚙';
      nav.appendChild(b);
    });
  }
  function bind(){
    document.addEventListener('click',e=>{
      if(e.target.closest('[data-hg-settings-open]')){open();return}
      if(e.target.closest('[data-hg-settings-close]')){close();return}
      const backdrop=e.target.closest('[data-hg-settings-backdrop]');
      if(backdrop&&e.target===backdrop){close();return}
      const choice=e.target.closest('[data-hg-setting]');
      if(choice){save({[choice.dataset.hgSetting]:choice.dataset.hgValue});return}
      const toggle=e.target.closest('[data-hg-toggle]');
      if(toggle){save({[toggle.dataset.hgToggle]:toggle.dataset.hgValue==='true'});return}
      if(e.target.closest('[data-hg-settings-reset]')){
        if(confirm('共通設定を初期設定にもどしますか？'))reset();
      }
    });
    document.addEventListener('keydown',e=>{if(e.key==='Escape')close()});
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')requestWakeLock()});
    document.addEventListener('pointerdown',()=>{if(load().keepAwake)requestWakeLock()},{passive:true});
    const mo=new MutationObserver(()=>ensureNavButtons());
    mo.observe(document.body,{childList:true,subtree:true});
    ensureNavButtons();
  }

  const API={KEY,DEFAULTS,load,save,reset,apply,vibrate,open,close,requestWakeLock,releaseWakeLock};
  window.HoukagoSettings=API;
  apply();
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
})();