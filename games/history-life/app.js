import {ERAS,REGIONS,FOCI,getEra,getRegion} from './scenarios.js';
import {createLife,advanceYear,chooseEvent,autoAdvance,lifeSummary,validateSave,upgradeSave,interactWithPerson,changeCareer,jobOptions,manageMoney,moneySummary} from './engine.js';
import {PURCHASES} from './money.js';
import {RELATION_ACTIONS,labelRole,personAge} from './social.js';
import {getJob} from './careers.js';
const $=id=>document.getElementById(id);
const STORAGE='houkago_history_life_slots_v1';
let events=[],sourceMap=new Map(),population=new Map(),slots=[null,null,null],activeSlot=0,current=null,archives=[];
let clockRunning=false,clockSpeed=1,clockProgress=0,clockLast=0;
const YEAR_SECONDS=9;
const barConfig=[
 ['health','健康','#7bbd99'],['knowledge','知恵・技能','#78a4c7'],
 ['bonds','人との縁','#d3ac73'],['joy','幸福','#cb8ca4'],['wealth','暮らしの余裕','#9b9bbd']
];
const escaped=x=>String(x==null?'':x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dateNumber=(n)=>new Intl.NumberFormat('ja-JP').format(n);
function storageRead(){
 try{
  const data=JSON.parse(localStorage.getItem(STORAGE)||'{}');
  if(Array.isArray(data.slots)){
   slots=Array.from({length:3},(_,i)=>upgradeSave(data.slots[i]));
  }
  if(Array.isArray(data.archives))archives=data.archives.slice(-20).filter(x=>x&&x.summary);
 }catch{slots=[null,null,null];archives=[]}
}
function storageWrite(){
 if(current){slots[activeSlot]=current}
 try{
  localStorage.setItem(STORAGE,JSON.stringify({version:1,slots,archives}));
 }catch(e){console.warn('Save unavailable',e);$('saveNotice').textContent='保存できない端末環境の可能性があります'}
}
function updateSetup(){
 $('savesList').innerHTML='<h3 class="saves-title">つづきから</h3>'+slots.map((s,i)=>{
  if(!s)return '<div class="slot-row"><span>記録'+(i+1)+'</span><div><strong>空きスロット</strong><small>まだ人生はありません</small></div></div>';
  return '<div class="slot-row"><span>記録'+(i+1)+'</span><div><strong>'+
    escaped(s.name)+'｜'+escaped(getEra(s.eraId).name)+'</strong><small>'+
    dateNumber(s.year)+'年・'+s.age+'歳'+(s.phase==='ended'?'・人生終了':'')+
    '</small></div><button type="button" data-continue="'+i+'">ひらく</button></div>';
 }).join('');
}
function showSetup(){
 stopClock();current=null;
 $('gameView').hidden=true;$('setupView').hidden=false;updateSetup();
 window.scrollTo({top:0,behavior:'instant'});
}
function openLife(s,slot){
 stopClock();activeSlot=slot;current=s;
 $('setupView').hidden=true;$('gameView').hidden=false;
 $('saveNotice').textContent='';
 render();window.scrollTo({top:0,behavior:'instant'});
}
function ageCategory(a){
 if(a<7)return '幼年期';
 if(a<15)return '少年・少女期';
 if(a<25)return '青年期';
 if(a<45)return '壮年期';
 if(a<65)return '中年期';
 return '老年期';
}
function renderStat(s){
 $('statBars').innerHTML=barConfig.map(([key,title,color])=>{
  const n=s.stats[key];
  return '<div class="stat-line"><div class="stat-meta"><span>'+title+'</span><span>'+n+'</span></div>'+
   '<div class="bar" role="progressbar" aria-label="'+title+'" aria-valuenow="'+n+'" aria-valuemin="0" aria-valuemax="100"><div style="width:'+n+'%;background:'+color+'"></div></div></div>';
 }).join('');
 const facts=[
  ['出生地',getRegion(s.regionId).name],['生まれ',s.background],
  ['仕事',s.profession],['家族',s.family.partner?'ともに暮らす相手あり':'独り身・家族と暮らす'],
  ['子ども',s.family.children+'人'],['選択の回数',s.choices+'年＋転機'+s.specialChoices+'回']
 ];
 $('personalFacts').innerHTML=facts.map(([a,b])=>'<div class="fact"><span>'+escaped(a)+'</span><strong>'+escaped(b)+'</strong></div>').join('');
 const pop=population.get(s.year),element=$('populationContext');
 element.hidden=!pop;
 if(pop){
  element.innerHTML='<b>その年の全国人口推計</b><br>'+dateNumber(Math.round(pop.populationThousand/1000*10)/10)+'百万人（学術的推計）<br>'+
    '<small>個人の出生確率・死亡率を表す数値ではありません。<a href="https://www.ipss.go.jp/syoushika/tohkei/Data/Popular2024/T01-07.files/sheet001.htm" target="_blank" rel="noopener noreferrer">出典・国立社会保障・人口問題研究所</a></small>';
 }
}
function logRows(items,full=false){
 return items.length?items.map(e=>{
  return '<div class="log-row'+(e.kind==='history'?' history':'')+'"><span class="date">'+e.year+'年<br>'+e.age+'歳</span><div>'+
   '<span class="log-title">'+escaped(e.title)+'</span>'+
   (full?'<span class="log-desc">'+escaped(e.text)+'</span>':'')+
   '</div></div>';
 }).join(''):'<p class="empty-log">まだ記録はありません</p>';
}
function renderPeople(s){
 const list=(s.people||[]).slice().sort((a,b)=>Number(b.alive)-Number(a.alive));
 $('peopleCount').textContent=list.length+'人の縁';
 const canSocial=s.phase==='living'&&s.age>=7&&s.lastSocialYear!==s.year;
 $('peopleList').innerHTML=list.map(p=>{
  const age=personAge(p,s.year),canTalk=p.alive&&canSocial;
  const actions=canTalk?'<div class="social-actions">'+RELATION_ACTIONS.map(a=>'<button type="button" data-social="'+escaped(p.id)+'" data-social-action="'+escaped(a.id)+'"'+(s.stats.wealth<a.cost?' disabled':'')+'>'+escaped(a.name)+'</button>').join('')+'</div>':'';
  return '<div class="person-row'+(!p.alive?' no-longer':'')+'">'+
   '<div class="person-row-head"><div><b>'+escaped(p.name)+'</b><span>'+escaped(labelRole(p.role))+'・'+age+'歳'+(!p.alive?'・故人':'')+'</span></div>'+
   '<strong>親密度 '+p.closeness+'</strong></div>'+
   '<div class="bond-meter"><span style="width:'+p.closeness+'%"></span></div>'+
   '<small>'+escaped(p.traitLabel)+'</small>'+actions+'</div>';
 }).join('');
}
function renderCareer(s){
 const c=s.career||{},job=getJob(c.jobId);
 $('careerRank').textContent=s.age<15?'修業前':c.rank===2?'熟練':c.rank===1?'一人前':'見習い';
 $('careerStatus').innerHTML='<div class="career-name">'+escaped(job?.name||s.profession)+'</div>'+
  '<div class="career-caption">技能 '+(c.skill||0)+'/100 ・ 経験 '+(c.years||0)+'年</div>'+
  '<div class="bond-meter"><span style="width:'+(c.skill||0)+'%"></span></div>'+
  '<p>仕事、技能、家庭の負担、毎年の重点によって暮らしが変化する。</p>';
 $('careerButton').disabled=s.age<15||s.phase!=='living';
 $('careerButton').textContent=s.age<15?'15歳から仕事を選べます':'仕事を探す・転職する';
}
function showCareers(){
 if(!current||current.age<15||current.phase!=='living')return;
 $('jobList').innerHTML=jobOptions(current).map(job=>
  '<div class="job-row"><div><b>'+escaped(job.name)+'</b><small>'+escaped(job.description)+'</small>'+
  '<span>必要知恵 '+job.needKnowledge+'／技能 '+job.needSkill+(job.familyAccess?'・家の縁あり':'')+'</span></div>'+
  '<button type="button" data-job="'+escaped(job.id)+'"'+(!job.available?' disabled':'')+'>'+
  (job.available?'この仕事を目指す':escaped(job.reason||'応募不可'))+'</button></div>').join('');
 $('careerModal').hidden=false;
}
function renderMoney(s){
 const m=s.money;if(!m)return;
 const b=moneySummary(s);
 $('moneySummary').innerHTML=[
  ['手元',b.cash,''],['蓄え',b.savings,''],['借り入れ',b.debt,'debt']
 ].map(([label,value,cls])=>'<div class="money-stat '+cls+'"><small>'+label+'</small><strong>'+value+'</strong></div>').join('');
 $('moneyFlow').innerHTML='<span>今年の収入 <b>+'+b.yearIncome+'</b></span>'+
  '<span>今年の支出 <b class="outgo">-'+b.yearExpenses+'</b></span>'+
  '<span>正味 <b>'+(b.netWorth>=0?'+':'')+b.netWorth+'</b></span>';
 const ready=s.phase==='living'&&s.age>=7;
 const buttons=[
  {id:'food',label:'食料・備蓄 7',cost:7,once:true},
  {id:'tools',label:'仕事の道具 10',cost:10,once:true},
  {id:'learning',label:'学び 9',cost:9,once:true},
  {id:'family',label:'家族との時間 6',cost:6,once:true},
  {id:'save',label:'5点を貯蓄',cost:5,cash:true},
  {id:'withdraw',label:'5点を引き出す',savings:true},
  {id:'repay',label:'借入を返す',cash:true,needDebt:true}
 ];
 $('moneyActions').innerHTML=buttons.map(action=>{
  const insufficient=action.savings?m.savings<5:action.cash?m.cash<5:m.cash+m.savings<action.cost;
  const disabled=!ready||insufficient||action.once&&m.lastSpendYear===s.year||action.needDebt&&m.debt===0;
  return '<button type="button" data-money="'+action.id+'"'+(disabled?' disabled':'')+'>'+action.label+'</button>';
 }).join('');
 $('moneyLedger').innerHTML=m.ledger.length?m.ledger.slice(-8).reverse().map(e=>
   '<div class="money-ledger-row"><span>'+e.year+'年 '+escaped(e.label)+'</span>'+
   '<b class="'+(e.amount<0?'negative':'')+'">'+(e.amount>0?'+':'')+e.amount+'</b></div>'
 ).join(''):'<p>まだ収支の記録はありません</p>';
}
function renderClock(){
 $('clockToggle').textContent=clockRunning?'Ⅱ 一時停止':'▶ 自動で進める';
 $('clockToggle').setAttribute('aria-pressed',String(clockRunning));
 $('clockSpeed').value=String(clockSpeed);
 $('clockFill').style.width=Math.min(100,clockProgress*100)+'%';
 $('clockToggle').disabled=!current||current.phase!=='living';
 $('clockNext').disabled=!current||current.phase!=='living';
 $('clockInfo').textContent=current?.phase==='event'?'大切な選択で停止中':
  current?.phase==='ended'?'人生が終了しました':
  clockRunning?'次の年まで約'+Math.ceil(Math.max(0,YEAR_SECONDS/clockSpeed*(1-clockProgress)))+'秒':
  '停止中・重点を選んで1年ずつ進めることもできます';
}
function stopClock(){clockRunning=false;clockProgress=0;renderClock()}
function timeTick(timestamp){
 if(!clockLast)clockLast=timestamp;
 const dt=Math.min((timestamp-clockLast)/1000,.2);
 clockLast=timestamp;
 if(clockRunning&&current?.phase==='living'&&!document.hidden&&
  $('historyModal').hidden&&$('helpModal').hidden&&$('careerModal').hidden){
  clockProgress+=Math.max(0,dt)*clockSpeed/YEAR_SECONDS;
  if(clockProgress>=1){
   clockProgress=0;
   advance(current.autoFocus||'family');
  }
 }
 renderClock();
 requestAnimationFrame(timeTick);
}
function refreshLog(s){
 $('miniLog').innerHTML=logRows(s.log.slice(-7).reverse());
}
function setStory(label,title,text,sourceId=null){
 $('storyLabel').textContent=label;$('storyTitle').textContent=title;
 $('storyText').textContent=text;
 const source=sourceMap.get(sourceId);
 if(sourceId&&source){
  $('storySource').innerHTML='<div class="source-pill">史実の参照資料：<a href="'+escaped(source.url)+'" target="_blank" rel="noopener noreferrer">'+escaped(source.name)+'</a><br>本人への影響や確率はゲーム用の仮設定です。</div>';
 }else $('storySource').textContent='';
}
function renderActions(s){
 const target=$('actionArea');
 if(s.phase==='ended'){
  const summary=lifeSummary(s);
  target.innerHTML='<p class="action-title">ひとりの人生の記録</p>'+
   '<p class="end-summary">'+escaped(s.name)+'は'+s.age+'歳まで生きた。'+
   escaped(summary.profession)+'という道を歩み、'+summary.children+'人の子どもと、'+
   summary.historySeen+'件の歴史の出来事に触れた。</p>'+
   '<div class="end-actions"><button class="primary" data-action="timeline">人生年表を見る</button>'+
   '<button class="secondary" data-action="another">別の人生を生きる</button></div>';
  return;
 }
 if(s.phase==='event'&&s.pending){
  target.innerHTML='<p class="action-title">あなたはどうする？</p><div class="event-grid">'+
   s.pending.options.map((o,i)=>'<button class="event-button" type="button" data-choice="'+escaped(o.id)+'"><span>'+(i+1)+'</span>'+escaped(o.label)+'</button>').join('')+
   '</div><p class="turn-note">選択で結果の可能性は変わりますが、必ず成功するとは限りません。</p>';
  return;
 }
 if(s.age<7){
  target.innerHTML='<p class="action-title">子ども時代を過ごす</p>'+
    '<button class="primary large" data-action="child">次の1年へ進む →</button>'+
    '<p class="turn-note">幼少期は家族に育てられる。7歳から毎年の行動を選択できます。</p>';
  return;
 }
 target.innerHTML='<p class="action-title">今年、何を大切にして暮らす？</p><div class="action-grid">'+
  FOCI.map(f=>'<button class="action-button'+(s.autoFocus===f.id?' focus-active':'')+'" type="button" data-focus="'+f.id+'">'+
    '<span class="action-symbol">'+escaped(f.icon)+'</span><span><strong>'+escaped(f.name)+'</strong>'+
    '<small>'+escaped(f.effect)+'</small></span></button>').join('')+
 '</div><div class="action-toolbar">'+
  '<button class="secondary" data-action="auto5" type="button">同じ重点で最大5年進める</button>'+
  '<span class="turn-note">歴史イベントや人生の節目が発生したら自動で停止します。</span></div>';
}
function render(){
 const s=current;if(!s)return;
 const era=getEra(s.eraId);
 $('gameYear').textContent=s.year+'年';$('eraBadge').textContent=era.name;
 $('ageText').textContent=s.age+'歳';
 $('chapter').textContent=s.phase==='ended'?'人生の終わり':ageCategory(s.age);
 $('personName').textContent=s.name;
 $('portrait').textContent=s.name.slice(0,1);
 $('personDetail').textContent=getRegion(s.regionId).name+'生まれ / '+s.background;
 if(s.phase==='event'&&s.pending){
  setStory(s.pending.kind==='history'?'実際に起きた歴史の出来事':'人生の転機',
   s.pending.title,s.pending.description,s.pending.sourceId);
 }else if(s.phase==='ended'){
  const r=lifeSummary(s);
  setStory('人生の記録',r.birthYear+'〜'+r.endYear+'年・享年'+r.age+'歳',
   s.name+'は'+r.hometown+'で生まれ、さまざまな選択を積み重ねて一生を終えた。\n'+
   'これは一人の、名もない歴史の物語。あなたが歩んだ道は、人生年表に残っている。');
 }else if(s.lastStory){
  setStory(s.lastStory.label,s.lastStory.title,s.lastStory.text);
 }else{
  setStory('新しい命',s.year+'年、'+getRegion(s.regionId).name+'に生まれた。',
    era.intro+'\n'+s.background+'に生まれた'+s.name+'。ここから、たった一度の人生が始まる。');
 }
 renderStat(s);renderActions(s);refreshLog(s);renderPeople(s);renderCareer(s);renderMoney(s);renderClock();
}
function advance(focus){
 if(!current||current.phase!=='living')return;
 clockProgress=0;
 const r=advanceYear(current,focus,events);
 if(!r.ok)return;
 current.lastStory={label:'人生の一年',title:current.age+'歳の暮らし',
  text:r.description+'\n'+current.year+'年。時代は少しずつ移り変わっていく。'};
 if(current.phase==='ended')archiveCurrent();
 if(current.phase!=='living')clockRunning=false;
 storageWrite();render();
}
function archiveCurrent(){
 const key=String(activeSlot)+'-'+String(current.birthYear)+'-'+String(current.rng);
 if(archives.some(a=>a.key===key))return;
 archives.push({key,summary:lifeSummary(current),log:current.log.slice(),at:new Date().toISOString()});
 if(archives.length>20)archives.shift();
}
function choose(id){
 if(!current||current.phase!=='event')return;
 const eventTitle=current.pending.title,option=current.pending.options.find(o=>o.id===id);
 const result=chooseEvent(current,id);
 if(!result.ok)return;
 const last=current.log[current.log.length-1];
 current.lastStory={label:'選択の結果',title:eventTitle,
  text:(option?option.label+'。\n':'')+(last?.text||'新しい道を歩むことになった。')};
 if(current.phase==='ended')archiveCurrent();
 storageWrite();render();
}
function fastForward(){
 if(!current||current.phase!=='living'||current.age<7)return;
 clockRunning=false;clockProgress=0;
 const r=autoAdvance(current,5,events);
 current.lastStory={label:'時間の流れ',title:r.advanced+'年の歩み',
  text:'同じ重点を続けながら、'+r.advanced+'年が過ぎた。'+
   (r.stoppedBy==='event'?'歴史や人生の大切な転機が訪れた。':r.stoppedBy==='ended'?'この人生はここで終わりを迎えた。':'次の一年は、どんな道を選ぼうか。')};
 if(current.phase==='ended')archiveCurrent();
 storageWrite();render();
}
function showHistory(){
 if(!current)return;
 clockRunning=false;clockProgress=0;
 $('fullLog').innerHTML=logRows(current.log.slice().reverse(),true);
 $('historyTitle').textContent=current.name+'の人生年表';
 $('historyModal').hidden=false;
}
$('moneyActions').addEventListener('click',e=>{
 const b=e.target.closest('[data-money]');
 if(!b||!current)return;
 const result=manageMoney(current,b.dataset.money);
 if(result.ok){
  $('moneyFeedback').textContent='';
  current.lastStory={label:'暮らしとお金',title:'家計の選択',text:current.log.at(-1)?.text||'暮らしを見直した。'};
  storageWrite();render();
 }else $('moneyFeedback').textContent=result.reason||'操作できません';
});
$('clockToggle').addEventListener('click',()=>{
 if(!current||current.phase!=='living')return;
 clockRunning=!clockRunning;clockProgress=0;renderClock();
});
$('clockSpeed').addEventListener('change',e=>{
 const v=Number(e.target.value);if([1,2,4,8,16].includes(v))clockSpeed=v;
 renderClock();
});
$('clockNext').addEventListener('click',()=>{
 if(!current||current.phase!=='living')return;
 clockRunning=false;clockProgress=0;
 let n=0;
 while(n<110&&current.phase==='living'){advance(current.autoFocus||'family');n++}
 renderClock();
});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&clockRunning)stopClock()});
$('peopleList').addEventListener('click',e=>{
 const btn=e.target.closest('[data-social]');if(!btn||!current)return;
 const id=btn.dataset.social;
 const result=interactWithPerson(current,id,btn.dataset.socialAction);
 if(result.ok){
  const p=current.people.find(x=>x.id===id);
  current.lastStory={label:'人とのつながり',title:p.name+'と過ごす時間',
   text:p.name+'（'+labelRole(p.role)+'）との関係が少し変わった。'};
  storageWrite();render();
 }
});
$('careerButton').addEventListener('click',showCareers);
$('closeCareer').addEventListener('click',()=>$('careerModal').hidden=true);
$('jobList').addEventListener('click',e=>{
 const btn=e.target.closest('[data-job]');if(!btn||!current||btn.disabled)return;
 const name=jobOptions(current).find(j=>j.id===btn.dataset.job)?.name||'仕事';
 const result=changeCareer(current,btn.dataset.job);
 if(!result.ok)return;
 $('careerModal').hidden=true;
 current.lastStory={label:'仕事の転機',title:name,text:current.log.at(-1)?.text||'新しい仕事を目指した。'};
 storageWrite();render();
});
$('actionArea').addEventListener('click',e=>{
 const button=e.target.closest('button');if(!button)return;
 if(button.dataset.focus){
  if(clockRunning&&current?.phase==='living'){
   current.autoFocus=button.dataset.focus;storageWrite();renderActions(current);
  }else advance(button.dataset.focus);
 }
 else if(button.dataset.choice)choose(button.dataset.choice);
 else if(button.dataset.action==='child')advance('family');
 else if(button.dataset.action==='auto5')fastForward();
 else if(button.dataset.action==='timeline')showHistory();
 else if(button.dataset.action==='another')showSetup();
});
function selectEra(){
 const val=document.querySelector('[name=era]:checked')?.value||'random';
 const era=ERAS.find(x=>x.id===val);
 const input=$('birthYearInput');input.disabled=!era;
 if(era){input.min=String(era.birthYears[0]);input.max=String(era.birthYears[1]);input.placeholder=era.birthYears[0]+'〜'+era.birthYears[1]}
 else{input.value='';input.placeholder='ランダム'}
 $('birthYearNotice').textContent=era?
  '出生可能年：'+era.birthYears[0]+'〜'+era.birthYears[1]+'年。出生地・家柄の抽選割合は史実の統計ではなく試作用です。':
  '出生年・時代・地域はランダム。現代の人口比ではなく、ゲーム用の均等抽選です。';
}
$('eraChoices').addEventListener('change',selectEra);
$('newLifeButton').addEventListener('click',()=>{
 const chosen=document.querySelector('[name=era]:checked')?.value||'random';
 const era=chosen==='random'?ERAS[Math.floor(Math.random()*ERAS.length)]:getEra(chosen);
 const slot=Number($('slotSelect').value)||0;
 const old=slots[slot];
 if(old&&!confirm('スロット'+(slot+1)+'の人生を新しい人生で上書きする？'))return;
 const raw=$('birthYearInput').value;
 const year=chosen!=='random'&&raw!==''?Number(raw):null;
 if(year!==null&&(!Number.isInteger(year)||year<era.birthYears[0]||year>era.birthYears[1])){
  alert('出生年は'+era.birthYears[0]+'〜'+era.birthYears[1]+'年の範囲にしてね。');return;
 }
 const seed=new Uint32Array(1);if(globalThis.crypto?.getRandomValues)crypto.getRandomValues(seed);else seed[0]=Date.now()>>>0;
 const life=createLife({eraId:era.id,seed:seed[0],birthYear:year,regionId:$('regionSelect').value||null});
 slots[slot]=life;current=life;activeSlot=slot;storageWrite();openLife(life,slot);
});
$('savesList').addEventListener('click',e=>{
 const button=e.target.closest('[data-continue]');if(!button)return;
 const slot=Number(button.dataset.continue),state=slots[slot];if(state)openLife(state,slot);
});
$('homeButton').addEventListener('click',()=>{storageWrite();showSetup()});
$('historyButton').addEventListener('click',showHistory);
$('seeFullLog').addEventListener('click',showHistory);
$('closeHistory').addEventListener('click',()=>$('historyModal').hidden=true);
$('helpBtn').addEventListener('click',()=>{stopClock();$('helpModal').hidden=false});
$('closeHelp').addEventListener('click',()=>$('helpModal').hidden=true);
document.addEventListener('keydown',e=>{
 if(e.key!=='Escape')return;
 if(!$('historyModal').hidden)$('historyModal').hidden=true;
 else if(!$('careerModal').hidden)$('careerModal').hidden=true;
 else if(!$('helpModal').hidden)$('helpModal').hidden=true;
});
function showSources(){
 const refs=['archives-wars','archives-edo','ndl-modern','ipss2026','wpp2024','ndl-population'];
 $('sourceLinks').innerHTML=refs.map(id=>{
  const s=sourceMap.get(id);if(!s)return '';
  return '<a target="_blank" rel="noopener noreferrer" href="'+escaped(s.url)+'">'+escaped(s.name)+' ↗</a>';
 }).join('');
}
async function loadData(){
 const result=await Promise.allSettled([
  fetch('./data/historical-events.jp.json').then(r=>{if(!r.ok)throw Error('historical events '+r.status);return r.json()}),
  fetch('./data/data-sources.json').then(r=>{if(!r.ok)throw Error('sources '+r.status);return r.json()}),
  fetch('./data/historical-population.jp.json').then(r=>{if(!r.ok)throw Error('population '+r.status);return r.json()})
 ]);
 if(result[0].status==='fulfilled'&&Array.isArray(result[0].value.events)){
  events=result[0].value.events.filter(e=>Number.isInteger(e.year)&&typeof e.title==='string');
 }else console.warn('Historical timeline unavailable: offline life simulation continues');
 if(result[1].status==='fulfilled'&&Array.isArray(result[1].value.sources))
  sourceMap=new Map(result[1].value.sources.map(s=>[s.id,s]));
 if(result[2].status==='fulfilled'&&Array.isArray(result[2].value.records))
  population=new Map(result[2].value.records.map(row=>[row.year,row]));
 showSources();
}
window.HistoryLifeDebug=Object.freeze({
 get clock(){return {running:clockRunning,speed:clockSpeed,progress:clockProgress}},
 get active(){return !!current},
 get phase(){return current?.phase||'setup'},
 get snapshot(){return current?structuredClone(current):null},
 get eventCount(){return events.length},
 get activeSlot(){return activeSlot}
});
const saveNotice=document.createElement('div');saveNotice.id='saveNotice';saveNotice.className='save-notice';
document.querySelector('.game-ribbon').appendChild(saveNotice);
storageRead();selectEra();updateSetup();loadData();requestAnimationFrame(timeTick);
