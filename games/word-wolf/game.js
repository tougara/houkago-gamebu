/* ことばのオオカミ / オフライン8作目 / 3〜10人 */
(function(){
'use strict';
const app=document.getElementById('app');
const playersApi=window.HoukagoPlayers;
const resumeApi=window.HoukagoResume;
const questionData=window.HoukagoWordWolfData;
const SAVE_ID='word-wolf';
const HISTORY_KEY='houkago_word_wolf_recent_pairs_v1';
const GAME_ID='word-wolf';
const CATEGORIES=questionData?.categories||[];
if(!app||!playersApi||!questionData?.pairs?.length)return;
const state={
 screen:'title',history:[],gameStarted:false,players:[],mode:'reverse',minutes:3,
 topicSource:'auto',hostId:'',host:null,
 categories:CATEGORIES.slice(),pair:null,majority:'',minority:'',wolf:-1,
 handoff:0,seen:false,seconds:180,paused:true,deadline:0,
 voteStage:1,voter:0,votes:[],firstVotes:[],runoffVotes:[],candidates:[],
 votedOut:-1,answer:'',verdict:'',resultRecorded:false
};
let ticker=null;
const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const random=n=>{if(n<=1)return 0;if(window.crypto?.getRandomValues){const v=new Uint32Array(1);const bound=Math.floor(4294967296/n)*n;do{crypto.getRandomValues(v)}while(v[0]>=bound);return v[0]%n}return Math.floor(Math.random()*n)};
const label=i=>state.players[i]?.name||'プレイヤー';
const avatar=i=>state.players[i]?.icon||'？';
function loadPlayers(){const d=playersApi.load();state.players=d.players.slice(0,d.activeCount).map(p=>({id:p.id,name:p.name,icon:p.icon}));}
function nav(){return '<nav class="top-nav"><button type="button" class="nav-pill" data-back>← もどる</button><button type="button" class="nav-pill" data-home>ゲームをえらぶ</button></nav>'}
function heading(title,desc=''){return '<header class="heading"><h1>'+esc(title)+'</h1>'+(desc?'<p>'+esc(desc)+'</p>':'')+'</header>'}
function button(label,attr,cls='primary'){return '<button type="button" class="btn '+cls+'" '+attr+'>'+esc(label)+'</button>'}
function titleScreen(){return nav()+'<section class="welcome"><p class="kicker">8TH GAME · TALK & DEDUCTION</p><h1 class="welcome-title"><img class="welcome-logo" src="../../kotoba_no_ookami_logo_transparent.png?v=20261015-art1" alt="ことばのオオカミ"></h1><p class="welcome-description">同じ話をしているはずなのに、<br>誰かひとり、何かが違う。</p><div class="welcomebadges"><span>3〜10人</span><span>スマホ1台</span><span>オフライン</span></div></section><div class="stack">'+button('ゲームをはじめる','data-start','gold')+button('あそびかた','data-open-rules','secondary')+'</div>'}
function membersScreen(){return nav()+playersApi.renderEditor({min:3,max:10,count:Math.max(3,state.players.length),title:'参加メンバー',subtitle:'いつものメンバーから3〜10人を選ぼう',doneLabel:'このメンバーで決定'})}
function setupScreen(){
 const selected=state.categories;
 const custom=state.topicSource==='custom';
 const chosen=state.players.find(p=>p.id===state.hostId);
 const valid=custom?(state.players.length>=4&&!!chosen):selected.length>0;
 return nav()+heading('ゲーム設定','ルールと話し合い時間を決めよう')+
 '<section class="card"><h2>お題の決め方</h2><div class="select-grid"><button type="button" class="select-option '+(!custom?'selected':'')+'" data-topic-source="auto" aria-pressed="'+(!custom)+'"><strong>おまかせ</strong><small>150ペアから自動で決定</small></button><button type="button" class="select-option '+(custom?'selected':'')+'" data-topic-source="custom" aria-pressed="'+custom+'"><strong>自分たちで決める</strong><small>出題者1人が自由入力</small></button></div></section>'+
 (custom?
 '<section class="card"><h2>お題を決める人は？</h2><p class="intro">出題者はお題を知っているので、ゲームには参加しないよ。</p><div class="host-grid">'+state.players.map(p=>'<button type="button" class="host-choice '+(state.hostId===p.id?'selected':'')+'" data-host-id="'+esc(p.id)+'" aria-pressed="'+(state.hostId===p.id)+'"><span class="host-icon">'+esc(p.icon)+'</span><strong>'+esc(p.name)+'</strong><small>'+(state.hostId===p.id?'出題者':'この人にする')+'</small></button>').join('')+'</div><p class="hint">'+(state.players.length>=4?state.players.length+'人中 '+(state.players.length-1)+'人でプレイ ＋ 出題者1人':'出題者ありは4人以上必要です')+'</p>'+(!chosen?'<p class="topic-warning">出題者をひとり選んでね。</p>':'')+'</section>':
 '<section class="card"><h2>お題ジャンル <span class="count">'+selected.length+' / '+CATEGORIES.length+'</span></h2><div class="genre-grid">'+CATEGORIES.map(c=>'<button type="button" class="choice '+(selected.includes(c)?'selected':'')+'" data-category="'+esc(c)+'" aria-pressed="'+selected.includes(c)+'">'+esc(c)+'</button>').join('')+'</div><p class="hint">1ジャンル以上を選んでね。お題は全150ペア。</p></section>')+
 '<section class="card"><h2>勝敗ルール</h2><div class="select-grid"><button type="button" class="select-option '+(state.mode==='simple'?'selected':'')+'" data-mode="simple"><strong>シンプル</strong><small>ウルフを当てたら市民の勝ち</small></button><button type="button" class="select-option '+(state.mode==='reverse'?'selected':'')+'" data-mode="reverse"><strong>逆転チャンスあり</strong><small>見つかったウルフはお題を自由回答</small></button></div></section>'+
 '<section class="card"><h2>話し合い時間</h2><div class="small-grid">'+[2,3,5,7].map(n=>'<button type="button" class="choice '+(state.minutes===n?'selected':'')+'" data-minutes="'+n+'">'+n+'分</button>').join('')+'</div><p class="hint">ゲーム中に10秒・30秒ずつ増減できるよ。</p></section>'+
 '<section class="card compact"><h2>今回のメンバー <span class="count">'+state.players.length+'人</span></h2><div class="chips">'+state.players.map(p=>'<span class="chip">'+esc(p.icon)+' '+esc(p.name)+'</span>').join('')+'</div>'+button('メンバーを変更','data-edit-members','secondary')+'</section>'+
 '<div class="stack">'+button(custom?'出題者にスマホを渡す':'この設定でゲーム開始','data-begin '+(!valid?'disabled':''),'gold')+'</div>';
}
function customTopicsScreen(){
 return nav()+heading('出題者がお題を決めよう','ほかの人には画面を見せないでね')+
 '<section class="card host-header"><div class="person-icon">'+esc(state.host?.icon||'？')+'</div><h2>'+esc(state.host?.name||'出題者')+' さんの番</h2><p>今回のゲームには参加せず、お題を考える係だよ。</p><p class="hint">'+state.players.length+'人でプレイ。似ているけど同じではない言葉が盛り上がるよ。</p></section>'+
 '<form class="card topic-form" data-custom-topic-form><label for="common-topic">みんなのお題</label><input id="common-topic" name="majority" maxlength="30" autocomplete="off" placeholder="例：カレー" required><p class="hint">多数派に配るお題</p><label for="wolf-topic">オオカミのお題</label><input id="wolf-topic" name="minority" maxlength="30" autocomplete="off" placeholder="例：シチュー" required><p class="hint">1人だけに配る似たお題</p><p class="topic-warning" data-topic-error role="alert" aria-live="polite"></p><button class="btn gold" type="submit">お題を決定してスマホを渡す</button><p class="hint">決定後はお題を隠して、1人目に渡す画面に切り替わるよ。</p></form>';
}
function rulesScreen(){return nav()+heading('あそびかた','たった4つのポイント')+'<section class="card rules"><div><b>1</b><p><strong>お題をひみつで確認</strong><span>ひとりだけ似ている別のお題。誰が少数派かは本人にも分からないよ。</span></p></div><div><b>2</b><p><strong>みんなで会話</strong><span>お題を直接言わずに話そう。最初から答えをズバリ聞くのは控えると盛り上がるよ。</span></p></div><div><b>3</b><p><strong>怪しい人に投票</strong><span>自分以外の1人に秘密投票。同票なら1回だけ決選投票だよ。</span></p></div><div><b>4</b><p><strong>逆転チャンス</strong><span>逆転ありルールでは、見つかったウルフが市民のお題を自由入力。当てれば逆転勝利！</span></p></div></section>'+button('もどる','data-rules-back','secondary')}
function passScreen(type){
 const index=type==='word'?state.handoff:state.voter,person=state.players[index];
 const title=type==='word'?'お題を確認':'ひみつ投票';
 const stage=type==='vote'&&state.voteStage===2?'決選投票：':'';
 return nav()+heading(stage+title,(index+1)+' / '+state.players.length+'人目')+
 '<section class="card pass-card"><div class="person-icon">'+esc(person.icon)+'</div><h2>'+esc(person.name)+' さん</h2><p>この人だけがスマホを見てね。<br>ほかの人は画面を見ないで待ってね。</p>'+button(type==='word'?'お題を確認する':'投票する',type==='word'?'data-open-word':'data-open-vote','gold')+'</section>';
}
function wordScreen(){
 const p=state.players[state.handoff];
 return nav()+heading('お題をひみつで確認',esc(p.name)+' さんのお題')+
 '<section class="card word-card"><p>下のボタンを長押ししている間だけ表示されるよ。</p><div class="word-secret" data-word-value aria-live="off"><span>？？？</span></div><button type="button" class="hold-button" data-hold-word>ここを長押ししてお題を見る</button><p class="hint">自分がウルフかどうかは分からないよ。</p>'+button('確認した！ 次の人へ','data-word-done disabled','gold')+'</section>';
}
function discussionScreen(){
 return nav()+heading('みんなで話し合おう','お題そのものは言わずに会話しよう')+
 '<section class="card talk-card"><div class="label">のこり時間</div><div class="timer" data-clock>'+clock(state.seconds)+'</div><p data-clock-note>'+(state.paused?'一時停止中':'話し合い中')+'</p><div class="timer-controls">'+button(state.paused?'再開':'一時停止','data-pause','secondary')+button('＋30秒','data-plus','secondary') +button('−30秒','data-minus','secondary')+button('リセット','data-reset','secondary')+button('＋10秒','data-plus10','secondary')+button('−10秒','data-minus10','secondary')+'</div></section><div class="card"><h2>参加メンバー</h2><div class="chips">'+state.players.map(p=>'<span class="chip">'+esc(p.icon)+' '+esc(p.name)+'</span>').join('')+'</div><p class="hint">時間が0になっても、自動的には次へ進まないよ。</p></div>'+button('話し合いを終えて投票へ','data-go-vote','gold');
}
function voteScreen(){
 const voter=state.voter;
 const possible=state.voteStage===2?state.candidates:state.players.map((_,i)=>i);
 return nav()+heading(state.voteStage===2?'決選投票':'ウルフを探そう',esc(label(voter))+' さんの投票')+
 '<section class="card"><p class="intro">怪しいと思う人をひとり選んでね。<br>自分には投票できないよ。</p><div class="vote-grid">'+possible.map(i=>'<button type="button" class="vote-choice" data-vote="'+i+'" '+(i===voter?'disabled':'')+'><span>'+esc(avatar(i))+'</span><strong>'+esc(label(i))+'</strong><small>'+(i===voter?'自分':'投票する')+'</small></button>').join('')+'</div></section>';
}
function tallyScreen(){
 const counts=countVotes(state.firstVotes),highest=Math.max(...counts),candidates=state.candidates;
 return nav()+heading('同票！ 決選投票','最多得票の'+candidates.length+'人からひとりを選び直そう')+
 '<section class="card"><div class="vote-summary">'+state.players.map((p,i)=>'<div class="vote-summary-row"><span>'+esc(p.icon)+' '+esc(p.name)+'</span><b>'+counts[i]+'票</b></div>').join('')+'</div><p class="hint">最多 '+highest+'票の人が複数いるため、もう1回だけ投票。次も同票ならウルフの勝利。</p><div class="chips">'+candidates.map(i=>'<span class="chip candidate">'+esc(avatar(i))+' '+esc(label(i))+'</span>').join('')+'</div></section>'+button('決選投票へ進む','data-start-runoff','gold');
}
function wolfPassScreen(){return nav()+heading('逆転チャンス！','ウルフに最後のチャンス')+
 '<section class="card pass-card"><div class="person-icon">'+esc(avatar(state.wolf))+'</div><h2>'+esc(label(state.wolf))+' さん</h2><p>あなたがオオカミだった！<br>ここからは本人だけが画面を見てね。</p>'+button('市民のお題を答える','data-open-answer','gold')+'</section>'}
function answerScreen(){return nav()+heading('市民のお題は何だった？','回答は1回だけ。自分のお題とは違う言葉を推理しよう')+
 '<form class="card answer-card" data-answer-form><label for="answer">市民のお題を入力</label><input id="answer" name="answer" maxlength="40" autocomplete="off" enterkeyhint="done" placeholder="お題を入力" required><p class="hint">ひらがな・カタカナ、全角・半角の違いは自動で調整するよ。</p><button class="btn gold" type="submit">これで回答する</button></form>'}
function appealScreen(){return nav()+heading('回答を確認しよう','入力した答えと正解を比較してね')+
 '<section class="card"><div class="answer-compare"><div><small>ウルフの回答</small><strong>'+esc(state.answer)+'</strong></div><div><small>市民のお題</small><strong>'+esc(state.majority)+'</strong></div></div><p class="hint">自動判定は不正解。表記ゆれなどで実質正解だと思う場合だけ、全員一致で訂正できるよ。</p></section><div class="stack">'+button('全員一致で正解に訂正','data-accept-appeal','secondary')+button('不正解として結果を見る','data-reject-appeal','gold')+'</div>'}
function resultScreen(){
 const wolfWins=state.verdict==='wolf';
 const counts=countVotes(state.firstVotes);
 const votes=state.voteStage===2?state.runoffVotes:state.firstVotes;
 const resultInfo=state.votedOut<0?'同票のまま決着！':state.votedOut===state.wolf?'ウルフを見つけた！':'別の人を選んでしまった！';
 return nav()+'<section class="results"><div class="winner-symbol">'+(wolfWins?'☾':'★')+'</div><p class="kicker">GAME RESULT</p><h1 class="'+(wolfWins?'wolf-wins':'human-wins')+'">'+(wolfWins?'ウルフの勝利！':'市民チームの勝利！')+'</h1><p>'+resultInfo+'</p></section>'+
 '<section class="card"><div class="result-words"><div><small>市民のお題</small><strong>'+esc(state.majority)+'</strong></div><div class="minority"><small>ウルフのお題</small><strong>'+esc(state.minority)+'</strong></div></div><h2>オオカミの正体は…</h2><div class="wolf-reveal">'+esc(avatar(state.wolf))+' '+esc(label(state.wolf))+'</div>'+(state.answer?'<p class="answer-detail">逆転回答：'+esc(state.answer)+(state.verdict==='wolf'&&state.votedOut===state.wolf?'（正解）':'（不正解）')+'</p>':'')+'</section>'+
 '<section class="card"><h2>投票結果</h2><div class="vote-summary">'+state.players.map((p,i)=>'<div class="vote-summary-row"><span>'+esc(p.icon)+' '+esc(p.name)+'</span><b>'+counts[i]+'票</b></div>').join('')+'</div>'+(state.voteStage===2?'<p class="hint">決選投票：'+votes.map((target,i)=>esc(label(i))+' → '+esc(label(target))).join(' ／ ')+'</p>':'')+'</section>'+
 '<div class="stack">'+button('同じメンバーでもう一戦','data-again','gold')+button('ゲーム設定へ','data-to-setup','secondary')+button('ゲームをえらぶ','data-result-home','secondary')+'</div>';
}
function screenHtml(){
 const screens={title:titleScreen,members:membersScreen,setup:setupScreen,customTopics:customTopicsScreen,rules:rulesScreen,
 pass:()=>passScreen('word'),word:wordScreen,discussion:discussionScreen,
 votePass:()=>passScreen('vote'),vote:voteScreen,tally:tallyScreen,wolfPass:wolfPassScreen,
 answer:answerScreen,appeal:appealScreen,result:resultScreen};
 return (screens[state.screen]||titleScreen)();
}
function clock(seconds){const n=Math.max(0,Math.ceil(seconds));return String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0')}
function currentSeconds(){return state.paused?state.seconds:Math.max(0,(state.deadline-Date.now())/1000)}
function stopTicker(){if(ticker){clearInterval(ticker);ticker=null}}
function refreshClock(){
 if(state.screen!=='discussion'){stopTicker();return}
 state.seconds=currentSeconds();
 if(state.seconds<=0){state.seconds=0;state.paused=true;stopTicker();persistResume()}
 const el=app.querySelector('[data-clock]');if(el)el.textContent=clock(state.seconds);
 const note=app.querySelector('[data-clock-note]');if(note)note.textContent=state.seconds<=0?'時間終了。投票へ進むか延長してね。':state.paused?'一時停止中':'話し合い中';
 const b=app.querySelector('[data-pause]');if(b)b.textContent=state.paused?'再開':'一時停止';
}
function render(){
 app.className='word-wolf-app screen-'+state.screen;
 app.innerHTML=screenHtml();
 window.scrollTo({top:0,behavior:'instant'});
 if(state.screen==='discussion'&&!state.paused){stopTicker();ticker=setInterval(refreshClock,250)}
 else stopTicker();
 persistResume();
}
function go(screen,push=true){
 if(push&&state.screen!==screen)state.history.push(state.screen);
 state.screen=screen;render();
}
function showLeave(to){
 const dialog=document.createElement('div');dialog.className='modal-backdrop';dialog.innerHTML='<section class="modal" role="alertdialog" aria-modal="true"><h2>ゲームを中断する？</h2><p>途中の状態は保存されているよ。秘密のお題は伏せた状態で再開できるよ。</p><div class="stack"><button type="button" class="btn secondary" data-cancel>ゲームを続ける</button><button type="button" class="btn gold" data-exit>中断して戻る</button></div></section>';
 document.body.appendChild(dialog);
 dialog.querySelector('[data-cancel]').addEventListener('click',()=>dialog.remove());
 dialog.querySelector('[data-exit]').addEventListener('click',()=>{dialog.remove();if(state.screen==='discussion')pauseClock();persistResume();location.href='../'});
}
function safeBack(){
 if(state.gameStarted&&state.screen!=='result'){showLeave('setup');return}
 if(state.screen==='title'){location.href='../';return}
 if(state.screen==='rules'){go('title',false);return}
 if(state.screen==='members'){go('setup',false);return}
 if(state.screen==='setup'){go('title',false);return}
 if(state.screen==='customTopics'){loadPlayers();go('setup',false);return}
 if(state.screen==='result'){go('setup',false);return}
 go('setup',false);
}
function normalized(word){
 return String(word||'').normalize('NFKC').trim().toLowerCase().replace(/[\s　・･、。．.！!？?「」『』'"（）()_-]/g,'').replace(/[ァ-ヶ]/g,ch=>String.fromCharCode(ch.charCodeAt(0)-96)).replace(/[ー－]/g,'ー');
}
function correct(answer,expected){
 const words=[expected,...(questionData.aliases[expected]||[])];
 return words.some(w=>normalized(w)===normalized(answer));
}
function recent(){
 try{const ids=JSON.parse(localStorage.getItem(HISTORY_KEY)||'[]');return Array.isArray(ids)?ids:[]}
 catch{return []}
}
function choosePair(){
 const pool=questionData.pairs.filter(p=>state.categories.includes(p.category));
 if(!pool.length)return null;
 const old=recent(),fresh=pool.filter(p=>!old.includes(p.id));
 const p=(fresh.length?fresh:pool)[random((fresh.length?fresh:pool).length)];
 try{localStorage.setItem(HISTORY_KEY,JSON.stringify([...old.filter(id=>id!==p.id),p.id].slice(-50)))}catch(e){}
 return p;
}
function begin(){
 loadPlayers();
 if(state.players.length<3||state.players.length>10||!state.categories.length)return;
 const pair=choosePair();if(!pair)return;
 stopTicker();Object.assign(state,{gameStarted:true,pair:pair,majority:random(2)?pair.a:pair.b,
 wolf:random(state.players.length),handoff:0,seen:false,seconds:state.minutes*60,
 paused:true,deadline:0,voteStage:1,voter:0,votes:[],firstVotes:[],runoffVotes:[],
 candidates:[],votedOut:-1,answer:'',verdict:'',resultRecorded:false,history:[]});
 state.minority=state.majority===pair.a?pair.b:pair.a;
 go('pass',false);
}
function revealWord(show){
 const field=app.querySelector('[data-word-value]'),btn=app.querySelector('[data-hold-word]');
 if(!field||state.screen!=='word')return;
 field.replaceChildren();
 const span=document.createElement('span');
 span.textContent=show?(state.handoff===state.wolf?state.minority:state.majority):'？？？';
 field.appendChild(span);
 field.classList.toggle('revealed',show);
 btn?.classList.toggle('holding',show);
 if(show){state.seen=true;const done=app.querySelector('[data-word-done]');if(done)done.disabled=false}
}
function nextWord(){
 if(!state.seen)return;
 revealWord(false);state.seen=false;state.handoff++;
 if(state.handoff===state.players.length){
  state.paused=false;state.seconds=state.minutes*60;state.deadline=Date.now()+state.seconds*1000;
  go('discussion',false);
 }else go('pass',false);
}
function pauseClock(){
 if(state.screen!=='discussion'||state.paused)return;
 state.seconds=currentSeconds();state.paused=true;state.deadline=0;refreshClock();persistResume();
}
function togglePause(){
 if(state.screen!=='discussion')return;
 if(state.paused){state.paused=false;state.deadline=Date.now()+state.seconds*1000;stopTicker();ticker=setInterval(refreshClock,250)}
 else pauseClock();
 refreshClock();persistResume();
}
function adjustClock(amount){
 if(state.screen!=='discussion')return;
 state.seconds=Math.max(0,Math.ceil(currentSeconds())+amount);
 if(!state.paused)state.deadline=Date.now()+state.seconds*1000;
 refreshClock();persistResume();
}
function resetClock(){
 if(state.screen!=='discussion')return;
 state.seconds=state.minutes*60;
 if(!state.paused)state.deadline=Date.now()+state.seconds*1000;
 refreshClock();persistResume();
}
function startVoting(){
 pauseClock();stopTicker();state.voteStage=1;state.voter=0;state.votes=[];go('votePass',false);
}
function confirmVote(target){
 const voter=state.voter,possible=state.voteStage===2?state.candidates:state.players.map((_,i)=>i);
 if(!possible.includes(target)||target===voter)return;
 const dialog=document.createElement('div');dialog.className='modal-backdrop';
 dialog.innerHTML='<section class="modal" role="alertdialog" aria-modal="true"><h2>'+esc(label(target))+' さんに投票する？</h2><p>確定すると投票先は隠れるよ。</p><div class="stack"><button type="button" class="btn gold" data-yes>投票を確定</button><button type="button" class="btn secondary" data-no>選び直す</button></div></section>';
 document.body.appendChild(dialog);
 dialog.querySelector('[data-no]').addEventListener('click',()=>dialog.remove());
 dialog.querySelector('[data-yes]').addEventListener('click',()=>{
  dialog.remove();state.votes.push(target);state.voter++;
  if(state.voter<state.players.length){go('votePass',false);return}
  if(state.voteStage===1)state.firstVotes=state.votes.slice();
  else state.runoffVotes=state.votes.slice();
  settleVotes();
 });
}
function countVotes(votes){
 const n=Array(state.players.length).fill(0);
 (votes||[]).forEach(i=>{if(Number.isInteger(i)&&i>=0&&i<n.length)n[i]++});
 return n;
}
function settleVotes(){
 const counts=countVotes(state.votes),highest=Math.max(...counts);
 const leaders=counts.map((v,i)=>v===highest?i:-1).filter(i=>i>=0);
 if(leaders.length>1&&state.voteStage===1){
  state.candidates=leaders;go('tally',false);return;
 }
 if(leaders.length>1){state.votedOut=-1;conclude('wolf');return}
 state.votedOut=leaders[0];
 if(state.votedOut===state.wolf){
  if(state.mode==='reverse')go('wolfPass',false);
  else conclude('human');
 }else conclude('wolf');
}
function startRunoff(){
 state.voteStage=2;state.votes=[];state.voter=0;go('votePass',false);
}
function conclude(winner){
 state.verdict=winner;
 stopTicker();state.gameStarted=false;state.screen='result';
 resumeApi?.clear?.(SAVE_ID);
 if(!state.resultRecorded&&playersApi?.recordGame){
  state.resultRecorded=true;
  const winners=state.players.filter((_,i)=>winner==='wolf'?i===state.wolf:i!==state.wolf).map(p=>p.id);
  try{playersApi.recordGame({gameId:GAME_ID,participants:state.players.map(p=>p.id),winners:winners})}catch(e){}
 }
 render();
}
function submitAnswer(input){
 if(state.screen!=='answer'||!input)return;
 state.answer=input.trim().slice(0,40);
 if(!state.answer)return;
 if(correct(state.answer,state.majority)){conclude('wolf')}
 else go('appeal',false);
}
function saveSnapshot(){
 const snapshot={...state,players:state.players.map(p=>({...p})),categories:state.categories.slice(),history:[]};
 if(snapshot.screen==='word'){snapshot.screen='pass';snapshot.seen=false}
 if(snapshot.screen==='vote')snapshot.screen='votePass';
 if(snapshot.screen==='answer')snapshot.screen='wolfPass';
 if(snapshot.screen==='discussion'){snapshot.seconds=Math.ceil(currentSeconds());snapshot.paused=true;snapshot.deadline=0}
 return snapshot;
}
function persistResume(){
 if(!state.gameStarted)return;
 resumeApi?.save?.(SAVE_ID,{title:'ことばのオオカミ',path:'/games/word-wolf/',summary:state.screen==='discussion'?'話し合い中':'ゲーム進行中'},saveSnapshot());
}
function restore(saved){
 if(!saved||!Array.isArray(saved.players)||saved.players.length<3||saved.players.length>10||!saved.pair)return;
 stopTicker();Object.assign(state,saved);
 state.gameStarted=true;state.paused=true;state.deadline=0;state.seen=false;
 if(state.screen==='word')state.screen='pass';
 if(state.screen==='vote')state.screen='votePass';
 if(state.screen==='answer')state.screen='wolfPass';
 render();
}
function startFresh(){stopTicker();state.gameStarted=false;state.screen='title';state.history=[];loadPlayers();render()}
app.addEventListener('click',event=>{
 const b=event.target.closest('button');if(!b||!app.contains(b)||b.disabled)return;
 if(b.matches('[data-back]')){safeBack();return}
 if(b.matches('[data-home]')){if(state.gameStarted){showLeave('home')}else location.href='../';return}
 if(b.matches('[data-start]')){loadPlayers();go('members');return}
 if(b.matches('[data-open-rules]')){go('rules');return}
 if(b.matches('[data-rules-back]')){go('title',false);return}
 if(b.matches('[data-members-done]')){loadPlayers();go('setup',false);return}
 if(b.matches('[data-member-count]')){const n=Number(b.dataset.memberCount);playersApi.setActiveCount(n);loadPlayers();render();return}
 if(b.matches('[data-member-icon]')){const i=Number(b.dataset.memberIcon);playersApi.setPlayer(i,{icon:b.dataset.icon});loadPlayers();render();return}
 if(b.matches('[data-edit-members]')){go('members');return}
 if(b.matches('[data-mode]')){state.mode=b.dataset.mode;render();return}
 if(b.matches('[data-minutes]')){state.minutes=Number(b.dataset.minutes);render();return}
 if(b.matches('[data-category]')){const c=b.dataset.category;state.categories=state.categories.includes(c)?state.categories.filter(x=>x!==c):[...state.categories,c];render();return}
 if(b.matches('[data-begin]')){begin();return}
 if(b.matches('[data-open-word]')){state.seen=false;go('word',false);return}
 if(b.matches('[data-word-done]')){nextWord();return}
 if(b.matches('[data-pause]')){togglePause();return}
 if(b.matches('[data-plus]')){adjustClock(30);return}
 if(b.matches('[data-minus]')){adjustClock(-30);return}
 if(b.matches('[data-plus10]')){adjustClock(10);return}
 if(b.matches('[data-minus10]')){adjustClock(-10);return}
 if(b.matches('[data-reset]')){resetClock();return}
 if(b.matches('[data-go-vote]')){startVoting();return}
 if(b.matches('[data-open-vote]')){go('vote',false);return}
 if(b.matches('[data-vote]')){confirmVote(Number(b.dataset.vote));return}
 if(b.matches('[data-start-runoff]')){startRunoff();return}
 if(b.matches('[data-open-answer]')){go('answer',false);return}
 if(b.matches('[data-accept-appeal]')){conclude('wolf');return}
 if(b.matches('[data-reject-appeal]')){conclude('human');return}
 if(b.matches('[data-again]')){begin();return}
 if(b.matches('[data-to-setup]')){loadPlayers();go('setup',false);return}
 if(b.matches('[data-result-home]')){location.href='../';return}
});
app.addEventListener('change',event=>{
 const el=event.target;if(el.matches('[data-member-name]')){
  const i=Number(el.dataset.memberName);playersApi.setPlayer(i,{name:el.value});loadPlayers();
 }
});
app.addEventListener('submit',event=>{
 if(!event.target.matches('[data-answer-form]'))return;
 event.preventDefault();submitAnswer(event.target.elements.answer?.value||'');
});
function isHold(target){return target?.closest?.('[data-hold-word]')&&state.screen==='word'}
app.addEventListener('pointerdown',e=>{if(!isHold(e.target))return;e.preventDefault();try{e.target.setPointerCapture(e.pointerId)}catch(err){}revealWord(true)});
['pointerup','pointercancel','lostpointercapture','pointerleave'].forEach(type=>app.addEventListener(type,e=>{
 if(state.screen==='word'&&(isHold(e.target)||app.querySelector('.word-secret.revealed')))revealWord(false);
}));
app.addEventListener('keydown',e=>{if(isHold(e.target)&&[' ','Enter'].includes(e.key)){e.preventDefault();revealWord(true)}});
app.addEventListener('keyup',e=>{if(isHold(e.target)&&[' ','Enter'].includes(e.key)){e.preventDefault();revealWord(false)}});
window.addEventListener('blur',()=>{if(state.screen==='word')revealWord(false);pauseClock()});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'){if(state.screen==='word')revealWord(false);pauseClock();persistResume()}});
window.addEventListener('pagehide',()=>{if(state.screen==='word')revealWord(false);pauseClock();persistResume()});
window.addEventListener('houkago-back-guard-open',()=>{if(state.screen==='word')revealWord(false);pauseClock();persistResume()});
window.addEventListener('houkago-back-guard-save',persistResume);
window.addEventListener('houkago-player-selection-changed',()=>{if(state.gameStarted)return;const y=window.scrollY;loadPlayers();render();window.scrollTo(0,y)});
loadPlayers();render();
resumeApi?.offer?.({gameId:SAVE_ID,onResume:restore,onNew:startFresh});
})();
