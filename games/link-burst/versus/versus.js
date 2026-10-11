(function(){
  'use strict';
  const root=document.getElementById('versus-app');
  if(!root)return;
  const registry=window.HoukagoPlayers;
  const STORAGE_KEY='houkago_link_burst_versus_players_v1';
  const state={screen:'select',target:0,ids:[],notice:''};

  function esc(v){
    return String(v==null?'':v).replace(/[&<>"']/g,function(ch){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch];
    });
  }
  function roster(){
    const saved=registry&&typeof registry.load==='function'?registry.load():null;
    const list=saved&&Array.isArray(saved.roster)?saved.roster:[];
    return list.filter(function(p){return p&&typeof p.id==='string'&&p.id});
  }
  function readStoredIds(){
    try{
      const ids=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null');
      return Array.isArray(ids)?ids.map(String).slice(0,2):[];
    }catch(e){return []}
  }
  function saveSelectedIds(){
    try{localStorage.setItem(STORAGE_KEY,JSON.stringify(state.ids))}catch(e){}
  }
  function synchronizeSelection(members){
    const valid=new Set(members.map(function(p){return p.id}));
    const chosen=state.ids.filter(function(id,i,all){return valid.has(id)&&all.indexOf(id)===i});
    for(const person of members){
      if(chosen.length>=2)break;
      if(!chosen.includes(person.id))chosen.push(person.id);
    }
    state.ids=chosen.slice(0,2);
  }
  function selectedMember(members,index){
    return members.find(function(p){return p.id===state.ids[index]})||null;
  }
  function controls(){
    return '<nav class="versus-nav" aria-label="ページ移動">'+
      '<a href="../">← リンクバーストへ</a>'+
      '<a href="../../">ゲームをえらぶ</a>'+
      '<button type="button" data-hg-settings-open aria-label="共通設定">⚙</button>'+
    '</nav>';
  }
  function header(message){
    return '<header class="versus-top">'+
      '<img src="../../../link_burst_logo.png" alt="リンクバースト！">'+
      '<h1>2人対戦</h1>'+
      '<p>'+esc(message)+'</p>'+
      '<span class="versus-status">STEP 1 / 対戦準備</span>'+
    '</header>';
  }
  function selectScreen(members){
    const slots=[0,1].map(function(i){
      const p=selectedMember(members,i);
      return '<button type="button" class="versus-slot '+(state.target===i?'is-active':'')+'" data-slot="'+i+'" data-side="'+(i+1)+'" aria-pressed="'+String(state.target===i)+'">'+
        '<small>'+(i===0?'1P　左側':'2P　右側')+'</small>'+
        '<span class="avatar">'+(p?esc(p.icon):'？')+'</span>'+
        '<strong>'+(p?esc(p.name):'未選択')+'</strong>'+
      '</button>';
    }).join('');
    const options=members.map(function(p){
      const which=state.ids.indexOf(p.id);
      return '<button type="button" class="versus-member '+(which===0?'is-one':which===1?'is-two':'')+'" data-pick="'+esc(p.id)+'" aria-label="'+esc(p.name)+'を選ぶ">'+
        '<span class="avatar">'+esc(p.icon)+'</span>'+
        '<strong>'+esc(p.name)+'</strong>'+
        (which>=0?'<small>'+(which+1)+'P</small>':'<small>選択する</small>')+
      '</button>';
    }).join('');
    return header('共有メンバーから2人を選ぼう。登録済みの全員から選べるよ。')+
      '<div class="versus-players">'+slots+'</div>'+
      '<section class="versus-card"><h2>メンバー選択</h2>'+
        '<p>上の1P・2Pを押してから、下のメンバーを選択。2人は別のメンバーにしてね。</p>'+
        '<div class="versus-roster">'+options+'</div>'+
        '<p class="versus-error" role="status">'+esc(state.notice)+'</p>'+
      '</section>'+
      '<div class="versus-actions"><button class="versus-primary" type="button" data-ready '+(state.ids.length<2?'disabled':'')+'>この2人で対戦準備へ進む →</button></div>'+
      '<p class="versus-footnote">選択した2人だけを対戦専用に保存。1人用プレイヤーや他ゲームの参加設定は変わらないよ。</p>';
  }
  function readyScreen(members){
    const sides=[0,1].map(function(i){
      const p=selectedMember(members,i);
      return '<section class="versus-ready-side">'+
        '<small>'+(i===0?'1P / LEFT':'2P / RIGHT')+'</small>'+
        '<div class="avatar">'+(p?esc(p.icon):'？')+'</div>'+
        '<strong>'+(p?esc(p.name):'未選択')+'</strong>'+
        '<small>左右の盤面で同時に操作するよ</small>'+
      '</section>';
    }).join('');
    return header('2人の準備ができたよ。スマホを横にして、同時KO対戦を試そう。')+
      '<div class="versus-ready-screen">'+
      '<section class="versus-card"><h2>KO対戦の準備</h2>'+
        '<div class="versus-ready-players">'+sides+'</div>'+
        '<div class="versus-ready-rule"><span>5色・4個消し</span><span>先に積んだら負け</span><span>JAMは未実装</span></div>'+
        '<div class="versus-landscape-note">スマホを横向きにしてね。横画面で左右の盤面を同時に操作できるよ。</div>'+
        '<div class="versus-coming"><strong>2人KO対戦 テスト版</strong>左右2盤面・同時タッチ・5色4個消し・KO決着に対応。<br>JAM・COUNTER・対戦記録は次の段階で追加するよ。</div>'+
      '</section>'+
      '<div class="versus-actions">'+
        '<button type="button" class="versus-primary" data-launch>2人KO対戦をはじめる →</button>'+
        '<button type="button" class="versus-secondary" data-change>← プレイヤーを選び直す</button>'+
      '</div></div>';
  }
  function render(){
    const members=roster();
    synchronizeSelection(members);
    if(state.screen==='ready'&&state.ids.length<2)state.screen='select';
    root.className='versus-shell';
    root.innerHTML='<div class="versus-wrap">'+controls()+
      (state.screen==='ready'?readyScreen(members):selectScreen(members))+'</div>';
  }
  root.addEventListener('click',function(e){
    const slot=e.target.closest('[data-slot]');
    if(slot){
      state.target=Number(slot.dataset.slot)===1?1:0;
      state.notice='';
      render();
      return;
    }
    const pick=e.target.closest('[data-pick]');
    if(pick){
      const id=pick.dataset.pick;
      const members=roster();
      if(!members.some(function(p){return p.id===id}))return;
      if(state.ids[1-state.target]===id){
        state.notice='もう片方が使っているメンバーです。別のメンバーを選んでね。';
        render();
        return;
      }
      state.ids[state.target]=id;
      saveSelectedIds();
      state.notice='';
      render();
      return;
    }
    if(e.target.closest('[data-ready]')){
      if(state.ids.length!==2||state.ids[0]===state.ids[1])return;
      saveSelectedIds();
      state.screen='ready';
      render();
      return;
    }
    if(e.target.closest('[data-launch]')){
      if(state.ids.length!==2||state.ids[0]===state.ids[1])return;
      saveSelectedIds();
      location.href='play.html';
      return;
    }
    if(e.target.closest('[data-change]')){
      state.screen='select';
      state.notice='';
      render();
    }
  });
  state.ids=readStoredIds();
  render();
})();
