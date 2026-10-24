import {createSabotage,sabotageAction,sabotageView,sabotageRevealPhase} from './engine.js?v=20261024-sabui3';
import {sabotageRevealBody} from './reveal-ui.js?v=20261024-sabui3';
import {sabotageBadges,sabotageSlots,sabotageSlotLegend,sabotageVictory,sabotageRoleCard,sabotageCutConfirm,sabotageRoleGoal} from './visuals.js?v=20261024-sabui3';
const app=document.getElementById('app'),api=window.HoukagoPlayers,resume=window.HoukagoResume;
const SAVE='sabotage',esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let g=null,screen='title',players=[],peek=0,secretOpen=false,target='',wire=-1,recorded=false,returnScreen='title',revealTimer=null;
function loadPlayers(){const d=api.load();players=d.players.slice(0,d.activeCount).map(p=>({id:p.id,name:p.name,icon:p.icon}))}
function persist(){if(!g||g.stage==='finished')return;resume?.save?.(SAVE,{title:'サボタージュ！',path:'/games/sabotage/',summary:'ROUND '+g.round+' / 4'}, {g,peek,screen:'handoff',recorded})}
function nav(){return '<nav class="sab-nav top-nav"><button type="button" class="nav-pill" data-nav="back">← もどる</button><span class="sab-mark">SABOTAGE!</span><button type="button" class="nav-pill" data-nav="home">ゲームをえらぶ</button></nav>'}
const btn=(s,a,cls='',disabled=false)=>'<button type="button" class="sab-btn '+cls+'" data-action="'+a+'" '+(disabled?'disabled':'')+'>'+esc(s)+'</button>';
const roleName={crew:'クルーメイト',impostor:'インポスター',jackal:'ジャッカル'};
const wireName={repair:'解除コード',error:'爆弾（BOMB）',dummy:'しーん……'};
const winnerName={crew:'クルーメイト',impostor:'インポスター',jackal:'ジャッカル'};
function rules(){return '<details class="sab-more" '+(screen==='rules'?'open':'')+'><summary>あそびかた・勝利条件</summary><div class="sab-more-content"><ol><li>秘密の役職と、手持ちコードの種類・枚数を確認。どの位置に何があるかは本人も分かりません。</li><li>話し合って、自分以外の人のコードを1本選択。選ばれた人が次の番です。</li><li>解除コードをすべて見つけるとクルーメイトの勝利。爆弾を選ぶとインポスターの勝利。</li><li>各ラウンド人数分だけ選択したら、残りを混ぜて再配布。4ラウンド終了まで決着しなければジャッカルがいる場合はジャッカル、いなければインポスターの勝利です。</li></ol><p>嘘の申告や自由な会話はOK。特殊能力・投票・脱落はありません。</p></div></details>'}
function title(){return '<section class="sab-panel sab-center sab-handoff"><p class="sab-kicker">EMERGENCY! / SPACE MYSTERY</p><h1 class="sab-headline">サボタージュ！</h1><p class="sab-sub">修理するか、妨害するか、最後まで隠れ続けるか。<br>誰を信じてコードを選ぶ？</p><p class="sab-sub">4〜10人・スマホ1台・4ラウンド</p></section><div class="sab-actions">'+btn('ゲームをはじめる','members')+btn('あそびかた','rules','secondary')+'</div>'}
function members(){return api.renderEditor({min:4,max:10,count:Math.max(4,players.length),title:'参加メンバー',subtitle:'いつものメンバーから4〜10人を選ぼう',doneLabel:'このメンバーでゲーム開始'})}
function handoff(){const p=g?.players[peek];if(!p)return '';return '<section class="sab-panel sab-center sab-handoff"><p class="sab-kicker">'+(g.stage==='roles'?'ROLE REVEAL':'ROUND '+g.round+' / 4 · SECRET')+'</p><h2>'+esc(p.icon)+' '+esc(p.name)+' にスマホを渡してね</h2><p class="sab-sub">本人だけが秘密を確認。ほかの人は見ないでね。</p><button type="button" class="sab-btn sab-hold-button" data-hold="briefing">長押しで秘密を確認<span class="sab-hold-progress"></span></button></section>'}
function secret(){
 const p=g.players[peek],v=sabotageView(g,p.id),roles=g.stage==='roles';
 return '<section class="sab-panel sab-center sab-handoff"><p class="sab-kicker">'+(roles?'ROLE REVEAL':'ROUND '+g.round+' / 4 · SECRET')+'</p>'+
 (roles?'<h2>あなたの役職</h2>': '<h2>今回のコード内訳</h2>')+
 sabotageRoleCard(p.role,roles?null:v.myCounts)+
 '<p class="sab-sub">コードの位置は本人にも分かりません。内容を覚えてから閉じてね。</p>'+
 btn('確認完了・秘密を隠す','seen')+'</section>';
}
function roster(gv){
 return '<div class="sab-roster">'+gv.members.map(p=>
 '<button type="button" class="sab-player '+(gv.currentId===p.id?'active':'')+'" data-target="'+esc(p.id)+'" '+(p.id===gv.currentId?'disabled':'')+'>'+
 '<span class="meta"><span class="name">'+esc(p.icon)+' '+esc(p.name)+'</span><small>残り'+p.cards+'本</small></span>'+
 sabotageSlots(p.slots)+'</button>').join('')+'</div>';
}
function playing(){
 const v=sabotageView(g,g.players[0].id),op=g.players.find(x=>x.id===v.currentId);
 return '<section class="sab-play"><section class="sab-panel sab-status-panel"><div class="sab-status">'+
 '<strong class="sab-round">ROUND '+v.round+' <span>/ 4</span></strong><span>解除 '+v.repaired+' / '+v.required+'</span></div>'+
 sabotageBadges(v.required,v.repaired)+'</section>'+
 '<div class="sab-current"><small>現在の選択者</small><strong>'+esc(op.icon)+' '+esc(op.name)+'</strong><small>残り '+(v.totalCuts-v.cuts)+' 回のコード選択</small></div>'+
 roster(v)+sabotageSlotLegend()+'<div class="sab-stack"><button type="button" class="sab-btn secondary sab-private-trigger" data-hold="review">選択者の秘密を長押しで確認</button>'+
 rules()+btn('公開されたコードの履歴','history','secondary')+'</div></section>';
}
function picker(){
 const p=g.players.find(x=>x.id===target);
 return '<section class="sab-panel sab-center sab-handoff"><p class="sab-kicker">SELECT CODE</p>'+
 '<h2>'+esc(p?.icon)+' '+esc(p?.name)+' のコード</h2><p class="sab-sub">切断済みは表向き。未公開のコードだけ選べるよ。</p>'+
 sabotageSlots(p?.slots,true,wire)+
 '<div class="sab-actions" style="margin-top:15px">'+btn('このコードを公開する','cut','',wire<0)+
 '<button type="button" class="sab-btn secondary sab-private-trigger" data-hold="review">選択者の秘密を長押しで確認</button>'+
 btn('選び直す','cancel','secondary')+'</div></section>';
}
function reveal(){
 const x=g.lastCut,p=g.players.find(v=>v.id===x.targetId),phase=sabotageRevealPhase(x);
 return '<section class="sab-panel sab-center sab-handoff sab-reveal-scene"><p class="sab-kicker">CODE REVEAL / ROUND '+g.round+'</p>'+
 '<h2>'+esc(p.icon)+' '+esc(p.name)+' のコード</h2>'+
 sabotageRevealBody(x.type,phase.stage,g.repaired,g.required)+
 (phase.stage==='ready'?btn(g.pendingResult?'最終結果を見る':g.cuts===g.players.length?'次のラウンドへ':'次の選択へ','next'):'<p class="sab-reveal-pause" aria-label="演出中">……</p>')+'</section>';
}
function history(){return '<section class="sab-panel"><h2>コード公開履歴</h2><p class="sab-sub">'+(g.history.length?g.history.map(x=>{const p=g.players.find(v=>v.id===x.targetId);return 'ROUND '+x.round+'：'+esc(p?.name)+' → '+wireName[x.type]}).join('<hr style="border-color:#44677b">'):'まだ公開されたコードはありません')+'</p></section>'+btn('ゲームにもどる','cancel','secondary')}
function finish(){
 if(!recorded){recorded=true;const winners=g.players.filter(x=>x.role===g.winner).map(x=>x.id);api.recordGame?.({gameId:'sabotage',participants:g.players.map(x=>x.id),winners});resume?.clear?.(SAVE)}
 return sabotageVictory(g.winner)+
 '<section class="sab-panel sab-final-roster"><h3>全員の正体</h3>'+
 g.players.map(p=>'<p>'+esc(p.icon)+' '+esc(p.name)+'：<b class="sab-role '+p.role+'" style="font-size:14px">'+roleName[p.role]+'</b></p>').join('')+
 '</section><div class="sab-actions">'+btn('同じメンバーでもう一戦','again')+btn('メンバー変更','members','secondary')+btn('ゲームをえらぶ','home','secondary')+'</div>';
}
function render(){
 if(!app)return;
 clearTimeout(revealTimer);revealTimer=null;
 const active=!!g&&g.stage!=='finished';window.HoukagoBackGuard?.setActive(active);
 if(g?.stage==='finished'&&screen!=='result')screen='result';
 let html=nav();
 if(screen==='title')html+=title();
 else if(screen==='members')html+=members();
 else if(screen==='rules')html+='<section class="sab-panel"><h2>あそびかた</h2>'+rules()+'</section>'+btn('もどる','title','secondary');
 else if(screen==='handoff')html+=handoff();
 else if(screen==='secret')html+=secret();
 else if(screen==='select')html+=picker();
 else if(screen==='history')html+=history();
 else if(screen==='result')html+=finish();
 else if(g?.stage==='reveal')html+=reveal();
 else if(g?.stage==='playing')html+=playing();
 else if(g?.stage==='briefing'||g?.stage==='roles'){screen='handoff';peek=0;secretOpen=false;html+=handoff()}
 else html+=title();
 app.innerHTML=html;
 if(g?.stage==='reveal'&&screen==='play'){
  const phase=sabotageRevealPhase(g.lastCut);
  if(phase.waitMs>0)revealTimer=setTimeout(()=>{if(g?.stage==='reveal'&&screen==='play')render()},Math.ceil(phase.waitMs)+30);
 }
}
function begin(){loadPlayers();if(players.length<4){screen='members';return render()}g=createSabotage(players);peek=0;screen='handoff';recorded=false;persist();render()}
function advance(){sabotageAction(g,g.currentId,{type:'sabotage-next'});if(g.stage==='briefing'){screen='handoff';peek=0}else if(g.stage==='finished')screen='result';else screen='play';persist();render()}
let holdTimer=null,holdElement=null,reviewing=false;
function clearHold(){if(holdTimer!==null)clearTimeout(holdTimer);holdTimer=null;if(holdElement){holdElement.classList.remove('is-holding');holdElement=null}
 if(reviewing){document.querySelector('[data-sab-private-review]')?.remove();reviewing=false}}
