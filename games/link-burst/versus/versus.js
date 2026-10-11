(function(){
  'use strict';
  const root=document.getElementById('versus-app');
  if(!root)return;
  const registry=window.HoukagoPlayers;
  const STORAGE_KEY='houkago_link_burst_versus_players_v1';
  const state={screen:'select',target:0,ids:[],notice:'',editingId:null,formIcon:''};

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

  function openMemberForm(id){
    const members=roster();
    const member=id?members.find(function(p){return p.id===id}):null;
    if(id&&!member)return;
    if(!id&&members.length>=(registry&&registry.ROSTER_MAX||15)){
      state.notice='登録できる人数は最大15人だよ。';
      render();
      return;
    }
    const icons=registry&&Array.isArray(registry.ICONS)?registry.ICONS:[];
    const used=new Set(members.map(function(p){return p.icon}));
    const available=icons.find(function(icon){return !used.has(icon)});
    if(!member&&!available){
      state.notice='使えるアイコンがないため登録できません。';
      render();
      return;
    }
    state.editingId=member?member.id:null;
    state.formIcon=member?member.icon:available;
    state.notice='';
    state.screen='form';
    render();
    window.scrollTo(0,0);
  }
  function memberManagement(members){
    return header('名前やアイコンを変更できるよ。変更内容はほかのゲームでも共通だよ。')+
      '<section class="versus-card"><div class="versus-section-heading"><h2>登録メンバーを編集</h2><small>'+members.length+' / '+(registry&&registry.ROSTER_MAX||15)+'人</small></div>'+
        '<p>変更したいメンバーの「編集」を押してね。プレイ記録はそのまま残るよ。</p>'+
        '<div class="versus-edit-list">'+members.map(function(p){
          return '<div class="versus-edit-item"><span class="avatar">'+esc(p.icon)+'</span><strong>'+esc(p.name)+'</strong>'+
            '<button type="button" class="versus-edit-button" data-edit-member="'+esc(p.id)+'" aria-label="'+esc(p.name)+'を編集">編集</button></div>';
        }).join('')+'</div>'+
      '</section>'+
      '<div class="versus-actions"><button class="versus-secondary" type="button" data-back-select>← メンバー選択へ戻る</button></div>';
  }
  function memberForm(members){
    const member=state.editingId?members.find(function(p){return p.id===state.editingId}):null;
    if(state.editingId&&!member)return memberManagement(members);
    const icons=registry&&Array.isArray(registry.ICONS)?registry.ICONS:[];
    const used=new Set(members.filter(function(p){return !member||p.id!==member.id}).map(function(p){return p.icon}));
    const editing=!!member;
    const title=editing?'メンバーを編集':'新しいメンバーを登録';
    return header(editing?'名前とアイコンを編集しよう。':'新しいメンバーを登録して、対戦に参加させよう。')+
      '<form class="versus-card versus-member-form" data-versus-member-form>'+
        '<h2>'+title+'</h2>'+
        '<label class="versus-form-label" for="versus-name">名前（12文字まで）</label>'+
        '<input id="versus-name" name="memberName" maxlength="12" autocomplete="off" required placeholder="名前を入力" value="'+esc(member?member.name:'')+'">'+
        '<div class="versus-form-label" id="versus-icon-label">アイコンを選ぶ</div>'+
        '<div class="versus-icon-options" role="group" aria-labelledby="versus-icon-label">'+
          icons.map(function(icon){
            const selected=state.formIcon===icon;
            const unavailable=used.has(icon);
            return '<button type="button" class="versus-icon-choice '+(selected?'is-selected':'')+'" data-icon-choice="'+esc(icon)+'" aria-pressed="'+String(selected)+'" '+(unavailable?'disabled title="ほかのメンバーが使用中"':'')+'>'+esc(icon)+'</button>';
          }).join('')+
        '</div>'+
        '<p class="versus-form-help">アイコンは1人1種類。薄く表示されたものは使用中だよ。</p>'+
        '<p class="versus-error" data-form-error role="alert">'+esc(state.notice)+'</p>'+
        '<button type="submit" class="versus-primary">'+(editing?'変更を保存':'登録して'+(state.target+1)+'Pに設定')+'</button>'+
      '</form>'+
      '<div class="versus-actions"><button type="button" class="versus-secondary" data-cancel-form>← 保存せず戻る</button></div>'+
      '<p class="versus-footnote">'+(editing?'名前・アイコンの変更は放課後ゲーム部の共通メンバーに反映されるよ。':'新規登録したメンバーはほかのゲームでも使えるよ。')+'</p>';
  }
  function showSelect(){
    state.screen='select';
    state.notice='';
    state.editingId=null;
    render();
    window.scrollTo(0,0);
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
      '<section class="versus-card"><div class="versus-section-heading"><h2>メンバー選択</h2><small>登録 '+members.length+'人</small></div>'+
        '<p>上で変更したい1P・2Pを選んで、下のメンバーをタップしてね。</p>'+
        '<div class="versus-member-tools">'+
          '<button type="button" class="versus-tool-btn" data-add-member '+(members.length>=(registry&&registry.ROSTER_MAX||15)?'disabled':'')+'>＋ 新規登録</button>'+
          '<button type="button" class="versus-tool-btn" data-manage-members>✎ 名前・アイコン編集</button>'+
        '</div>'+
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
      (state.screen==='ready'?readyScreen(members):
       state.screen==='manage'?memberManagement(members):
       state.screen==='form'?memberForm(members):selectScreen(members))+'</div>';
  }
  root.addEventListener('click',function(e){
    if(e.target.closest('[data-add-member]')){openMemberForm(null);return}
    if(e.target.closest('[data-manage-members]')){
      state.screen='manage';state.notice='';render();window.scrollTo(0,0);return;
    }
    const edit=e.target.closest('[data-edit-member]');
    if(edit){openMemberForm(edit.dataset.editMember);return}
    if(e.target.closest('[data-back-select]')){showSelect();return}
    if(e.target.closest('[data-cancel-form]')){
      if(state.editingId){state.screen='manage';state.notice='';render();window.scrollTo(0,0)}
      else showSelect();
      return;
    }
    const iconChoice=e.target.closest('[data-icon-choice]');
    if(iconChoice&&!iconChoice.disabled){
      state.formIcon=iconChoice.dataset.iconChoice;
      root.querySelectorAll('[data-icon-choice]').forEach(function(button){
        const selected=button.dataset.iconChoice===state.formIcon;
        button.classList.toggle('is-selected',selected);
        button.setAttribute('aria-pressed',String(selected));
      });
      return;
    }
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

  root.addEventListener('submit',function(e){
    const form=e.target.closest('[data-versus-member-form]');
    if(!form)return;
    e.preventDefault();
    const error=form.querySelector('[data-form-error]');
    const name=String(form.elements.memberName.value||'').trim().slice(0,12);
    const members=roster();
    const editing=!!state.editingId;
    const member=editing?members.find(function(p){return p.id===state.editingId}):null;
    const icons=registry&&Array.isArray(registry.ICONS)?registry.ICONS:[];
    function fail(message){if(error)error.textContent=message}
    if(!name){fail('名前を入力してね。');return}
    if(editing&&!member){fail('編集するメンバーが見つかりません。');return}
    if(!icons.includes(state.formIcon)||members.some(function(p){return p.id!==state.editingId&&p.icon===state.formIcon})){
      fail('ほかのメンバーと重ならないアイコンを選んでね。');return;
    }
    if(!registry||typeof registry.load!=='function'||typeof registry.setPlayer!=='function'){
      fail('メンバー登録機能を読み込めませんでした。');return;
    }
    if(editing){
      const data=registry.load();
      const index=data.players.findIndex(function(p){return p.id===member.id});
      if(index<0){fail('編集するメンバーが見つかりません。');return}
      const updated=registry.setPlayer(index,{name:name,icon:state.formIcon});
      const saved=updated.roster.find(function(p){return p.id===member.id});
      if(!saved||saved.name!==name||saved.icon!==state.formIcon){
        fail('変更を保存できませんでした。もう一度試してね。');return;
      }
      state.screen='select';
      state.notice='メンバー情報を更新したよ。';
    }else{
      if(members.length>=(registry.ROSTER_MAX||15)){fail('登録できる人数は最大15人だよ。');return}
      if(typeof registry.addPlayer!=='function'){fail('登録機能を読み込めませんでした。');return}
      const createdData=registry.addPlayer(name);
      const created=createdData.roster.find(function(p){return !members.some(function(old){return old.id===p.id})});
      if(!created){fail('登録できませんでした。もう一度試してね。');return}
      if(created.icon!==state.formIcon){
        const idx=createdData.players.findIndex(function(p){return p.id===created.id});
        registry.setPlayer(idx,{icon:state.formIcon});
      }
      const saved=registry.load().roster.find(function(p){return p.id===created.id});
      if(!saved||saved.name!==name||saved.icon!==state.formIcon){
        fail('アイコンの保存を確認できませんでした。');return;
      }
      state.ids[state.target]=created.id;
      saveSelectedIds();
      state.screen='select';
      state.notice='新しいメンバーを'+(state.target+1)+'Pに登録したよ。';
    }
    state.editingId=null;
    render();
    window.scrollTo(0,0);
  });

  state.ids=readStoredIds();
  render();
})();
