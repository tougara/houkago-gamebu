(function(){
  const KEY='houkago_gamebu_players_v1';
  const ICONS=['🐶','🐱','🐰','🐼','🦊','🐸','🐧','🐯','🐨','🐵','🦁','🐹','🦍','🦄','👻'];
  const MIN_COUNT=2,MAX_COUNT=10,ROSTER_MAX=15;

  function clampCount(n){n=Number(n);if(!Number.isFinite(n))n=4;return Math.max(MIN_COUNT,Math.min(MAX_COUNT,Math.round(n)))}
  function fallbackPlayer(i){return {name:'プレイヤー'+(i+1),icon:ICONS[i%ICONS.length]}}
  function migrateIcon(icon){if(icon==='👽')return'🦍';if(icon==='🤖')return'🦄';return icon}
  function cleanName(v,i){return String(v||'').trim().slice(0,12)||fallbackPlayer(i).name}
  function makeId(i){return 'p'+(i+1)}
  function isCustomized(p,i){const fb=fallbackPlayer(i);return !!p&&(String(p.name||'').trim()!==fb.name||migrateIcon(p.icon)!==fb.icon)}
  function emptyRecord(){return {plays:0,wins:0,lastPlayed:0,games:{}}}

  function migrateV2(raw){
    const src=Array.isArray(raw?.players)?raw.players:[];
    const activeCount=clampCount(raw?.activeCount);
    let keep=activeCount;
    for(let i=activeCount;i<Math.min(src.length,MAX_COUNT);i++)if(isCustomized(src[i],i))keep=i+1;
    keep=Math.max(activeCount,keep);
    const roster=[];
    for(let i=0;i<keep;i++){
      const fb=fallbackPlayer(i),p=src[i]||fb;
      roster.push({id:makeId(i),name:cleanName(p.name,i),icon:ICONS.includes(migrateIcon(p.icon))?migrateIcon(p.icon):fb.icon});
    }
    const activeIds=roster.slice(0,activeCount).map(p=>p.id);
    return {version:3,activeIds,roster,records:{}};
  }
  function normalize(raw){
    raw=raw&&typeof raw==='object'?raw:null;
    if(!raw||raw.version<3||!Array.isArray(raw.roster))raw=migrateV2(raw);
    const roster=[],seenId=new Set(),usedIcons=new Set();
    (raw.roster||[]).slice(0,ROSTER_MAX).forEach((p,i)=>{
      let id=String(p?.id||makeId(i));if(seenId.has(id))id='p_'+Date.now()+'_'+i;seenId.add(id);
      let icon=migrateIcon(p?.icon);if(!ICONS.includes(icon)||usedIcons.has(icon))icon=ICONS.find(x=>!usedIcons.has(x))||ICONS[i%ICONS.length];usedIcons.add(icon);
      roster.push({id,name:cleanName(p?.name,i),icon});
    });
    while(roster.length<MIN_COUNT){
      const i=roster.length,fb=fallbackPlayer(i),icon=ICONS.find(x=>!usedIcons.has(x))||fb.icon;usedIcons.add(icon);
      roster.push({id:makeId(i),name:fb.name,icon});
    }
    let activeIds=Array.isArray(raw.activeIds)?raw.activeIds.map(String).filter((id,i,a)=>a.indexOf(id)===i&&roster.some(p=>p.id===id)):[];
    if(activeIds.length<MIN_COUNT)activeIds=roster.slice(0,Math.max(MIN_COUNT,Math.min(4,roster.length))).map(p=>p.id);
    activeIds=activeIds.slice(0,MAX_COUNT);
    const records={};
    for(const p of roster){
      const r=raw.records?.[p.id]||{};
      records[p.id]={plays:Math.max(0,Number(r.plays)||0),wins:Math.max(0,Number(r.wins)||0),lastPlayed:Number(r.lastPlayed)||0,games:(r.games&&typeof r.games==='object')?r.games:{}};
    }
    return {version:3,activeIds,roster,records};
  }
  function ordered(data){
    const active=data.activeIds.map(id=>data.roster.find(p=>p.id===id)).filter(Boolean);
    const rest=data.roster.filter(p=>!data.activeIds.includes(p.id));
    return [...active,...rest];
  }
  function publicData(data){
    const players=ordered(data);
    return {...data,activeCount:data.activeIds.length,players};
  }
  function load(){try{return publicData(normalize(JSON.parse(localStorage.getItem(KEY)||'null')))}catch(e){return publicData(normalize(null))}}
  function save(data){
    const clean=normalize(data);
    try{localStorage.setItem(KEY,JSON.stringify(clean))}catch(e){}
    const out=publicData(clean);window.dispatchEvent(new CustomEvent('houkago-players-changed',{detail:out}));return out;
  }
  function setActiveCount(count){
    const data=load(),want=clampCount(count);
    while(data.roster.length<want&&data.roster.length<ROSTER_MAX)addPlayerInternal(data);
    let ids=data.activeIds.slice(0,want);
    if(ids.length<want){
      for(const p of data.roster){if(!ids.includes(p.id))ids.push(p.id);if(ids.length>=want)break}
    }
    data.activeIds=ids;return save(data);
  }
  function setActiveIds(ids,{min=MIN_COUNT,max=MAX_COUNT}={}){
    const data=load();const valid=[...new Set((ids||[]).map(String))].filter(id=>data.roster.some(p=>p.id===id)).slice(0,max);
    if(valid.length<min)return data;
    data.activeIds=valid;return save(data);
  }
  function toggleActive(id,{min=MIN_COUNT,max=MAX_COUNT}={}){
    const data=load();id=String(id);
    if(!data.roster.some(p=>p.id===id))return data;
    const on=data.activeIds.includes(id);
    if(on){if(data.activeIds.length<=min)return data;data.activeIds=data.activeIds.filter(x=>x!==id)}
    else{if(data.activeIds.length>=max)return data;data.activeIds.push(id)}
    return save(data);
  }
  function setPlayer(index,patch){
    index=Number(index);const data=load(),list=ordered(data);if(!Number.isInteger(index)||index<0||index>=list.length)return data;
    const id=list[index].id,pos=data.roster.findIndex(p=>p.id===id);if(pos<0)return data;
    const next={...data.roster[pos],...(patch||{})};next.name=cleanName(next.name,pos);next.icon=migrateIcon(next.icon);
    if(ICONS.includes(next.icon)){
      const duplicate=data.roster.some((p,i)=>i!==pos&&p.icon===next.icon);if(duplicate)return data;
    }else next.icon=data.roster[pos].icon;
    data.roster[pos]=next;return save(data);
  }
  function setPlayers(players,activeCount){const data=load();if(Array.isArray(players))players.forEach((p,i)=>{if(i<ordered(data).length)setPlayer(i,p)});return activeCount!=null?setActiveCount(activeCount):load()}
  function addPlayerInternal(data,name){
    if(data.roster.length>=ROSTER_MAX)return null;
    const i=data.roster.length,used=new Set(data.roster.map(p=>p.icon)),icon=ICONS.find(x=>!used.has(x))||ICONS[i%ICONS.length];
    const id='p_'+Date.now().toString(36)+'_'+i;
    const p={id,name:cleanName(name||('プレイヤー'+(i+1)),i),icon};data.roster.push(p);data.records[id]=emptyRecord();return p;
  }
  function addPlayer(name){const data=load();const p=addPlayerInternal(data,name);if(!p)return data;return save(data)}
  function reset(){try{localStorage.removeItem(KEY)}catch(e){}const data=load();window.dispatchEvent(new CustomEvent('houkago-players-changed',{detail:data}));return data}
  function esc(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
  function resolveId(player){
    if(!player)return null;const data=load();
    if(player.id&&data.roster.some(p=>p.id===player.id))return player.id;
    return data.roster.find(p=>p.name===player.name&&p.icon===player.icon)?.id||null;
  }
  function recordGame({gameId,participants=[],winners=[],scores={},metrics={}}={}){
    if(!gameId)return load();const data=load(),winnerSet=new Set(winners.map(x=>typeof x==='string'?x:resolveId(x)).filter(Boolean));
    const ids=[...new Set(participants.map(x=>typeof x==='string'?x:resolveId(x)).filter(Boolean))];
    const now=Date.now();
    for(const id of ids){
      const r=data.records[id]||(data.records[id]=emptyRecord());r.plays++;r.lastPlayed=now;
      const win=winnerSet.has(id);if(win)r.wins++;
      const g=r.games[gameId]||(r.games[gameId]={plays:0,wins:0});g.plays++;if(win)g.wins++;
      const score=Number(scores[id]);if(Number.isFinite(score)){g.bestScore=Math.max(Number(g.bestScore)||0,score);g.lastScore=score}
      const m=metrics[id]||{};
      for(const [k,v] of Object.entries(m)){
        if(!Number.isFinite(Number(v)))continue;
        if(k.startsWith('best'))g[k]=Math.max(Number(g[k])||0,Number(v));
        else if(k.startsWith('total'))g[k]=(Number(g[k])||0)+Number(v);
        else g[k]=Number(v);
      }
    }
    return save(data);
  }
  function clearRecord(id){
    const data=load();id=String(id||'');
    if(!data.roster.some(p=>p.id===id))return data;
    data.records[id]=emptyRecord();
    return save(data);
  }
  function gameLabel(id){return ({'nise-transfer-student':'ニセ転校生','minna-wa-docchi':'みんなはどっち？','kankaku-meter':'感覚メーター','kyokasho-tower':'教科書タワー','gesture-battle':'ジェスチャーバトル','pitadome-challenge':'ピタ止め','link-burst':'リンクバースト！'})[id]||id}
  function renderRecords(){
    const data=load();
    return '<section class="shared-records"><header class="shared-player-heading"><h1>プレイヤー記録</h1><p>登録メンバーごとの放課後ゲーム部の記録です。</p></header>'+
      data.roster.map(p=>{const r=data.records[p.id]||emptyRecord();const games=Object.entries(r.games||{}).filter(([,g])=>g.plays>0).sort((a,b)=>b[1].plays-a[1].plays);
        return '<section class="shared-record-card"><div class="shared-record-head"><span class="shared-record-avatar">'+esc(p.icon)+'</span><div><strong>'+esc(p.name)+'</strong><small>プレイ '+r.plays+'回'+(r.wins?' ／ 勝利・1位 '+r.wins+'回':'')+'</small></div></div>'+
        (games.length?'<div class="shared-record-games">'+games.map(([id,g])=>'<div><span>'+esc(gameLabel(id))+'</span><strong>'+g.plays+'回'+(g.wins?'・勝'+g.wins:'')+(Number.isFinite(g.bestScore)?'・BEST '+g.bestScore:'')+'</strong></div>').join('')+'</div>':'<p class="shared-record-empty">まだプレイ記録がありません。</p>')+
        '<button type="button" class="shared-record-delete" data-player-record-delete="'+esc(p.id)+'" data-player-record-name="'+esc(p.name)+'" '+(r.plays>0?'':'disabled')+'>この記録を削除</button></section>'
      }).join('')+'</section>';
  }
  function renderEditor(opts){
    opts=opts||{};const min=Math.max(MIN_COUNT,Number(opts.min)||MIN_COUNT),max=Math.min(MAX_COUNT,Number(opts.max)||MAX_COUNT);
    let data=load();let count=Math.max(min,Math.min(max,Number(opts.count)||data.activeCount));if(data.activeCount!==count)data=setActiveCount(count);
    const players=data.players.slice(0,data.activeCount),used=new Set(data.roster.map(p=>p.icon));
    const title=opts.title||'参加メンバー',subtitle=opts.subtitle||'名前とアイコンは放課後ゲーム部で共通です',doneLabel=opts.doneLabel||'このメンバーで決定';
    const nums=[];for(let n=min;n<=max;n++)nums.push(n);
    return '<section class="shared-player-editor" data-editor-min="'+min+'" data-editor-max="'+max+'">'+
      '<header class="shared-player-heading"><h1>'+esc(title)+'</h1><p>'+esc(subtitle)+'</p></header>'+
      '<section class="shared-player-card shared-roster-card"><div class="shared-roster-head"><div><h2>登録メンバーから選ぶ</h2><p>外したメンバーも消えません。次回また選べます。</p></div><button type="button" class="shared-add-player" data-member-add>＋ 登録</button></div><div class="shared-roster-grid">'+data.roster.map(p=>'<button type="button" class="shared-roster-chip '+(data.activeIds.includes(p.id)?'selected':'')+'" data-member-pick="'+esc(p.id)+'"><span>'+esc(p.icon)+'</span><strong>'+esc(p.name)+'</strong><small>'+(data.activeIds.includes(p.id)?'参加中':'おやすみ')+'</small></button>').join('')+'</div></section>'+
      '<section class="shared-player-card shared-player-count"><h2>遊ぶ人数</h2><div class="shared-count-grid">'+nums.map(n=>'<button type="button" class="shared-count-btn '+(n===data.activeCount?'selected':'')+'" data-member-count="'+n+'">'+n+'人</button>').join('')+'</div></section>'+
      '<div class="shared-player-list">'+players.map((p,i)=>'<section class="shared-player-card shared-player-row"><div class="shared-player-main"><button type="button" class="shared-player-avatar" data-shared-icon-toggle="'+i+'" aria-label="'+(i+1)+'人目のアイコンを変更">'+esc(p.icon)+'</button><label><span>'+(i+1)+'人目</span><input data-member-name="'+i+'" maxlength="12" value="'+esc(p.name)+'"></label></div><div class="shared-icon-grid" data-shared-icon-grid="'+i+'">'+ICONS.map(ic=>'<button type="button" class="shared-icon-btn '+(p.icon===ic?'selected':'')+'" data-member-icon="'+i+'" data-icon="'+esc(ic)+'" '+(p.icon!==ic&&used.has(ic)?'disabled aria-disabled="true"':'')+'>'+esc(ic)+'</button>').join('')+'</div></section>').join('')+'</div>'+
      '<p class="shared-player-note">登録は最大15人・同じアイコンは使えません。</p><button type="button" class="shared-player-done" data-members-done>'+esc(doneLabel)+'</button></section>';
  }

  if(!window.__houkagoPlayerEditorToggleBound){
    window.__houkagoPlayerEditorToggleBound=true;
    document.addEventListener('click',function(e){
      const add=e.target.closest?.('[data-member-add]');
      if(add){const name=prompt('登録するメンバーの名前を入力してください。');if(name){addPlayer(name);window.dispatchEvent(new CustomEvent('houkago-player-selection-changed'))}return}
      const pick=e.target.closest?.('[data-member-pick]');
      if(pick){const root=pick.closest('.shared-player-editor'),min=Number(root?.dataset.editorMin)||MIN_COUNT,max=Number(root?.dataset.editorMax)||MAX_COUNT;const before=load();const on=before.activeIds.includes(pick.dataset.memberPick);if(on&&before.activeIds.length<=min){alert('このゲームは最低'+min+'人必要です。');return}if(!on&&before.activeIds.length>=max){alert('このゲームは最大'+max+'人です。先に1人外してください。');return}toggleActive(pick.dataset.memberPick,{min,max});window.dispatchEvent(new CustomEvent('houkago-player-selection-changed'));return}
      const btn=e.target.closest?.('[data-shared-icon-toggle]');if(!btn)return;const root=btn.closest('.shared-player-editor');if(!root)return;const id=btn.dataset.sharedIconToggle;
      root.querySelectorAll('[data-shared-icon-grid]').forEach(grid=>grid.classList.toggle('open',grid.dataset.sharedIconGrid===id&&!grid.classList.contains('open')));
    });
  }
  window.HoukagoPlayers={KEY,ICONS,MIN_COUNT,MAX_COUNT,ROSTER_MAX,load,save,setActiveCount,setActiveIds,toggleActive,setPlayer,setPlayers,addPlayer,reset,renderEditor,renderRecords,recordGame,clearRecord,resolveId};
})();