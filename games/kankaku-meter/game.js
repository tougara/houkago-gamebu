(()=>{
const app=document.getElementById('app');
const DB=window.KANKAKU_QUESTIONS||{};
const playersApi=window.HoukagoPlayers;
const CUSTOM_KEY='houkago_kankaku_custom_v1';
const LONG_PRESS_MS=550;
const state={screen:'title',playerCount:playersApi?.load?.().activeCount||4,players:[],difficulty:'normal',selectedCategories:new Set(Object.keys(DB)),includeCustom:false,roundCount:5,round:0,used:new Set(),topic:null,numbers:[],revealIndex:0,order:[],selectedOrder:null,roundScore:0,totalScore:0,resultRevealed:new Set(),memberIconTarget:null,history:[],gameStarted:false};
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
function loadPlayers(){const d=playersApi?.load?.();if(d){state.playerCount=Math.max(2,Math.min(10,Number(d.activeCount)||4));state.players=d.players.slice(0,state.playerCount)}else{state.playerCount=Math.max(2,Math.min(10,Number(state.playerCount)||4));state.players=Array.from({length:state.playerCount},(_,i)=>({name:'プレイヤー'+(i+1),icon:'●'}))}}
function customItems(){try{const x=JSON.parse(localStorage.getItem(CUSTOM_KEY)||'[]');return Array.isArray(x)?x:[]}catch(e){return[]}}
function saveCustom(x){try{localStorage.setItem(CUSTOM_KEY,JSON.stringify(x))}catch(e){}}
function topNav(){return '<nav class="top-nav"><button class="nav-pill" data-back>← 1個前にもどる</button><button class="nav-pill" data-home>ゲームをえらぶ</button></nav>'}
function heading(t,p=''){return '<header class="screen-heading"><h1>'+esc(t)+'</h1>'+(p?'<p>'+esc(p)+'</p>':'')+'</header>'}
function memberChip(p){return '<span class="member-chip">'+esc(p.icon)+' '+esc(p.name)+'</span>'}
function allTopics(){const built=[...state.selectedCategories].flatMap(cat=>(DB[cat]||[]).map(x=>({category:cat,q:x[0],low:x[1],high:x[2]})));const custom=state.includeCustom?customItems().map(x=>({category:'マイお題',...x})):[];return [...built,...custom]}
function drawTopic(){let pool=allTopics().filter(x=>!state.used.has(x.category+'|'+x.q));if(!pool.length){state.used.clear();pool=allTopics()}if(!pool.length)return null;const q=pool[Math.floor(Math.random()*pool.length)];state.used.add(q.category+'|'+q.q);return q}
function shuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function generateNumbers(n,d){let arr=[];if(d==='easy'){for(let i=0;i<n;i++){const base=Math.round((i+1)*100/(n+1));const jitter=Math.floor(Math.random()*7)-3;arr.push(Math.max(1,Math.min(100,base+jitter)))}arr=[...new Set(arr)];while(arr.length<n){const v=1+Math.floor(Math.random()*100);if(!arr.includes(v))arr.push(v)}}else if(d==='hard'){const span=Math.min(42,Math.max(22,n*5));const start=1+Math.floor(Math.random()*(100-span));while(arr.length<n){const v=start+Math.floor(Math.random()*(span+1));if(!arr.includes(v))arr.push(v)}}else{while(arr.length<n){const v=1+Math.floor(Math.random()*100);if(!arr.includes(v))arr.push(v)}}return shuffle(arr)}
function titleScreen(){return topNav()+'<section class="title-card"><img class="title-logo" src="../../kankaku_meter_logo.png" alt="感覚メーター"><p>数字は言っちゃダメ。ことばの感覚だけで、みんなの順番をそろえよう！</p><div class="stack"><button class="btn yellow full" data-start-title>ゲームをはじめる</button><button class="btn glass full" data-rules>あそびかた</button><button class="btn glass full" data-custom>マイお題</button></div></section>'}
function setupScreen(){loadPlayers();return topNav()+heading('ゲーム設定','2〜10人で、みんなで協力！')+'<section class="card"><div class="section-row"><div><h2>参加メンバー</h2><p>'+state.playerCount+'人で遊びます</p></div><button class="small-btn" data-edit-members>変更</button></div><div class="member-chips">'+state.players.map(memberChip).join('')+'</div></section><section class="card"><h2>難易度</h2><p>数字の離れ具合が変わります。</p><div class="difficulty-grid">'+[['easy','かんたん','数字が離れやすい'],['normal','ふつう','完全ランダム'],['hard','むずかしい','近い数字も出る']].map(x=>'<button class="difficulty-btn '+(state.difficulty===x[0]?'selected':'')+'" data-difficulty="'+x[0]+'">'+x[1]+'<small>'+x[2]+'</small></button>').join('')+'</div></section><button class="btn full" data-next-categories>ジャンル設定へ</button>'}
function membersScreen(){
  loadPlayers();
  return topNav()+playersApi.renderEditor({
    min:2,
    max:10,
    count:state.playerCount,
    players:state.players,
    title:'参加メンバー',
    subtitle:'名前とアイコンは放課後ゲーム部で共通です',
    doneLabel:'登録をおわる'
  });
}
function categoriesScreen(){const cats=Object.keys(DB),customN=customItems().length,pool=allTopics().length;return topNav()+heading('ジャンル','遊びたいお題を選ぼう')+'<section class="card"><div class="section-row"><div><h2>お題ジャンル</h2><p>複数選べます</p></div><button class="small-btn" data-all>全部</button></div><div class="category-grid">'+cats.map(c=>'<button class="category-chip '+(state.selectedCategories.has(c)?'selected':'')+'" data-cat="'+esc(c)+'">'+esc(c)+'</button>').join('')+'</div></section><section class="card"><div class="section-row"><div><h2>マイお題</h2><p>保存中 '+customN+'問</p></div><button class="small-btn" data-custom>編集</button></div><label class="switch-row '+(!customN?'disabled':'')+'"><input type="checkbox" data-custom-toggle '+(state.includeCustom&&customN?'checked':'')+' '+(!customN?'disabled':'')+'><span>オリジナルお題も混ぜる</span></label></section><p style="text-align:center;color:#667085;font-size:12px;font-weight:800">この設定のお題：<strong data-pool>'+pool+'問</strong></p><button class="btn full" data-begin '+(pool?'':'disabled')+'>5ラウンドでスタート</button>'}
function topicScreen(){const q=state.topic;return topNav()+heading((state.round+1)+' / '+state.roundCount+'ラウンド','まずは全員でお題を確認')+'<section class="card topic-card"><span class="topic-tag">'+esc(q.category)+'</span><h2>'+esc(q.q)+'</h2><div class="scale-box"><div class="scale-end low"><small>1</small>'+esc(q.low)+'</div><div class="scale-arrow">→</div><div class="scale-end high"><small>100</small>'+esc(q.high)+'</div></div></section><div class="stack"><button class="btn full" data-secret-start>秘密の数字を見る</button><button class="btn secondary full" data-change-topic>別のお題にする</button><button class="btn secondary full" data-compose-topic>お題を考える</button></div>'}
function passScreen(){const p=state.players[state.revealIndex];return topNav()+'<section class="privacy-card"><div class="avatar">'+esc(p.icon)+'</div><h2>'+esc(p.name)+'さんに<br>スマホを渡してね</h2><p>ほかの人は画面を見ないでください。</p><button class="btn yellow hold-btn" data-hold><i></i><span>長押しして数字を見る</span></button></section>'}
function numberScreen(){const p=state.players[state.revealIndex],q=state.topic,n=state.numbers[state.revealIndex];return topNav()+'<section class="number-card"><div class="avatar">'+esc(p.icon)+'</div><strong>'+esc(p.name)+'さんの数字</strong><div class="secret-number">'+n+'</div><div class="number-scale">1 ←────→ 100</div><div class="number-tip">お題「'+esc(q.q)+'」に合わせて、この数字くらいだと思う答えを口頭で考えてね。数字そのものは言わないで！</div><button class="btn full" data-remember>覚えた！</button></section>'}
function readyScreen(){return topNav()+'<section class="ready-screen"><div class="done-icon">✓</div><h1>全員、数字を<br>確認しました！</h1><p>ここからはみんなで画面を見てOK。<br>一人ずつ、お題に合う答えを口頭で発表してね。</p><button class="btn yellow full" data-arrange>並べる画面へ</button></section>'}
function arrangeScreen(){const q=state.topic;return topNav()+heading('みんなで順番を決めよう','0から100に向かって上へ。上ほど大きい数字')+'<section class="card topic-card arrange-topic" style="padding:14px"><span class="topic-tag">'+esc(q.category)+'</span><h2 style="font-size:22px;margin:8px 0">'+esc(q.q)+'</h2><div class="arrange-scale"><div class="arrange-scale-end high"><small>100</small><strong>'+esc(q.high)+'</strong></div><div class="arrange-scale-arrow">↑</div><div class="arrange-scale-end low"><small>1</small><strong>'+esc(q.low)+'</strong></div></div></section><p class="arrange-help">↑↓で順番を調整。名前をタップすると、忘れたときだけ自分の数字を再確認できます。</p><div class="order-board"><div class="order-meter" aria-hidden="true"><span class="meter-max">100</span><div class="meter-arrow"><span>↑</span></div><span class="meter-min">0</span></div><div class="order-list">'+state.order.map((pi,pos)=>{const p=state.players[pi];return '<div class="order-row"><span class="row-direction">↑</span><button class="order-person recheck-person" data-recheck="'+pi+'"><span>'+esc(p.icon)+' '+esc(p.name)+'</span><small>タップで数字を再確認</small></button><button class="move-btn" data-up="'+pos+'" '+(pos===0?'disabled':'')+'>↑</button><button class="move-btn" data-down="'+pos+'" '+(pos===state.order.length-1?'disabled':'')+'>↓</button></div>'}).join('')+'</div></div><button class="btn yellow full" style="margin-top:13px" data-confirm>これで決定！</button>'}
function orderConfirmScreen(){return topNav()+heading('この順番で決定する？','もう一度だけ確認してから結果発表へ進みます')+'<section class="card"><div class="confirm-scale-label top">100に近い</div><div class="confirm-order-list">'+state.order.map((pi,i)=>{const p=state.players[pi];return '<div class="confirm-order-row"><b>'+(i+1)+'</b><span>'+esc(p.icon)+' '+esc(p.name)+'</span></div>'}).join('')+'</div><div class="confirm-scale-label bottom">0に近い</div></section><div class="stack"><button class="btn secondary full" data-back-arrange>並べ直す</button><button class="btn yellow full" data-finalize-order>この順番で決定する</button></div>'}
function calculateResult(){const correct=[...state.players.keys()].sort((a,b)=>state.numbers[b]-state.numbers[a]);const rank=new Map(correct.map((p,i)=>[p,i]));const seq=state.order.map(p=>rank.get(p));let inv=0;for(let i=0;i<seq.length;i++)for(let j=i+1;j<seq.length;j++)if(seq[i]>seq[j])inv++;const max=seq.length*(seq.length-1)/2;state.roundScore=max?Math.round(100*(1-inv/max)):100;state.totalScore+=state.roundScore}
function resultScreen(){const correct=[...state.players.keys()].sort((a,b)=>state.numbers[b]-state.numbers[a]);const allShown=state.resultRevealed.size>=state.playerCount;const score=state.roundScore;const msg=score===100?'PERFECT！ 全員の感覚がつながった！':score>=80?'おしい！ かなり合ってる！':score>=55?'いい感じ！ あと少し！':'感覚バラバラ！ それも面白い！';return topNav()+heading((state.round+1)+'ラウンド目の結果',allShown?msg:'名前をタップして、好きな人から数字を公開！')+(allShown?'<div class="result-score result-score-reveal"><strong>'+score+'</strong><span>/ 100点</span></div>':'<div class="result-progress">'+state.resultRevealed.size+' / '+state.playerCount+'人 公開</div>')+'<section class="card"><h2>みんなの予想順</h2><p class="result-hint">上が100に近い予想、下が1に近い予想です。</p><div class="reveal-list progressive">'+state.order.map((pi,i)=>{const p=state.players[pi],shown=state.resultRevealed.has(pi);return '<button type="button" class="reveal-row reveal-tap '+(shown?'revealed':'')+'" data-result-reveal="'+pi+'" '+(shown?'disabled':'')+'><b>'+(i+1)+'</b><span>'+esc(p.icon)+' '+esc(p.name)+'</span><strong>'+(shown?state.numbers[pi]:'？')+'</strong></button>'}).join('')+'</div>'+(allShown?'<div class="fact">全員の数字が公開されました。上の点数が、みんなで決めた順番の結果です。</div>':'<div class="fact">タップした人の数字だけ公開されます。全員を公開すると点数が上に表示されます。</div>')+'</section>'+(allShown?'<section class="card correct-order-card"><h2>正しい順番</h2><div class="reveal-list">'+correct.map((pi,i)=>'<div class="reveal-row"><b>'+(i+1)+'</b><span>'+esc(state.players[pi].icon)+' '+esc(state.players[pi].name)+'</span><strong>'+state.numbers[pi]+'</strong></div>').join('')+'</div></section><button class="btn full" data-next-round>'+(state.round+1>=state.roundCount?'最終結果を見る':'次のお題へ')+'</button>':'')}
function finalScreen(){const max=state.roundCount*100,pct=Math.round(state.totalScore/max*100);const title=pct>=90?'感覚シンクロ部！':pct>=75?'かなり通じ合ってる！':pct>=55?'いいチーム！':'もっと知り合えるかも！';return '<section class="final-screen"><div class="done-icon">★</div><h1>'+esc(title)+'</h1><div class="result-score"><strong>'+state.totalScore+'</strong><span>/ '+max+'点</span></div><p>数字を言わずにここまで合わせられた！<br>もう一度やると、違う感覚が見つかるかも。</p><div class="stack" style="width:min(420px,100%)"><button class="btn yellow full" data-replay>同じ設定でもう一度</button><button class="btn secondary full" data-title>タイトルへ</button></div></section>'}
function rulesScreen(){return topNav()+heading('あそびかた','数字を言わずに、みんなで順番を合わせよう')+'<section class="card"><div class="rule-step"><b>1</b><span>全員でお題と「1〜100」の基準を見る</span></div><div class="rule-step"><b>2</b><span>1人ずつ秘密の数字を確認する</span></div><div class="rule-step"><b>3</b><span>数字は言わず、その数字っぽい答えを口頭で発表する</span></div><div class="rule-step"><b>4</b><span>みんなで相談し、大きい数字だと思う人を上、小さい人を下に並べる</span></div><div class="rule-step"><b>5</b><span>数字を公開！ 5ラウンドの合計点に挑戦</span></div></section><section class="card"><h2>大事なルール</h2><p>「70くらい」「半分より上」など、数字を直接伝える言い方は禁止。答えの理由を話したり、みんなで相談したりするのはOK！</p></section><button class="btn secondary full rules-bottom-back" data-rules-back>← もどる</button>'}
function composeTopicScreen(){const q=state.topic||{q:'',low:'',high:''};return topNav()+heading('お題を考える','このラウンドだけ、自分たちのお題で遊べます')+'<section class="card custom-form"><label>お題<input id="tq" maxlength="60" value="'+esc(q.category==='みんなのお題'?q.q:'')+'" placeholder="例：もらったらうれしいプレゼント"></label><div class="custom-two"><label>1のイメージ<input id="tl" maxlength="30" value="'+esc(q.category==='みんなのお題'?q.low:'')+'" placeholder="例：いらない"></label><label>100のイメージ<input id="th" maxlength="30" value="'+esc(q.category==='みんなのお題'?q.high:'')+'" placeholder="例：最高にうれしい"></label></div><button class="btn full" data-use-composed-topic>このお題で遊ぶ</button></section>'}
function customScreen(){const items=customItems();return topNav()+heading('マイお題','自分たちだけの感覚テーマを作ろう')+'<section class="card custom-form"><label>お題<input id="cq" maxlength="60" placeholder="例：旅行で行きたい場所"></label><div class="custom-two"><label>1のイメージ<input id="cl" maxlength="30" placeholder="行きたくない"></label><label>100のイメージ<input id="ch" maxlength="30" placeholder="今すぐ行きたい"></label></div><button class="btn full" data-add-custom>追加する</button></section><section class="card"><h2>保存したお題 '+items.length+'問</h2>'+(items.length?'<div class="custom-list">'+items.map((x,i)=>'<div class="custom-item"><div><strong>'+esc(x.q)+'</strong><span>1：'+esc(x.low)+' / 100：'+esc(x.high)+'</span></div><button data-delete="'+i+'">削除</button></div>').join('')+'</div>':'<p>まだマイお題はありません。</p>')+'</section>'}
function screenHtml(){return({title:titleScreen,setup:setupScreen,members:membersScreen,categories:categoriesScreen,topic:topicScreen,composeTopic:composeTopicScreen,pass:passScreen,number:numberScreen,ready:readyScreen,arrange:arrangeScreen,orderConfirm:orderConfirmScreen,result:resultScreen,final:finalScreen,rules:rulesScreen,custom:customScreen}[state.screen]||titleScreen)()}
function render({preserveScroll=false,scrollY=window.scrollY}={}){app.className='meter-app screen-'+state.screen;app.innerHTML=screenHtml();bind();if(preserveScroll){window.scrollTo({top:scrollY,behavior:'auto'});requestAnimationFrame(()=>window.scrollTo({top:scrollY,behavior:'auto'}))}else{window.scrollTo({top:0,behavior:'auto'})}}
function go(s,{push=true}={}){if(push&&state.screen!==s)state.history.push(state.screen);state.screen=s;render()}
function doBackOne(){
  if(!state.gameStarted){if(state.history.length){state.screen=state.history.pop();render()}else{location.href='../'};return}
  if(state.screen==='number'){state.screen='pass';render();return}
  if(state.screen==='pass'){
    if(state.revealIndex>0){state.revealIndex--;state.screen='pass';render();return}
    state.screen='topic';render();return
  }
  if(state.screen==='ready'){state.revealIndex=Math.max(0,state.playerCount-1);state.screen='pass';render();return}
  if(state.screen==='arrange'){state.screen='ready';render();return}
  if(state.screen==='orderConfirm'){state.screen='arrange';render();return}
  if(state.screen==='result'){alert('結果発表を始めたあとは、並べ直しには戻れません。');return}
  if(state.history.length){state.screen=state.history.pop();render()}else{state.screen='title';render()}
}
function showNavConfirm(type){
  if(!state.gameStarted){if(type==='home')location.href='../';else doBackOne();return}
  document.querySelector('.nav-confirm-backdrop')?.remove();
  const wrap=document.createElement('div');
  wrap.className='recheck-backdrop nav-confirm-backdrop';
  const isHome=type==='home';
  wrap.innerHTML='<section class="recheck-modal"><div class="recheck-warning">ゲームの途中です</div><h2>'+(isHome?'ゲームをやめますか？':'1個前にもどりますか？')+'</h2><p>'+(isHome?'今のラウンドをやめて、ゲームをえらぶ画面へ戻ります。':'今の進行を保ったまま、1個前の画面へ戻ります。')+'</p><div class="recheck-actions"><button class="btn secondary" data-nav-cancel>ゲームにもどる</button><button class="btn" data-nav-ok>ほんとにもどる</button></div></section>';
  document.body.appendChild(wrap);
  wrap.querySelector('[data-nav-cancel]').addEventListener('click',()=>wrap.remove());
  wrap.querySelector('[data-nav-ok]').addEventListener('click',()=>{wrap.remove();if(isHome)location.href='../';else doBackOne()});
  wrap.addEventListener('click',e=>{if(e.target===wrap)wrap.remove()})
}
function safeBack(){showNavConfirm('back')}
function refreshPool(){const n=allTopics().length;const el=document.querySelector('[data-pool]');if(el)el.textContent=n+'問';const b=document.querySelector('[data-begin]');if(b)b.disabled=n===0}
function beginGame(){loadPlayers();state.used.clear();state.round=0;state.totalScore=0;state.gameStarted=true;newRound()}
function newRound(){state.topic=drawTopic();if(!state.topic){state.gameStarted=false;go('categories');return}state.numbers=generateNumbers(state.playerCount,state.difficulty);state.revealIndex=0;state.order=shuffle([...state.players.keys()]);state.selectedOrder=null;state.roundScore=0;state.resultRevealed=new Set();go('topic',{push:false})}
function remember(){state.revealIndex++;if(state.revealIndex>=state.playerCount)go('ready',{push:false});else go('pass',{push:false})}
function swapOrder(a,b){const y=window.scrollY;[state.order[a],state.order[b]]=[state.order[b],state.order[a]];state.selectedOrder=null;render({preserveScroll:true,scrollY:y})}
function confirmOrder(){go('orderConfirm')}
function finalizeOrder(){calculateResult();state.resultRevealed=new Set();go('result',{push:false})}
function nextRound(){if(state.round+1>=state.roundCount){state.gameStarted=false;go('final');return}state.round++;newRound()}
function changeTopic(){const q=drawTopic();if(!q)return;state.topic=q;render()}
function useComposedTopic(){const q=document.getElementById('tq')?.value.trim(),low=document.getElementById('tl')?.value.trim(),high=document.getElementById('th')?.value.trim();if(!q||!low||!high){alert('お題・1・100のイメージを全部入力してください。');return}state.topic={category:'みんなのお題',q,low,high};if(state.history[state.history.length-1]==='topic')state.history.pop();go('topic',{push:false})}
function addCustom(){const q=document.getElementById('cq')?.value.trim(),low=document.getElementById('cl')?.value.trim(),high=document.getElementById('ch')?.value.trim();if(!q||!low||!high){alert('お題・1・100のイメージを全部入力してください。');return}const a=customItems();a.push({q,low,high});saveCustom(a);render()}
function closeRecheck(){document.querySelector('.recheck-backdrop')?.remove()}
function showRecheckFirst(playerIndex){
  closeRecheck();
  const p=state.players[playerIndex];
  if(!p)return;
  const wrap=document.createElement('div');
  wrap.className='recheck-backdrop';
  wrap.innerHTML='<section class="recheck-modal"><div class="recheck-avatar">'+esc(p.icon)+'</div><h2>'+esc(p.name)+'さん本人ですか？</h2><p>忘れてしまったときだけ使ってね。<br>数字は本人だけが確認してください。</p><div class="recheck-actions"><button class="btn secondary" data-recheck-cancel>違う</button><button class="btn" data-recheck-next>本人です</button></div></section>';
  document.body.appendChild(wrap);
  wrap.querySelector('[data-recheck-cancel]').addEventListener('click',closeRecheck);
  wrap.querySelector('[data-recheck-next]').addEventListener('click',()=>showRecheckHold(playerIndex));
}
function showRecheckHold(playerIndex){
  closeRecheck();
  const p=state.players[playerIndex],n=state.numbers[playerIndex];
  if(!p||n==null)return;
  const wrap=document.createElement('div');
  wrap.className='recheck-backdrop privacy';
  wrap.innerHTML='<section class="recheck-modal recheck-private"><div class="recheck-avatar">'+esc(p.icon)+'</div><h2>'+esc(p.name)+'さんだけ見てね</h2><p>長押ししている間に、周りの人は画面を見ないでください。</p><button class="btn yellow hold-btn recheck-hold" data-recheck-hold><i></i><span>長押しして数字を見る</span></button><button class="recheck-text-btn" data-recheck-cancel>やめる</button></section>';
  document.body.appendChild(wrap);
  wrap.querySelector('[data-recheck-cancel]').addEventListener('click',closeRecheck);
  bindHold(wrap.querySelector('[data-recheck-hold]'),()=>showRecheckNumber(playerIndex));
}
function showRecheckNumber(playerIndex){
  closeRecheck();
  const p=state.players[playerIndex],n=state.numbers[playerIndex];
  if(!p||n==null)return;
  const wrap=document.createElement('div');
  wrap.className='recheck-backdrop privacy';
  wrap.innerHTML='<section class="recheck-modal recheck-private"><div class="recheck-avatar">'+esc(p.icon)+'</div><strong>'+esc(p.name)+'さんの数字</strong><div class="recheck-number">'+n+'</div><p>覚えたら、すぐ閉じてスマホをみんなに戻してね。</p><button class="btn full" data-recheck-close>覚えた！ 閉じる</button></section>';
  document.body.appendChild(wrap);
  wrap.querySelector('[data-recheck-close]').addEventListener('click',closeRecheck);
}
function bindHold(btn,fn){if(!btn)return;let t=null;const start=()=>{btn.classList.add('holding');t=setTimeout(()=>{t=null;btn.classList.remove('holding');fn()},LONG_PRESS_MS)};const cancel=()=>{if(t)clearTimeout(t);t=null;btn.classList.remove('holding')};btn.addEventListener('pointerdown',start);btn.addEventListener('pointerup',cancel);btn.addEventListener('pointerleave',cancel);btn.addEventListener('pointercancel',cancel);btn.addEventListener('contextmenu',e=>e.preventDefault())}
function bind(){
document.querySelector('[data-back]')?.addEventListener('click',safeBack);
document.querySelector('[data-home]')?.addEventListener('click',()=>showNavConfirm('home'));
document.querySelector('[data-start-title]')?.addEventListener('click',()=>{state.history=[];go('setup',{push:false})});
document.querySelectorAll('[data-rules]').forEach(b=>b.addEventListener('click',()=>go('rules')));
  document.querySelector('[data-rules-back]')?.addEventListener('click',doBackOne);
document.querySelectorAll('[data-custom]').forEach(b=>b.addEventListener('click',()=>go('custom')));
document.querySelector('[data-edit-members]')?.addEventListener('click',()=>{state.memberIconTarget=null;go('members')});
document.querySelectorAll('[data-member-count]').forEach(b=>b.addEventListener('click',()=>{playersApi?.setActiveCount?.(Number(b.dataset.memberCount));state.memberIconTarget=null;loadPlayers();render()}));
document.querySelectorAll('[data-member-avatar]').forEach(b=>b.addEventListener('click',()=>{const i=Number(b.dataset.memberAvatar);state.memberIconTarget=state.memberIconTarget===i?null:i;render()}));
document.querySelectorAll('[data-member-icon]').forEach(b=>b.addEventListener('click',()=>{const i=Number(b.dataset.memberIcon);playersApi?.setPlayer?.(i,{icon:b.dataset.icon});state.memberIconTarget=null;loadPlayers();render()}));
document.querySelectorAll('[data-member-name]').forEach(input=>input.addEventListener('input',()=>{const i=Number(input.dataset.memberName);playersApi?.setPlayer?.(i,{name:input.value||('プレイヤー'+(i+1))});loadPlayers()}));
document.querySelector('[data-members-done]')?.addEventListener('click',()=>{state.memberIconTarget=null;loadPlayers();safeBack()});
document.querySelectorAll('[data-difficulty]').forEach(b=>b.addEventListener('click',()=>{const y=window.scrollY;state.difficulty=b.dataset.difficulty;render({preserveScroll:true,scrollY:y})}));
document.querySelector('[data-next-categories]')?.addEventListener('click',()=>go('categories'));
document.querySelectorAll('[data-cat]').forEach(b=>b.addEventListener('click',()=>{const c=b.dataset.cat;if(state.selectedCategories.has(c))state.selectedCategories.delete(c);else state.selectedCategories.add(c);b.classList.toggle('selected',state.selectedCategories.has(c));refreshPool()}));
document.querySelector('[data-all]')?.addEventListener('click',()=>{const cats=Object.keys(DB),on=cats.every(c=>state.selectedCategories.has(c));state.selectedCategories=on?new Set():new Set(cats);document.querySelectorAll('[data-cat]').forEach(b=>b.classList.toggle('selected',state.selectedCategories.has(b.dataset.cat)));refreshPool()});
document.querySelector('[data-custom-toggle]')?.addEventListener('change',e=>{state.includeCustom=e.target.checked;refreshPool()});
document.querySelector('[data-begin]')?.addEventListener('click',beginGame);
document.querySelector('[data-change-topic]')?.addEventListener('click',changeTopic);
document.querySelector('[data-compose-topic]')?.addEventListener('click',()=>go('composeTopic'));
document.querySelector('[data-use-composed-topic]')?.addEventListener('click',useComposedTopic);
document.querySelector('[data-secret-start]')?.addEventListener('click',()=>go('pass'));
bindHold(document.querySelector('[data-hold]'),()=>go('number'));
document.querySelector('[data-remember]')?.addEventListener('click',remember);
document.querySelector('[data-arrange]')?.addEventListener('click',()=>go('arrange'));
document.querySelectorAll('[data-recheck]').forEach(b=>b.addEventListener('click',()=>showRecheckFirst(Number(b.dataset.recheck))));
document.querySelectorAll('[data-up]').forEach(b=>b.addEventListener('click',()=>{const p=Number(b.dataset.up);if(p>0)swapOrder(p,p-1)}));
document.querySelectorAll('[data-down]').forEach(b=>b.addEventListener('click',()=>{const p=Number(b.dataset.down);if(p<state.order.length-1)swapOrder(p,p+1)}));
document.querySelector('[data-confirm]')?.addEventListener('click',confirmOrder);
document.querySelector('[data-back-arrange]')?.addEventListener('click',()=>{state.screen='arrange';render()});
document.querySelector('[data-finalize-order]')?.addEventListener('click',finalizeOrder);
document.querySelectorAll('[data-result-reveal]').forEach(b=>b.addEventListener('click',()=>{const pi=Number(b.dataset.resultReveal);state.resultRevealed.add(pi);render()}));
document.querySelector('[data-next-round]')?.addEventListener('click',nextRound);
document.querySelector('[data-replay]')?.addEventListener('click',()=>{state.history=[];beginGame()});
document.querySelector('[data-title]')?.addEventListener('click',()=>{state.gameStarted=false;state.history=[];go('title',{push:false})});
document.querySelector('[data-add-custom]')?.addEventListener('click',addCustom);
document.querySelectorAll('[data-delete]').forEach(b=>b.addEventListener('click',()=>{const a=customItems();a.splice(Number(b.dataset.delete),1);saveCustom(a);render()}));
}
loadPlayers();render();
})();