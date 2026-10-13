(function(){
  'use strict';
  const root=document.getElementById('pitadome-versus');
  const registry=window.HoukagoPlayers;
  const rules=window.PitadomeVersusRules;
  const settingsApi=window.HoukagoSettings;
  if(!root||!registry||!rules)return;
  const KEY='houkago_pitadome_versus_players_v1';
  const state={
    screen:'select',ids:[],targetSlot:0,editId:null,formIcon:'',
    difficulty:'normal',round:1,profile:null,players:[],
    lives:[3,3],perfects:[0,0],attempts:[null,null],scores:[0,0],combos:[0,0],greatStreaks:[0,0],charges:[0,0],quiet:[0,0],mushin:[false,false],mushinReady:[false,false],pendingPressure:[0,0],activePressure:0,activeSafe:12,
    currentSide:0,turnNo:1,starter:0,lastStarter:null,phase:'ready',countdown:3,
    motion:null,value:0,dir:1,elapsed:0,lastTs:0,raf:0,timer:0,
    result:null,resultReady:false,recorded:false,notice:''
  };
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
  function clamp(n,a,b){return Math.max(a,Math.min(b,n))}
  function roster(){return registry.load().roster||[]}
  function readIds(){try{const x=JSON.parse(localStorage.getItem(KEY)||'null');return Array.isArray(x)?x.slice(0,2).map(String):[]}catch(e){return []}}
  function saveIds(){try{localStorage.setItem(KEY,JSON.stringify(state.ids))}catch(e){}}
  function syncIds(){
    const members=roster(),valid=new Set(members.map(p=>p.id));
    const chosen=state.ids.filter((id,i,a)=>valid.has(id)&&a.indexOf(id)===i);
    for(const p of members){if(chosen.length>=2)break;if(!chosen.includes(p.id))chosen.push(p.id)}
    state.ids=chosen.slice(0,2);
  }
  function selected(i){return roster().find(p=>p.id===state.ids[i])||null}
  function nav(){return '<nav class="top-nav"><button type="button" class="nav-pill" data-back>← もどる</button><button type="button" class="nav-pill" data-home>ゲームをえらぶ</button></nav>'}
  function heading(t,sub){return '<header class="screen-heading"><h1>'+esc(t)+'</h1>'+(sub?'<p>'+esc(sub)+'</p>':'')+'</header>'}
  function currentPlayers(change){
    return '<section class="pv-current"><strong>今回のプレイヤー</strong>'+
      [0,1].map(i=>{const p=selected(i);
        return '<div class="pv-person"><span class="pv-person-icon">'+esc(p?.icon||'？')+'</span>'+
          '<div class="pv-person-data"><small>'+(i+1)+'P・'+(i?'右側':'左側')+'</small><strong>'+esc(p?.name||'未選択')+'</strong></div>'+
          (change?'<button type="button" data-change="'+i+'">変更</button>':'')+'</div>';
      }).join('')+'</section>';
  }
  function selectScreen(){
    return nav()+'<div class="pv-wrap">'+heading('2人KO対戦','スマホ1台で交互にSTOP！')+currentPlayers(true)+
      '<div class="pv-rules"><h2>勝ち方</h2><p>1人1回ずつ完全交代！ STOPしたその場で得点・ライフ・判定を確定し、相手に交代するよ。</p>'+
      '<p>ライフ3。セーフ範囲を外すと−1。PERFECTはライフ＋1＆次の相手のセーフ範囲−2！</p>'+
      '<p>GREAT以上（PERFECT以外）3連続も同じ効果。累計350点ごとにライフ＋1、満タンなら相手のセーフ範囲−1。</p>'+
      '<p>妨害は次の相手の1回だけ・最大−3。早押し加点なし。得点は回復のために使い、勝敗はKOで決める。</p></div>'+
      '<div class="pv-rules"><h2>むずかしさ</h2><div class="pv-diff-choice">'+
      '<button type="button" data-diff="easy" class="'+(state.difficulty==='easy'?'selected':'')+'">かんたん</button>'+
      '<button type="button" data-diff="normal" class="'+(state.difficulty==='normal'?'selected':'')+'">通常</button></div>'+
      '<p class="pv-note">後半は±1、最後はピッタリのみ！ 先攻は初戦ランダム、再戦では入れ替わるよ。</p></div>'+
      '<button class="btn full pv-action" type="button" data-begin>2人で対戦をはじめる</button>'+
      (state.notice?'<p class="pv-error">'+esc(state.notice)+'</p>':'')+'</div>';
  }
  function pickScreen(){
    const other=state.ids[1-state.targetSlot];
    return nav()+'<div class="pv-wrap">'+heading((state.targetSlot+1)+'Pのプレイヤーを変更','登録済みのメンバーから選んでね。')+
      '<div class="pv-list">'+roster().map(p=>{
        const busy=p.id===other,active=p.id===state.ids[state.targetSlot];
        return '<button type="button" class="pv-choice '+(active?'selected':'')+'" data-pick="'+esc(p.id)+'"'+(busy?' disabled':'')+'>'+
        '<span>'+esc(p.icon)+'</span><strong>'+esc(p.name)+'</strong><small>'+(busy?'相手が使用中':active?'選択中':'選択する')+'</small></button>';
      }).join('')+'</div><div class="pv-setup-actions"><button class="btn secondary full" type="button" data-add '+(roster().length>=registry.ROSTER_MAX?'disabled':'')+'>＋ 新しいプレイヤーを登録</button>'+
      '<button class="btn secondary full" type="button" data-manage>名前・アイコンを編集</button></div></div>';
  }
  function manageScreen(){
    return nav()+'<div class="pv-wrap">'+heading('登録メンバーを編集','変更内容はほかのゲームでも共通になるよ。')+
      '<div class="pv-list">'+roster().map(p=>'<div class="pv-person"><span class="pv-person-icon">'+esc(p.icon)+'</span><div class="pv-person-data"><strong>'+esc(p.name)+'</strong></div><button type="button" data-edit="'+esc(p.id)+'">編集</button></div>').join('')+'</div>'+
      '<button type="button" class="btn secondary full pv-action" data-manage-done>← プレイヤー選択へ</button></div>';
  }
  function formScreen(){
    const members=roster(),edit=members.find(p=>p.id===state.editId)||null;
    const used=new Set(members.filter(p=>!edit||p.id!==edit.id).map(p=>p.icon));
    const icons=registry.ICONS||[];
    const choice=icons.includes(state.formIcon)&&!used.has(state.formIcon)?state.formIcon:icons.find(i=>!used.has(i));
    state.formIcon=choice;
    return nav()+'<div class="pv-wrap">'+heading(edit?'メンバーを編集':'新しく登録','名前とアイコンを決めてね。')+
      '<form class="pv-form" data-member-form><label for="pv-name">名前（12文字まで）</label>'+
      '<input id="pv-name" name="name" maxlength="12" autocomplete="off" value="'+esc(edit?.name||'')+'" required>'+
      '<label>アイコン</label><div class="pv-icons">'+icons.map(icon=>'<button type="button" data-icon="'+esc(icon)+'" class="'+(icon===choice?'selected':'')+'" '+(used.has(icon)?'disabled':'')+'>'+esc(icon)+'</button>').join('')+'</div>'+
      '<div class="pv-error" data-form-error></div><button class="btn full" type="submit">'+(edit?'変更を保存':'登録して選択')+'</button>'+
      '</form></div>';
  }
  function heart(life){return '♥'.repeat(clamp(life,0,3))+'♡'.repeat(3-clamp(life,0,3))}
  function activeIndex(){return state.currentSide}
  function stopSummary(i){
    const a=state.attempts[i];if(!a)return '<span>STOP待ち</span>';
    const clearance=a.safe-a.error;
    return '<span>'+({perfect:'PERFECT！',excellent:'EXCELLENT！',great:'GREAT！',good:'GOOD！',safe:'セーフ！',miss:'ミス！'}[a.tier]||'')+
      ' / STOP '+a.value+' / 誤差 '+a.error+' / '+(clearance>=0?'猶予あと '+clearance:'許容超過 '+Math.abs(clearance))+'</span>';
  }
  function meterLabels(){
    const p=state.profile;if(!p)return '';
    if(state.difficulty==='easy')return '<div class="pv-meter-labels pv-meter-easy">'+Array.from({length:10},(_,i)=>{
      const v=(i+1)*10,at=((v-1)/99)*100;return '<span style="left:'+at+'%">'+v+'</span>';
    }).join('')+'</div>';
    const at=((p.refPoint-p.minValue)/(p.maxValue-p.minValue))*100;
    return '<div class="pv-meter-labels"><span style="left:0%">'+p.minValue+'</span>'+
      '<span style="left:'+at+'%">'+p.refPoint+'</span><span style="left:100%">'+p.maxValue+'</span></div>';
  }
  /* The duel shows ONE active bar and ONE action button. Player cards never own controls. */
  function playerCard(i){
    const p=state.players[i],active=i===activeIndex(),last=state.attempts[i];
    const status=active?'プレイ中':(last?'前回 '+(last.error<=last.safe?'合格':'判定外')+' / 誤差'+last.error:'待機中');
    return '<aside class="pv-vs-player '+(active?'is-active':'is-waiting')+'" data-side="'+i+'">'+
      '<div class="pv-vs-head"><span class="pv-vs-avatar">'+esc(p.icon)+'</span><div class="pv-vs-identity"><small>'+(i+1)+'P</small><strong>'+esc(p.name)+'</strong></div></div>'+
      '<div class="pv-vs-heart" aria-label="ライフ'+state.lives[i]+'">'+heart(state.lives[i])+'</div>'+
      '<div class="pv-vs-score"><span>SCORE</span><strong>'+state.scores[i]+'</strong></div>'+
      '<div class="pv-vs-status">'+esc(status)+'</div>'+
      '<div class="pv-vs-detail"><span>COMBO '+state.combos[i]+'</span><span>GREAT '+state.greatStreaks[i]+'/3</span></div>'+
      '<div class="pv-vs-reward">回復まで '+(rules.CHARGE_LIMIT-state.charges[i])+'pt</div>'+
      '<div class="pv-vs-quiet"><span>静 '+state.quiet[i]+'%</span><i><b style="width:'+state.quiet[i]+'%"></b></i></div>'+
      '</aside>';
  }
  function verdictText(attempt){
    if(attempt.error>attempt.safe)return 'OUT！';
    return ({perfect:'PERFECT！',excellent:'EXCELLENT！',great:'GREAT！',good:'GOOD！',safe:'SAFE！',miss:'OUT！'})[attempt.tier]||'';
  }
  function actionHtml(){
    const i=activeIndex(),who=state.players[i];
    if(state.phase==='ready')return '<button class="pv-game-action pv-action-start" type="button" data-start-turn>'+
      '<span class="pv-action-player">'+(i+1)+'P '+esc(who.icon)+' '+esc(who.name)+' の準備</span>'+
      '<strong>準備OK！ START</strong></button>';
    if(state.phase==='countdown')return '<div class="pv-action-countdown" aria-live="polite">'+state.countdown+'</div>';
    if(state.phase==='moving')return '<button class="pv-game-action pv-action-stop" type="button" data-stop="'+i+'">STOP！</button>';
    if(state.phase==='judged')return '<button class="pv-game-action pv-action-next" type="button" data-next-turn'+
      (state.resultReady?'':' disabled aria-disabled="true"')+'>'+
      (state.result.winner!=null?'勝敗結果を見る':'次は '+(1-i+1)+'P '+esc(state.players[1-i].name)+' の番')+'　›</button>';
    return '';
  }
  function resultEffects(attempt){
    if(!['perfect','excellent','great'].includes(attempt.tier)||attempt.error>attempt.safe)return '';
    const count=attempt.perfect?18:12;
    const sparks=Array.from({length:count},(_,i)=>'<i class="pv-result-spark" style="--i:'+i+';--step:'+(360/count)+'deg"></i>').join('');
    const rays=Array.from({length:12},(_,i)=>'<i class="pv-result-ray" style="--i:'+i+'"></i>').join('');
    return '<div class="pv-result-effects" aria-hidden="true"><div class="pv-result-rays">'+rays+
      '</div><div class="pv-result-sparks">'+sparks+'</div><div class="pv-result-ring"></div></div>';
  }

  function battleScreen(){
    const p=state.profile,i=activeIndex(),player=state.players[i],a=state.result?.attempt;
    const isResult=state.phase==='judged';
    const lo=Math.max(p.minValue,p.target-state.activeSafe),hi=Math.min(p.maxValue,p.target+state.activeSafe);
    const range=p.maxValue-p.minValue,pct=((state.phase==='moving'?state.value:(a?a.value:p.minValue))-p.minValue)/range*100;
    const showCursor=state.phase==='moving';
    const blind=p.blind?'<div class="pv-meter-blind" style="left:'+p.blindStart+'%;width:'+(p.blindEnd-p.blindStart)+'%"></div>':'';
    const hint=state.phase==='ready'?'準備ができたらスタート':
      state.phase==='countdown'?'バーが動いたらSTOP！':
      state.phase==='moving'?'目標の数字に合わせてSTOP！':'結果を確認してから次へ';
    let stage;
    if(isResult){
      const leftover=a.safe-a.error,losing=a.error>a.safe;
      const notes=[];
      if(a.special)notes.push((a.perfect?'PERFECT':'3連続GREAT')+'：回復＋1／相手に妨害−2');
      if(a.chargeReward)notes.push('350点達成：回復または妨害');
      if(state.result.reward.damage)notes.push('ライフ−1');
      if(a.mushinActive)notes.push('無心 ×1.5');
      if(a.mushinReady)notes.push('次回「無心」');
      stage='<div class="pv-round-result '+(losing?'is-out':'tier-'+a.tier)+'" role="status" aria-label="今回の判定結果">'+
        resultEffects(a)+
        '<div class="pv-result-mainline"><strong>'+verdictText(a)+'</strong><b>＋'+a.points+'<small> POINT</small></b></div>'+
        '<div class="pv-result-stats"><span>目標 <b>'+p.target+'</b></span><span>STOP <b>'+a.value+'</b></span>'+
        '<span>誤差 <b>'+a.error+'</b></span><span>'+(leftover>=0?'残り猶予':'超過')+' <b>'+Math.abs(leftover)+'</b></span></div>'+
        '<div class="pv-result-note">'+esc(notes.join('　・　')||'得点を獲得！')+'</div></div>';
    }else{
      stage='<div class="pv-objective"><span>目標</span><strong>'+p.target+'</strong></div>'+
        '<div class="pv-safe-range '+(state.activePressure?'is-attacked':'')+'"><span>合格</span><strong>'+lo+'〜'+hi+'</strong><b>±'+state.activeSafe+'</b>'+
        (state.activePressure?'<small>妨害 −'+state.activePressure+'</small>':'')+'</div>'+
        '<div class="pv-meter-zone"><div class="pv-meter-shell" style="width:'+Math.round(p.barScale*100)+'%">'+
        '<div class="pv-meter"><div class="pv-meter-line"></div>'+blind+
        (showCursor?'<div id="pv-cursor-'+i+'" class="pv-meter-cursor'+(p.blind&&pct>=p.blindStart&&pct<=p.blindEnd?' blind':'')+'" style="left:'+pct+'%"></div>':'')+
        '</div>'+meterLabels()+'</div></div>';
    }
    return '<div class="pv-duel">'+
      '<header class="pv-duel-head"><button class="pv-duel-quit" type="button" data-leave>← 対戦をやめる</button>'+
      '<strong>TURN '+state.turnNo+' / LEVEL '+p.level+'・'+(state.difficulty==='easy'?'かんたん':'通常')+'</strong></header>'+
      '<div class="pv-duel-body">'+
      playerCard(0)+
      '<section class="pv-play-center '+(isResult?'is-result ':'')+(state.activePressure?'is-pressured':'')+'">'+
      '<div class="pv-turn-heading"><span>'+esc(player.icon)+' '+esc(player.name)+' の番</span><small>'+esc(p.gimmicks.join('・'))+'</small></div>'+
      stage+
      '<div class="pv-action-slot">'+actionHtml()+'</div>'+
      '<div class="pv-result-strip '+(isResult?'is-result-footer':'is-hint')+'"><span>'+esc(hint)+'</span></div>'+
      '</section>'+
      playerCard(1)+
      '</div>'+
      '<div class="pv-rotate-overlay" data-rotate hidden><div><strong>スマホを横向きにしてね</strong><p>横画面専用です。縦画面ではゲームを停止します。</p></div></div>'+
      '</div>';
  }

  function finalScreen(){
    const w=state.result?.winner;
    return nav()+'<div class="pv-wrap">'+heading('KO決着！','全'+state.turnNo+'ターンの勝負')+
      '<section class="pv-result"><h1>WIN！</h1><h2>'+esc(state.players[w].icon+' '+state.players[w].name)+' の勝利！</h2>'+
      '<div class="pv-result-grid">'+state.players.map((p,i)=>'<div class="pv-result-card"><small>'+(i+1)+'P</small><strong>'+esc(p.icon)+'</strong>'+
      '<strong>'+esc(p.name)+'</strong><div class="pv-heart">'+heart(state.lives[i])+'</div><small>SCORE '+state.scores[i]+'</small><small>PERFECT '+state.perfects[i]+'回</small></div>').join('')+'</div>'+
      '<div class="pv-rules"><h2>決着：TURN '+state.turnNo+' / 判定 ±'+state.activeSafe+'</h2><p>'+esc(state.players[activeIndex()].name)+'：STOP '+
        state.result.attempt.value+' / 誤差 '+state.result.attempt.error+'</p></div>'+
      '<button class="btn full" type="button" data-rematch>同じ2人でもう一度</button>'+
      '<button class="btn secondary full" type="button" data-new-players>プレイヤーを変更</button>'+
      '<button class="btn secondary full" type="button" data-home>ゲームをえらぶ</button></section></div>';
  }
  function render(){
    if(['select','pick','manage','form'].includes(state.screen))syncIds();
    root.className='pitadome-app pv-app screen-'+state.screen;
    root.innerHTML=({select:selectScreen,pick:pickScreen,manage:manageScreen,form:formScreen,battle:battleScreen,final:finalScreen}[state.screen]||selectScreen)();
    syncRotate();
  }
  function stopTimers(){
    if(state.raf)cancelAnimationFrame(state.raf);
    if(state.timer)clearTimeout(state.timer);
    state.raf=0;state.timer=0;
  }
  function switchScreen(screen){stopTimers();state.screen=screen;render();window.scrollTo(0,0)}
  function showForm(id){
    state.editId=id||null;
    const members=roster(),edit=members.find(p=>p.id===id)||null;
    const used=new Set(members.filter(p=>!edit||p.id!==edit.id).map(p=>p.icon));
    state.formIcon=edit?edit.icon:registry.ICONS.find(icon=>!used.has(icon));
    state.notice='';switchScreen('form');
  }
  function beginTurn(){
    state.currentSide=state.starter===0?(state.turnNo-1)%2:1-(state.turnNo-1)%2;
    // Each pair gets the same target, moving profile and baseline safe range.
    if(state.turnNo%2===1||!state.profile)state.profile=rules.roundProfile(state.turnNo,state.difficulty);
    state.mushin[state.currentSide]=state.mushinReady[state.currentSide];
    state.mushinReady[state.currentSide]=false;
    state.activePressure=state.pendingPressure[state.currentSide];
    state.pendingPressure[state.currentSide]=0;
    state.activeSafe=rules.effectiveSafe(state.profile.baseSafe,state.activePressure);
    state.attempts[state.currentSide]=null;
    state.phase='ready';state.motion=null;state.value=state.profile.minValue;
    state.resultReady=false;
    switchScreen('battle');
  }
  function beginMatch(){
    syncIds();
    if(state.ids.length!==2||state.ids[0]===state.ids[1]){state.notice='2人のプレイヤーを選んでね。';render();return}
    state.players=state.ids.map(id=>roster().find(p=>p.id===id));
    if(state.players.some(p=>!p)){state.notice='メンバー情報を確認してね。';render();return}
    saveIds();
    state.starter=state.lastStarter==null?rules.chooseRandom():1-state.lastStarter;
    state.lastStarter=state.starter;
    state.lives=[3,3];state.perfects=[0,0];state.scores=[0,0];state.combos=[0,0];
    state.greatStreaks=[0,0];state.charges=[0,0];state.pendingPressure=[0,0];
    state.quiet=[0,0];state.mushin=[false,false];state.mushinReady=[false,false];
    state.attempts=[null,null];state.turnNo=1;state.profile=null;state.recorded=false;state.resultReady=false;
    beginTurn();
  }
  function countdown(){
    if(state.screen!=='battle'||state.phase!=='ready'||!landscape())return;
    stopTimers();state.phase='countdown';state.countdown=3;render();
    function step(){
      if(state.phase!=='countdown'||state.screen!=='battle'||!landscape())return;
      state.countdown--;
      if(state.countdown===0){startMotion();return}
      render();state.timer=setTimeout(step,650);
    }
    state.timer=setTimeout(step,650);
  }
  function landscape(){return window.matchMedia?window.matchMedia('(orientation: landscape)').matches:window.innerWidth>window.innerHeight}
  function syncRotate(){
    const overlay=root.querySelector('[data-rotate]');if(overlay)overlay.hidden=landscape();
  }
  function updatePosition(ts){
    if(!state.lastTs){state.lastTs=ts;return}
    const dt=Math.min(.04,Math.max(0,(ts-state.lastTs)/1000));state.lastTs=ts;
    state.motion=rules.advanceMotion(state.motion,dt,state.profile);
    state.value=state.motion.value;
  }
  function paintCursor(){
    const i=activeIndex(),el=document.getElementById('pv-cursor-'+i);if(!el)return;
    const p=state.profile,at=((state.value-p.minValue)/(p.maxValue-p.minValue))*100;
    el.style.left=at+'%';
    el.classList.toggle('blind',p.blind&&at>=p.blindStart&&at<=p.blindEnd);
  }
  function motionFrame(ts){
    if(state.phase!=='moving'||state.screen!=='battle'||!landscape())return;
    updatePosition(ts);paintCursor();state.raf=requestAnimationFrame(motionFrame);
  }
  function startMotion(){
    if(state.screen!=='battle'||state.phase!=='countdown'||!landscape())return;
    state.phase='moving';
    state.motion=rules.initialMotion(state.profile);
    state.value=state.motion.value;state.lastTs=performance.now();
    render();state.raf=requestAnimationFrame(motionFrame);
  }
  function stopPlayer(i){
    if(state.screen!=='battle'||state.phase!=='moving'||activeIndex()!==i||!landscape())return;
    updatePosition(performance.now());stopTimers();
    const p=state.profile;
    const attempt=rules.evaluateStop(state.value,p.target,{
      combo:state.combos[i],greatStreak:state.greatStreaks[i],charge:state.charges[i],score:state.scores[i],
      quiet:state.quiet[i],mushinActive:state.mushin[i]
    },state.activeSafe);
    if(attempt.tier==='perfect')settingsApi?.vibrate?.([28,22,70]);
    else if(attempt.tier==='excellent')settingsApi?.vibrate?.([24,18,45]);
    else if(attempt.tier==='great')settingsApi?.vibrate?.(24);
    state.attempts[i]=attempt;state.combos[i]=attempt.combo;state.greatStreaks[i]=attempt.greatStreak;
    state.charges[i]=attempt.charge;state.scores[i]=attempt.total;
    state.quiet[i]=attempt.quiet;state.mushinReady[i]=attempt.mushinReady;
    if(attempt.perfect)state.perfects[i]++;
    const reward=rules.applyRewards(state.lives[i],attempt);
    state.lives[i]=reward.life;
    const other=1-i;
    state.pendingPressure[other]=Math.min(rules.MAX_PRESSURE,state.pendingPressure[other]+reward.pressure);
    state.result={attempt,reward,winner:reward.life<=0?other:null};
    state.phase='judged';state.resultReady=false;
    render();
    // Solo's result screen persists until user advances. Protect the entry
    // impact animation from accidental immediate double-taps.
    const judgedTurn=state.turnNo;
    state.timer=setTimeout(()=>{
      state.timer=0;
      if(state.screen!=='battle'||state.phase!=='judged'||state.turnNo!==judgedTurn)return;
      state.resultReady=true;
      const next=root.querySelector('[data-next-turn]');
      if(next){next.disabled=false;next.removeAttribute('aria-disabled')}
    },1100);
  }
  function nextTurn(){
    if(state.phase!=='judged'||!state.resultReady)return;
    if(state.result.winner!=null){finishMatch();render();return}
    state.turnNo++;beginTurn();
  }
  function finishMatch(){
    if(state.recorded)return;
    state.recorded=true;
    const ids=state.players.map(p=>registry.resolveId(p)),winner=state.result.winner;
    const metrics={};const scores={};
    ids.forEach((id,i)=>{if(id){metrics[id]={totalPerfects:state.perfects[i]};scores[id]=state.scores[i]}});
    registry.recordGame({gameId:'pitadome-challenge-versus',participants:state.players,winners:[ids[winner]],scores,metrics});
    state.screen='final';
    stopTimers();
  }
  function quit(){
    if(state.screen!=='battle'){switchScreen('select');return}
    if(!window.confirm('対戦をやめる？ 今回の勝敗は記録されないよ。'))return;
    switchScreen('select');
  }
  root.addEventListener('pointerdown',function(e){
    const btn=e.target.closest('[data-stop]');
    if(!btn)return;
    e.preventDefault();
    stopPlayer(Number(btn.dataset.stop));
  },{passive:false});
  root.addEventListener('click',function(e){
    const b=e.target.closest('button');if(!b)return;
    if(b.hasAttribute('data-stop')){stopPlayer(Number(b.dataset.stop));return}
    if(b.hasAttribute('data-home')){if(state.screen==='battle'&&!window.confirm('対戦をやめてゲーム一覧へ戻る？'))return;stopTimers();location.href='../../';return}
    if(b.hasAttribute('data-back')){if(state.screen==='select'||state.screen==='final'){location.href='../';return}
      if(state.screen==='form')switchScreen(state.editId?'manage':'pick');
      else if(state.screen==='manage')switchScreen('pick');
      else switchScreen('select');return}
    if(b.hasAttribute('data-change')){state.targetSlot=Number(b.dataset.change);switchScreen('pick');return}
    if(b.hasAttribute('data-pick')){state.ids[state.targetSlot]=b.dataset.pick;saveIds();switchScreen('select');return}
    if(b.hasAttribute('data-add')){if(roster().length<registry.ROSTER_MAX)showForm(null);return}
    if(b.hasAttribute('data-manage')){switchScreen('manage');return}
    if(b.hasAttribute('data-manage-done')){switchScreen('pick');return}
    if(b.hasAttribute('data-edit')){showForm(b.dataset.edit);return}
    if(b.hasAttribute('data-icon')){state.formIcon=b.dataset.icon;root.querySelectorAll('[data-icon]').forEach(x=>x.classList.toggle('selected',x===b));return}
    if(b.hasAttribute('data-diff')){state.difficulty=b.dataset.diff;render();return}
    if(b.hasAttribute('data-begin')){beginMatch();return}
    if(b.hasAttribute('data-leave')){quit();return}
    if(b.hasAttribute('data-start-turn')){countdown();return}

    if(b.hasAttribute('data-next-turn')){nextTurn();return}
    if(b.hasAttribute('data-rematch')){beginMatch();return}
    if(b.hasAttribute('data-new-players')){switchScreen('select');return}
  });
  root.addEventListener('submit',function(e){
    const form=e.target.closest('[data-member-form]');if(!form)return;
    e.preventDefault();
    const fail=m=>{const el=form.querySelector('[data-form-error]');if(el)el.textContent=m};
    const name=form.elements.name.value.trim().slice(0,12);
    if(!name){fail('名前を入れてね。');return}
    const before=registry.load(),used=before.roster.filter(p=>p.id!==state.editId).some(p=>p.icon===state.formIcon);
    if(!registry.ICONS.includes(state.formIcon)||used){fail('別のアイコンを選んでね。');return}
    if(state.editId){
      const idx=before.players.findIndex(p=>p.id===state.editId);
      if(idx<0){fail('編集対象が見つからないよ。');return}
      const after=registry.setPlayer(idx,{name,icon:state.formIcon});
      const member=after.roster.find(p=>p.id===state.editId);
      if(!member||member.name!==name||member.icon!==state.formIcon){fail('保存できなかったよ。');return}
      switchScreen('manage');
    }else{
      if(before.roster.length>=registry.ROSTER_MAX){fail('登録できる人数は15人までだよ。');return}
      const after=registry.addPlayer(name),created=after.roster.find(p=>!before.roster.some(x=>x.id===p.id));
      if(!created){fail('追加できなかったよ。');return}
      if(created.icon!==state.formIcon){
        const idx=after.players.findIndex(p=>p.id===created.id);
        registry.setPlayer(idx,{icon:state.formIcon});
      }
      const saved=registry.load().roster.find(p=>p.id===created.id);
      if(!saved||saved.icon!==state.formIcon){fail('アイコンの保存に失敗したよ。');return}
      state.ids[state.targetSlot]=created.id;saveIds();switchScreen('select');
    }
  });
  document.addEventListener('visibilitychange',function(){
    if(document.visibilityState==='hidden'&&state.screen==='battle'&&['moving','countdown'].includes(state.phase)){
      stopTimers();state.phase='ready';state.motion=null;state.value=state.profile.minValue;render();
    }
  });
  window.addEventListener('resize',()=>{if(state.screen==='battle'&&['moving','countdown'].includes(state.phase)&&!landscape()){stopTimers();state.phase='ready';state.motion=null;render()}else syncRotate()});
  window.addEventListener('orientationchange',()=>{if(state.screen==='battle'&&['moving','countdown'].includes(state.phase)&&!landscape()){stopTimers();state.phase='ready';state.motion=null;render()}else syncRotate()});
  window.addEventListener('pagehide',stopTimers);
  state.ids=readIds();syncIds();render();
})();