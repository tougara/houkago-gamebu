const SIDE_DEFS={
  real:{label:'ホンモノサイド'},
  fake:{label:'ニセモノサイド'},
  trick:{label:'クセモノサイド'}
};
const ROLE_DEFS={
  classmate:{name:'クラスメイト',side:'real',image:'../../role_classmate.png',max:10,desc:'特別な能力はありません。話し合いからニセ転校生を見つけます。'},
  fake:{name:'ニセ転校生',side:'fake',image:'../../role_fake_transfer_student.png',max:3,desc:'休み時間にほかのニセ転校生がいるかどうか確認します。最終投票でニセ転校生が1人も判定対象にならなければ、ニセモノサイドの勝利です。'},
  president:{name:'学級委員',side:'real',image:'../../role_class_representative.png',max:1,desc:'休み時間に「プレイヤー1人の役職を見る」か「お休みのカード2枚を見る」のどちらかを選びます。'},
  dayDuty:{name:'日直',side:'real',image:'../../role_day_duty.png',max:1,desc:'休み時間に、おやすみカード2枚のうち好きな1枚だけ確認できます。'},
  swapper:{name:'席替え係',side:'real',image:'../../role_seat_changer.png',max:1,desc:'休み時間にプレイヤー1人を選び、自分の役職カードと入れ替えます。交換しないこともできます。入れ替えた場合は新しい役職を確認し、その役職になります。'},
  observer:{name:'観察係',side:'real',image:'../../role_observer.png',max:1,desc:'休み時間にプレイヤー2人を選び、その2人が同じ陣営か違う陣営かを確認します。'},
  collaborator:{name:'秘密の協力者',side:'fake',image:'../../role_secret_collaborator.png',max:1,desc:'ニセモノサイドですが、ニセ転校生そのものではありません。ニセ転校生が見つからなければ一緒に勝利します。誰がニセ転校生かは知りません。'},
  trickster:{name:'いたずらっ子',side:'trick',image:'../../role_trickster.png',max:1,desc:'クセモノサイドです。休み時間の行動はありません。最終投票で自分が最多票の判定対象になれば、クセモノサイドの単独勝利です。'}
};
const PLAYER_ICONS=window.HoukagoPlayers?.ICONS||['🐶','🐱','🐰','🐼','🦊','🐸','🐧','🐯','🐨','🐵','🦁','🐹','🦍','🦄','👻'];
const SHARED_PLAYERS=window.HoukagoPlayers?.load?.()||null;
const BASIC_ROLE_KEYS=['classmate','fake','president','swapper'];
const ADVANCED_ROLE_KEYS=['observer','dayDuty','collaborator','trickster'];
const roleKeys=[...BASIC_ROLE_KEYS,...ADVANCED_ROLE_KEYS];
const ROLE_HELP_KEYS=['classmate','president','swapper','observer','dayDuty','fake','collaborator','trickster'];
const app=document.getElementById('app');
app.addEventListener('click',e=>{const trigger=e.target.closest('[data-role-detail]');if(!trigger)return;e.preventDefault();e.stopPropagation();openModal('roleDetail:'+trigger.dataset.roleDetail);});
const state={screen:'title',playerCount:SHARED_PLAYERS?.activeCount||3,players:[],roleCounts:{},deck:[],rest:[],initialRoles:[],finalRoles:[],revealIndex:0,nightIndex:0,voteIndex:0,votes:[],coverNext:null,timerSeconds:180,timerRemaining:180,timerId:null,modal:null,roleHelpSide:'real',ruleHelpMode:'simple',navHistory:[],gameStarted:false};
function esc(v){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function shuffle(a){a=[...a];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function needCards(){return state.playerCount+2;} function totalCards(){return Object.values(state.roleCounts).reduce((a,b)=>a+b,0);} function sideLabel(r){const side=ROLE_DEFS[r]?.side;return SIDE_DEFS[side]?.label||'不明なサイド';}
function roleMin(k){return k==='fake'?2:0;} function roleMax(k){return k==='fake'?(state.playerCount>=6?3:2):ROLE_DEFS[k].max;} function formatTime(s){return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;}
function ensurePlayers(){const shared=window.HoukagoPlayers?.load?.();while(state.players.length<state.playerCount){const i=state.players.length;const used=new Set(state.players.map(p=>p.icon));const saved=shared?.players?.[i];const fallbackIcon=PLAYER_ICONS.find(x=>!used.has(x))||PLAYER_ICONS[i%PLAYER_ICONS.length];state.players.push({name:saved?.name||`プレイヤー${i+1}`,icon:(saved?.icon&&!used.has(saved.icon))?saved.icon:fallbackIcon});}state.players=state.players.slice(0,state.playerCount);}
function setBaseRoles(){const c={classmate:0,fake:2,president:0,dayDuty:0,observer:0,swapper:0,collaborator:0,trickster:0};let r=needCards()-2;for(const k of ['president','swapper']){if(r>0){c[k]=1;r--;}}c.classmate=r;state.roleCounts=c;}
function boardCardBack(label,attrs){
  label=label||''; attrs=attrs||'';
  return '<div class="table-card-wrap '+(attrs?'table-card-selectable':'')+'" '+attrs+'><div class="table-card table-card-back"><div class="table-card-mark">?</div></div>'+(label?'<div class="table-card-name">'+esc(label)+'</div>':'')+'</div>';
}
function boardRoleCard(role,label,extra,attrs){
  const d=ROLE_DEFS[role]; label=label||''; extra=extra||''; attrs=attrs||'';
  const detailAttrs=attrs?'':'data-role-detail="'+role+'"';
  const detailClass=attrs?'':' role-card-detail-trigger';
  return '<div class="table-card-wrap '+extra+' '+(attrs?'table-card-selectable':'')+detailClass+'" '+attrs+' '+detailAttrs+'><div class="table-card table-card-face"><img src="'+d.image+'" alt="'+esc(d.name)+'"></div>'+(label?'<div class="table-card-name">'+esc(label)+'</div>':'')+'<div class="table-card-role">'+esc(d.name)+'</div></div>';
}
function gameBoard(opts){
  opts=opts||{};
  const roles=opts.useFinal?state.finalRoles:state.initialRoles;
  const facePlayers=Array.isArray(opts.facePlayers)?opts.facePlayers:(Number.isInteger(opts.facePlayer)?[opts.facePlayer]:[]);
  const partnerPlayers=Array.isArray(opts.partnerPlayers)?opts.partnerPlayers:[];
  const swapPlayers=Array.isArray(opts.swapPlayers)?opts.swapPlayers:[];
  const expelledPlayers=Array.isArray(opts.expelledPlayers)?opts.expelledPlayers:[];
  const clickablePlayers=Array.isArray(opts.clickablePlayers)?opts.clickablePlayers:null;
  const faceRest=Array.isArray(opts.faceRest)?opts.faceRest:[];
  const restHtml=state.rest.map(function(r,i){
    const attrs=opts.restAction?'data-'+opts.restAction+'="'+i+'"':'';
    const showRest=opts.revealRest||faceRest.includes(i);
    return showRest?boardRoleCard(r,'おやすみ'+(i+1),'',attrs):boardCardBack('おやすみ'+(i+1),attrs);
  }).join('');
  const playersHtml=state.players.map(function(p,i){
    const show=opts.revealAll||facePlayers.includes(i);
    let extra='';
    if(opts.selfPlayer===i||opts.facePlayer===i)extra='table-card-current';
    else if(partnerPlayers.includes(i))extra='table-card-partner';
    else if(swapPlayers.includes(i))extra='table-card-swap';
    if(expelledPlayers.includes(i))extra+=(extra?' ':'')+'table-card-expelled';
    const canClick=opts.playerAction&&(!clickablePlayers||clickablePlayers.includes(i));
    const attrs=canClick?'data-'+opts.playerAction+'="'+i+'"':'';
    return show?boardRoleCard(roles[i],p.name,extra,attrs):boardCardBack(p.name,attrs);
  }).join('');
  const cols=state.playerCount<=5?state.playerCount:(state.playerCount===6?3:(state.playerCount<=8?4:5));
  const density=state.playerCount>=9?' board-very-dense':(state.playerCount>=7?' board-dense':(state.playerCount>=5?' board-medium':''));
  return '<div class="table-board'+density+'" style="--player-cols:'+cols+'"><div class="table-zone"><div class="table-zone-title">おやすみ</div><div class="table-card-row table-rest-row">'+restHtml+'</div></div><div class="table-zone"><div class="table-zone-title">参加者</div><div class="table-card-row table-player-row">'+playersHtml+'</div></div></div>';
}

function topNav(){return `<div class="top-nav"><button type="button" class="back-home" id="stepBack">← 1個前にもどる</button><button type="button" class="back-home top-home-link" id="goTop">ゲームをえらぶ</button></div>`;} function brand(){return `<img class="game-brand" src="../../nise_transfer_student_logo.png" alt="ニセ転校生を探せ！">`;} function heading(t,s=''){return `<h1 class="title">${t}</h1>${s?`<p class="subtitle">${s}</p>`:''}`;} function helpButtons(){return `<div class="topbar"><button class="btn secondary" data-open="roles">役職確認</button><button class="btn secondary" data-open="reg">レギュ確認</button></div>`;}
function stopTimer(){if(state.timerId){clearInterval(state.timerId);state.timerId=null;}}
function go(s){stopTimer();if(state.screen!==s)state.navHistory.push(state.screen);state.screen=s;render();}
function backOne(){stopTimer();if(state.navHistory.length){state.screen=state.navHistory.pop();render();}else{window.location.href='../';}}
function doNavAction(type){if(type==='back')backOne();else window.location.href='../';}
function confirmNav(type){
  if(!state.gameStarted){doNavAction(type);return;}
  document.querySelector('.nav-confirm-backdrop')?.remove();
  const timerWasRunning=!!state.timerId;
  if(timerWasRunning)stopTimer();
  const wrap=document.createElement('div');
  wrap.className='modal-backdrop nav-confirm-backdrop';
  const isTop=type==='top';
  const cancel=()=>{wrap.remove();if(timerWasRunning&&state.screen==='discussion')toggleTimer();};
  wrap.innerHTML=`<div class="modal nav-confirm-modal"><h2>ほんとにもどる？</h2><p>${isTop?'ゲームを途中でやめて、ゲームをえらぶ画面へもどります。':'ゲームの途中です。1個前の画面にもどります。'}</p><div class="grid2"><button type="button" class="btn secondary" id="cancelNav">ゲームにもどる</button><button type="button" class="btn danger" id="confirmNav">ほんとにもどる</button></div></div>`;
  document.body.appendChild(wrap);
  document.getElementById('cancelNav').addEventListener('click',cancel);
  document.getElementById('confirmNav').addEventListener('click',()=>{wrap.remove();doNavAction(type);});
  wrap.addEventListener('click',e=>{if(e.target===wrap)cancel();});
}
function confirmCardChoice(title,message,onConfirm){
  document.querySelector('.card-choice-confirm')?.remove();
  const wrap=document.createElement('div');
  wrap.className='modal-backdrop card-choice-confirm';
  wrap.innerHTML=`<div class="modal card-choice-modal"><h2>${title}</h2><p>${message}</p><div class="grid2"><button type="button" class="btn secondary" id="cancelCardChoice">選びなおす</button><button type="button" class="btn" id="confirmCardChoice">このカードで決定</button></div></div>`;
  document.body.appendChild(wrap);
  document.getElementById('cancelCardChoice').addEventListener('click',()=>wrap.remove());
  document.getElementById('confirmCardChoice').addEventListener('click',()=>{wrap.remove();onConfirm();});
  wrap.addEventListener('click',e=>{if(e.target===wrap)wrap.remove();});
}
function render(){app.className='game-app'+((state.screen==='voteComplete'||state.screen==='result')?' classroom-result-bg':'');app.innerHTML=screenHtml();bind();if(state.modal)renderModal();}
function screenHtml(){return ({title:titleScreen,count:countScreen,players:playersScreen,roles:rolesScreen,revealPass:revealPassScreen,revealRole:revealRoleScreen,cover:coverScreen,nightIntro:nightIntroScreen,nightPass:nightPassScreen,nightAction:nightActionScreen,discussion:discussionScreen,votePass:votePassScreen,vote:voteScreen,voteComplete:voteCompleteScreen,result:resultScreen}[state.screen]||(()=>`${topNav()}<div class="card">画面エラー</div>`))();}
function titleScreen(){return `${topNav()}<div class="card game-title-card">${brand()}<p class="subtitle">クラスにまぎれたニセ転校生を見つけよう！</p><div class="stack"><button class="btn yellow full" id="startSetup">ゲームをはじめる</button><button class="btn rules-button full" data-open="rules">あそびかた</button><button class="btn secondary full" data-open="roles">役職をみる</button></div></div>`;}
function countScreen(){return `${topNav()}${brand()}${heading('何人で遊ぶ？','3〜10人に対応')}<div class="card stack"><div class="grid3">${[3,4,5,6,7,8,9,10].map(n=>`<button class="btn choice ${state.playerCount===n?'selected':''}" data-count="${n}">${n}人</button>`).join('')}</div><button class="btn full" id="toPlayers">つぎへ</button></div>`;}
function playersScreen(){
  ensurePlayers();
  return topNav()+window.HoukagoPlayers.renderEditor({
    min:3,
    max:10,
    count:state.playerCount,
    players:state.players,
    title:'参加メンバー',
    subtitle:'名前とアイコンは放課後ゲーム部で共通です',
    doneLabel:'このメンバーで決定'
  });
}
function rolesScreen(){
  const fakeCount=state.roleCounts.fake;
  const fakeValid=fakeCount>=2&&fakeCount<=roleMax('fake');
  const valid=totalCards()===needCards()&&fakeValid;
  const fakeNote=state.playerCount>=6?'ニセ転校生はおすすめ2人。6人以上は3人まで設定できます。':'ニセ転校生は2人固定です。';
  const roleRow=k=>{
    const d=ROLE_DEFS[k];
    return '<div class="role-row">'
      +'<button type="button" class="role-thumb-button" data-role-detail="'+k+'" aria-label="'+d.name+'の詳細を見る"><img class="role-thumb" src="'+d.image+'" alt=""></button>'
      +'<div class="role-info"><div class="role-title">'+d.name+'</div><span class="side-tag '+d.side+'">'+sideLabel(k)+'</span></div>'
      +'<div class="role-count-controls">'
      +'<button class="btn secondary role-step" data-role-minus="'+k+'" '+(state.roleCounts[k]<=roleMin(k)?'disabled':'')+' aria-label="'+d.name+'を1枚減らす">−</button>'
      +'<span class="count">'+state.roleCounts[k]+'</span>'
      +'<button class="btn secondary role-step" data-role-plus="'+k+'" '+(state.roleCounts[k]>=roleMax(k)?'disabled':'')+' aria-label="'+d.name+'を1枚増やす">＋</button>'
      +'</div>'
      +'</div>';
  };
  return topNav()
    +heading('使用する役職','人数＋お休み2枚ぶんのカードを選ぶ')
    +'<div class="card"><div class="section-row"><div><h2>参加メンバー</h2><p>'+state.playerCount+'人で遊びます</p></div><button class="small-btn" id="editPlayersFromRoles">変更</button></div><div class="member-chips">'+state.players.map(p=>'<span class="member-chip">'+esc(p.icon)+' '+esc(p.name)+'</span>').join('')+'</div></div>'
    +'<div class="card role-select-card">'
    +'<div class="note '+(valid?'success':'warning')+'">必要：'+needCards()+'枚 ／ 現在：'+totalCards()+'枚<br>'+fakeNote+'<br><span class="auto-balance-note">役職を増減すると、クラスメイトが自動で人数調整されます。</span></div>'
    +'<div class="role-reg-group basic"><div class="role-reg-heading"><div><strong>基本レギュ</strong><span>まずはここから</span></div><span class="role-reg-badge">おすすめ</span></div>'
    +BASIC_ROLE_KEYS.map(roleRow).join('')
    +'</div>'
    +'<div class="role-reg-group advanced"><div class="role-reg-heading"><div><strong>応用レギュ</strong><span>慣れてきたら追加</span></div><span class="role-reg-badge">アレンジ</span></div>'
    +ADVANCED_ROLE_KEYS.map(roleRow).join('')
    +'</div></div>'
    +'<div class="row role-select-actions"><button class="btn secondary" id="backPlayers">戻る</button><button class="btn '+(valid?'':'role-deal-disabled')+'" id="dealRoles" '+(valid?'':'disabled')+'>'+ (valid?'役職を配る':'枚数を合わせてください') +'</button></div>';
}
function revealPassScreen(){const p=state.players[state.revealIndex];return topNav()+heading('役職確認',(state.revealIndex+1)+' / '+state.playerCount)+gameBoard()+ '<div class="privacy-screen role-pass-panel"><div><div class="avatar large">'+p.icon+'</div><h2>'+esc(p.name)+'さんに<br>スマホを渡してください</h2><p>ほかの人は画面を見ないでね。</p><button class="btn yellow hold" id="holdReveal">長押しして役職を見る</button></div></div>';}
function revealRoleScreen(){const r=state.initialRoles[state.revealIndex],d=ROLE_DEFS[r];return topNav()+heading('あなたの役職',(state.revealIndex+1)+' / '+state.playerCount)+gameBoard({facePlayer:state.revealIndex})+'<div class="card role-reveal role-detail-under-board"><span class="side-tag '+d.side+'">'+sideLabel(r)+'</span><p class="role-desc">'+d.desc+'</p><button class="btn full" id="startRoleAction">このまま休み時間の行動へ</button></div>';}
function coverScreen(){return `${topNav()}<div class="privacy-screen"><div><h2>画面を伏せてください</h2><p>内容が見えない状態にしてから、次の人へ渡そう。</p><button class="btn yellow" id="coverNext">次へ</button></div></div>`;}
function nightIntroScreen(){return `${topNav()}${helpButtons()}${heading('休み時間','1人ずつ自分だけで確認します')}${gameBoard({useFinal:true})}<div class="card stack"><p>休み時間の処理は <strong>①ニセ転校生 → ②学級委員・観察係・日直 → ③席替え係</strong> の情報関係になるよう処理します。</p><div class="note">クラスメイト・秘密の協力者・いたずらっ子には休み時間の行動はありません。</div><button class="btn" id="beginNight">休み時間を始める</button></div>`;}
function nightPassScreen(){const p=state.players[state.nightIndex];return `${topNav()}${heading('休み時間の行動',`${state.nightIndex+1} / ${state.playerCount}`)}${gameBoard({useFinal:true})}<div class="privacy-screen"><div><div class="avatar large">${p.icon}</div><h2>${esc(p.name)}さんに<br>スマホを渡してください</h2><p>自分の名前を確認してから進んでね。</p><button class="btn yellow hold" id="holdNight">長押しして行動を確認</button></div></div>`;}
function nightActionScreen(){
  const i=state.nightIndex,r=state.initialRoles[i],d=ROLE_DEFS[r];
  let body='';
  let facePlayers=[i];
  let partnerPlayers=[];
  if(r==='classmate'||r==='collaborator'||r==='trickster'){
    body=`<div class="card role-reveal"><span class="night-role ${d.side}">${d.name}</span><img class="role-card-large role-detail-trigger" data-role-detail="${r}" src="${d.image}" alt="${d.name}"><h2>休み時間の行動はありません</h2><button class="btn full" id="nightDone">確認した</button></div>`;
  }else if(r==='fake'){
    partnerPlayers=state.initialRoles.map((x,j)=>j!==i&&x==='fake'?j:-1).filter(j=>j>=0);
    facePlayers=[i,...partnerPlayers];
    const partnerText=partnerPlayers.length
      ? `相方は <strong>${partnerPlayers.map(j=>esc(state.players[j].name)).join('、')}</strong> さんです。`
      : 'ほかのプレイヤーにニセ転校生はいません。';
    body=`<div class="card role-reveal"><span class="night-role fake">ニセ転校生</span><img class="role-card-large role-detail-trigger" data-role-detail="fake" src="${d.image}" alt="ニセ転校生"><h2>${partnerPlayers.length?'ニセ転校生の相方を確認':'今回は1人です'}</h2><p class="role-desc">${partnerText}</p><button class="btn full" id="nightDone">確認した</button></div>`;
  }else if(r==='president'){
    body=`<div class="card stack"><h2>学級委員</h2><p>見たいカードを直接タップしてください。</p><div class="note">参加者カードをタップ → その1人の役職を確認<br>おやすみカードをどちらかタップ → おやすみ2枚を両方確認</div></div>`;
  }else if(r==='dayDuty'){
    body=`<div class="card stack"><h2>日直</h2><p>上のおやすみカードから、確認したい1枚をタップしてください。</p><div class="note">確認できるのは、おやすみ2枚のうち1枚だけです。</div></div>`;
  }else if(r==='observer'){
    body=`<div class="card stack observer-action-card"><h2>観察係</h2><p>上の参加者カードから、確認したい2人をタップしてください。</p><div class="note">選んだカードは青く表示されます。2人選ぶと確認できます。</div><div id="observerStatus" class="observer-status">0 / 2人選択</div><button class="btn full" id="observerCheck" disabled>2人を確認する</button></div>`;
  }else if(r==='swapper'){
    body=`<div class="card stack"><h2>席替え係</h2><p>交換したい相手のカードを直接タップしてください。</p><div class="note">カードをタップしたあと、確認画面が出ます。</div><button class="btn secondary" id="noSwap">交換しない</button></div>`;
  }
  const clickablePlayers=(r==='president'||r==='observer'||r==='swapper')?state.players.map((_,j)=>j).filter(j=>j!==i):null;
  const boardOpts={useFinal:false,facePlayers,selfPlayer:i,partnerPlayers};
  if(r==='president'){boardOpts.playerAction='pres-card';boardOpts.restAction='pres-rest';boardOpts.clickablePlayers=clickablePlayers;}
  if(r==='dayDuty'){boardOpts.restAction='day-duty-rest';}
  if(r==='observer'){boardOpts.playerAction='observer-card';boardOpts.clickablePlayers=clickablePlayers;}
  if(r==='swapper'){boardOpts.playerAction='swap-card';boardOpts.clickablePlayers=clickablePlayers;}
  return `${topNav()}${helpButtons()}${heading(`${esc(state.players[i].name)}さんの休み時間`)}${gameBoard(boardOpts)}${body}`;
}
function discussionScreen(){return topNav()+helpButtons()+heading('話し合い','ニセ転校生は誰？')+gameBoard({useFinal:true})+'<div class="card"><div id="timer" class="timer timer-large '+(state.timerRemaining<=10?'low':'')+'">'+formatTime(state.timerRemaining)+'</div><button class="btn timer-start-button full" id="timerToggle">'+(state.timerId?'一時停止':'スタート')+'</button><div class="timer-adjust-grid"><button class="btn secondary" id="minus60">−1分</button><button class="btn secondary" id="plus60">＋1分</button><button class="btn secondary" id="minus10">−10秒</button><button class="btn secondary" id="plus10">＋10秒</button></div></div><button class="btn danger full" id="toVote">投票へ</button>';}
function votePassScreen(){const p=state.players[state.voteIndex];return topNav()+heading('秘密投票',(state.voteIndex+1)+' / '+state.playerCount)+gameBoard({useFinal:true})+'<div class="privacy-screen vote-pass-panel"><div><div class="avatar large">'+p.icon+'</div><h2>'+esc(p.name)+'さんに<br>スマホを渡してください</h2><p>投票内容はほかの人に見せないでね。</p><button class="btn yellow hold" id="holdVote">長押しして投票</button></div></div>';}
function voteScreen(){const v=state.voteIndex,targets=state.players.map((_,i)=>i).filter(i=>i!==v);return topNav()+heading(esc(state.players[v].name)+'さんの投票','投票したい人のカードをタップしてください')+gameBoard({useFinal:true,playerAction:'vote-card',clickablePlayers:targets})+'<div class="card vote-card-guide"><p>カードをタップしたあと、確認画面が出ます。</p></div>';}
function voteCompleteScreen(){
  return topNav()+'<div class="vote-complete-wrap"><div class="vote-complete-card"><div class="vote-complete-icon">✓</div><h1>投票が終わりました</h1><p>全員の投票が完了しました。<br>結果を確認しましょう。</p><button class="btn yellow full vote-result-button" id="showResult">結果を表示</button></div></div>';
}
function calcResult(){const counts=Array(state.playerCount).fill(0);state.votes.forEach(v=>counts[v]++);const max=Math.max(...counts);const expelled=max<=1?[]:counts.map((c,i)=>c===max?i:-1).filter(i=>i>=0);const tricksterIndex=expelled.find(i=>state.finalRoles[i]==='trickster');if(Number.isInteger(tricksterIndex))return{kind:'trick',winner:'クセモノサイド勝利！',reason:state.players[tricksterIndex].name+'さんのいたずらっ子が最多票の判定対象になりました。',logo:'../../result_kusemono_side_win.png',expelled,max,tricksterIndex};const fakeExists=state.finalRoles.includes('fake'),fakeExpelled=expelled.some(i=>state.finalRoles[i]==='fake');if(!fakeExists&&expelled.length===0)return{kind:'peace',winner:'平和なクラス！',reason:'ニセ転校生がいないことを見抜き、だれも処刑されませんでした。',logo:'../../result_peaceful_class.png',expelled,max};const realWin=fakeExists&&fakeExpelled;return{kind:realWin?'real':'fake',winner:realWin?'ホンモノサイド勝利！':'ニセモノサイド勝利！',reason:fakeExists?(fakeExpelled?'ニセ転校生を見つけました。':'ニセ転校生が正体を隠し切りました。'):'ニセ転校生がいないのに、だれかが処刑されました。',logo:realWin?'../../result_honmono_side_win.png':'../../result_nisemono_side_win.png',expelled,max};}
function resultScreen(){const r=calcResult(),names=r.expelled.length?r.expelled.map(function(i){return state.players[i].name;}).join('、'):'だれも選ばれませんでした';const voteDetails=state.players.map(function(voter,i){const targetIndex=state.votes[i],target=state.players[targetIndex];return '<div class="vote-detail-row"><div class="vote-detail-person"><span class="avatar">'+voter.icon+'</span><strong>'+esc(voter.name)+'</strong></div><div class="vote-detail-arrow">→</div><div class="vote-detail-person target"><span class="avatar">'+target.icon+'</span><strong>'+esc(target.name)+'</strong></div></div>';}).join('');const resultMark='<img class="result-logo" src="'+r.logo+'" alt="'+r.winner+'">';return topNav()+'<div class="card result-hero result-'+r.kind+'">'+resultMark+'<p class="result-reason">'+esc(r.reason)+'</p></div>'+gameBoard({useFinal:true,revealAll:true,revealRest:true,expelledPlayers:r.expelled})+'<div class="card"><h2>投票結果</h2><p>最多票：'+r.max+'票</p><p><strong>'+esc(names)+'</strong></p><div class="vote-detail-list"><h3>誰が誰に投票した？</h3>'+voteDetails+'</div></div><div class="stack"><button class="btn full" id="restartSame">もう一回遊ぶ</button><button class="btn secondary full" id="restartRoles">役職を選び直す</button></div>';}
function startGame(){const d=[];Object.entries(state.roleCounts).forEach(([r,n])=>{for(let i=0;i<n;i++)d.push(r);});state.deck=shuffle(d);state.initialRoles=state.deck.slice(0,state.playerCount);state.finalRoles=[...state.initialRoles];state.rest=state.deck.slice(state.playerCount);state.revealIndex=state.nightIndex=state.voteIndex=0;state.votes=[];state.timerRemaining=state.timerSeconds;state.gameStarted=true;go('revealPass');}
function queueCover(n){state.coverNext=null;if(n==='revealNext')nextReveal();else if(n==='nightNext')nextNight();else if(n==='voteNext')nextVote();} function nextReveal(){if(++state.revealIndex>=state.playerCount){state.timerRemaining=state.timerSeconds;go('discussion');}else go('revealPass');} function nextNight(){if(++state.nightIndex>=state.playerCount){state.timerRemaining=state.timerSeconds;go('discussion');}else go('nightPass');} function nextVote(){if(++state.voteIndex>=state.playerCount)go('voteComplete');else go('votePass');}
function openModal(t){state.modal=t;if(t==='roles')state.roleHelpSide='real';if(t==='rules')state.ruleHelpMode='simple';renderModal();} function closeModal(){document.querySelector('.modal-backdrop')?.remove();state.modal=null;}function openRuleRoleDetail(k){
  const d=ROLE_DEFS[k];
  if(!d)return;
  document.querySelector('.rule-role-detail-backdrop')?.remove();
  const w=document.createElement('div');
  w.className='modal-backdrop rule-role-detail-backdrop';
  w.innerHTML=`<div class="modal rule-role-detail-modal"><div class="role-detail-modal"><img class="role-detail-image" id="ruleRoleDetailImage" src="${d.image}" alt="${d.name}" role="button" tabindex="0" aria-label="もう一度タップして戻る"><h2>${d.name}</h2><span class="side-tag ${d.side}">${sideLabel(k)}</span><p>${d.desc}</p></div><button class="btn full" id="closeRuleRoleDetail">くわしいルールにもどる</button></div>`;
  document.body.appendChild(w);
  const close=()=>w.remove();
  document.getElementById('ruleRoleDetailImage')?.addEventListener('click',close);
  document.getElementById('ruleRoleDetailImage')?.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();close();}});
  document.getElementById('closeRuleRoleDetail')?.addEventListener('click',close);
  w.addEventListener('click',e=>{if(e.target===w)close();});
}function renderModal(){document.querySelector('.modal-backdrop')?.remove();const w=document.createElement('div');w.className='modal-backdrop';let content='';if(state.modal?.startsWith('roleDetail:')){const k=state.modal.split(':')[1],d=ROLE_DEFS[k];content=`<div class="role-detail-modal"><img class="role-detail-image" id="roleDetailImage" src="${d.image}" alt="${d.name}" role="button" tabindex="0" aria-label="もう一度タップして戻る"><h2>${d.name}</h2><span class="side-tag ${d.side}">${sideLabel(k)}</span><p>${d.desc}</p></div>`;}else if(state.modal==='roles'){const availableSides=Object.keys(SIDE_DEFS).filter(side=>roleKeys.some(k=>ROLE_DEFS[k].side===side));if(!availableSides.includes(state.roleHelpSide))state.roleHelpSide=availableSides[0]||'real';content=`<h2>役職の内容</h2><div class="role-side-tabs" style="--side-count:${availableSides.length}">${availableSides.map(side=>`<button class="btn choice ${state.roleHelpSide===side?'selected':''}" data-role-side="${side}">${SIDE_DEFS[side].label}</button>`).join('')}</div>${ROLE_HELP_KEYS.filter(k=>ROLE_DEFS[k].side===state.roleHelpSide).map(k=>{const d=ROLE_DEFS[k];return `<div class="role-help"><img src="${d.image}" alt=""><div><strong>${d.name}</strong><div><span class="side-tag ${d.side}">${sideLabel(k)}</span></div><p>${d.desc}</p></div></div>`}).join('')}`;}else if(state.modal==='rules'){if(state.ruleHelpMode==='simple')content=`<div class="rules-modal simple-rules-modal"><h2>かんたんルール</h2><p class="rules-lead">これだけ見ればすぐ遊べます。</p><div class="simple-rules-board"><div class="simple-rules-brand"><img src="../../nise_transfer_student_logo.png" alt="ニセ転校生を探せ！"></div><section class="simple-rule-step"><div class="simple-step-no">1</div><div class="simple-step-body"><h3>準備</h3><p><strong>プレイヤー人数＋おやすみ2枚</strong>ぶんの役職を選びます。最初は「基本レギュ」がおすすめ。</p><div class="simple-role-strip"><img src="../../role_classmate.png" alt="クラスメイト"><img src="../../role_fake_transfer_student.png" alt="ニセ転校生"><img src="../../role_class_representative.png" alt="学級委員"><img src="../../role_seat_changer.png" alt="席替え係"></div></div></section><section class="simple-rule-step"><div class="simple-step-no">2</div><div class="simple-step-body"><h3>役職確認・休み時間</h3><p>スマホを1人ずつ回し、<strong>自分の役職を確認したらそのまま休み時間の行動</strong>まで行います。</p><div class="simple-action-flow"><div><img src="../../role_fake_transfer_student.png" alt="ニセ転校生"><span>① ニセ転校生</span></div><b>→</b><div class="simple-action-group"><span>②</span><img src="../../role_class_representative.png" alt="学級委員"><img src="../../role_observer.png" alt="観察係"><img src="../../role_day_duty.png" alt="日直"></div><b>→</b><div><img src="../../role_seat_changer.png" alt="席替え係"><span>③ 席替え係</span></div></div><p class="simple-mini-note">クラスメイト・秘密の協力者・いたずらっ子は特別な行動なし。</p></div></section><section class="simple-rule-step"><div class="simple-step-no">3</div><div class="simple-step-body"><h3>話し合い</h3><p>全員で情報を出し合い、<strong>誰がニセ転校生か</strong>を推理します。役職を正直に話すか、ウソをつくかは自由。</p></div></section><section class="simple-rule-step"><div class="simple-step-no">4</div><div class="simple-step-body"><h3>投票</h3><p>1人ずつ怪しい人へ投票。<strong>最多票が2票以上</strong>ならその人が判定対象。同率最多ならその全員が対象です。</p><p class="simple-mini-note">最多票が1票だけなら、誰も判定対象になりません。</p></div></section><section class="simple-rule-step simple-win-step"><div class="simple-step-no">5</div><div class="simple-step-body"><h3>勝利条件</h3><div class="simple-win-grid"><div class="simple-win-card real"><img src="../../role_classmate.png" alt="ホンモノサイド"><strong>ホンモノサイド</strong><span>判定対象にニセ転校生がいれば勝利</span></div><div class="simple-win-card fake"><img src="../../role_fake_transfer_student.png" alt="ニセモノサイド"><strong>ニセモノサイド</strong><span>ニセ転校生が判定対象にならなければ勝利</span></div><div class="simple-win-card trick"><img src="../../role_trickster.png" alt="クセモノサイド"><strong>クセモノサイド</strong><span>いたずらっ子が判定対象になれば単独勝利</span></div></div><p class="simple-mini-note">秘密の協力者はニセモノサイドの味方です。席替えで役職が変わった場合は、最後に持っている役職で勝敗を判定します。</p></div></section></div><button class="btn full rules-detail-button" data-rule-mode="detail">くわしいルール</button></div>`;else content=`<div class="rules-modal"><h2>くわしいルール</h2><div class="rules-detail-list"><section><h3>ゲームの準備</h3><p>プレイヤー人数より2枚多く役職カードを使います。1人1枚ずつ配り、残った2枚がおやすみカードになります。</p></section><section><h3>勝利サイド</h3><p><strong>ホンモノサイド</strong>は、最終投票の判定対象にニセ転校生が1人でも含まれれば勝利です。<strong>ニセモノサイド</strong>は、参加者にニセ転校生がいる場合、最終投票の判定対象にニセ転校生が1人も含まれなければ勝利です。参加者にニセ転校生がいない場合は、誰も判定対象にならなければ<strong>平和なクラス</strong>、誰かが判定対象になればニセモノサイド勝利になります。<strong>クセモノサイド</strong>は、いたずらっ子が最終投票で最多票の判定対象になれば、ほかの判定より優先して単独勝利です。</p></section><section><h3>役職確認と休み時間</h3><p>スマホを1人ずつ回し、<strong>自分の役職を確認したら、そのまま同じ人が休み時間の行動まで行います。</strong>全員が1回ずつスマホを受け取り、ほかの人は画面を見ないでください。</p><p>役職の確認情報は、席替えによる変更前の役職を基準に正しく処理されます。</p></section><section><h3>休み時間の処理順</h3><p>スマホはプレイヤー順に回しますが、役職の情報は次の順番になるよう処理されます。</p><div class="night-order"><div class="night-order-item"><img class="night-order-role-icon" data-rule-role-detail="fake" src="../../role_fake_transfer_student.png" alt="ニセ転校生" role="button" tabindex="0" aria-label="ニセ転校生の役職詳細を見る"><span class="order-no">1</span><strong>ニセ転校生</strong><small>ほかのニセ転校生を確認</small></div><div class="night-order-arrow">↓</div><div class="night-order-group"><span class="order-no">2</span><div class="night-order-group-list"><div class="night-order-subitem"><img class="night-order-role-icon" data-rule-role-detail="president" src="../../role_class_representative.png" alt="学級委員" role="button" tabindex="0" aria-label="学級委員の役職詳細を見る"><div><strong>学級委員</strong><small>1人の役職 または おやすみ2枚を確認</small></div></div><div class="night-order-subitem"><img class="night-order-role-icon" data-rule-role-detail="observer" src="../../role_observer.png" alt="観察係" role="button" tabindex="0" aria-label="観察係の役職詳細を見る"><div><strong>観察係</strong><small>2人が同じサイドか確認</small></div></div><div class="night-order-subitem"><img class="night-order-role-icon" data-rule-role-detail="dayDuty" src="../../role_day_duty.png" alt="日直" role="button" tabindex="0" aria-label="日直の役職詳細を見る"><div><strong>日直</strong><small>おやすみ1枚を確認</small></div></div></div></div><div class="night-order-arrow">↓</div><div class="night-order-item"><img class="night-order-role-icon" data-rule-role-detail="swapper" src="../../role_seat_changer.png" alt="席替え係" role="button" tabindex="0" aria-label="席替え係の役職詳細を見る"><span class="order-no">3</span><strong>席替え係</strong><small>自分と1人の役職を入れ替え</small></div></div></section><section><h3>話し合い</h3><p>全員で情報を出し合い、誰がニセ転校生なのかを推理します。自分の役職や情報をどう話すかは自由です。</p></section><section><h3>投票</h3><p>最後に全員が1人へ投票します。<strong>最多票が2票以上なら、その最多票の人が判定対象</strong>です。同じ最多票が複数人いる場合は、その全員が判定対象になります。<strong>最多票が1票だけの場合は、票がばらけたものとして誰も判定対象になりません。</strong>いたずらっ子が判定対象に含まれていれば、<strong>クセモノサイドが優先して単独勝利</strong>です。いたずらっ子がいない場合、その中にニセ転校生が1人でもいれば、<strong>ホンモノサイドの勝利</strong>です。</p></section><section><h3>役職の入れ替わり</h3><p>席替え係の行動などで役職が変わる場合があります。勝敗はゲーム終了時に持っている最終役職で判定します。</p></section></div><button class="btn secondary full" data-rule-mode="simple">かんたんルールにもどる</button></div>`;}else content=`<h2>今回のレギュ</h2><p>${state.playerCount}人 ＋ お休み2枚</p>${roleKeys.filter(k=>state.roleCounts[k]>0).map(k=>`<div class="reg-line"><span>${ROLE_DEFS[k].name}</span><span>× ${state.roleCounts[k]}</span></div>`).join('')}`;w.innerHTML=`<div class="modal">${content}<button class="btn ${state.modal==='rules'?'secondary ':''}full" id="closeModal">${state.modal==='rules'?'← もどる':'閉じる'}</button></div>`;document.body.appendChild(w);document.querySelectorAll('[data-role-side]').forEach(b=>b.addEventListener('click',()=>{state.roleHelpSide=b.dataset.roleSide;renderModal();}));document.querySelectorAll('[data-rule-mode]').forEach(b=>b.addEventListener('click',()=>{state.ruleHelpMode=b.dataset.ruleMode;renderModal();}));document.querySelectorAll('[data-rule-role-detail]').forEach(el=>{const open=()=>openRuleRoleDetail(el.dataset.ruleRoleDetail);el.addEventListener('click',open);el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open();}});});const roleDetailImage=document.getElementById('roleDetailImage');roleDetailImage?.addEventListener('click',closeModal);roleDetailImage?.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();closeModal();}});document.getElementById('closeModal').addEventListener('click',closeModal);}
function bindHold(id,cb){const el=document.getElementById(id);if(!el)return;let t=null;const start=e=>{e.preventDefault();t=setTimeout(()=>{t=null;cb();},700)},cancel=()=>{if(t){clearTimeout(t);t=null;}};el.addEventListener('pointerdown',start);['pointerup','pointerleave','pointercancel'].forEach(x=>el.addEventListener(x,cancel));}
function toggleTimer(){if(state.timerId){stopTimer();render();return;}state.timerId=setInterval(()=>{state.timerRemaining=Math.max(0,state.timerRemaining-1);const el=document.getElementById('timer');if(el){el.textContent=formatTime(state.timerRemaining);el.classList.toggle('low',state.timerRemaining<=10);}if(state.timerRemaining===0){stopTimer();const b=document.getElementById('timerToggle');if(b)b.textContent='終了';}},1000);render();}
function adjustDiscussionTimer(seconds){
  state.timerRemaining=Math.max(0,state.timerRemaining+seconds);
  const el=document.getElementById('timer');
  if(el){
    el.textContent=formatTime(state.timerRemaining);
    el.classList.toggle('low',state.timerRemaining<=10);
  }
  const b=document.getElementById('timerToggle');
  if(b&&!state.timerId)b.textContent=state.timerRemaining===0?'終了':'スタート';
}
function bind(){
  document.getElementById('stepBack')?.addEventListener('click',()=>confirmNav('back'));
  document.getElementById('goTop')?.addEventListener('click',()=>confirmNav('top'));
  document.getElementById('startSetup')?.addEventListener('click',()=>{const shared=window.HoukagoPlayers?.load?.();state.playerCount=Math.max(3,Math.min(10,Number(shared?.activeCount)||3));window.HoukagoPlayers?.setActiveCount?.(state.playerCount);state.players=[];ensurePlayers();setBaseRoles();go('roles')});document.querySelectorAll('[data-open]').forEach(b=>b.addEventListener('click',()=>openModal(b.dataset.open)));
  document.getElementById('editPlayersFromRoles')?.addEventListener('click',()=>go('players'));document.querySelectorAll('[data-count]').forEach(b=>b.addEventListener('click',()=>{state.playerCount=Number(b.dataset.count);window.HoukagoPlayers?.setActiveCount?.(state.playerCount);state.players=[];ensurePlayers();setBaseRoles();render();}));document.getElementById('toPlayers')?.addEventListener('click',()=>{ensurePlayers();go('players')});document.getElementById('backCount')?.addEventListener('click',()=>go('roles'));
  document.querySelectorAll('[data-member-count]').forEach(b=>b.addEventListener('click',()=>{state.playerCount=Math.max(3,Math.min(10,Number(b.dataset.memberCount)||3));window.HoukagoPlayers?.setActiveCount?.(state.playerCount);state.players=[];ensurePlayers();setBaseRoles();render();}));
  document.querySelectorAll('[data-member-name]').forEach(x=>x.addEventListener('change',()=>{const i=Number(x.dataset.memberName);window.HoukagoPlayers?.setPlayer?.(i,{name:x.value||`プレイヤー${i+1}`});state.players=[];ensurePlayers();render();}));
  document.querySelectorAll('[data-member-icon]').forEach(b=>b.addEventListener('click',()=>{const i=Number(b.dataset.memberIcon);window.HoukagoPlayers?.setPlayer?.(i,{icon:b.dataset.icon});state.players=[];ensurePlayers();render();}));
  document.querySelector('[data-members-done]')?.addEventListener('click',()=>{state.players=[];ensurePlayers();if(state.navHistory[state.navHistory.length-1]==='roles')state.navHistory.pop();state.screen='roles';render();});
  document.getElementById('toRoles')?.addEventListener('click',()=>go('roles'));document.getElementById('backPlayers')?.addEventListener('click',()=>go('players'));
  document.querySelectorAll('[data-role-minus]').forEach(b=>b.addEventListener('click',()=>{const r=b.dataset.roleMinus;if(state.roleCounts[r]<=roleMin(r))return;const wasExact=totalCards()===needCards();state.roleCounts[r]--;if(r!=='classmate'&&wasExact)state.roleCounts.classmate++;render();}));document.querySelectorAll('[data-role-plus]').forEach(b=>b.addEventListener('click',()=>{const r=b.dataset.rolePlus;if(state.roleCounts[r]>=roleMax(r))return;const wasExact=totalCards()===needCards();if(r!=='classmate'&&wasExact&&state.roleCounts.classmate>0){state.roleCounts.classmate--;state.roleCounts[r]++;}else{state.roleCounts[r]++;}render();}));document.getElementById('dealRoles')?.addEventListener('click',startGame);
  bindHold('holdReveal',()=>go('revealRole'));document.getElementById('startRoleAction')?.addEventListener('click',()=>{state.nightIndex=state.revealIndex;go('nightAction');});
  document.getElementById('beginNight')?.addEventListener('click',()=>{state.nightIndex=0;go('nightPass')});bindHold('holdNight',()=>go('nightAction'));document.getElementById('nightDone')?.addEventListener('click',()=>queueCover('revealNext'));
  document.querySelectorAll('[data-pres-card]').forEach(b=>b.addEventListener('click',()=>{const i=Number(b.dataset.presCard);confirmCardChoice('このカードでよろしいですか？',esc(state.players[i].name)+'さんのカードを確認します。',()=>{const r=state.initialRoles[i],board=document.querySelector('.table-board'),p=document.querySelector('.card.stack');if(board)board.outerHTML=gameBoard({useFinal:false,facePlayers:[state.nightIndex,i],selfPlayer:state.nightIndex});p.innerHTML=`<div class="role-reveal"><p>${esc(state.players[i].name)}さんの役職</p><img class="role-card-large role-detail-trigger" data-role-detail="${r}" src="${ROLE_DEFS[r].image}" alt="${ROLE_DEFS[r].name}"><button class="btn full" id="nightDone">確認した</button></div>`;document.getElementById('nightDone').addEventListener('click',()=>queueCover('revealNext'));});}));
  document.querySelectorAll('[data-pres-rest]').forEach(b=>b.addEventListener('click',()=>{const idx=Number(b.dataset.presRest);confirmCardChoice('このカードでよろしいですか？','おやすみ'+(idx+1)+'を選ぶと、おやすみ2枚を両方確認します。',()=>{const board=document.querySelector('.table-board'),p=document.querySelector('.card.stack');if(board)board.outerHTML=gameBoard({useFinal:false,facePlayers:[state.nightIndex],selfPlayer:state.nightIndex,revealRest:true});p.innerHTML=`<div class="role-reveal"><h2>お休み2枚</h2><div class="grid2">${state.rest.map(r=>`<img class="role-card-large role-detail-trigger" data-role-detail="${r}" src="${ROLE_DEFS[r].image}" alt="${ROLE_DEFS[r].name}">`).join('')}</div><button class="btn full" id="nightDone">確認した</button></div>`;document.getElementById('nightDone').addEventListener('click',()=>queueCover('revealNext'));});}));
  document.querySelectorAll('[data-day-duty-rest]').forEach(b=>b.addEventListener('click',()=>{const idx=Number(b.dataset.dayDutyRest);confirmCardChoice('このカードでよろしいですか？','おやすみ'+(idx+1)+'のカードを確認します。',()=>{const r=state.rest[idx],board=document.querySelector('.table-board'),p=document.querySelector('.card.stack');if(board)board.outerHTML=gameBoard({useFinal:false,facePlayers:[state.nightIndex],selfPlayer:state.nightIndex,faceRest:[idx]});p.innerHTML=`<div class="role-reveal"><h2>おやすみ${idx+1}の役職</h2><img class="role-card-large role-detail-trigger" data-role-detail="${r}" src="${ROLE_DEFS[r].image}" alt="${ROLE_DEFS[r].name}"><p class="role-desc"><strong>${ROLE_DEFS[r].name}</strong></p><button class="btn full" id="nightDone">確認した</button></div>`;document.getElementById('nightDone').addEventListener('click',()=>queueCover('revealNext'));});}));
  let observed=[];document.querySelectorAll('[data-observer-card]').forEach(b=>b.addEventListener('click',()=>{const i=Number(b.dataset.observerCard);if(observed.includes(i)){observed=observed.filter(x=>x!==i);b.classList.remove('table-card-observer-selected');}else if(observed.length<2){observed.push(i);b.classList.add('table-card-observer-selected');}const status=document.getElementById('observerStatus');if(status)status.textContent=observed.length+' / 2人選択';const c=document.getElementById('observerCheck');if(c)c.disabled=observed.length!==2;}));document.getElementById('observerCheck')?.addEventListener('click',()=>{const same=ROLE_DEFS[state.initialRoles[observed[0]]].side===ROLE_DEFS[state.initialRoles[observed[1]]].side,p=document.querySelector('.observer-action-card')||document.querySelector('.card.stack');p.innerHTML=`<div class="role-reveal observer-result"><h2>${same?'同じサイドです':'ちがうサイドです'}</h2><p><strong>${esc(state.players[observed[0]].name)}さん</strong> と <strong>${esc(state.players[observed[1]].name)}さん</strong></p><button class="btn full" id="nightDone">確認した</button></div>`;document.getElementById('nightDone').addEventListener('click',()=>queueCover('revealNext'));});
  document.querySelectorAll('[data-swap-card]').forEach(b=>b.addEventListener('click',()=>{const t=Number(b.dataset.swapCard),me=state.nightIndex;confirmCardChoice('このカードでよろしいですか？',esc(state.players[t].name)+'さんと席替えします。',()=>{[state.finalRoles[me],state.finalRoles[t]]=[state.finalRoles[t],state.finalRoles[me]];const myRole=state.finalRoles[me],theirRole=state.finalRoles[t],board=document.querySelector('.table-board'),p=document.querySelector('.card.stack');if(board)board.outerHTML=gameBoard({useFinal:true,facePlayers:[me,t],selfPlayer:me,swapPlayers:[t]});p.innerHTML=`<div class="role-reveal"><h2>${esc(state.players[t].name)}さんと交換しました</h2><p><strong>黄色の枠が自分の新しいカード</strong><br><strong>水色の枠が交換相手のカード</strong>です。</p><div class="swap-result-cards"><div><span>自分の新しい役職</span><img class="role-card-large role-detail-trigger" data-role-detail="${myRole}" src="${ROLE_DEFS[myRole].image}" alt="${ROLE_DEFS[myRole].name}"><strong>${ROLE_DEFS[myRole].name}</strong></div><div><span>${esc(state.players[t].name)}さん</span><img class="role-card-large role-detail-trigger" data-role-detail="${theirRole}" src="${ROLE_DEFS[theirRole].image}" alt="${ROLE_DEFS[theirRole].name}"><strong>${ROLE_DEFS[theirRole].name}</strong></div></div><p class="role-desc">交換された相手には、交換されたことは知らされません。</p><button class="btn full" id="nightDone">確認した</button></div>`;document.getElementById('nightDone').addEventListener('click',()=>queueCover('revealNext'));});}));document.getElementById('noSwap')?.addEventListener('click',()=>queueCover('revealNext'));
  document.getElementById('timerToggle')?.addEventListener('click',toggleTimer);document.getElementById('plus60')?.addEventListener('click',()=>adjustDiscussionTimer(60));document.getElementById('plus10')?.addEventListener('click',()=>adjustDiscussionTimer(10));document.getElementById('minus60')?.addEventListener('click',()=>adjustDiscussionTimer(-60));document.getElementById('minus10')?.addEventListener('click',()=>adjustDiscussionTimer(-10));document.getElementById('toVote')?.addEventListener('click',()=>{stopTimer();state.voteIndex=0;state.votes=[];go('votePass');});bindHold('holdVote',()=>go('vote'));document.querySelectorAll('[data-vote-card]').forEach(b=>b.addEventListener('click',()=>{const t=Number(b.dataset.voteCard);confirmCardChoice('このカードに投票しますか？',esc(state.players[t].name)+'さんに投票します。',()=>{state.votes[state.voteIndex]=t;queueCover('voteNext');});}));
  document.getElementById('showResult')?.addEventListener('click',()=>{state.gameStarted=false;go('result');});document.getElementById('restartSame')?.addEventListener('click',()=>{state.navHistory=[];state.screen='roles';startGame();});document.getElementById('restartRoles')?.addEventListener('click',()=>{state.gameStarted=false;state.navHistory=[];state.screen='roles';render();});
}
setBaseRoles();ensurePlayers();render();