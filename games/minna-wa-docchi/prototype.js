(()=>{
const api=window.HoukagoPlayers;
const DB=window.DOCCHI_QUESTIONS;
if(!api||!DB)return;

const state={
  open:false,mode:'battle',screen:'setup',players:[],roundCount:5,category:'all',
  questions:[],round:0,voter:0,answers:[],predictions:[],scores:[],secretCounts:{a:0,b:0},used:new Set()
};
const CUSTOM_KEY='houkago_docchi_custom_v1';

function esc(v){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function customItems(){try{return JSON.parse(localStorage.getItem(CUSTOM_KEY)||'[]')}catch(e){return[]}}
function categories(){return Object.keys(DB[state.mode])}
function allPool(){
  const cats=categories();
  const base=(state.category==='all'?cats:[state.category]).flatMap(cat=>(DB[state.mode][cat]||[]).map(x=>({...x,category:cat})));
  return base;
}
function drawQuestions(){
  let pool=[...allPool()];
  const out=[];
  while(pool.length&&out.length<state.roundCount){
    const i=Math.floor(Math.random()*pool.length);
    out.push(pool.splice(i,1)[0]);
  }
  return out;
}
function currentQ(){return state.questions[state.round]}
function resetRound(){
  state.voter=0;state.answers=[];state.predictions=[];state.secretCounts={a:0,b:0};
}
function start(mode){
  const shared=api.load();
  state.open=true;state.mode=mode;state.screen='setup';
  state.players=shared.players.slice(0,shared.activeCount);
  state.roundCount=5;state.category='all';state.questions=[];state.round=0;state.scores=Array(state.players.length).fill(0);
  render();
}
function close(){state.open=false;document.querySelector('.docchi-prototype-overlay')?.remove();document.body.classList.remove('docchi-prototype-open')}
function modeName(){return state.mode==='battle'?'よみあいバトル':'ひみつ投票'}
function setupHtml(){
  const cats=categories();
  const memberHtml=state.players.map(p=>'<span class="proto-member">'+p.icon+' '+esc(p.name)+'</span>').join('');
  return '<div class="proto-head"><div><span class="mode-number">試作プレイ</span><h2>'+modeName()+'</h2></div><button class="registry-close" data-proto-close>×</button></div>'
    +'<div class="proto-setup-card"><h3>参加メンバー</h3><div class="proto-members">'+memberHtml+'</div><p>トップページの「いつものメンバー」をそのまま使います。</p></div>'
    +'<div class="proto-setup-card"><h3>何問遊ぶ？</h3><div class="proto-round-buttons">'+[3,5,7,10].map(n=>'<button type="button" data-proto-round="'+n+'" class="'+(state.roundCount===n?'selected':'')+'">'+n+'問</button>').join('')+'</div></div>'
    +'<div class="proto-setup-card"><h3>ジャンル</h3><select id="protoCategory"><option value="all">すべてのジャンル</option>'+cats.map(c=>'<option value="'+esc(c)+'" '+(state.category===c?'selected':'')+'>'+esc(c)+'</option>').join('')+'</select></div>'
    +(state.mode==='battle'?'<div class="proto-rule-note"><strong>試作ルール</strong><span>自分の答えが「多数派 / 少数派」のどちらになるか予想。当たれば1点。同数ならその問題は得点なし。</span></div>':'<div class="proto-rule-note secret"><strong>匿名性を優先</strong><span>誰がA/Bを選んだかは保存せず、投票した瞬間に人数だけを加算します。</span></div>')
    +'<button type="button" class="play-button" data-proto-start>この設定でスタート</button>';
}
function passHtml(){
  const q=currentQ();
  const p=state.players[state.voter];
  return '<div class="proto-head"><div><span class="mode-number">'+(state.round+1)+' / '+state.questions.length+'問</span><h2>'+modeName()+'</h2></div><button class="registry-close" data-proto-close>×</button></div>'
    +'<div class="proto-question-preview"><span>'+esc(q.category)+'</span><strong>'+esc(q.q)+'</strong></div>'
    +(state.voter===0?'<button type="button" class="proto-change-question" data-proto-change>このお題を変える</button>':'')
    +'<div class="proto-pass-card"><div class="proto-big-avatar">'+p.icon+'</div><h3>'+esc(p.name)+'さんに<br>スマホを渡してください</h3><p>ほかの人は画面を見ないでね。</p><button type="button" class="play-button" data-proto-vote>自分だけで回答する</button></div>';
}
function voteHtml(){
  const q=currentQ(),p=state.players[state.voter];
  return '<div class="proto-head"><div><span class="mode-number">'+(state.round+1)+' / '+state.questions.length+'問</span><h2>'+esc(p.name)+'さんの回答</h2></div><button class="registry-close" data-proto-close>×</button></div>'
    +'<div class="proto-vote-card"><span class="question-category-label">'+esc(q.category)+'</span><strong>'+esc(q.q)+'</strong><div class="proto-choice-grid"><button type="button" data-proto-answer="a">'+esc(q.a)+'</button><button type="button" data-proto-answer="b">'+esc(q.b)+'</button></div>'
    +(state.mode==='battle'?'<div class="proto-predict" hidden id="protoPredict"><p>自分が選んだ答えはどっちになりそう？</p><div><button type="button" data-proto-predict="majority">多数派</button><button type="button" data-proto-predict="minority">少数派</button></div></div>':'<p class="secret-pass-note">回答後、誰がどちらを選んだかは結果画面にも表示しません。</p>')
    +'</div>';
}
function coverHtml(){
  return '<div class="proto-head"><div><span class="mode-number">'+(state.round+1)+' / '+state.questions.length+'問</span><h2>回答しました</h2></div></div>'
    +'<div class="proto-pass-card"><div class="proto-cover-icon">✓</div><h3>画面を伏せて<br>次の人へ</h3><p>今の回答はもう表示されません。</p><button type="button" class="play-button" data-proto-next-voter>次の人へ</button></div>';
}
function battleResultHtml(){
  const q=currentQ();
  const ca=state.answers.filter(x=>x==='a').length,cb=state.answers.filter(x=>x==='b').length;
  const tie=ca===cb;
  let majority=ca>cb?'a':cb>ca?'b':null;
  const gains=state.answers.map((ans,i)=>{
    if(tie)return 0;
    const pred=state.predictions[i];
    const kind=ans===majority?'majority':'minority';
    return pred===kind?1:0;
  });
  gains.forEach((g,i)=>state.scores[i]+=g);
  const rows=state.players.map((p,i)=>'<div class="proto-result-row"><span>'+p.icon+' '+esc(p.name)+'</span><strong>'+esc(state.answers[i]==='a'?q.a:q.b)+'</strong><b>'+(gains[i]?'+1点':'0点')+'</b></div>').join('');
  return '<div class="proto-head"><div><span class="mode-number">'+(state.round+1)+'問目 結果</span><h2>'+esc(q.q)+'</h2></div><button class="registry-close" data-proto-close>×</button></div>'
    +'<div class="proto-tally"><div><span>'+esc(q.a)+'</span><strong>'+ca+'人</strong></div><div><span>'+esc(q.b)+'</span><strong>'+cb+'人</strong></div></div>'
    +(tie?'<div class="proto-rule-note"><strong>同数！</strong><span>今回は多数派・少数派なし。全員0点です。</span></div>':'')
    +'<div class="proto-result-list">'+rows+'</div>'
    +'<button type="button" class="play-button" data-proto-next-round>'+(state.round+1>=state.questions.length?'最終結果を見る':'次のお題へ')+'</button>';
}
function secretResultHtml(){
  const q=currentQ();
  return '<div class="proto-head"><div><span class="mode-number">'+(state.round+1)+'問目 結果</span><h2>'+esc(q.q)+'</h2></div><button class="registry-close" data-proto-close>×</button></div>'
    +'<div class="proto-anon-banner">誰がどっちを選んだかは秘密</div>'
    +'<div class="proto-tally"><div><span>'+esc(q.a)+'</span><strong>'+state.secretCounts.a+'人</strong></div><div><span>'+esc(q.b)+'</span><strong>'+state.secretCounts.b+'人</strong></div></div>'
    +'<div class="proto-talk-card"><strong>ここからが楽しい時間</strong><span>「誰だろう？」「意外！」と、答えを明かさず自由に話してみよう。</span></div>'
    +'<button type="button" class="play-button" data-proto-next-round>'+(state.round+1>=state.questions.length?'おわる':'次のお題へ')+'</button>';
}
function finalHtml(){
  if(state.mode==='secret'){
    return '<div class="proto-head"><div><span class="mode-number">FINISH</span><h2>ひみつ投票 おわり！</h2></div><button class="registry-close" data-proto-close>×</button></div>'
      +'<div class="proto-final-card"><div class="proto-cover-icon">✓</div><h3>'+state.questions.length+'問遊びました</h3><p>誰がどっちに投票したかは最後まで保存・表示していません。</p></div><button type="button" class="play-button" data-proto-restart>もう一度遊ぶ</button>';
  }
  const ranking=state.players.map((p,i)=>({p,score:state.scores[i]})).sort((a,b)=>b.score-a.score);
  return '<div class="proto-head"><div><span class="mode-number">FINAL RESULT</span><h2>よみあいバトル結果</h2></div><button class="registry-close" data-proto-close>×</button></div>'
    +'<div class="proto-ranking">'+ranking.map((x,i)=>'<div class="proto-rank-row"><b>'+(i+1)+'位</b><span>'+x.p.icon+' '+esc(x.p.name)+'</span><strong>'+x.score+'点</strong></div>').join('')+'</div>'
    +'<button type="button" class="play-button" data-proto-restart>もう一度遊ぶ</button>';
}
function render(){
  document.querySelector('.docchi-prototype-overlay')?.remove();
  if(!state.open)return;
  const wrap=document.createElement('div');wrap.className='docchi-prototype-overlay';
  let body='';
  if(state.screen==='setup')body=setupHtml();
  else if(state.screen==='pass')body=passHtml();
  else if(state.screen==='vote')body=voteHtml();
  else if(state.screen==='cover')body=coverHtml();
  else if(state.screen==='result')body=state.mode==='battle'?battleResultHtml():secretResultHtml();
  else body=finalHtml();
  wrap.innerHTML='<section class="docchi-prototype-modal">'+body+'</section>';
  document.body.appendChild(wrap);document.body.classList.add('docchi-prototype-open');
  bind(wrap);
}
function begin(){
  state.players=api.load().players.slice(0,api.load().activeCount);
  state.questions=drawQuestions();
  if(!state.questions.length)return;
  state.round=0;state.scores=Array(state.players.length).fill(0);resetRound();state.screen='pass';render();
}
function changeQuestion(){
  const pool=allPool().filter(x=>x.q!==currentQ().q);
  if(!pool.length)return;
  const next=pool[Math.floor(Math.random()*pool.length)];
  state.questions[state.round]=next;render();
}
function submitAnswer(ans){
  if(state.mode==='secret'){
    state.secretCounts[ans]++;state.screen='cover';render();return;
  }
  state.answers[state.voter]=ans;
  document.querySelectorAll('[data-proto-answer]').forEach(b=>b.disabled=true);
  const box=document.getElementById('protoPredict');if(box)box.hidden=false;
}
function submitPrediction(pred){
  state.predictions[state.voter]=pred;state.screen='cover';render();
}
function nextVoter(){
  state.voter++;
  if(state.voter>=state.players.length)state.screen='result';else state.screen='pass';
  render();
}
function nextRound(){
  if(state.round+1>=state.questions.length){state.screen='final';render();return}
  state.round++;resetRound();state.screen='pass';render();
}
function bind(wrap){
  wrap.querySelectorAll('[data-proto-close]').forEach(b=>b.addEventListener('click',close));
  wrap.addEventListener('click',e=>{if(e.target===wrap)close()});
  wrap.querySelectorAll('[data-proto-round]').forEach(b=>b.addEventListener('click',()=>{state.roundCount=Number(b.dataset.protoRound);render()}));
  wrap.querySelector('#protoCategory')?.addEventListener('change',e=>{state.category=e.target.value});
  wrap.querySelector('[data-proto-start]')?.addEventListener('click',begin);
  wrap.querySelector('[data-proto-change]')?.addEventListener('click',changeQuestion);
  wrap.querySelector('[data-proto-vote]')?.addEventListener('click',()=>{state.screen='vote';render()});
  wrap.querySelectorAll('[data-proto-answer]').forEach(b=>b.addEventListener('click',()=>submitAnswer(b.dataset.protoAnswer)));
  wrap.querySelectorAll('[data-proto-predict]').forEach(b=>b.addEventListener('click',()=>submitPrediction(b.dataset.protoPredict)));
  wrap.querySelector('[data-proto-next-voter]')?.addEventListener('click',nextVoter);
  wrap.querySelector('[data-proto-next-round]')?.addEventListener('click',nextRound);
  wrap.querySelector('[data-proto-restart]')?.addEventListener('click',()=>{state.screen='setup';render()});
}
document.querySelectorAll('[data-prototype-mode]').forEach(btn=>btn.addEventListener('click',()=>start(btn.dataset.prototypeMode)));
})();