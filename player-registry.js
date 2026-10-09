(function(){
  const KEY='houkago_gamebu_players_v1';
  const ICONS=['🐶','🐱','🐰','🐼','🦊','🐸','🐧','🐯','🐨','🐵','🦁','🐹','👽','🤖','👻'];
  const MIN_COUNT=2,MAX_COUNT=10;
  function clampCount(n){n=Number(n);if(!Number.isFinite(n))n=4;return Math.max(MIN_COUNT,Math.min(MAX_COUNT,Math.round(n)))}
  function fallbackPlayer(i){return {name:'プレイヤー'+(i+1),icon:ICONS[i%ICONS.length]}}
  function cleanPlayer(p,i){const fb=fallbackPlayer(i);const name=String(p&&p.name||'').trim().slice(0,12)||fb.name;const icon=ICONS.includes(p&&p.icon)?p.icon:fb.icon;return {name,icon}}
  function normalize(raw){raw=raw&&typeof raw==='object'?raw:{};const players=[];for(let i=0;i<MAX_COUNT;i++)players.push(cleanPlayer(Array.isArray(raw.players)?raw.players[i]:null,i));return {version:1,activeCount:clampCount(raw.activeCount),players}}
  function load(){try{return normalize(JSON.parse(localStorage.getItem(KEY)||'null'))}catch(e){return normalize(null)}}
  function save(data){const clean=normalize(data);try{localStorage.setItem(KEY,JSON.stringify(clean))}catch(e){}window.dispatchEvent(new CustomEvent('houkago-players-changed',{detail:clean}));return clean}
  function setActiveCount(count){const data=load();data.activeCount=clampCount(count);return save(data)}
  function setPlayer(index,patch){index=Number(index);if(!Number.isInteger(index)||index<0||index>=MAX_COUNT)return load();const data=load();data.players[index]=cleanPlayer(Object.assign({},data.players[index],patch||{}),index);return save(data)}
  function setPlayers(players,activeCount){const current=load();if(Array.isArray(players))players.slice(0,MAX_COUNT).forEach((p,i)=>{current.players[i]=cleanPlayer(p,i)});if(activeCount!=null)current.activeCount=clampCount(activeCount);return save(current)}
  function reset(){try{localStorage.removeItem(KEY)}catch(e){}const data=load();window.dispatchEvent(new CustomEvent('houkago-players-changed',{detail:data}));return data}
  window.HoukagoPlayers={KEY,ICONS,MIN_COUNT,MAX_COUNT,load,save,setActiveCount,setPlayer,setPlayers,reset};
})();