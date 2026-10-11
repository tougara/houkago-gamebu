(function(){
  'use strict';

  const app=document.getElementById('app');
  const playersApi=window.HoukagoPlayers;
  const settingsApi=window.HoukagoSettings;
  const resumeApi=window.HoukagoResume;

  const COLS=7;
  const VISIBLE_ROWS=13;
  const HIDDEN_ROWS=2;
  const ROWS=VISIBLE_ROWS+HIDDEN_ROWS;
  const SPAWN_X=3;
  const SPAWN_Y=1;
  const LOCK_DELAY=300;
  const RESUME_ID='link-burst';
  const RANK_KEY='houkago_link_burst_ranking_v1';
  const PB_KEY='houkago_link_burst_personal_best_v1';
  const SOLO_KEY='houkago_link_burst_solo_index_v1';
  const SOLO_PLAYER_ID_KEY='houkago_link_burst_solo_player_id_v1';
  const TUTORIAL_KEY='houkago_link_burst_tutorial_seen_v1';
  const COLORS=['blue','red','yellow','green'];
  const SYMBOL={blue:'○',red:'△',yellow:'★',green:'◇'};

  const ROTATIONS=[
    [[0,0,'a'],[1,0,'b']],
    [[0,0,'a'],[0,1,'b']],
    [[0,0,'a'],[-1,0,'b']],
    [[0,0,'a'],[0,-1,'b']]
  ];

  const state={
    screen:'title',
    history:[],
    mode:'endless',
    rankMode:'endless',
    gameStarted:false,
    paused:false,
    resolving:false,
    board:makeBoard(),
    piece:null,
    queue:[],
    score:0,
    maxLink:0,
    maxCombo:0,
    clears:0,
    pieces:0,
    timeLeft:120,
    timeExpired:false,
    player:{id:'',name:'プレイヤー1',icon:'🐶'},
    soloIndex:0,
    registerIcon:null,
    fallAccum:0,
    lockAccum:0,
    softDrop:false,
    lastFrame:0,
    rafId:null,
    resumeAccum:0,
    chargedKeys:new Set(),
    clearingKeys:new Set(),
    fallingKeys:new Set(),
    chainActive:false,
    rankResult:null
  };

  let repeatDelayId=null;
  let repeatId=null;

  function makeBoard(){
    return Array.from({length:ROWS},()=>Array(COLS).fill(null));
  }
  function esc(v){
    return String(v==null?'':v).replace(/[&<>"']/g,function(m){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]});
  }
  function clamp(n,a,b){return Math.max(a,Math.min(b,n))}
  function sleep(ms){return new Promise(function(resolve){setTimeout(resolve,ms)})}
  async function delay(ms){
    let remaining=ms;
    while(remaining>0){
      if(state.paused){await sleep(60);continue}
      const step=Math.min(remaining,60);
      await sleep(step);
      remaining-=step;
    }
  }
  function reducedMotion(){return document.documentElement.dataset.hgMotion==='reduced'}
  function vibrate(pattern){settingsApi&&settingsApi.vibrate&&settingsApi.vibrate(pattern)}

  function rosterPlayers(){
    const data=playersApi&&playersApi.load?playersApi.load():null;
    return data&&Array.isArray(data.players)?data.players:[];
  }
  function loadPlayer(){
    const players=rosterPlayers();
    let id='',legacyIndex=0;
    try{
      id=localStorage.getItem(SOLO_PLAYER_ID_KEY)||'';
      legacyIndex=Number(localStorage.getItem(SOLO_KEY)||0);
    }catch(e){}
    let idx=id?players.findIndex(function(p){return p.id===id}):-1;
    if(idx<0){
      idx=Number.isInteger(legacyIndex)&&legacyIndex>=0&&legacyIndex<players.length?legacyIndex:0;
    }
    state.soloIndex=idx;
    state.player=players[idx]||{id:'',name:'プレイヤー1',icon:'🐶'};
    return players;
  }
  function selectSoloPlayer(id){
    const players=rosterPlayers();
    const idx=players.findIndex(function(p){return p.id===id});
    if(idx<0)return false;
    state.soloIndex=idx;
    state.player=players[idx];
    try{
      localStorage.setItem(SOLO_PLAYER_ID_KEY,id);
      localStorage.setItem(SOLO_KEY,String(idx));
    }catch(e){}
    return true;
  }

  function topNav(){
    return '<nav class="top-nav"><button type="button" class="nav-pill" data-back>← 1個前にもどる</button><button type="button" class="nav-pill" data-home>ゲームをえらぶ</button></nav>';
  }
  function heading(title,sub){
    return '<header class="screen-heading"><h1>'+esc(title)+'</h1>'+(sub?'<p>'+esc(sub)+'</p>':'')+'</header>';
  }

  function titleScreen(){
    loadPlayer();
    return topNav()+
      '<section class="title-card">'+
        '<img class="title-logo" src="../../link_burst_logo.png" alt="リンクバースト！">'+
        '<p class="title-copy">つないで、落として、バースト！<br>2個のブロックが分かれて落ちる、新感覚リンクパズル。</p>'+
        '<div class="stack title-actions">'+
          '<button class="btn" data-start>ゲームをはじめる</button>'+
          '<button class="btn secondary" data-rules>あそびかた</button>'+
          '<button class="btn secondary" data-ranking>ランキング</button>'+
        '</div>'+
        '<div class="title-player">'+esc(state.player.icon)+' '+esc(state.player.name)+'でプレイ</div>'+
      '</section>';
  }

  function playTypeScreen(){
    return topNav()+heading('遊び方をえらぶ','まずは1人用を完成。2人対戦は次の段階で追加します。')+
      '<div class="choice-grid">'+
        '<button class="choice-card solo" data-play-type="solo"><span class="mode-badge">PLAYABLE</span><strong>1人であそぶ</strong><span>ENDLESSと2 MINUTES。連鎖とハイスコアに挑戦。</span></button>'+
        '<button class="choice-card versus" disabled><span class="mode-badge">NEXT STEP</span><strong>2人で対戦</strong><span>横画面・JAM・COUNTER・攻撃演出は次の実装段階で追加。</span></button>'+
      '</div>';
  }

  function modeScreen(){
    loadPlayer();
    return topNav()+heading('1人用モード','遊びたいルールをえらんでね。')+
      '<section class="card solo-current-card mode-player-card">'+
        '<div class="solo-current-row"><div class="solo-current-person">'+
          '<span class="solo-current-icon">'+esc(state.player.icon)+'</span>'+
          '<div class="solo-current-details">'+
            '<small class="solo-current-caption">今回のプレイヤー</small>'+
            '<strong>'+esc(state.player.name)+'</strong>'+
          '</div>'+
        '</div><button class="solo-change-btn" type="button" data-change-player>変更</button></div>'+
      '</section>'+
      '<div class="choice-grid">'+
        '<button class="choice-card solo" data-mode="endless"><span class="mode-badge">ENDLESS</span><strong>エンドレス</strong><span>積み上がるまで挑戦。置くほど少しずつスピードアップ。</span></button>'+
        '<button class="choice-card solo" data-mode="timed"><span class="mode-badge">2 MINUTES</span><strong>2分スコアアタック</strong><span>120秒でどこまで得点できるか勝負。</span></button>'+
      '</div>';
  }

  function playerListScreen(){
    const players=rosterPlayers();
    const limit=playersApi&&playersApi.ROSTER_MAX||15;
    return topNav()+heading('プレイヤーを変更','登録済みのメンバーから1人選んでね。')+
      '<section class="card solo-list">'+players.map(function(p){
        const selected=p.id===state.player.id;
        return '<button type="button" class="solo-choice '+(selected?'selected':'')+'" data-solo-player-id="'+esc(p.id)+'" aria-pressed="'+selected+'">'+
          '<span>'+esc(p.icon)+'</span><strong>'+esc(p.name)+'</strong>'+(selected?'<small>選択中</small>':'')+'</button>';
      }).join('')+'</section>'+
      '<div class="stack player-select-actions">'+
        '<button class="btn secondary" type="button" data-player-add '+(players.length>=limit?'disabled':'')+'>＋ 新しいプレイヤーを登録</button>'+
        (players.length>=limit?'<p class="solo-hint">登録は最大'+limit+'人までです。</p>':'')+
      '</div>';
  }

  function playerRegisterScreen(){
    const data=playersApi&&playersApi.load?playersApi.load():null;
    const used=new Set((data&&data.roster||[]).map(function(p){return p.icon}));
    const free=(playersApi&&playersApi.ICONS||[]).filter(function(icon){return !used.has(icon)});
    const chosen=free.includes(state.registerIcon)?state.registerIcon:free[0];
    return topNav()+heading('新しく登録','名前とアイコンを決めてね。')+
      '<form class="card solo-register" data-player-register>'+
        '<label class="solo-register-label" for="solo-register-name">プレイヤー名</label>'+
        '<input id="solo-register-name" name="playerName" type="text" maxlength="12" autocomplete="off" placeholder="名前を入力" required>'+
        '<div class="solo-register-label">アイコンを選ぶ</div>'+
        '<div class="solo-register-icons">'+free.map(function(icon){
          return '<button type="button" class="solo-icon-choice '+(icon===chosen?'selected':'')+'" data-register-icon="'+esc(icon)+'" aria-label="'+esc(icon)+'" aria-pressed="'+(icon===chosen)+'">'+esc(icon)+'</button>';
        }).join('')+'</div>'+
        '<p class="solo-register-error" data-register-error role="alert"></p>'+
        '<button class="btn" type="submit">このプレイヤーを登録する</button>'+
        '<button class="btn secondary" type="button" data-register-cancel>登録せずに戻る</button>'+
      '</form>';
  }

  function rulesScreen(){
    return topNav()+heading('あそびかた','基本は4つ。置いたあとの分離がポイント。')+
      '<div class="rules-wrap">'+
        '<section class="card rule-card"><h2>1. 2個セットで落ちてくる</h2><div class="rule-visual"><div class="rule-pair"><i class="pair-a">○</i><i class="pair-b">△</i></div></div><p>2個の色は4色から選ばれます。同じ色のペアが来ることもあります。NEXTとNEXT 2で先の色まで確認できます。</p></section>'+
        '<section class="card rule-card"><h2>2. LOCKすると2個に分かれる</h2><p>2個セットで着地したあと、それぞれ別々のブロックになります。支えのない方だけ真下へ落下するので、段差を利用して連鎖を作ろう。</p></section>'+
        '<section class="card rule-card"><h2>3. 同じ色を4個以上つなげる</h2><p>上下左右につながった同色4個以上で消去。消したあとにまた4個つながると2 LINK、3 LINK…と続きます。</p></section>'+
        '<section class="card rule-card"><h2>4. 操作</h2><div class="control-demo"><span class="demo-left">←</span><span class="demo-right">→</span><span class="demo-rotate">↻</span><span class="demo-down">↓</span></div><p>上段は← → ↻、下段は←と→の中央に↓。←→は長押し移動、↓は高速落下、↻は90°右回転です。<br>キーボードは A＝左、D＝右、S＝下、Enter＝回転。矢印キーでも操作できます。</p></section>'+
      '</div>'+
      '<div class="stack" style="margin-top:10px"><button class="btn secondary" data-rules-back>← もどる</button></div>';
  }

  function miniPieceHtml(t){
    if(!t)return '';
    return '<div class="mini-piece"><i class="mini-block p0 c-'+t.a+'"></i><i class="mini-block p1 c-'+t.b+'"></i></div>';
  }

  function playScreen(){
    return topNav()+
      '<section class="play-hud">'+
        '<div class="score-panel">'+
          '<div class="hud-box score-box"><small>SCORE</small><strong data-score>0</strong><em data-best-score>BEST 0</em></div>'+
          '<div class="hud-box link" aria-label="最大連鎖数"><small>LINK</small><strong data-max-link>0</strong></div>'+
          '<div class="hud-box"><small data-third-label>'+(state.mode==='timed'?'TIME':'BLOCKS')+'</small><strong data-third-value>0</strong></div>'+
        '</div>'+
      '</section>'+
      '<section class="board-stage">'+
        '<div class="board-frame" data-board-frame>'+
          '<span class="danger-label">DANGER</span>'+
          '<div class="game-board" data-board></div>'+
        '</div>'+
        '<aside class="next-panel" aria-label="次のブロックと一時停止">'+
          '<div class="next-box"><small>NEXT</small><div data-next-one>'+miniPieceHtml(state.queue[0])+'</div></div>'+
          '<div class="next-box"><small>NEXT 2</small><div data-next-two>'+miniPieceHtml(state.queue[1])+'</div></div>'+
          '<button type="button" class="pause-btn" data-pause aria-label="一時停止"><strong>Ⅱ</strong><small>PAUSE</small></button>'+
        '</aside>'+
        '<div class="chain-banner" data-chain-banner><small>CHAIN</small><strong>1 LINK</strong></div>'+
        '<div class="combo-fx" data-combo-fx><strong>2 COMBO!</strong><span>SIMULTANEOUS CLEAR</span></div>'+
        '<div class="chain-flash" data-chain-flash></div>'+
        '<div class="particle-layer" data-particle-layer aria-hidden="true"></div>'+
        '<div class="link-fx" data-link-fx><strong></strong><span></span></div>'+
        '<div class="score-pop" data-score-pop></div>'+ 
        '<div class="play-tip" data-play-tip>← → 移動　↓ 高速落下　↻ 回転</div>'+
      '</section>'+
      '<section class="controls" aria-label="操作">'+
        '<button class="control-btn" data-control="left" aria-label="左へ">←</button>'+
        '<button class="control-btn" data-control="right" aria-label="右へ">→</button>'+
        '<button class="control-btn rotate" data-control="rotate" aria-label="右回転">↻</button>'+
        '<button class="control-btn" data-control="down" aria-label="速く落とす">↓</button>'+
      '</section>';
  }

  function resultScreen(){
    const r=state.rankResult||{};
    let banner='チャレンジ終了';
    if(r.modeBest)banner='最高記録！';
    else if(r.rank)banner='ランキング '+r.rank+'位！';
    else if(r.personalBest)banner='自己ベスト更新！';
    const reason=r.reason==='time'?'2分終了':(r.reason==='topout'?'GAME OVER':'RESULT');
    return topNav()+heading(reason,state.mode==='timed'?'2 MINUTES':'ENDLESS')+
      '<section class="card result-card">'+
        '<div class="result-kicker">TOTAL SCORE</div>'+
        '<div class="result-score">'+state.score+'</div>'+
        '<div class="result-banner">'+esc(banner)+'</div>'+
        '<div class="result-stats">'+
          '<div class="result-stat"><small>MAX LINK</small><strong>'+state.maxLink+'</strong></div>'+
          '<div class="result-stat"><small>MAX COMBO</small><strong>'+state.maxCombo+'</strong></div>'+
          '<div class="result-stat"><small>CLEAR</small><strong>'+state.clears+'</strong></div>'+
        '</div>'+
      '</section>'+
      '<div class="stack" style="margin-top:10px">'+
        '<button class="btn" data-retry>もう一度！</button>'+
        '<button class="btn secondary" data-ranking>ランキングを見る</button>'+
        '<button class="btn secondary" data-mode-change>モードを変える</button>'+
        '<button class="btn secondary" data-home>ゲームをえらぶ</button>'+
      '</div>';
  }

  function rankingScreen(){
    return topNav()+heading('ハイスコアランキング','この端末のTOP10')+
      '<div class="ranking-tabs"><button class="'+(state.rankMode==='endless'?'selected':'')+'" data-rank-mode="endless">ENDLESS</button><button class="'+(state.rankMode==='timed'?'selected':'')+'" data-rank-mode="timed">2 MINUTES</button></div>'+
      '<section class="card ranking-card">'+rankingRows(state.rankMode)+'</section>'+
      '<div class="stack" style="margin-top:10px"><button class="btn secondary" data-ranking-back>← もどる</button></div>';
  }

  function rankingRows(mode){
    const rows=sortRanking(loadRankings()[mode]||[]);
    if(!rows.length)return '<div class="ranking-empty">まだ記録がありません。<br>最初のハイスコアを作ろう！</div>';
    return '<div class="ranking-list">'+rows.map(function(x,i){
      return '<div class="ranking-row '+(state.rankResult&&state.rankResult.entryId===x.id?'current':'')+'">'+
        '<div class="rank-no">'+(i+1)+'</div>'+
        '<div class="rank-player"><span>'+esc(x.icon)+'</span><strong>'+esc(x.name)+'</strong></div>'+
        '<div class="rank-score"><strong>'+x.score+'</strong><small>MAX LINK '+x.maxLink+'</small></div>'+
      '</div>';
    }).join('')+'</div>';
  }

  function screenHtml(){
    const map={title:titleScreen,playType:playTypeScreen,mode:modeScreen,playerList:playerListScreen,playerRegister:playerRegisterScreen,rules:rulesScreen,play:playScreen,result:resultScreen,ranking:rankingScreen};
    return (map[state.screen]||titleScreen)();
  }

  function render(){
    stopLoop();
    app.className='link-burst-app screen-'+state.screen;
    app.innerHTML=screenHtml();
    bind();
    window.scrollTo({top:0,behavior:'auto'});
    if(state.screen==='play'){
      drawBoard();
      updateHud();
      startLoop();
      maybeShowTutorial();
    }
  }

  function maybeShowTutorial(){
    let seen=false;
    try{seen=localStorage.getItem(TUTORIAL_KEY)==='1'}catch(e){}
    if(seen)return;
    const tip=document.querySelector('[data-play-tip]');
    if(!tip)return;
    tip.classList.add('show');
    setTimeout(function(){
      if(!tip.isConnected)return;
      tip.textContent='同じ色を4つつなげよう！';
    },2600);
    setTimeout(function(){
      if(tip.isConnected)tip.classList.remove('show');
      try{localStorage.setItem(TUTORIAL_KEY,'1')}catch(e){}
    },5600);
  }

  function go(screen,push){
    if(push!==false&&state.screen!==screen)state.history.push(state.screen);
    state.screen=screen;
    render();
  }

  function doBack(){
    if(state.screen==='play'&&state.gameStarted){showQuitConfirm('back');return}
    if(state.history.length){state.screen=state.history.pop();render();return}
    location.href='../';
  }

  function goHome(){
    if(state.screen==='play'&&state.gameStarted){showQuitConfirm('home');return}
    location.href='../';
  }

  function pauseGame(auto){
    if(state.screen!=='play'||!state.gameStarted||state.paused)return;
    state.paused=true;
    releaseControls();
    stopLoop();
    persistResume();
    document.querySelector('[data-pause-backdrop]')?.remove();

    const w=document.createElement('div');
    w.className='pause-backdrop';
    w.setAttribute('data-pause-backdrop','');
    w.innerHTML='<section class="card pause-card" role="dialog" aria-modal="true" aria-labelledby="pauseTitle">'+
      '<span class="pause-kicker">PAUSE</span>'+
      '<h2 id="pauseTitle">一時停止</h2>'+
      '<p>'+(auto?'画面を離れたため自動で停止しました。':'ゲームは止まっています。ゆっくり再開してね。')+'</p>'+
      '<div class="pause-summary"><span>SCORE <strong>'+state.score+'</strong></span><span>MAX LINK <strong>'+state.maxLink+'</strong></span></div>'+
      '<div class="stack"><button class="btn" type="button" data-pause-resume>ゲームに戻る</button><button class="btn secondary" type="button" data-pause-quit>やめる</button></div>'+
    '</section>';
    document.body.appendChild(w);

    w.querySelector('[data-pause-resume]').addEventListener('click',resumePausedGame);
    w.querySelector('[data-pause-quit]').addEventListener('click',function(){
      w.remove();
      showQuitConfirm('pause');
    });
  }

  function resumePausedGame(){
    document.querySelector('[data-pause-backdrop]')?.remove();
    if(!state.gameStarted)return;
    state.paused=false;
    state.lastFrame=performance.now();
    startLoop();
  }

  function showQuitConfirm(type){
    document.querySelector('.quit-backdrop')&&document.querySelector('.quit-backdrop').remove();
    state.softDrop=false;
    clearRepeat();
    stopLoop();
    const fromPause=type==='pause';
    if(fromPause)state.paused=true;

    const w=document.createElement('div');
    w.className='quit-backdrop';
    w.innerHTML='<section class="card quit-card" role="dialog" aria-modal="true" aria-labelledby="quitTitle">'+
      '<h2 id="quitTitle">ゲームをやめますか？</h2>'+
      '<p>現在のスコアはランキングに保存されません。</p>'+
      '<div class="stack"><button class="btn secondary" data-quit-cancel>続ける</button><button class="btn danger" data-quit-ok>やめる</button></div>'+
    '</section>';
    document.body.appendChild(w);

    w.querySelector('[data-quit-cancel]').addEventListener('click',function(){
      w.remove();
      if(fromPause){
        state.paused=false;
        pauseGame(false);
      }else if(state.gameStarted&&state.screen==='play'&&!state.paused){
        startLoop();
      }
    });

    w.querySelector('[data-quit-ok]').addEventListener('click',function(){
      w.remove();
      stopLoop();
      state.gameStarted=false;
      state.paused=false;
      state.resolving=false;
      state.chainActive=false;
      resumeApi&&resumeApi.clear&&resumeApi.clear(RESUME_ID);
      if(type==='home')location.href='../';
      else{
        state.history=[];
        state.screen='title';
        render();
      }
    });

    w.addEventListener('click',function(e){
      if(e.target===w){
        w.querySelector('[data-quit-cancel]').click();
      }
    });
  }

  function bind(){
    document.querySelector('[data-back]')&&document.querySelector('[data-back]').addEventListener('click',doBack);
    document.querySelectorAll('[data-home]').forEach(function(b){b.addEventListener('click',goHome)});
    document.querySelector('[data-start]')&&document.querySelector('[data-start]').addEventListener('click',function(){go('playType')});
    document.querySelector('[data-rules]')&&document.querySelector('[data-rules]').addEventListener('click',function(){go('rules')});
    document.querySelector('[data-rules-back]')&&document.querySelector('[data-rules-back]').addEventListener('click',doBack);
    document.querySelector('[data-change-player]')&&document.querySelector('[data-change-player]').addEventListener('click',function(){go('playerList')});
    document.querySelectorAll('[data-solo-player-id]').forEach(function(b){
      b.addEventListener('click',function(){
        if(selectSoloPlayer(b.dataset.soloPlayerId))doBack();
      });
    });
    document.querySelector('[data-player-add]')&&document.querySelector('[data-player-add]').addEventListener('click',function(){
      state.registerIcon=null;
      go('playerRegister');
    });
    document.querySelectorAll('[data-register-icon]').forEach(function(b){
      b.addEventListener('click',function(){
        state.registerIcon=b.dataset.registerIcon;
        document.querySelectorAll('[data-register-icon]').forEach(function(option){
          const selected=option===b;
          option.classList.toggle('selected',selected);
          option.setAttribute('aria-pressed',String(selected));
        });
      });
    });
    document.querySelector('[data-register-cancel]')&&document.querySelector('[data-register-cancel]').addEventListener('click',doBack);
    document.querySelector('[data-player-register]')&&document.querySelector('[data-player-register]').addEventListener('submit',function(e){
      e.preventDefault();
      const form=e.currentTarget;
      const error=form.querySelector('[data-register-error]');
      const name=form.querySelector('[name="playerName"]').value.trim();
      const before=playersApi&&playersApi.load?playersApi.load():null;
      if(!before||!playersApi.addPlayer||!playersApi.setPlayer){error.textContent='登録機能を読み込めませんでした。';return}
      if(!name){error.textContent='名前を入力してください。';return}
      if(before.roster.length>=playersApi.ROSTER_MAX){error.textContent='登録できる人数の上限です。';return}
      const used=new Set(before.roster.map(function(p){return p.icon}));
      const free=playersApi.ICONS.filter(function(icon){return !used.has(icon)});
      const icon=free.includes(state.registerIcon)?state.registerIcon:free[0];
      if(!icon){error.textContent='使用できるアイコンがありません。';return}
      const after=playersApi.addPlayer(name);
      const oldIds=new Set(before.roster.map(function(p){return p.id}));
      const created=after.roster.find(function(p){return !oldIds.has(p.id)});
      if(!created){error.textContent='登録できませんでした。';return}
      const idx=after.players.findIndex(function(p){return p.id===created.id});
      if(idx>=0&&created.icon!==icon)playersApi.setPlayer(idx,{icon:icon});
      selectSoloPlayer(created.id);
      state.registerIcon=null;
      state.history.pop();
      doBack();
    });
    document.querySelector('[data-play-type="solo"]')&&document.querySelector('[data-play-type="solo"]').addEventListener('click',function(){go('mode')});
    document.querySelectorAll('[data-mode]').forEach(function(b){b.addEventListener('click',function(){beginGame(b.dataset.mode)})});
    document.querySelectorAll('[data-ranking]').forEach(function(b){b.addEventListener('click',function(){state.rankMode=state.mode||'endless';go('ranking')})});
    document.querySelectorAll('[data-rank-mode]').forEach(function(b){b.addEventListener('click',function(){state.rankMode=b.dataset.rankMode;render()})});
    document.querySelector('[data-ranking-back]')&&document.querySelector('[data-ranking-back]').addEventListener('click',doBack);
    document.querySelector('[data-retry]')&&document.querySelector('[data-retry]').addEventListener('click',function(){beginGame(state.mode)});
    document.querySelector('[data-mode-change]')&&document.querySelector('[data-mode-change]').addEventListener('click',function(){state.history=['title','playType'];state.screen='mode';render()});
    document.querySelector('[data-pause]')&&document.querySelector('[data-pause]').addEventListener('click',function(){pauseGame(false)});

    document.querySelectorAll('[data-control]').forEach(function(btn){
      btn.addEventListener('pointerdown',function(e){
        e.preventDefault();
        btn.classList.add('pressed');
        const action=btn.dataset.control;
        if(action==='left')startHorizontal(-1);
        else if(action==='right')startHorizontal(1);
        else if(action==='down'){state.softDrop=true;stepDownNow()}
        else if(action==='rotate')rotatePiece();
      },{passive:false});
    });
  }

  function releaseControls(){
    state.softDrop=false;
    clearRepeat();
    document.querySelectorAll('.control-btn.pressed').forEach(function(b){b.classList.remove('pressed')});
  }
  window.addEventListener('pointerup',releaseControls);
  window.addEventListener('pointercancel',releaseControls);
  window.addEventListener('blur',releaseControls);

  function canInput(){return state.screen==='play'&&state.gameStarted&&!state.paused&&!state.resolving&&!!state.piece}
  function clearRepeat(){
    if(repeatDelayId){clearTimeout(repeatDelayId);repeatDelayId=null}
    if(repeatId){clearInterval(repeatId);repeatId=null}
  }
  function startHorizontal(dir){
    if(!canInput())return;
    moveHorizontal(dir);
    clearRepeat();
    repeatDelayId=setTimeout(function(){
      repeatId=setInterval(function(){moveHorizontal(dir)},82);
    },230);
  }
  function moveHorizontal(dir){
    if(!canInput())return false;
    if(canPlace(state.piece,state.piece.x+dir,state.piece.y,state.piece.rot)){
      state.piece.x+=dir;
      state.lockAccum=0;
      drawBoard();
      return true;
    }
    return false;
  }
  function stepDownNow(){
    if(!canInput())return false;
    if(canPlace(state.piece,state.piece.x,state.piece.y+1,state.piece.rot)){
      state.piece.y++;
      state.fallAccum=0;
      state.lockAccum=0;
      drawBoard();
      return true;
    }
    return false;
  }
  function rotatePiece(){
    if(!canInput())return false;
    const next=(state.piece.rot+1)%4;
    const kicks=[0,-1,1];
    for(let i=0;i<kicks.length;i++){
      const nx=state.piece.x+kicks[i];
      if(canPlace(state.piece,nx,state.piece.y,next)){
        state.piece.x=nx;
        state.piece.rot=next;
        state.lockAccum=0;
        vibrate(7);
        drawBoard();
        return true;
      }
    }
    return false;
  }

  function randomTemplate(){
    const a=COLORS[Math.floor(Math.random()*COLORS.length)];
    const b=COLORS[Math.floor(Math.random()*COLORS.length)];
    return {a:a,b:b};
  }
  function fillQueue(){
    while(state.queue.length<3)state.queue.push(randomTemplate());
  }
  function spawnPiece(){
    fillQueue();
    const t=state.queue.shift();
    state.queue.push(randomTemplate());
    state.piece={x:SPAWN_X,y:SPAWN_Y,rot:0,a:t.a,b:t.b};
    state.fallAccum=0;
    state.lockAccum=0;
    if(!canPlace(state.piece,state.piece.x,state.piece.y,state.piece.rot)){
      state.piece=null;
      finishGame('topout');
      return false;
    }
    updateHud();
    drawBoard();
    persistResume();
    return true;
  }
  function pieceCells(piece,x,y,rot){
    if(!piece)return[];
    return ROTATIONS[rot].map(function(o){
      return {x:x+o[0],y:y+o[1],color:o[2]==='a'?piece.a:piece.b};
    });
  }
  function canPlace(piece,x,y,rot){
    const cells=pieceCells(piece,x,y,rot);
    for(let i=0;i<cells.length;i++){
      const c=cells[i];
      if(c.x<0||c.x>=COLS||c.y<0||c.y>=ROWS)return false;
      if(state.board[c.y][c.x])return false;
    }
    return true;
  }

  function beginGame(mode){
    loadPlayer();
    state.mode=mode||'endless';
    state.rankMode=state.mode;
    state.history=[];
    state.gameStarted=true;
    state.paused=false;
    state.resolving=false;
    state.board=makeBoard();
    state.piece=null;
    state.queue=[];
    state.score=0;
    state.maxLink=0;
    state.maxCombo=0;
    state.clears=0;
    state.pieces=0;
    state.timeLeft=120;
    state.timeExpired=false;
    state.fallAccum=0;
    state.lockAccum=0;
    state.softDrop=false;
    state.resumeAccum=0;
    state.chargedKeys=new Set();
    state.clearingKeys=new Set();
    state.fallingKeys=new Set();
    state.chainActive=false;
    state.rankResult=null;
    fillQueue();
    spawnPiece();
    state.screen='play';
    render();
  }

  function fallInterval(){
    if(state.mode==='timed'){
      const elapsed=120-state.timeLeft;
      return Math.max(460,760-elapsed*2);
    }
    // ENDLESS: 20個目から8個ごとに40ms加速。後半は120msまで速くなる。
    const speedSteps=state.pieces<20?0:Math.floor((state.pieces-20)/8)+1;
    return Math.max(120,820-speedSteps*40);
  }

  function startLoop(){
    if(state.rafId||state.screen!=='play'||!state.gameStarted||state.paused)return;
    state.lastFrame=performance.now();
    state.rafId=requestAnimationFrame(frame);
  }
  function stopLoop(){
    if(state.rafId){cancelAnimationFrame(state.rafId);state.rafId=null}
    state.lastFrame=0;
  }
  function frame(ts){
    state.rafId=null;
    if(state.screen!=='play'||!state.gameStarted||state.paused)return;
    const dt=Math.min(60,Math.max(0,ts-state.lastFrame));
    state.lastFrame=ts;

    if(state.mode==='timed'&&!state.timeExpired&&!state.chainActive){
      state.timeLeft=Math.max(0,state.timeLeft-dt/1000);
      if(state.timeLeft<=0)state.timeExpired=true;
    }

    state.resumeAccum+=dt;
    if(state.resumeAccum>=1200){state.resumeAccum=0;persistResume()}

    if(!state.resolving&&state.piece){
      const below=canPlace(state.piece,state.piece.x,state.piece.y+1,state.piece.rot);
      if(below){
        state.lockAccum=0;
        state.fallAccum+=dt;
        const interval=state.softDrop?65:fallInterval();
        if(state.fallAccum>=interval){
          state.piece.y++;
          state.fallAccum=0;
          drawBoard();
        }
      }else{
        state.fallAccum=0;
        state.lockAccum+=dt;
        if(state.lockAccum>=LOCK_DELAY)lockPiece();
      }
    }

    updateHud();
    if(state.timeExpired&&!state.resolving){
      finishGame('time');
      return;
    }
    if(state.gameStarted&&state.screen==='play')state.rafId=requestAnimationFrame(frame);
  }

  async function lockPiece(){
    if(state.resolving||!state.piece||!state.gameStarted)return;
    state.resolving=true;
    releaseControls();
    const cells=pieceCells(state.piece,state.piece.x,state.piece.y,state.piece.rot);
    cells.forEach(function(c){state.board[c.y][c.x]=c.color});
    state.piece=null;
    state.pieces++;
    drawBoard();
    flashLock(cells);
    vibrate(9);
    await delay(120);
    await applyGravityAnimated();
    await resolveClears();

    if(!state.gameStarted)return;
    if(state.timeExpired){finishGame('time');return}
    if(hiddenOccupied()){finishGame('topout');return}

    state.resolving=false;
    spawnPiece();
  }

  async function applyGravityAnimated(stepMs){
    stepMs=Number(stepMs)||76;
    let safety=0;
    while(safety++<ROWS+2){
      const moved=[];
      for(let y=ROWS-2;y>=0;y--){
        for(let x=0;x<COLS;x++){
          if(state.board[y][x]&&!state.board[y+1][x]){
            state.board[y+1][x]=state.board[y][x];
            state.board[y][x]=null;
            moved.push((y+1)+':'+x);
          }
        }
      }
      if(!moved.length)break;
      state.fallingKeys=new Set(moved);
      drawBoard();
      await delay(stepMs);
      state.fallingKeys.clear();
    }
    drawBoard();
  }

  function findGroups(){
    const seen=Array.from({length:ROWS},()=>Array(COLS).fill(false));
    const groups=[];
    const dirs=[[1,0],[-1,0],[0,1],[0,-1]];
    for(let y=0;y<ROWS;y++){
      for(let x=0;x<COLS;x++){
        const color=state.board[y][x];
        if(!color||seen[y][x])continue;
        const group=[];
        const q=[[x,y]];
        seen[y][x]=true;
        while(q.length){
          const p=q.shift(),px=p[0],py=p[1];
          group.push({x:px,y:py});
          for(let d=0;d<dirs.length;d++){
            const nx=px+dirs[d][0],ny=py+dirs[d][1];
            if(nx<0||nx>=COLS||ny<0||ny>=ROWS||seen[ny][nx])continue;
            if(state.board[ny][nx]===color){seen[ny][nx]=true;q.push([nx,ny])}
          }
        }
        if(group.length>=4)groups.push(group);
      }
    }
    return groups;
  }

  function scoreGain(cleared,link,combo){
    const base=cleared*100*link;
    const comboBonus=Math.max(0,combo-1)*400;
    const bigBonus=Math.max(0,cleared-4)*50;
    return base+comboBonus+bigBonus;
  }

  async function resolveClears(){
    let link=0;
    let groups=findGroups();
    if(!groups.length)return 0;

    state.chainActive=true;
    while(state.gameStarted&&groups.length){
      link++;
      const cells=[].concat.apply([],groups);
      const total=cells.length;
      const combo=groups.length;
      const gain=scoreGain(total,link,combo);
      const power=Math.max(1,Math.min(8,link+Math.max(0,combo-1)*2));
      const keys=cells.map(function(c){return c.y+':'+c.x});
      const chargeWait=Math.min(270+link*55,520);
      const clearWait=Math.min(360+link*28,500);
      const betweenWait=Math.min(230+link*75,520);

      // 1) Anticipation: freeze the board for a beat and make the winning group glow.
      state.chargedKeys=new Set(keys);
      setChainStage(link,combo,power);
      showChainBanner(link,combo,power);
      drawBoard();
      pulseChainFlash(link,combo,power,'charge');
      await delay(chargeWait);
      if(!state.gameStarted)break;

      // 2) Impact: score appears exactly when the blocks burst.
      state.maxLink=Math.max(state.maxLink,link);
      state.maxCombo=Math.max(state.maxCombo,combo);
      state.clears+=total;
      state.score+=gain;
      state.chargedKeys.clear();
      state.clearingKeys=new Set(keys);
      drawBoard();
      updateHud();
      spawnClearParticles(cells,link,combo,power);
      showLink(link,gain,combo,power);
      showComboFx(combo,power);
      pulseChainFlash(link,combo,power,'burst');
      spawnBurstRings(link,combo,power);
      if(power>=8)vibrate([34,22,56,24,72]);
      else if(power>=6)vibrate([30,22,48]);
      else if(power>=4)vibrate([20,16,30]);
      else if(power>=2)vibrate([14,10,18]);
      else vibrate(12);

      await delay(clearWait);
      cells.forEach(function(cell){state.board[cell.y][cell.x]=null});
      state.clearingKeys.clear();
      drawBoard();
      await delay(110);

      // 3) Fallout: let the player watch the board collapse before checking the next link.
      await applyGravityAnimated(link>=2?94:84);
      await delay(150);

      groups=findGroups();
      if(groups.length){
        showContinueCue(link+1);
        await delay(betweenWait);
      }
    }

    state.chargedKeys.clear();
    state.clearingKeys.clear();
    state.chainActive=false;
    hideChainBanner();
    clearChainStage();
    drawBoard();
    return link;
  }

  function hiddenOccupied(){
    for(let y=0;y<HIDDEN_ROWS;y++)for(let x=0;x<COLS;x++)if(state.board[y][x])return true;
    return false;
  }
  function isDanger(){
    for(let y=HIDDEN_ROWS;y<HIDDEN_ROWS+2;y++)for(let x=0;x<COLS;x++)if(state.board[y][x])return true;
    return false;
  }

  function blockHtml(color,classes){
    return '<div class="block c-'+color+(classes?' '+classes:'')+'"><span>'+SYMBOL[color]+'</span></div>';
  }

  function drawBoard(){
    const host=document.querySelector('[data-board]');
    if(!host)return;
    const active=new Map();
    if(state.piece){
      pieceCells(state.piece,state.piece.x,state.piece.y,state.piece.rot).forEach(function(c){
        if(c.y>=HIDDEN_ROWS)active.set(c.y+':'+c.x,c.color);
      });
    }
    let html='';
    for(let vy=0;vy<VISIBLE_ROWS;vy++){
      const y=vy+HIDDEN_ROWS;
      for(let x=0;x<COLS;x++){
        const key=y+':'+x;
        const activeColor=active.get(key);
        const color=activeColor||state.board[y][x];
        let classes='';
        if(color){
          if(activeColor)classes+=' active';
          if(state.chargedKeys.has(key))classes+=' charged';
          if(state.clearingKeys.has(key))classes+=' clearing';
          if(state.fallingKeys.has(key))classes+=' falling';
        }
        html+='<div class="board-cell '+(vy<2?'danger-row':'')+'" data-key="'+key+'">'+(color?blockHtml(color,classes.trim()):'')+'</div>';
      }
    }
    host.innerHTML=html;
    const frameEl=document.querySelector('[data-board-frame]');
    if(frameEl)frameEl.classList.toggle('danger',isDanger());
  }

  function formatTime(sec){
    const s=Math.max(0,Math.ceil(sec));
    return Math.floor(s/60)+':'+String(s%60).padStart(2,'0');
  }
  function updateHud(){
    const score=document.querySelector('[data-score]');
    const link=document.querySelector('[data-max-link]');
    const third=document.querySelector('[data-third-value]');
    const best=document.querySelector('[data-best-score]');
    if(score)score.textContent=String(state.score);
    if(link)link.textContent=String(state.maxLink);
    if(best){const rows=sortRanking(loadRankings()[state.mode]||[]);best.textContent='BEST '+(rows[0]?rows[0].score:0)}
    if(third)third.textContent=state.mode==='timed'?formatTime(state.timeLeft):String(state.pieces);
    const one=document.querySelector('[data-next-one]');
    const two=document.querySelector('[data-next-two]');
    if(one)one.innerHTML=miniPieceHtml(state.queue[0]);
    if(two)two.innerHTML=miniPieceHtml(state.queue[1]);
  }

  function flashLock(cells){
    // Normal placement should stay quiet: the outer frame no longer pulses.
    // Only the newly landed blocks squash; chain/burst feedback remains unchanged.
    // Only animate the two newly landed blocks; never alter board coordinates or timing.
    if(reducedMotion()||!Array.isArray(cells))return;
    cells.forEach(function(cell){
      const block=document.querySelector('[data-key="'+cell.y+':'+cell.x+'"] .block');
      if(!block)return;
      block.classList.add('land-squash');
      setTimeout(function(){if(block.isConnected)block.classList.remove('land-squash')},220);
    });
  }
  function showLink(link,gain,combo,power){
    const el=document.querySelector('[data-link-fx]');
    const pop=document.querySelector('[data-score-pop]');
    const frameEl=document.querySelector('[data-board-frame]');
    const hold=reducedMotion()?220:Math.min(820+link*95,1300);
    if(el){
      let main=link+' LINK!';
      if(link>=8)main='MAXIMUM LINK!';
      else if(link>=6)main='SUPER BURST!';
      else if(link>=5)main='BURST!';
      el.querySelector('strong').textContent=main;
      el.querySelector('span').textContent=(combo>1?combo+' COMBO  ':'')+'+'+gain;
      el.style.setProperty('--link-duration',hold+'ms');
      el.className='link-fx fx-tier-'+Math.min(8,power)+' '+(link>=5?'burst ':'')+(link>=3?'strong ':'')+(combo>=2?' combo-heavy ':'')+'show';
      setTimeout(function(){if(el&&el.isConnected)el.classList.remove('show')},hold+30);
    }
    if(pop){
      pop.textContent='+'+gain;
      pop.style.setProperty('--score-duration',Math.min(700+link*55,980)+'ms');
      pop.classList.remove('show');
      void pop.offsetWidth;
      pop.classList.add('show');
      setTimeout(function(){if(pop&&pop.isConnected)pop.classList.remove('show')},reducedMotion()?240:1000);
    }
    if(frameEl&&(power>=5||combo>=3)){
      frameEl.classList.remove('burst-shake');
      void frameEl.offsetWidth;
      frameEl.classList.add('burst-shake');
      setTimeout(function(){if(frameEl&&frameEl.isConnected)frameEl.classList.remove('burst-shake')},430);
    }
  }

  function showChainBanner(link,combo,power){
    const el=document.querySelector('[data-chain-banner]');
    if(!el)return;
    el.querySelector('strong').textContent=link+' LINK';
    el.querySelector('small').textContent=combo>1?combo+' COMBO / CHAIN':'CHAIN';
    el.className='chain-banner show fx-tier-'+Math.min(8,power)+(link>=3?' hot':'')+(link>=5?' burst':'')+(combo>=2?' combo-heavy':'');
  }

  function hideChainBanner(){
    const el=document.querySelector('[data-chain-banner]');
    if(el)el.className='chain-banner';
  }

  function showContinueCue(nextLink){
    const el=document.querySelector('[data-link-fx]');
    if(!el)return;
    const hold=reducedMotion()?170:460;
    el.querySelector('strong').textContent=nextLink+' LINK...';
    el.querySelector('span').textContent='CHAIN CONTINUES';
    el.style.setProperty('--link-duration',hold+'ms');
    el.className='link-fx continue show';
    setTimeout(function(){if(el&&el.isConnected)el.classList.remove('show')},hold+20);
  }

  function setChainStage(link,combo,power){
    const frameEl=document.querySelector('[data-board-frame]');
    const stage=document.querySelector('.board-stage');
    if(!frameEl)return;
    frameEl.classList.add('chain-active');
    frameEl.classList.toggle('chain-strong',power>=4);
    frameEl.classList.toggle('chain-burst',power>=6);
    frameEl.dataset.chain=String(link);
    frameEl.dataset.combo=String(combo);
    if(stage){
      stage.className='board-stage chain-stage fx-tier-'+Math.min(8,power)+(combo>=2?' combo-heavy':'');
    }
  }

  function clearChainStage(){
    const frameEl=document.querySelector('[data-board-frame]');
    if(!frameEl)return;
    frameEl.classList.remove('chain-active','chain-strong','chain-burst');
    delete frameEl.dataset.chain;
    delete frameEl.dataset.combo;
    const stage=document.querySelector('.board-stage');
    if(stage)stage.className='board-stage';
  }

  function pulseChainFlash(link,combo,power,kind){
    const el=document.querySelector('[data-chain-flash]');
    if(!el)return;
    el.className='chain-flash';
    void el.offsetWidth;
    el.classList.add(kind==='charge'?'charge':'burst');
    if(power>=4)el.classList.add('strong');
    if(power>=6)el.classList.add('max');
    if(combo>=2)el.classList.add('combo-heavy');
    el.classList.add('fx-tier-'+Math.min(8,power));
    setTimeout(function(){if(el&&el.isConnected)el.className='chain-flash'},reducedMotion()?100:430);
  }

  function spawnClearParticles(cells,link,combo,power){
    if(reducedMotion())return;
    const stage=document.querySelector('.board-stage');
    const layer=document.querySelector('[data-particle-layer]');
    if(!stage||!layer)return;
    const stageRect=stage.getBoundingClientRect();
    let count=0;
    const cap=Math.min(88,34+power*7+Math.max(0,combo-1)*10);
    cells.forEach(function(cell,cellIndex){
      if(cell.y<HIDDEN_ROWS||count>=cap)return;
      const key=cell.y+':'+cell.x;
      const origin=document.querySelector('[data-key="'+key+'"]');
      if(!origin)return;
      const rect=origin.getBoundingClientRect();
      const color=state.board[cell.y][cell.x]||'blue';
      const perCell=Math.min(7,3+Math.floor(power/3)+(combo>=2?1:0));
      for(let i=0;i<perCell&&count<cap;i++,count++){
        const p=document.createElement('i');
        const angle=((cellIndex*53+i*97)%360)*Math.PI/180;
        const dist=26+((cellIndex*17+i*13)%34)+power*5+(combo>=2?10:0);
        p.className='clear-particle c-'+color+' fx-tier-'+Math.min(8,power);
        p.style.left=(rect.left-stageRect.left+rect.width/2)+'px';
        p.style.top=(rect.top-stageRect.top+rect.height/2)+'px';
        p.style.setProperty('--dx',(Math.cos(angle)*dist).toFixed(1)+'px');
        p.style.setProperty('--dy',(Math.sin(angle)*dist-10).toFixed(1)+'px');
        p.style.setProperty('--particle-life',(470+power*45)+'ms');
        layer.appendChild(p);
        setTimeout(function(){p.remove()},700+power*55);
      }
    });
  }

  function showComboFx(combo,power){
    const el=document.querySelector('[data-combo-fx]');
    if(!el)return;
    if(combo<2){
      el.className='combo-fx';
      return;
    }
    el.querySelector('strong').textContent=combo+' COMBO!';
    el.querySelector('span').textContent=combo>=4?'MULTI BURST!':combo>=3?'TRIPLE CLEAR!':'DOUBLE CLEAR!';
    el.className='combo-fx show fx-tier-'+Math.min(8,power)+(combo>=3?' heavy':'');
    const hold=reducedMotion()?220:Math.min(720+combo*130,1250);
    setTimeout(function(){if(el&&el.isConnected)el.className='combo-fx'},hold);
  }

  function spawnBurstRings(link,combo,power){
    if(reducedMotion()||power<3)return;
    const layer=document.querySelector('[data-particle-layer]');
    if(!layer)return;
    const rings=Math.min(4,1+Math.floor((power-3)/2)+(combo>=3?1:0));
    for(let i=0;i<rings;i++){
      const ring=document.createElement('b');
      ring.className='burst-ring fx-tier-'+Math.min(8,power);
      ring.style.setProperty('--ring-delay',(i*90)+'ms');
      ring.style.setProperty('--ring-size',(70+i*24+power*6)+'%');
      layer.appendChild(ring);
      setTimeout(function(){ring.remove()},900+i*100);
    }
  }

  function personalBestKey(){
    const id=playersApi&&playersApi.resolveId?playersApi.resolveId(state.player):(state.player&&state.player.id);
    return id?('id:'+id):('name:'+String(state.player&&state.player.name||'')+'|'+String(state.player&&state.player.icon||''));
  }
  function loadPersonalBests(){
    try{const x=JSON.parse(localStorage.getItem(PB_KEY)||'{}');return x&&typeof x==='object'?x:{}}
    catch(e){return{}}
  }
  function personalBestFor(mode){
    const all=loadPersonalBests();
    const p=all[personalBestKey()];
    return p&&Number(p[mode])||0;
  }
  function savePersonalBest(mode,score){
    const all=loadPersonalBests();
    const key=personalBestKey();
    const p=all[key]&&typeof all[key]==='object'?all[key]:{};
    p[mode]=Math.max(Number(p[mode])||0,Number(score)||0);
    all[key]=p;
    try{localStorage.setItem(PB_KEY,JSON.stringify(all))}catch(e){}
  }

  function cleanRankEntry(x,i){
    return {
      id:String(x&&x.id||('legacy_'+i)),
      playerId:String(x&&x.playerId||''),
      name:String(x&&x.name||'プレイヤー').slice(0,14),
      icon:String(x&&x.icon||'🎮'),
      score:Math.max(0,Number(x&&x.score)||0),
      maxLink:Math.max(0,Number(x&&x.maxLink)||0),
      clears:Math.max(0,Number(x&&x.clears)||0),
      at:Number(x&&x.at)||0
    };
  }
  function loadRankings(){
    try{
      const raw=JSON.parse(localStorage.getItem(RANK_KEY)||'{}');
      return {
        endless:Array.isArray(raw.endless)?raw.endless.map(cleanRankEntry):[],
        timed:Array.isArray(raw.timed)?raw.timed.map(cleanRankEntry):[]
      };
    }catch(e){return{endless:[],timed:[]}}
  }
  function sortRanking(arr){
    return arr.slice().sort(function(a,b){return b.score-a.score||b.maxLink-a.maxLink||b.clears-a.clears||a.at-b.at}).slice(0,10);
  }
  function saveRankings(r){
    const out={endless:sortRanking(r.endless||[]),timed:sortRanking(r.timed||[])};
    try{localStorage.setItem(RANK_KEY,JSON.stringify(out))}catch(e){}
    return out;
  }
  function addRanking(reason){
    const r=loadRankings();
    const before=sortRanking(r[state.mode]||[]);
    const playerId=playersApi&&playersApi.resolveId?playersApi.resolveId(state.player):state.player.id||'';
    const oldPersonalBest=personalBestFor(state.mode);
    const oldModeBest=before[0]&&before[0].score||0;
    const entry={
      id:Date.now()+'_'+Math.random().toString(36).slice(2,7),
      playerId:playerId||'',
      name:state.player.name,
      icon:state.player.icon,
      score:state.score,
      maxLink:state.maxLink,
      clears:state.clears,
      at:Date.now()
    };
    r[state.mode]=sortRanking(before.concat([entry]));
    savePersonalBest(state.mode,state.score);
    const saved=saveRankings(r);
    const after=sortRanking(saved[state.mode]||[]);
    const index=after.findIndex(function(x){return x.id===entry.id});
    return {
      entryId:entry.id,
      rank:index>=0?index+1:null,
      modeBest:state.score>oldModeBest,
      personalBest:state.score>oldPersonalBest,
      reason:reason
    };
  }

  function recordShared(){
    if(!playersApi||!playersApi.recordGame)return;
    const id=playersApi.resolveId?playersApi.resolveId(state.player):state.player.id;
    if(!id)return;
    const scores={};scores[id]=state.score;
    const metrics={};metrics[id]={bestLink:state.maxLink,bestCombo:state.maxCombo,totalClears:state.clears};
    playersApi.recordGame({gameId:'link-burst',participants:[state.player],scores:scores,metrics:metrics});
  }

  function finishGame(reason){
    if(!state.gameStarted)return;
    stopLoop();
    releaseControls();
    state.gameStarted=false;
    state.paused=false;
    state.resolving=false;
    state.softDrop=false;
    state.rankResult=addRanking(reason);
    recordShared();
    resumeApi&&resumeApi.clear&&resumeApi.clear(RESUME_ID);
    state.screen='result';
    state.history=[];
    render();
  }

  function resumeSnapshot(){
    return {
      version:1,
      mode:state.mode,
      board:state.board,
      piece:state.piece,
      queue:state.queue,
      score:state.score,
      maxLink:state.maxLink,
      maxCombo:state.maxCombo,
      clears:state.clears,
      pieces:state.pieces,
      timeLeft:state.timeLeft,
      timeExpired:state.timeExpired,
      player:state.player,
      soloIndex:state.soloIndex
    };
  }
  function persistResume(){
    if(!state.gameStarted||state.resolving||state.chainActive||!resumeApi||!resumeApi.save)return;
    resumeApi.save(RESUME_ID,{
      title:'リンクバースト！',
      path:'/games/link-burst/',
      summary:(state.mode==='timed'?'2 MINUTES':'ENDLESS')+' SCORE '+state.score+' / MAX LINK '+state.maxLink
    },resumeSnapshot());
  }
  function normalizeBoard(raw){
    const b=makeBoard();
    if(Array.isArray(raw)){
      for(let y=0;y<Math.min(ROWS,raw.length);y++){
        if(!Array.isArray(raw[y]))continue;
        for(let x=0;x<Math.min(COLS,raw[y].length);x++)if(COLORS.includes(raw[y][x]))b[y][x]=raw[y][x];
      }
    }
    return b;
  }
  function restoreResume(saved){
    if(!saved)return;
    loadPlayer();
    state.mode=saved.mode==='timed'?'timed':'endless';
    state.rankMode=state.mode;
    state.board=normalizeBoard(saved.board);
    state.piece=saved.piece&&COLORS.includes(saved.piece.a)&&COLORS.includes(saved.piece.b)?saved.piece:null;
    state.queue=Array.isArray(saved.queue)?saved.queue.filter(function(t){return t&&COLORS.includes(t.a)&&COLORS.includes(t.b)}).slice(0,3):[];
    fillQueue();
    state.score=Math.max(0,Number(saved.score)||0);
    state.maxLink=Math.max(0,Number(saved.maxLink)||0);
    state.maxCombo=Math.max(0,Number(saved.maxCombo)||0);
    state.clears=Math.max(0,Number(saved.clears)||0);
    state.pieces=Math.max(0,Number(saved.pieces)||0);
    state.timeLeft=state.mode==='timed'?clamp(Number(saved.timeLeft)||120,0,120):120;
    state.timeExpired=!!saved.timeExpired;
    if(saved.player)state.player=saved.player;
    state.soloIndex=Math.max(0,Number(saved.soloIndex)||0);
    state.gameStarted=true;
    state.paused=false;
    state.resolving=!state.piece;
    state.chargedKeys=new Set();
    state.clearingKeys=new Set();
    state.fallingKeys=new Set();
    state.chainActive=false;
    state.rankResult=null;
    state.history=[];
    state.screen='play';
    render();
    if(state.resolving)setTimeout(stabilizeAfterRestore,30);
  }
  async function stabilizeAfterRestore(){
    if(!state.gameStarted)return;
    await applyGravityAnimated();
    await resolveClears();
    if(state.timeExpired){finishGame('time');return}
    if(hiddenOccupied()){finishGame('topout');return}
    state.resolving=false;
    spawnPiece();
  }

  window.addEventListener('houkago-player-selection-changed',function(){
    if(state.gameStarted)return;
    loadPlayer();
    render();
  });
  window.addEventListener('pagehide',persistResume);
  document.addEventListener('visibilitychange',function(){
    if(document.visibilityState==='hidden'){
      persistResume();
      if(state.screen==='play'&&state.gameStarted&&!state.paused)pauseGame(true);
    }
  });
  window.addEventListener('keydown',function(e){
    if(!canInput())return;
    const key=e.key.toLowerCase();
    if(key==='arrowleft'||key==='a'){e.preventDefault();moveHorizontal(-1)}
    else if(key==='arrowright'||key==='d'){e.preventDefault();moveHorizontal(1)}
    else if(key==='arrowdown'||key==='s'){e.preventDefault();stepDownNow()}
    else if(key==='arrowup'||key===' '||key==='enter'){e.preventDefault();rotatePiece()}
  });

  loadPlayer();
  render();
  setTimeout(function(){
    if(resumeApi&&resumeApi.offer){
      resumeApi.offer({
        gameId:RESUME_ID,
        onResume:function(saved){restoreResume(saved)},
        onNew:function(){state.history=[];state.screen='title';render()}
      });
    }
  },80);
})();
