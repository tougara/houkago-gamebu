(function(){
  const api=window.HoukagoPlayers;if(!api)return;
  const openBtn=document.getElementById('openPlayerRegistry');
  const overlay=document.getElementById('playerRegistryOverlay');
  const closeBtn=document.getElementById('closePlayerRegistry');
  const finishBtn=document.getElementById('finishPlayerRegistry');
  const countBox=document.getElementById('registryCountChoices');
  const list=document.getElementById('registryPlayerList');
  const summary=document.getElementById('registrySummary');
  let iconTarget=null;
  function esc(v){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
  function render(){
    const data=api.load();
    countBox.innerHTML=Array.from({length:8},(_,i)=>i+3).map(n=>'<button type="button" class="registry-count-btn '+(data.activeCount===n?'selected':'')+'" data-reg-count="'+n+'">'+n+'人</button>').join('');
    list.innerHTML=data.players.slice(0,data.activeCount).map((p,i)=>'<div class="registry-player-card" data-reg-player="'+i+'"><button type="button" class="registry-avatar" data-reg-icon-open="'+i+'" aria-label="'+(i+1)+'人目のアイコンを変更">'+p.icon+'</button><div class="registry-player-main"><label>'+(i+1)+'人目<input data-reg-name="'+i+'" maxlength="12" value="'+esc(p.name)+'"></label><div class="registry-icon-picker '+(iconTarget===i?'open':'')+'">'+api.ICONS.map(ic=>'<button type="button" class="registry-icon-choice '+(p.icon===ic?'selected':'')+'" data-reg-icon="'+i+'" data-icon="'+ic+'">'+ic+'</button>').join('')+'</div></div></div>').join('');
    summary.textContent=data.activeCount+'人分を共通メンバーとして使用します。';
  }
  function open(){iconTarget=null;render();overlay.hidden=false;document.body.classList.add('registry-open')}
  function close(){overlay.hidden=true;document.body.classList.remove('registry-open');iconTarget=null}
  openBtn?.addEventListener('click',open);closeBtn?.addEventListener('click',close);finishBtn?.addEventListener('click',close);
  overlay?.addEventListener('click',e=>{
    if(e.target===overlay){close();return}
    const count=e.target.closest('[data-reg-count]');if(count){api.setActiveCount(Number(count.dataset.regCount));iconTarget=null;render();return}
    const avatar=e.target.closest('[data-reg-icon-open]');if(avatar){const i=Number(avatar.dataset.regIconOpen);iconTarget=iconTarget===i?null:i;render();return}
    const icon=e.target.closest('[data-reg-icon]');if(icon){const i=Number(icon.dataset.regIcon);api.setPlayer(i,{icon:icon.dataset.icon});iconTarget=null;render()}
  });
  overlay?.addEventListener('input',e=>{const input=e.target.closest('[data-reg-name]');if(!input)return;const i=Number(input.dataset.regName);api.setPlayer(i,{name:input.value||('プレイヤー'+(i+1))});summary.textContent=api.load().activeCount+'人分を共通メンバーとして使用します。'});
  window.addEventListener('storage',e=>{if(e.key===api.KEY&&!overlay.hidden)render()});
})();