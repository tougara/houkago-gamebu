(function(){
  const api=window.HoukagoPlayers;if(!api)return;
  const resumeApi=window.HoukagoResume;
  const openBtn=document.getElementById('openPlayerRegistry');
  const recordBtn=document.getElementById('openPlayerRecords');
  const overlay=document.getElementById('playerRegistryOverlay');
  const closeBtn=document.getElementById('closePlayerRegistry');
  const host=document.getElementById('sharedPlayerEditorHost');
  let tab='members';

  function updateTabs(){
    document.querySelectorAll('[data-registry-tab]').forEach(b=>b.classList.toggle('selected',b.dataset.registryTab===tab));
  }
  function render(){
    const data=api.load();
    host.innerHTML=tab==='records'
      ? api.renderRecords()
      : api.renderEditor({
          min:2,max:10,count:data.activeCount,
          title:'参加メンバー',
          subtitle:'登録メンバーから、今回遊ぶ人を選べます',
          doneLabel:'登録をおわる'
        });
    updateTabs();
  }
  function open(nextTab='members'){tab=nextTab;render();overlay.hidden=false;document.body.classList.add('registry-open')}
  function close(){overlay.hidden=true;document.body.classList.remove('registry-open')}

  openBtn?.addEventListener('click',()=>open('members'));
  recordBtn?.addEventListener('click',()=>open('records'));
  closeBtn?.addEventListener('click',close);

  overlay?.addEventListener('click',e=>{
    if(e.target===overlay){close();return}
    const tabBtn=e.target.closest('[data-registry-tab]');
    if(tabBtn){tab=tabBtn.dataset.registryTab;render();return}
    const count=e.target.closest('[data-member-count]');
    if(count){api.setActiveCount(Number(count.dataset.memberCount));render();return}
    const icon=e.target.closest('[data-member-icon]');
    if(icon){api.setPlayer(Number(icon.dataset.memberIcon),{icon:icon.dataset.icon});render();return}
    const del=e.target.closest('[data-player-record-delete]');
    if(del){
      const name=del.dataset.playerRecordName||'このメンバー';
      if(confirm(name+'さんのプレイヤー記録を削除しますか？\n登録メンバー自体は削除されません。')){
        api.clearRecord(del.dataset.playerRecordDelete);
        render();
      }
      return;
    }
    if(e.target.closest('[data-members-done]')){close()}
  });
  overlay?.addEventListener('change',e=>{
    const input=e.target.closest('[data-member-name]');if(!input)return;
    const i=Number(input.dataset.memberName);api.setPlayer(i,{name:input.value||('プレイヤー'+(i+1))});render();
  });
  window.addEventListener('houkago-player-selection-changed',()=>{if(!overlay.hidden&&tab==='members')render()});
  window.addEventListener('storage',e=>{if(e.key===api.KEY&&!overlay.hidden)render()});
  resumeApi?.mountLatest?.('#homeResumeSlot');
  window.addEventListener('houkago-resume-change',()=>resumeApi?.mountLatest?.('#homeResumeSlot'));
})();