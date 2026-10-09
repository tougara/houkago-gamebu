(function(){
  const KEY='houkago_gamebu_players_v1';
  const ICONS=['🐶','🐱','🐰','🐼','🦊','🐸','🐧','🐯','🐨','🐵','🦁','🐹','🦍','🦄','👻'];
  const MIN_COUNT=2,MAX_COUNT=10;
  function clampCount(n){n=Number(n);if(!Number.isFinite(n))n=4;return Math.max(MIN_COUNT,Math.min(MAX_COUNT,Math.round(n)))}
  function fallbackPlayer(i){return {name:'プレイヤー'+(i+1),icon:ICONS[i%ICONS.length]}}
  function migrateIcon(icon){if(icon==='👽')return'🦍';if(icon==='🤖')return'🦄';return icon}
  function cleanName(v,i){const fb=fallbackPlayer(i);return String(v||'').trim().slice(0,12)||fb.name}
  function normalize(raw){
    raw=raw&&typeof raw==='object'?raw:{};
    const src=Array.isArray(raw.players)?raw.players:[];
    const activeCount=clampCount(raw.activeCount);
    const players=[],usedActive=new Set();
    for(let i=0;i<MAX_COUNT;i++){
      const fb=fallbackPlayer(i);
      const name=cleanName(src[i]&&src[i].name,i);
      let icon=migrateIcon(src[i]&&src[i].icon);
      if(!ICONS.includes(icon))icon=fb.icon;
      if(i<activeCount){
        if(usedActive.has(icon))icon=ICONS.find(x=>!usedActive.has(x))||fb.icon;
        usedActive.add(icon);
      }
      players.push({name,icon});
    }
    return {version:2,activeCount,players};
  }
  function load(){try{return normalize(JSON.parse(localStorage.getItem(KEY)||'null'))}catch(e){return normalize(null)}}
  function save(data){const clean=normalize(data);try{localStorage.setItem(KEY,JSON.stringify(clean))}catch(e){}window.dispatchEvent(new CustomEvent('houkago-players-changed',{detail:clean}));return clean}
  function setActiveCount(count){const data=load();data.activeCount=clampCount(count);return save(data)}
  function setPlayer(index,patch){
    index=Number(index);if(!Number.isInteger(index)||index<0||index>=MAX_COUNT)return load();
    const data=load(),next=Object.assign({},data.players[index],patch||{});
    next.name=cleanName(next.name,index);
    next.icon=migrateIcon(next.icon);
    if(ICONS.includes(next.icon)&&index<data.activeCount){
      const duplicate=data.players.slice(0,data.activeCount).some((p,i)=>i!==index&&p.icon===next.icon);
      if(duplicate)return data;
    }
    data.players[index]=next;
    return save(data);
  }
  function setPlayers(players,activeCount){const current=load();if(Array.isArray(players))players.slice(0,MAX_COUNT).forEach((p,i)=>{current.players[i]=Object.assign({},current.players[i],p||{})});if(activeCount!=null)current.activeCount=clampCount(activeCount);return save(current)}
  function reset(){try{localStorage.removeItem(KEY)}catch(e){}const data=load();window.dispatchEvent(new CustomEvent('houkago-players-changed',{detail:data}));return data}
  function esc(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
  function renderEditor(opts){
    opts=opts||{};
    const min=Math.max(MIN_COUNT,Number(opts.min)||MIN_COUNT);
    const max=Math.min(MAX_COUNT,Number(opts.max)||MAX_COUNT);
    const data=load();
    const count=Math.max(min,Math.min(max,Number(opts.count)||data.activeCount));
    const players=(opts.players||data.players).slice(0,count);
    const used=new Set(players.map(p=>p.icon));
    const title=opts.title||'参加メンバー';
    const subtitle=opts.subtitle||'名前とアイコンは放課後ゲーム部で共通です';
    const doneLabel=opts.doneLabel||'このメンバーで決定';
    const nums=[];for(let n=min;n<=max;n++)nums.push(n);
    return '<section class="shared-player-editor">'+
      '<header class="shared-player-heading"><h1>'+esc(title)+'</h1><p>'+esc(subtitle)+'</p></header>'+
      '<section class="shared-player-card shared-player-count"><h2>遊ぶ人数</h2><div class="shared-count-grid">'+nums.map(n=>'<button type="button" class="shared-count-btn '+(n===count?'selected':'')+'" data-member-count="'+n+'">'+n+'人</button>').join('')+'</div></section>'+
      '<div class="shared-player-list">'+players.map((p,i)=>'<section class="shared-player-card shared-player-row"><div class="shared-player-main"><div class="shared-player-avatar">'+esc(p.icon)+'</div><label><span>'+(i+1)+'人目</span><input data-member-name="'+i+'" maxlength="12" value="'+esc(p.name)+'"></label></div><div class="shared-icon-grid">'+ICONS.map(ic=>'<button type="button" class="shared-icon-btn '+(p.icon===ic?'selected':'')+'" data-member-icon="'+i+'" data-icon="'+esc(ic)+'" '+(p.icon!==ic&&used.has(ic)?'disabled aria-disabled="true"':'')+'>'+esc(ic)+'</button>').join('')+'</div></section>').join('')+'</div>'+
      '<p class="shared-player-note">同じアイコンは2人以上選べません。</p>'+
      '<button type="button" class="shared-player-done" data-members-done>'+esc(doneLabel)+'</button>'+
    '</section>';
  }
  window.HoukagoPlayers={KEY,ICONS,MIN_COUNT,MAX_COUNT,load,save,setActiveCount,setPlayer,setPlayers,reset,renderEditor};
})();