app.addEventListener('pointerdown',e=>{
 const b=e.target.closest('[data-hold]');if(!b)return;
 clearHold();holdElement=b;b.classList.add('is-holding');e.preventDefault();
 holdTimer=setTimeout(()=>{
  holdTimer=null;
  if(b.dataset.hold==='briefing'&&screen==='handoff'&&(g?.stage==='roles'||g?.stage==='briefing')){screen='secret';render()}
  else if(b.dataset.hold==='review'&&g?.stage==='playing'){
   const current=g.players.find(p=>p.id===g.currentId);if(!current)return;
   const count={repair:current.hand.filter(x=>x==='repair').length,error:current.hand.filter(x=>x==='error').length,dummy:current.hand.filter(x=>x==='dummy').length};
   reviewing=true;document.body.insertAdjacentHTML('beforeend','<div class="sab-private-review" data-sab-private-review><div class="sab-panel sab-center">'+sabotageRoleCard(current.role,count)+'<p class="sab-sub">指を離すと隠れます</p></div></div>');
  }
 },650);
});
for(const kind of ['pointerup','pointercancel'])window.addEventListener(kind,clearHold);
app.addEventListener('pointerleave',e=>{if(holdElement&& !holdElement.contains(e.relatedTarget))clearHold()});
function exit(){if(g&&g.stage!=='finished'&&!confirm('ゲームを中断して戻る？ 続きは保存されます。'))return;persist();location.href='../'}
app.addEventListener('click',e=>{
 const b=e.target.closest('button');if(!b)return;
 if(b.dataset.confirmCancel!==undefined){b.closest('.sab-confirm-overlay')?.remove();return}
 if(b.dataset.confirmOk!==undefined){b.closest('.sab-confirm-overlay')?.remove();b.dataset.action='confirm-cut'}
 if(b.dataset.memberCount!==undefined){api.setActiveCount(Number(b.dataset.memberCount));loadPlayers();render();return}
 if(b.dataset.memberIcon!==undefined){api.setPlayer(Number(b.dataset.memberIcon),{icon:b.dataset.icon});loadPlayers();render();return}
 if(b.dataset.nav){if(b.dataset.nav==='home')return exit();if(screen==='title')return exit();if(g&&g.stage!=='finished'){persist();if(!confirm('進行中のゲームです。ゲーム一覧に戻る？（続きは保存されます）'))return;location.href='../';return}screen=screen==='members'?'title':'title';render();return}
 if(b.dataset.target&&g?.stage==='playing'){target=b.dataset.target;if(target===g.currentId)return;wire=-1;screen='select';render();return}
 if(b.dataset.wire!==undefined){wire=Number(b.dataset.wire);render();return}
 switch(b.dataset.action){
 case 'members':loadPlayers();screen='members';render();break;
 case 'rules':screen='rules';render();break;
 case 'title':screen='title';render();break;
 case 'peek':break;
 case 'seen':{const p=g.players[peek];sabotageAction(g,p.id,{type:g.stage==='roles'?'sabotage-role-seen':'sabotage-seen'});peek++;if(peek>=g.players.length)peek=0;screen=g.stage==='playing'?'play':'handoff';persist();render();break}
 case 'cut':{
 if(wire<0||!g||screen!=='select')return;
 const t=g.players.find(p=>p.id===target);if(!t||t.slots?.[wire]?.state!=='closed')return;
 app.insertAdjacentHTML('beforeend',sabotageCutConfirm(t.name,wire));break;
 }
 case 'confirm-cut':{
 if(sabotageAction(g,g.currentId,{type:'sabotage-cut',targetId:target,index:wire})){screen='play';persist();render()}
 break;
 }
 case 'next':advance();break;
 case 'history':screen='history';render();break;
 case 'cancel':screen='play';target='';wire=-1;render();break;
 case 'again':begin();break;
 case 'home':exit();break;
 }
});
app.addEventListener('click',e=>{if(e.target.closest('[data-members-done]')){e.preventDefault();loadPlayers();begin()}});
app.addEventListener('change',e=>{const el=e.target;if(el.matches('[data-member-name]')){api.setPlayer(Number(el.dataset.memberName),{name:el.value});loadPlayers();render()}});
window.addEventListener('houkago-player-selection-changed',()=>{if(screen==='members'){loadPlayers();render()}});
window.addEventListener('pagehide',persist);window.addEventListener('houkago-back-guard-save',persist);
function restore(saved){if(!saved?.g)return;g=saved.g;peek=Number(saved.peek)||0;recorded=!!saved.recorded;screen=g.stage==='finished'?'result':(g.stage==='briefing'||g.stage==='roles')?'handoff':'play';render()}
loadPlayers();render();resume?.offer?.({gameId:SAVE,onResume:restore,onNew:()=>{g=null;screen='title';render()}});
