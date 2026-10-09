(function(){
  const api=window.HoukagoPlayers;if(!api)return;
  const resumeApi=window.HoukagoResume;
  const openBtn=document.getElementById('openPlayerRegistry');
  const overlay=document.getElementById('playerRegistryOverlay');
  const closeBtn=document.getElementById('closePlayerRegistry');
  const host=document.getElementById('sharedPlayerEditorHost');
  function render(){
    const data=api.load();
    host.innerHTML=api.renderEditor({
      min:2,max:10,count:data.activeCount,players:data.players,
      title:'参加メンバー',
      subtitle:'名前とアイコンは放課後ゲーム部の全ゲームで共通です',
      doneLabel:'登録をおわる'
    });
  }
  function open(){render();overlay.hidden=false;document.body.classList.add('registry-open')}
  function close(){overlay.hidden=true;document.body.classList.remove('registry-open')}
  openBtn?.addEventListener('click',open);
  closeBtn?.addEventListener('click',close);
  overlay?.addEventListener('click',e=>{
    if(e.target===overlay){close();return}
    const count=e.target.closest('[data-member-count]');
    if(count){api.setActiveCount(Number(count.dataset.memberCount));render();return}
    const icon=e.target.closest('[data-member-icon]');
    if(icon){api.setPlayer(Number(icon.dataset.memberIcon),{icon:icon.dataset.icon});render();return}
    if(e.target.closest('[data-members-done]')){close()}
  });
  overlay?.addEventListener('change',e=>{
    const input=e.target.closest('[data-member-name]');if(!input)return;
    const i=Number(input.dataset.memberName);api.setPlayer(i,{name:input.value||('プレイヤー'+(i+1))});render();
  });
  window.addEventListener('storage',e=>{if(e.key===api.KEY&&!overlay.hidden)render()});
  resumeApi?.mountLatest?.('#homeResumeSlot');
  window.addEventListener('houkago-resume-change',()=>resumeApi?.mountLatest?.('#homeResumeSlot'));
})();