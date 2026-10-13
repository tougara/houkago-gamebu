(function(){
  'use strict';
  const root=document.getElementById('pitadome-versus');
  const registry=window.HoukagoPlayers;
  const rules=window.PitadomeVersusRules;
  if(!root||!registry||!rules)return;
  const KEY='houkago_pitadome_versus_players_v1';
  const state={
    screen:'select',ids:[],targetSlot:0,editId:null,formIcon:'',
    difficulty:'normal',round:1,profile:null,players:[],
    lives:[3,3],perfects:[0,0],attempts:[null,null],
    order:[0,1],turn:0,phase:'ready',countdown:3,
    value:0,dir:1,elapsed:0,lastTs:0,raf:0,timer:0,
    result:null,recorded:false,notice:''
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
      '<div class="pv-rules"><h2>勝ち方</h2><p>2人ともライフ3。毎ラウンド、同じ目標・同じ難しさで先攻と後攻が交互にSTOPするよ。</p>'+
      '<p>セーフ範囲を外すとライフ−1。PERFECTならライフ＋1（最大3）、相手がPERFECTでなければ相手に1ダメージ！</p>'+
      '<p>ラウンドが進むほどセーフ範囲は狭くなる。早押し加点はなし。両者のSTOP後に結果をまとめて判定するよ。</p></div>'+
      '<div class="pv-rules"><h2>むずかしさ</h2><div class="pv-diff-choice">'+
      '<button type="button" data-diff="easy" class="'+(state.difficulty==='easy'?'selected':'')+'">かんたん</button>'+
      '<button type="button" data-diff="normal" class="'+(state.difficulty==='normal'?'selected':'')+'">通常</button></div>'+
      '<p class="pv-note">後半は誤差±1、最後は誤差0だけがセーフ！ 2人とも同時にライフ0なら引き分け。</p></div>'+
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
  function activeIndex(){return state.order[state.turn]}
  function stopSummary(i){
    const a=state.attempts[i];
    if(!a)return '<span>STOP待ち</span>';
    return '<span>'+(a.perfect?'PERFECT！':a.error<=state.profile.safe?'SAFE':'OUT')+' / STOP '+a.value+' / 誤差 '+a.error+'</span>';
  }
  function meterLabels(){return '<div class="pv-meter-labels"><span>0</span><span>50</span><span>100</span></div>'}
  function panel(i){
    const p=state.players[i],a=state.attempts[i];
    const active=state.phase==='moving'&&activeIndex()===i;
    const focused=!a&&activeIndex()===i&&['ready','countdown','moving'].includes(state.phase);
    const status=a?(a.perfect?'PERFECT！':a.error<=state.profile.safe?'セーフ！':'範囲外！'):
      focused?(state.phase==='moving'?'いまだ！ STOP！':state.phase==='countdown'?'カウント中':'順番待機完了'):'相手のターンを待ってね';
    const cursorPct=clamp(state.value,0,100);
    const target=state.profile.target;
    const blind=state.profile.blind;
    const showing=active||a;
    const pct=a?a.value:active?cursorPct:0;
    return '<section class="pv-panel '+(active?'pv-active':a?'pv-done':focused?'pv-active':'')+'" data-side="'+i+'">'+
      '<div class="pv-panel-top"><span class="pv-panel-icon">'+esc(p.icon)+'</span><strong class="pv-panel-name">'+esc(p.name)+'</strong><span class="pv-panel-side">'+(i+1)+'P</span></div>'+
      '<div class="pv-lives" data-lives="'+i+'">'+heart(state.lives[i])+'</div>'+
      '<div class="pv-stats"><span>PERFECT '+state.perfects[i]+'</span><span>'+(a?'誤差 '+a.error:'挑戦待ち')+'</span></div>'+
      '<div class="pv-panel-status" data-status="'+i+'">'+status+'</div>'+
      '<div class="pv-panel-target">目標 '+target+'</div>'+
      '<div class="pv-lane-wrap"><div style="width:100%"><div class="pv-meter">'+
      '<div class="pv-meter-line"></div><div class="pv-meter-target" style="left:'+target+'%"></div>'+
      (blind?'<div class="pv-meter-blind" style="left:'+blind.start+'%;width:'+(blind.end-blind.start)+'%"></div>':'')+
      (showing?'<div class="pv-meter-cursor" id="pv-cursor-'+i+'" style="left:'+pct+'%;'+(blind&&pct>=blind.start&&pct<=blind.end?'visibility:hidden':'')+'"></div>':'')+
      '</div>'+meterLabels()+'</div></div>'+
      '<button type="button" class="pv-stop" data-stop="'+i+'" '+(active?'':'disabled')+'>STOP！</button>'+
      '<div class="pv-panel-summary">'+(a?stopSummary(i):'　')+'</div></section>';
  }
  function consoleHtml(){
    if(state.phase==='ready')return '<p>'+(activeIndex()+1)+'P '+esc(state.players[activeIndex()].name)+' の番！</p>'+
      '<button class="pv-next" type="button" data-start-turn>準備OK！ スタート</button>';
    if(state.phase==='countdown')return '<p style="font-size:clamp(28px,7vw,48px);color:#ffe393">'+state.countdown+'</p>';
    if(state.phase==='moving')return '<p>'+(activeIndex()+1)+'P がプレイ中！ バーを見てSTOP！</p><small>相手のボタンは押せないよ</small>';
    if(state.phase==='handoff')return '<p>'+esc(state.players[state.order[1]].name)+' の番に交代！</p>'+
      '<button class="pv-next" type="button" data-handoff>後攻の準備へ</button>';
    if(state.phase==='judged'){
      const a=state.attempts,r=state.result;
      const line=r.damage.map((n,i)=>state.players[i].name+' '+(n?'−1':'−0')+(r.healed[i]?' / 回復＋1':'')).join('　｜　');
      return '<p>ROUND '+state.round+' の判定：'+esc(line)+'</p>'+
        '<button class="pv-next" type="button" data-next-round>次のラウンドへ</button>';
    }
    return '';
  }
  function battleScreen(){
    const prof=state.profile;
    return '<div class="pv-battle"><div class="pv-top"><button class="nav-pill" type="button" data-leave>← 対戦をやめる</button><div class="pv-round-title">ROUND '+state.round+' / '+(state.difficulty==='easy'?'かんたん':'通常')+'</div></div>'+
      '<div class="pv-safety">セーフ範囲 ±'+prof.safe+(prof.safe===0?'（ピッタリのみ）':'')+'</div>'+
      '<div class="pv-shared-target"><span>この数字をねらえ！</span><strong>'+prof.target+'</strong></div>'+
      '<div class="pv-panels">'+panel(0)+panel(1)+'</div>'+
      '<div class="pv-console">'+consoleHtml()+'</div></div>';
  }
  function finalScreen(){
    const w=state.result?.winner,draw=w==null;
    return nav()+'<div class="pv-wrap">'+heading('KO決着！','全'+state.round+'ラウンドの勝負')+
      '<section class="pv-result"><h1>'+(draw?'DRAW！':'WIN！')+'</h1>'+
      '<h2>'+(draw?'同時KOで引き分け！':esc(state.players[w].icon+' '+state.players[w].name)+' の勝利！')+'</h2>'+
      '<div class="pv-result-grid">'+state.players.map((p,i)=>'<div class="pv-result-card"><small>'+(i+1)+'P</small><strong>'+esc(p.icon)+'</strong>'+
      '<strong>'+esc(p.name)+'</strong><div class="pv-heart">'+heart(state.lives[i])+'</div><small>PERFECT '+state.perfects[i]+'回</small></div>').join('')+'</div>'+
      '<button class="btn full" type="button" data-rematch>同じ2人でもう一度</button>'+
      '<button class="btn secondary full" type="button" data-new-players>プレイヤーを変更</button>'+
      '<button class="btn secondary full" type="button" data-home>ゲームをえらぶ</button></section></div>';
  }
  function render(){
    if(state.screen==='select'||state.screen==='pick'||state.screen==='manage'||state.screen==='form')syncIds();
    root.className='pitadome-app pv-app screen-'+state.screen;
    root.innerHTML=({select:selectScreen,pick:pickScreen,manage:manageScreen,form:formScreen,battle:battleScreen,final:finalScreen}[state.screen]||selectScreen)();
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
  function beginRound(){
    state.profile=rules.roundProfile(state.round,state.difficulty);
    state.order=[rules.firstPlayer(state.round),1-rules.firstPlayer(state.round)];
    state.turn=0;state.attempts=[null,null];state.phase='ready';
    state.result=null;state.value=0;state.dir=1;state.elapsed=0;
    switchScreen('battle');
  }
  function beginMatch(){
    syncIds();
    if(state.ids.length!==2||state.ids[0]===state.ids[1]){state.notice='2人のプレイヤーを選んでね。';render();return}
    state.players=state.ids.map(id=>roster().find(p=>p.id===id));
    if(state.players.some(p=>!p)){state.notice='メンバー情報を確認してね。';render();return}
    saveIds();
    state.lives=[3,3];state.perfects=[0,0];state.round=1;state.recorded=false;beginRound();
  }
  function countdown(){
    if(state.screen!=='battle'||state.phase!=='ready')return;
    stopTimers();state.phase='countdown';state.countdown=3;render();
    function step(){
      if(state.phase!=='countdown'||state.screen!=='battle')return;
      state.countdown--;
      if(state.countdown===0){startMotion();return}
      render();state.timer=setTimeout(step,630);
    }
    state.timer=setTimeout(step,630);
  }
  function speedMultiplier(){
    const p=state.profile;
    if(p.movement==='accel')return Math.min(1.45,.75+state.elapsed*.13);
    if(p.movement==='change')return .8+.35*(1+Math.sin(state.elapsed*2.2));
    return 1;
  }
  function updatePosition(ts){
    if(!state.lastTs){state.lastTs=ts;return}
    const dt=clamp((ts-state.lastTs)/1000,0,.07);
    state.lastTs=ts;state.elapsed+=dt;
    const delta=dt*state.profile.speed*speedMultiplier();
    let next=state.value+state.dir*delta;
    if(next>100){next=200-next;state.dir=-1}
    if(next<0){next=-next;state.dir=1}
    state.value=clamp(next,0,100);
  }
  function paintCursor(){
    const i=activeIndex(),el=document.getElementById('pv-cursor-'+i);
    if(!el)return;
    const pct=state.value,b=state.profile.blind;
    el.style.left=pct+'%';
    el.style.visibility=b&&pct>=b.start&&pct<=b.end?'hidden':'visible';
  }
  function motionFrame(ts){
    if(state.phase!=='moving'||state.screen!=='battle')return;
    updatePosition(ts);paintCursor();
    state.raf=requestAnimationFrame(motionFrame);
  }
  function startMotion(){
    if(state.screen!=='battle'||state.phase!=='countdown')return;
    state.phase='moving';
    state.value=0;state.dir=1;state.elapsed=0;state.lastTs=performance.now();
    render();state.raf=requestAnimationFrame(motionFrame);
  }
  function stopPlayer(i){
    if(state.screen!=='battle'||state.phase!=='moving'||activeIndex()!==i)return;
    updatePosition(performance.now());
    const a=rules.evaluateStop(state.value,state.profile.target);
    stopTimers();state.attempts[i]=a;
    if(a.perfect)state.perfects[i]++;
    if(state.turn===0){state.phase='handoff'}
    else judgeRound();
    render();
  }
  function handoff(){
    if(state.phase!=='handoff')return;
    state.turn=1;state.phase='ready';state.value=0;state.lastTs=0;render();
  }
  function judgeRound(){
    state.result=rules.resolveRound(state.lives,state.attempts,state.profile.safe);
    state.lives=state.result.lives;
    if(state.result.knockout){finishMatch();return}
    state.phase='judged';
  }
  function finishMatch(){
    if(!state.recorded){
      state.recorded=true;
      const ids=state.players.map(p=>registry.resolveId(p));
      const winners=state.result.winner==null?[]:[ids[state.result.winner]];
      const metrics={};
      ids.forEach((id,i)=>{if(id)metrics[id]={totalPerfects:state.perfects[i],totalDraws:state.result.winner==null?1:0}});
      registry.recordGame({gameId:'pitadome-challenge-versus',participants:state.players,winners,metrics});
    }
    state.screen='final';
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
    if(b.hasAttribute('data-stop'))return;
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
    if(b.hasAttribute('data-handoff')){handoff();return}
    if(b.hasAttribute('data-next-round')){if(state.phase!=='judged')return;state.round++;beginRound();return}
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
      stopTimers();state.phase='ready';state.value=0;render();
    }
  });
  window.addEventListener('pagehide',stopTimers);
  state.ids=readIds();syncIds();render();
})();