(function(){
  'use strict';
  const root=document.getElementById('pitadome-versus');
  const registry=window.HoukagoPlayers;
  const rules=window.PitadomeVersusRules;
  const settingsApi=window.HoukagoSettings;
  const effects=window.PitadomeEffects;
  if(!root||!registry||!rules)return;
  const KEY='houkago_pitadome_versus_players_v1';
  const state={
    screen:'select',ids:[],targetSlot:0,editId:null,formIcon:'',
    difficulties:['normal','normal'],round:1,profile:null,players:[],lastTarget:null,
    lives:[3,3],perfects:[0,0],attempts:[null,null],scores:[0,0],combos:[0,0],greatStreaks:[0,0],charges:[0,0],quiet:[0,0],mushin:[false,false],mushinReady:[false,false],pendingPressure:[0,0],activePressure:0,activeSafe:12,
    currentSide:0,turnNo:1,starter:0,lastStarter:null,phase:'ready',countdown:3,
    motion:null,value:0,dir:1,elapsed:0,lastTs:0,raf:0,timer:0,
    result:null,resultReady:false,recorded:false,notice:'',cutin:null,lifeWarningPending:[false,false]
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
  const difficultyName=i=>state.difficulties[i]==='easy'?'かんたん':'通常';
  const matchupLabel=()=>state.difficulties[0]===state.difficulties[1]
    ?'両者 '+difficultyName(0)
    :'1P '+difficultyName(0)+' / 2P '+difficultyName(1);
  function selectScreen(){
    const choices=[0,1].map(i=>{
      const p=selected(i),diff=state.difficulties[i];
      const choice=(mode,text,summary)=>
        '<button type="button" data-diff="'+mode+'" data-side="'+i+'" aria-pressed="'+(diff===mode)+'" '+
        'class="pv-difficulty-choice '+(mode==='easy'?'is-easy ':'')+(diff===mode?'selected':'')+'">'+
        '<strong>'+text+'</strong><span>'+summary+'</span></button>';
      return '<section class="pv-difficulty-player" data-player-difficulty="'+i+'">'+
        '<h3><span>'+esc(p?.icon||'？')+'</span>'+(i+1)+'P '+esc(p?.name||'未選択')+' のむずかしさ</h3>'+
        '<div class="pv-difficulty-options">'+
        choice('easy','かんたん','1〜100・やさしめ')+
        choice('normal','通常','ギミック・上限変化')+
        '</div></section>';
    }).join('');
    return nav()+'<div class="pv-wrap pv-select-wrap">'+heading('2人で対戦','スマホ1台で1回ずつ交代。ライフ0でKO！')+
      currentPlayers(true)+
      '<section class="pv-difficulty-setup"><h2>それぞれのむずかしさを選ぼう</h2>'+
      choices+'<p class="pv-mixed-note">1Pと2Pは別々に選べるよ。組み合わせ自由！</p></section>'+
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
    if(state.difficulties[activeIndex()]==='easy')return '<div class="pv-meter-labels pv-meter-easy">'+Array.from({length:10},(_,i)=>{
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
    const maxFlash=active&&state.phase==='judged'&&Boolean(state.result?.attempt?.chargeReward);
    const gaugeValue=maxFlash?rules.CHARGE_LIMIT:state.charges[i];
    return '<aside class="pv-vs-player '+(active?'is-active':'is-waiting')+'" data-side="'+i+'">'+
      '<div class="pv-vs-head"><span class="pv-vs-avatar">'+esc(p.icon)+'</span><div class="pv-vs-identity"><small>'+(i+1)+'P・'+difficultyName(i)+'</small><strong>'+esc(p.name)+'</strong></div></div>'+
      '<div class="pv-vs-heart" aria-label="ライフ'+state.lives[i]+'">'+heart(state.lives[i])+'</div>'+
      '<div class="pv-vs-recovery '+(maxFlash?'is-max':'')+'" aria-label="回復ゲージ '+gaugeValue+' / '+rules.CHARGE_LIMIT+'">'+
      '<div class="pv-vs-recovery-title"><strong>回復ゲージ</strong><span>'+(maxFlash?'MAX！効果発動':gaugeValue+' / '+rules.CHARGE_LIMIT)+'</span></div>'+
      '<div class="pv-vs-recovery-bar"><i style="width:'+(100*gaugeValue/rules.CHARGE_LIMIT).toFixed(1)+'%"></i></div></div>'+
      '<div class="pv-vs-score pv-vs-score-secondary"><span>SCORE</span><strong>'+state.scores[i]+'</strong></div>'+
      '<div class="pv-vs-status">'+esc(status)+'</div>'+
      '<div class="pv-vs-detail"><span>COMBO '+state.combos[i]+'</span><span>GREAT '+state.greatStreaks[i]+'/3</span></div>'+

      '<div class="pv-vs-quiet"><span>静 '+state.quiet[i]+'%</span><i><b style="width:'+state.quiet[i]+'%"></b></i></div>'+
      '</aside>';
  }

  function actionHtml(){
    const i=activeIndex(),who=state.players[i];
    if(state.phase==='ready')return '<button class="pv-game-action pv-action-start" type="button" data-start-turn>'+
      '<span class="pv-action-player">'+(i+1)+'P '+esc(who.icon)+' '+esc(who.name)+' の準備</span>'+
      '<strong>準備OK！ START</strong></button>';
    if(state.phase==='countdown')return '<div class="pv-action-countdown" aria-hidden="true"></div>';
    if(state.phase==='moving')return '<button class="pv-game-action pv-action-stop" type="button" data-stop="'+i+'">STOP！</button>';
    if(state.phase==='judged'&&state.cutin)return '<div class="pv-action-hold" aria-hidden="true">判定演出中…</div>';
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
    // The frozen bar remains underneath the cinematic cut-in. Do not render the
    // result card until the cut-in AND any low-life warning have finished.
    const revealResult=isResult&&!state.cutin;
    const lo=Math.max(p.minValue,p.target-state.activeSafe),hi=Math.min(p.maxValue,p.target+state.activeSafe);
    const range=p.maxValue-p.minValue,pct=((state.phase==='moving'?state.value:(a?a.value:p.minValue))-p.minValue)/range*100;
    const showCursor=state.phase==='moving'||(isResult&&!revealResult);
    const blind=p.blind?'<div class="pv-meter-blind" style="left:'+p.blindStart+'%;width:'+(p.blindEnd-p.blindStart)+'%"></div>':'';
    const hint=(state.phase==='ready'||state.phase==='countdown'||state.phase==='warning')?'':
      state.phase==='moving'?'目標の数字に合わせてSTOP！':
      revealResult?'結果を確認してから次へ':'判定演出中…';
    let stage;
    if(revealResult){
      const leftover=a.safe-a.error,losing=a.error>a.safe;
      const notes=[];
      if(a.special)notes.push((a.perfect?'ぴったり成功':'3連続ボーナス')+'：回復＋1／相手に妨害−2');
      if(a.chargeReward)notes.push('350点達成：回復または妨害');
      if(state.result.reward.damage)notes.push('ライフ−1');
      if(a.mushinActive)notes.push('無心 ×1.5');
      if(a.mushinReady)notes.push('次回「無心」');
      stage='<div class="pv-round-result '+(losing?'is-out':'tier-'+a.tier)+'" role="status" aria-label="今回の判定結果">'+
        resultEffects(a)+
        '<div class="pv-result-mainline"><strong>'+'判定結果'+'</strong><b>＋'+a.points+'<small> POINT</small></b></div>'+
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
      '<strong>TURN '+state.turnNo+' / LEVEL '+p.level+'・'+difficultyName(i)+'</strong></header>'+
      '<div class="pv-duel-body">'+
      playerCard(0)+
      '<section class="pv-play-center '+(revealResult?'is-result ':'')+(!hint?'is-no-footer ':'')+(state.activePressure?'is-pressured':'')+'">'+
      '<div class="pv-turn-heading"><span>'+esc(player.icon)+' '+esc(player.name)+' の番</span><small>'+esc(p.gimmicks.join('・'))+'</small></div>'+
      stage+
      '<div class="pv-action-slot">'+actionHtml()+'</div>'+
      (hint?'<div class="pv-result-strip '+(revealResult?'is-result-footer':'is-hint')+'"><span>'+esc(hint)+'</span></div>':'')+
      '</section>'+
      playerCard(1)+
      '</div>'+
      '<div class="pv-rotate-overlay" data-rotate hidden><div><strong>スマホを横向きにしてね</strong><p>横画面専用です。縦画面ではゲームを停止します。</p></div></div>'+
      '</div>';
  }

  function finalScreen(){
    const winner=state.result?.winner;
    const loser=1-winner;
    const win=state.players[winner],lose=state.players[loser];
    const detail=state.result?.attempt;
    const playerResult=(p,i)=>'<article class="pv-final-player '+(i===winner?'is-winner':'is-loser')+'">'+
      '<div class="pv-final-player-name"><span class="pv-final-player-icon">'+esc(p.icon)+'</span>'+
      '<div><small>'+(i+1)+'P・'+difficultyName(i)+'</small><strong>'+esc(p.name)+'</strong></div></div>'+
      '<div class="pv-final-player-life">'+heart(state.lives[i])+'</div>'+
      '<div class="pv-final-player-stats"><span>SCORE <b>'+state.scores[i]+'</b></span>'+
      '<span>PERFECT <b>'+state.perfects[i]+'回</b></span></div>'+
      '</article>';
    // WIN introduction gets a clean backdrop instead of repeating WIN beneath
    // the giant cut-in. The actual scoreboard appears after the fanfare.
    if(state.cutin?.kind==='win')return '<div class="pv-final-intro" aria-hidden="true"></div>';
    return '<div class="pv-final-landscape">'+
      '<header class="pv-final-header"><button type="button" class="pv-final-back" data-back>← モード選択へ</button>'+
      '<strong>KO決着！ <span>TURN '+state.turnNo+' / '+matchupLabel()+'</span></strong></header>'+
      '<div class="pv-final-content">'+
      '<section class="pv-final-victory" aria-label="勝者">'+
      
      '<h1>WIN！</h1>'+
      '<div class="pv-final-winner-name"><span>'+esc(win.icon)+'</span><strong>'+esc(win.name)+'</strong></div>'+
      '<p>'+(winner+1)+'Pの勝利！</p></section>'+
      '<section class="pv-final-detail">'+
      '<div class="pv-final-players">'+state.players.map(playerResult).join('')+'</div>'+
      '<div class="pv-final-decisive"><strong>決着：TURN '+state.turnNo+' / 合格 ±'+state.activeSafe+'</strong>'+
      '<span>'+esc(lose.name)+'：STOP '+detail.value+' / 誤差 '+detail.error+'</span></div>'+
      '</section></div>'+
      '<footer class="pv-final-actions">'+
      '<button type="button" class="pv-final-primary" data-rematch>同じ2人でもう一度</button>'+
      '<button type="button" class="pv-final-secondary" data-new-players>プレイヤーを変更</button>'+
      '<button type="button" class="pv-final-secondary" data-home>ゲームをえらぶ</button>'+
      '</footer>'+
      '<div class="pv-rotate-overlay" data-rotate hidden><div><strong>スマホを横向きにしてね</strong>'+
      '<p>勝利画面も横画面専用です。<br>横向きにすると結果と再戦ボタンが表示されます。</p></div></div>'+
      '</div>';
  }
  // Full-screen cut-ins sit above both the bar and the target. Every scene is
  // transient and controlled by the same turn timer; no queued animation can
  // leak into the next turn, rematch, or results screen.
  function cutinHtml(){return effects.cutinHtml(state.cutin)}
  function setCutin(kind,title,subtitle='',rank='',kicker='',duration=2500){
    state.cutin={kind,title,subtitle,rank,kicker,duration};
  }

  function render(){
    if(['select','pick','manage','form'].includes(state.screen))syncIds();
    root.className='pitadome-app pv-app screen-'+state.screen;
    root.innerHTML=({select:selectScreen,pick:pickScreen,manage:manageScreen,form:formScreen,battle:battleScreen,final:finalScreen}[state.screen]||selectScreen)()+cutinHtml();
    syncRotate();
  }
  function stopTimers(){
    if(state.raf)cancelAnimationFrame(state.raf);
    if(state.timer)clearTimeout(state.timer);
    state.raf=0;state.timer=0;state.cutin=null;
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
    // Keep a shared LEVEL progression but randomize the target and gimmicks
    // per player. Never reuse the immediately preceding target number.
    const stageTurn=state.turnNo%2===1?state.turnNo:state.turnNo-1;
    state.profile=rules.roundProfile(stageTurn,state.difficulties[state.currentSide],Math.random,state.lastTarget);
    state.lastTarget=state.profile.target;
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
    state.attempts=[null,null];state.turnNo=1;state.profile=null;state.lastTarget=null;state.recorded=false;state.resultReady=false;
    state.lifeWarningPending=[false,false];
    beginTurn();
  }
  function countdown(){
    if(state.screen!=='battle'||state.phase!=='ready'||!landscape())return;
    stopTimers();
    const i=activeIndex();
    // Warn only on the NEXT time this player starts, not when the hit lands.
    // Keep the pending flag until the warning finishes: interrupted rotation
    // or app backgrounding must not silently consume the one-time alert.
    if(state.lives[i]===1&&state.lifeWarningPending[i]){
      state.phase='warning';
      const dangerDuration=effects.TIMING.danger;
      setCutin('danger','残りライフ 1！','次に判定外ならKO！','','DANGER',dangerDuration);
      render();
      state.timer=setTimeout(()=>{
        state.timer=0;
        if(state.screen!=='battle'||state.phase!=='warning'||activeIndex()!==i||!landscape())return;
        state.lifeWarningPending[i]=false;
        if(state.turnNo===1)beginCountdown();
        else startMotion();
      },dangerDuration);
      return;
    }
    // 3-2-1 is the opening ceremony, not a delay on every handoff.
    if(state.turnNo===1)beginCountdown();
    else startMotion();
  }
  function beginCountdown(){
    if(state.screen!=='battle'||!['ready','warning'].includes(state.phase)||!landscape())return;
    state.phase='countdown';state.countdown=3;
    const countMs=effects.TIMING.countdown,startMs=effects.TIMING.start;
    setCutin('countdown','3','','','',countMs);
    render();
    function step(){
      if(state.phase!=='countdown'||state.screen!=='battle'||!landscape())return;
      if(state.countdown>1){
        state.countdown--;
        setCutin('countdown',String(state.countdown),'','','',countMs);
        render();state.timer=setTimeout(step,countMs);
      }else if(state.countdown===1){
        state.countdown=0;
        setCutin('start','START！','','','',startMs);
        render();state.timer=setTimeout(step,startMs);
      }else startMotion();
    }
    state.timer=setTimeout(step,countMs);
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
    if(state.screen!=='battle'||!['countdown','ready','warning'].includes(state.phase)||!landscape())return;
    state.phase='moving';state.cutin=null;
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
    effects.vibrate(attempt.tier,settingsApi);
    state.attempts[i]=attempt;state.combos[i]=attempt.combo;state.greatStreaks[i]=attempt.greatStreak;
    state.charges[i]=attempt.charge;state.scores[i]=attempt.total;
    state.quiet[i]=attempt.quiet;state.mushinReady[i]=attempt.mushinReady;
    if(attempt.perfect)state.perfects[i]++;
    const lifeBefore=state.lives[i];
    const reward=rules.applyRewards(state.lives[i],attempt);
    state.lives[i]=reward.life;
    // Re-arm only for a fresh drop from 2/3 lives to 1 life.
    // Remaining at 1 never repeats; healing above 1 clears the old warning.
    if(lifeBefore>1&&reward.life===1)state.lifeWarningPending[i]=true;
    else if(reward.life!==1)state.lifeWarningPending[i]=false;
    const other=1-i;
    state.pendingPressure[other]=Math.min(rules.MAX_PRESSURE,state.pendingPressure[other]+reward.pressure);
    state.result={attempt,reward,winner:reward.life<=0?other:null};
    state.phase='judged';state.resultReady=false;
    const rank=attempt.error>attempt.safe?'out':attempt.tier;
    const scoreLabel='＋'+attempt.points+' POINT';
    const extra=attempt.chargeReward?'　回復ゲージMAX！':attempt.special?'　特別効果発動！':'';
    const duration=effects.TIMING[rank];
    // Every tier shows its English grade first, then the detailed numeric result.
    setCutin('judge',effects.LABEL[rank],scoreLabel+extra,rank,'JUDGEMENT',duration);
    render();
    const judgedTurn=state.turnNo;
    state.timer=setTimeout(()=>{
      state.timer=0;
      if(state.screen!=='battle'||state.phase!=='judged'||state.turnNo!==judgedTurn)return;
      state.cutin=null;state.resultReady=true;render();
    },duration);
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
    stopTimers();
    state.screen='final';
    const champion=state.players[winner];
    const winDuration=effects.TIMING.win;
    setCutin('win','WIN！',champion.icon+' '+champion.name+'！','',((winner+1)+'P CHAMPION'),winDuration);
    state.timer=setTimeout(()=>{
      state.timer=0;
      if(state.screen!=='final')return;
      state.cutin=null;render();
    },winDuration);
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
    if(state.screen==='final'&&state.cutin)return;
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
    if(b.hasAttribute('data-diff')){const i=Number(b.dataset.side),mode=b.dataset.diff;if((i===0||i===1)&&['easy','normal'].includes(mode)){state.difficulties[i]=mode;render()}return}
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
  // PC keyboard: Enter/Space confirms the main action (ready, STOP, next).
  // Focused buttons keep their normal keyboard behavior; editable fields are ignored.
  document.addEventListener('keydown',function(e){
    if(!['Enter',' ','Spacebar'].includes(e.key)||e.repeat||e.isComposing||
      e.ctrlKey||e.altKey||e.metaKey)return;
    const t=e.target,tag=String(t?.tagName||'').toUpperCase();
    if(t?.isContentEditable||['INPUT','TEXTAREA','SELECT'].includes(tag))return;
    const focused=t?.closest?.('button,a,[role="button"]');
    if(focused&&!focused.hasAttribute?.('data-stop'))return;
    if(state.screen==='battle'){
      if(!landscape()||state.cutin)return;
      if(!['ready','moving','judged'].includes(state.phase))return;
      if(state.phase==='judged'&&!state.resultReady)return;
      e.preventDefault();
      if(state.phase==='ready')countdown();
      else if(state.phase==='moving')stopPlayer(activeIndex());
      else nextTurn();
    }else if(!focused&&state.screen==='select'){
      e.preventDefault();beginMatch();
    }else if(!focused&&state.screen==='final'&&!state.cutin){
      e.preventDefault();beginMatch();
    }
  });
  document.addEventListener('visibilitychange',function(){
    if(document.visibilityState==='hidden'&&state.screen==='battle'&&['moving','countdown','warning'].includes(state.phase)){
      stopTimers();state.phase='ready';state.motion=null;state.value=state.profile.minValue;render();
    }
  });
  window.addEventListener('resize',()=>{if(state.screen==='battle'&&['moving','countdown','warning'].includes(state.phase)&&!landscape()){stopTimers();state.phase='ready';state.motion=null;render()}else syncRotate()});
  window.addEventListener('orientationchange',()=>{if(state.screen==='battle'&&['moving','countdown','warning'].includes(state.phase)&&!landscape()){stopTimers();state.phase='ready';state.motion=null;render()}else syncRotate()});
  window.addEventListener('pagehide',stopTimers);
  state.ids=readIds();syncIds();render();
})();