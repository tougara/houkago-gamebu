import {ERAS,REGIONS,FOCI,FIRST_NAMES,getEra,getRegion,relevantLocal,eraForYear} from './scenarios.js';
import {initPeople,syncFamily,createPartner,createChild,migratePeople,interact as interactPerson,tickPeople,relationshipEvent,labelRole} from './social.js';
import {initCareer,migrateCareer,setCareerFromLegacy,careerYear,jobOptions,switchCareer as tryCareerSwitch} from './careers.js';
import {initMoney,migrateMoney,beginMoneyYear,settleYear,changeMoney,moneyAction,validateMoney,moneySummary} from './money.js';
import {selectLifeEvent} from './life-events.js';
/* Deterministic, serializable history-life MVP engine.
 * Statistical caution: all personal odds here are invented GAME RULES,
 * never historical mortality, class, wealth or gender data. */
export const VERSION=3;
const LIMITS={stats:100,age:110,log:240};
const clamp=(x,lo=0,hi=100)=>Math.max(lo,Math.min(hi,x));
function rng(state){
 let n=(state.rng>>>0)||0x6d2b79f5;
 n^=n<<13;n^=n>>>17;n^=n<<5;
 state.rng=n>>>0;
 return (state.rng>>>0)/4294967296;
}
function draw(state,list){return list[Math.floor(rng(state)*list.length)]}
function dice(state,p){return rng(state)<p}
function log(state,title,text,{kind='life',sourceId=null,eventId=null,personId=null}={}){
 state.log.push({year:state.year,age:state.age,title,text,kind,sourceId,eventId,personId});
 if(state.log.length>LIMITS.log)state.log.shift();
}
function effect(state,deltas){
 for(const [key,diff] of Object.entries(deltas)){
  if(key==='wealth'&&state.money){changeMoney(state,diff,'行動・出来事による収支');continue}
  if(key in state.stats)state.stats[key]=Math.round(clamp(state.stats[key]+diff));
 }
}
export function createLife({eraId='sengoku',seed=1,birthYear=null,regionId=null}={}){
 const era=getEra(eraId),roll={rng:(Number(seed)>>>0)||987654321};
 const year=Number.isInteger(birthYear)?clamp(birthYear,era.birthYears[0],era.birthYears[1]):
  era.birthYears[0]+Math.floor(rng(roll)*(era.birthYears[1]-era.birthYears[0]+1));
 const region=regionId&&REGIONS.some(r=>r.id===regionId)?getRegion(regionId):draw(roll,REGIONS);
 const sex=dice(roll,.5)?'female':'male';
 const backgroundIndex=Math.floor(rng(roll)*era.backgrounds.length);
 const name=draw(roll,FIRST_NAMES[sex]);
 const fortune=Math.floor(rng(roll)*5);
 const state={
  version:VERSION,eraId:era.id,year,birthYear:year,age:0,regionId:region.id,
  sex,name,backgroundIndex,background:era.backgrounds[backgroundIndex],
  profession:'家族に育てられる子ども',family:{partner:false,children:0,parentsAlive:true},
  stats:{health:clamp(70+Math.round(rng(roll)*22)),knowledge:3,bonds:clamp(43+Math.floor(rng(roll)*20)),
   joy:clamp(42+Math.floor(rng(roll)*29)),wealth:clamp(20+fortune*13)},
  rng:roll.rng,phase:'living',pending:null,eventQueue:[],death:null,log:[],focusHistory:[],
  choices:0,specialChoices:0,autoFocus:'family',
  meta:{chanceModel:'game_balance_placeholder',historicalEventSource:'original annotated research',birthWeights:'fictional_equal_weights',birthEraId:era.id}
 };
 initPeople(state,()=>rng(state));initCareer(state);initMoney(state);
 log(state,'誕生',year+'年、'+region.name+'の「'+state.background+'」に生まれた。家族から「'+name+'」と呼ばれる。',{kind:'birth'});
 return state;
}
function defineEvent(state,id,title,description,options,{kind='life',sourceId=null,eventId=null}={}){
 const next={id,title,description,kind,sourceId,eventId,options};
 if(!Array.isArray(state.eventQueue))state.eventQueue=[];
 if(state.phase==='event'&&state.pending)state.eventQueue.push(next);
 else{
  state.pending=next;state.phase='event';
  log(state,title,description,{kind,sourceId,eventId});
 }
}
const chance=(s,base,boost)=>dice(s,clamp(base+boost,0,.95));
function focusYear(s,focus){
 const age=s.age,pre=s.stats;
 if(age<7){
  effect(s,{health:2,knowledge:2,bonds:1,joy:1});
  return '家族に見守られながら、少しずつできることが増えた。';
 }
 const chosen=FOCI.find(f=>f.id===focus)||FOCI[2];
 s.focusHistory.push(chosen.id);if(s.focusHistory.length>16)s.focusHistory.shift();
 s.autoFocus=chosen.id;s.choices++;
 const improve=chance(s,.66,pre.knowledge*.001);
 if(chosen.id==='work'){
  effect(s,{wealth:improve?7:3,knowledge:improve?2:0,health:-2,joy:-1});
  return improve?'仕事や家業で工夫が実り、暮らしに少し余裕が生まれた。':'働き続けた。思ったほどの稼ぎではないが、経験は積まれていく。';
 }
 if(chosen.id==='learn'){
  effect(s,{knowledge:improve?7:3,wealth:-2,joy:1});
  return improve?'教わったことを覚え、できる仕事や考え方が広がった。':'学ぶ機会は限られていたが、自分なりに知恵を積んだ。';
 }
 if(chosen.id==='family'){
  effect(s,{bonds:improve?7:3,joy:improve?4:1,wealth:-1});
  return improve?'大切な人と時間を過ごし、つながりが深まった。':'周囲を気にかけた。分かり合えない時もある。';
 }
 if(chosen.id==='rest'){
  effect(s,{health:improve?8:4,joy:2,wealth:-3});
  return improve?'疲れを癒やし、翌年を迎える力を取り戻した。':'暮らしを立て直すため、無理をしない一年を過ごした。';
 }
 const lucky=chance(s,.48,pre.knowledge*.002);
 effect(s,lucky?{knowledge:5,wealth:6,joy:3,health:-2}:{knowledge:2,wealth:-5,joy:-3,health:-1});
 return lucky?'新しい試みが実を結び、思いがけない道が開けた。':'新しいことは思いどおりに進まなかった。それでも経験は残る。';
}
const HIST_TAGS={war:'戦の知らせ',politics:'政の動き',fire:'大火の知らせ',famine:'食糧の不安',
 earthquake:'大地の揺れ',disaster:'災害の知らせ',technology:'技術の変化',policy:'制度の変化',
 diplomacy:'遠い国との往来',education:'学びの変化',religion:'信仰の変化'};
function historicalCard(s,ev){
 const dist=relevantLocal(ev,s.regionId);
 const local=dist==='nearby',nationwide=dist==='nationwide';
 const title=ev.title,place=getRegion(s.regionId).name;
 const type=HIST_TAGS[ev.category]||'歴史の知らせ';
 const work=s.career?.jobId;
 const context=(work==='farm'&&['famine','disaster','war'].includes(ev.category))?
  '田畑や食糧の行方が気にかかる。':
  (work==='merchant'&&['war','policy','diplomacy','technology'].includes(ev.category))?
  '取引や人の往来が変わるかもしれない。':
  (work==='craft'&&['fire','disaster','technology'].includes(ev.category))?
  '仕事場や道具を守る方法を考える。':
  ['fire','earthquake','disaster','famine'].includes(ev.category)?
  '住まいと食べ物の備えが気にかかる。':'';
 let description;
 if(local)description=String(s.year)+'年。'+title+'が起こった。'+place+'の暮らしにも、直接あるいは間接に変化が及ぶかもしれない。';
 else if(nationwide)description=String(s.year)+'年。'+title+'の知らせが届く。地域や立場によって、影響の受け方は異なる。';
 else description=String(s.year)+'年。'+title+'の話を耳にした。'+place+'で暮らす自分の身近に、どれほど関わるかはまだ分からない。';
 description+=' '+type+'。'+context;
 defineEvent(s,ev.id,'歴史のなかで：'+title,description,[
  {id:'protect',label:'暮らしと家族の備えを優先する',delta:{wealth:-3,health:2,bonds:4},result:'自分にできる備えをした。どこまで役立つかは分からない。'},
  {id:'observe',label:'情報を集め、周囲の変化を見つめる',delta:{knowledge:5,bonds:1},result:'話を聞き、記録を確かめた。何が起こっているのか少し理解した。'},
  {id:'adapt',label:'仕事や立場を見直す',delta:{wealth:local?5:3,knowledge:2,joy:-2},failDelta:{wealth:-6,joy:-3},success:local?.48:.40,result:'変化に合わせて動いてみた。',failResult:'慣れない変化への対応は、思うように進まなかった。'}
 ],{kind:'history',sourceId:ev.sourceId,eventId:ev.id});
}
function milestone(s){
 const a=s.age,era=getEra(s.eraId);
 if(a===7)defineEvent(s,'milestone-7','学びの入り口','家や地域によって、学べることも学ぶ場所も異なる。あなたの周囲では、どんな道が見えるだろう。',[
  {id:'listen',label:'家族や大人の仕事を覚える',delta:{knowledge:3,bonds:4},result:'身近な大人の働き方を知った。'},
  {id:'seek',label:era.education+'を探す',delta:{knowledge:8,wealth:-3},result:'少しでも学ぶ機会を探し、知識を積んだ。'},
  {id:'help',label:'家の仕事を手伝う',delta:{wealth:5,health:-2,bonds:3},result:'家族を手伝い、暮らしの重みを知った。'}
 ]);
 if(a===15)defineEvent(s,'milestone-15','暮らしの道を選ぶ','大人になるため、仕事や生き方の道を考える。選べる範囲は出生した家や地域によって違う。',[
  {id:'home',label:'家業を引き継ぐ道を探す',delta:{wealth:5,bonds:3},job:era.careers[s.backgroundIndex]||era.livelihood,result:'家族のつながりの中で生計を立てる道を選んだ。'},
  {id:'apprentice',label:'新しい仕事で修業する',delta:{knowledge:7,wealth:-4},job:'見習い・奉公',result:'仕事を覚えるため、見習いとして働き始めた。'},
  {id:'study',label:'学びを深める機会を探す',delta:{knowledge:10,wealth:-6},job:'学びながらの仕事',result:'学ぶ機会には制約があったが、できるところから始めた。'}
 ]);
 if(a===22)defineEvent(s,'milestone-22','人との縁','将来を考える年頃になり、家族や友人、仕事の縁が人生を左右する。',[
  {id:'partner',label:'ともに暮らす相手との縁を探す',delta:{bonds:7,joy:3,wealth:-3},partnerChance:.68,result:'新しい縁を育むため、周囲と向き合った。'},
  {id:'work',label:'自分の仕事を固める',delta:{wealth:9,knowledge:2,health:-2},result:'生活のため、自分の仕事に力を注いだ。'},
  {id:'freedom',label:'自分の好奇心を優先する',delta:{knowledge:5,joy:6,wealth:-4},result:'周囲の期待とは別に、自分の進みたい道を考えた。'}
 ]);
 if(a===35)defineEvent(s,'milestone-35','人生の中ほど','選んできた道には成果も悩みもある。これからの暮らしの土台を見直すときだ。',[
  {id:'care',label:'家族や大切な人を支える',delta:{bonds:8,joy:5,wealth:-3},result:'身近な人のために、自分の時間を使った。'},
  {id:'career',label:'仕事の技能を磨き直す',delta:{knowledge:6,wealth:8,health:-3},result:'これまでの経験を次の仕事へつなげようとした。'},
  {id:'travel',label:'新しい土地や話に触れる',delta:{knowledge:7,joy:4,wealth:-7},result:'暮らしの外にも世界があることを知った。'}
 ]);
 if(a===55)defineEvent(s,'milestone-55','受け継ぐもの','長く生きたぶん、多くの人との縁や思い出がある。残された時間に何を大切にするか。',[
  {id:'teach',label:'自分の技や知識を伝える',delta:{knowledge:3,bonds:9,joy:3},result:'人に伝えることで、自分も歩んできた道を振り返った。'},
  {id:'save',label:'暮らしを守るため備える',delta:{wealth:9,health:2,joy:-1},result:'先の暮らしを案じ、できる備えを重ねた。'},
  {id:'rest',label:'大切な人との時間を増やす',delta:{bonds:7,joy:8,wealth:-4},result:'これまで後回しにしてきた時間を過ごした。'}
 ]);
 return false;
}
function maybeDailyEvent(s){
 if(s.age<10||s.age%6!==0)return false;
 const a=s.age;
 const options=[
  ['良い知らせ','身近な人から、思いがけずうれしい知らせが届いた。',
   [{id:'celebrate',label:'ともに喜ぶ',delta:{bonds:4,joy:6,wealth:-2},result:'喜びを分け合った。'},
    {id:'save',label:'静かに暮らしを整える',delta:{wealth:3,joy:2},result:'日々の暮らしを大切にした。'},
    {id:'remember',label:'この出来事を覚えておく',delta:{knowledge:2,bonds:3},result:'小さな幸せを心に留めた。'}]],
  ['思いがけない出費','道具の修繕や暮らしの事情で、手持ちの財産に不安が生じた。',
   [{id:'repair',label:'生活の道具を整える',delta:{wealth:-5,health:3},result:'必要なものを修繕した。'},
    {id:'ask',label:'周囲に助けを求める',delta:{bonds:4,wealth:-2},result:'頼れる人との関係を見つめ直した。'},
    {id:'endure',label:'しばらく節約してしのぐ',delta:{wealth:2,joy:-5},result:'無理をしながらも支出を抑えた。'}]],
  ['仕事の誘い','近所から、新しい仕事や手伝いの話を聞いた。',
   [{id:'accept',label:'誘いを受けて挑戦する',delta:{wealth:7,knowledge:3,health:-3},failDelta:{wealth:-4,health:-2},success:.65,result:'新しい仕事で経験を積み、暮らしが豊かになった。',failResult:'思ったほどの結果にはつながらなかった。'},
    {id:'decline',label:'今の暮らしを守る',delta:{health:3,joy:2},result:'足元の生活を優先した。'},
    {id:'ask',label:'条件をよく調べる',delta:{knowledge:5,bonds:2},result:'仕事の実情を確かめた。'}]]
 ];
 const x=options[Math.floor(rng(s)*options.length)];
 defineEvent(s,'daily-'+a,x[0],x[1],x[2]);return true;
}
function historyEcho(s){
 if(!Array.isArray(s.historyThreads))s.historyThreads=[];
 const due=s.historyThreads.filter(t=>!t.resolved&&t.followupYear===s.year);
 for(const t of due){
  t.resolved=true;
  const path=t.choice==='protect'?'家族や暮らしを守ろうとした':t.choice==='observe'?'情報を集めた':'新しい道を探そうとした';
  const person=s.people?.find(p=>p.alive&&p.closeness>=65);
  const connection=person?' '+person.name+'とのつながりも、これからの選択に関わる。':'';
  defineEvent(s,'echo-'+t.id,'あの歴史の出来事から2年',
   t.title+'のころ、'+path+'。あれから二年。目の前には、また違う暮らしの課題がある。'+connection,[
    {id:'rebuild',label:'仕事や家計を立て直す',delta:{wealth:6,knowledge:2,health:-2},
      result:'二年前の選択を思い出しながら、日々の暮らしを整えた。'},
    {id:'pass',label:'学んだことを身近な人に伝える',delta:{bonds:6,knowledge:3,wealth:-2},
      result:'経験を語ることで、人とのつながりが深まった。'},
    {id:'move',label:'新しい試みに挑戦する',delta:{wealth:9,knowledge:4,joy:2},
      failDelta:{wealth:-5,knowledge:2,joy:-3},success:.52,
      result:'前の出来事をきっかけに、次の仕事の機会をつかんだ。',
      failResult:'試みはうまくいかなかったが、経験は後に残った。'}
   ],{kind:'history-echo',eventId:t.sourceEventId});
 }
}
function mortalityProbability(s){
 // Purely fictional prototype balance curve; NEVER cite as historical mortality statistics.
 const a=s.age;
 const baseline=a<1?.015:a<5?.006:a<40?.0015:a<55?.004:.004+Math.pow(a-54,1.55)*.00045;
 const health=(100-s.stats.health)/100;
 return clamp(baseline+Math.max(0,health-.35)*.035,0,.75);
}
function death(s){
 s.phase='ended';s.pending=null;s.eventQueue=[];
 s.death={year:s.year,age:s.age,reason:s.stats.health<=0?'健康状態の悪化':'生涯の終わり'};
 log(s,'人生の終わり',s.name+'は'+s.age+'年の人生を終えた。歴史に名が残らなくても、確かにここに生きていた。',{kind:'ending'});
}
function backgroundYear(s,focus){
 // Social odds are fictional gameplay tuning; not demographic historical rates.
 tickPeople(s,focus,()=>rng(s),(title,text,extra={})=>log(s,title,text,extra),d=>effect(s,d));
 const a=s.age;
 if(a>=23&&a<=48&&s.family.partner&&s.family.children<5&&dice(s,.11)){
  const person=createChild(s,()=>rng(s),(title,text,extra={})=>log(s,title,text,extra));
  if(person)effect(s,{bonds:4,joy:3,wealth:-4});
 }
 if(a>=18&&a<43&&!s.family.partner&&dice(s,.015+s.stats.bonds/5000)){
  const person=createPartner(s,()=>rng(s),(title,text,extra={})=>log(s,title,text,extra));
  if(person)effect(s,{bonds:4,joy:3});
 }
 if(a>45){effect(s,{health:-Math.max(1,Math.floor((a-40)/22))});}
 if(s.stats.wealth<15&&dice(s,.3))effect(s,{health:-2,joy:-3});
}
export function advanceYear(s,focus='family',historicalEvents=[]){
 if(s.phase!=='living')return {ok:false,reason:'Resolve pending event or end first'};
 const previousYear=s.year;
 beginMoneyYear(s);
 const result=focusYear(s,focus);
 s.age++;s.year=s.birthYear+s.age;
 const actualEra=eraForYear(s.year);
 if(actualEra!==s.eraId){
  if(!s.meta)s.meta={};
  if(!s.meta.birthEraId)s.meta.birthEraId=s.eraId;
  s.eraId=actualEra;
  log(s,'時代の変わり目',s.year+'年。社会の動きを映すため、生活や仕事に使う時代設定が切り替わった。実際の制度は地域ごとに段階的に変化した。',{kind:'history-context'});
 }
 backgroundYear(s,focus);
 careerYear(s,focus,()=>rng(s),(title,text,extra={})=>log(s,title,text,extra),d=>effect(s,d));
 settleYear(s);
 if(s.age>=110||s.stats.health<=0||dice(s,mortalityProbability(s))){
  death(s);return {ok:true,year:s.year,ended:true,description:result};
 }
 if(s.age%5===0||s.age<7)log(s,s.age+'歳の暮らし',result);
 const hit=historicalEvents.filter(e=>e.year===s.year).sort((a,b)=>{
  const rank=x=>relevantLocal(x,s.regionId)==='nearby'?2:relevantLocal(x,s.regionId)==='nationwide'?1:0;
  return rank(b)-rank(a);
 });
 if(hit.length){
  if(s.age>=7){historicalCard(s,hit[0]);for(const other of hit.slice(1))log(s,'同じ年の史実：'+other.title,'他にも歴史上の出来事が起きている。',{kind:'history',sourceId:other.sourceId,eventId:other.id})}
  else for(const ev of hit)log(s,'歴史の知らせ：'+ev.title,'この年の出来事。幼少期の本人への直接の影響は不明。',{kind:'history',sourceId:ev.sourceId,eventId:ev.id});
 }
 // Queue each life milestone, person story and annual event after a historical
 // event. Otherwise a history event on a birthday could erase a life decision.
 historyEcho(s);
 milestone(s);
 const rel=relationshipEvent(s,()=>rng(s));
 if(rel)defineEvent(s,rel.id,rel.title,rel.description,rel.options,{kind:'relationship',eventId:rel.personId});
 maybeDailyEvent(s);
 if(s.phase==='living'){
  const event=selectLifeEvent(s,()=>rng(s));
  if(event)defineEvent(s,'life-'+s.age+'-'+event.id,event.title,event.text,event.choices,{kind:event.type});
 }
 return {ok:true,year:s.year,description:result,pending:!!s.pending,previousYear};
}
export function chooseEvent(s,optionId){
 if(s.phase!=='event'||!s.pending)return {ok:false};
 const ev=s.pending,opt=ev.options.find(o=>o.id===optionId);
 if(!opt)return {ok:false};
 const wasSuccess=opt.success==null||dice(s,opt.success);
 effect(s,wasSuccess?opt.delta:(opt.failDelta||{}));
 if(ev.kind==='history'){
  if(!Array.isArray(s.historyThreads))s.historyThreads=[];
  if(s.historyThreads.length>=30)s.historyThreads.shift();
  s.historyThreads.push({id:ev.id+'-'+s.year,sourceEventId:ev.eventId,
   title:ev.title.replace(/^歴史のなかで：/,''),
   choice:opt.id,year:s.year,followupYear:s.year+2,resolved:false});
 }
 if(opt.job){s.profession=opt.job;setCareerFromLegacy(s,opt.job,(title,text,extra={})=>log(s,title,text,extra),()=>rng(s));}
 if(opt.personId&&Number.isFinite(opt.closeness)){
  const person=s.people.find(p=>p.id===opt.personId&&p.alive);
  if(person)person.closeness=clamp(person.closeness+opt.closeness);
 }
 if(opt.partnerChance!=null&&dice(s,opt.partnerChance)){
  if(createPartner(s,()=>rng(s),(title,text,extra={})=>log(s,title,text,extra)))effect(s,{bonds:5,joy:4});
 }
 log(s,'選んだ道：'+opt.label,wasSuccess?opt.result:(opt.failResult||'思うような成果にはつながらなかった。'));
 s.specialChoices++;
 s.pending=null;s.phase='living';
 if(s.stats.health<=0){death(s)}
 else if(s.eventQueue?.length){
  const next=s.eventQueue.shift();
  s.pending=next;s.phase='event';
  log(s,next.title,next.description,{kind:next.kind,sourceId:next.sourceId,eventId:next.eventId});
 }
 return {ok:true,success:wasSuccess};
}
export function autoAdvance(s,years,historicalEvents=[]){
 const result={advanced:0,stoppedBy:null};
 for(let i=0;i<Math.min(10,Math.max(0,Math.trunc(years)));i++){
  if(s.phase!=='living'){result.stoppedBy=s.phase;break}
  const r=advanceYear(s,s.autoFocus||'family',historicalEvents);if(!r.ok)break;
  result.advanced++;
  if(s.phase!=='living'){result.stoppedBy=s.phase;break}
 }
 return result;
}
export function lifeSummary(s){
 const history=s.log.filter(x=>x.kind==='history');
 return {name:s.name,eraId:s.eraId,birthEraId:s.meta?.birthEraId||s.eraId,
  birthYear:s.birthYear,endYear:s.year,age:s.age,
  hometown:getRegion(s.regionId).name,background:s.background,profession:s.profession,
  partner:s.family.partner,children:s.family.children,historySeen:history.length,
  lovedOnes:(s.people||[]).length,careerChanges:s.career?.history?.length||0,
  careerSkill:s.career?.skill||0,finances:s.money?moneySummary(s):null,
  focusCount:s.choices,turningPoints:s.specialChoices,stats:{...s.stats}};
}
export function interactWithPerson(s,personId,actionId){
 return interactPerson(s,personId,actionId,(title,text,extra={})=>log(s,title,text,extra),d=>effect(s,d));
}
export function changeCareer(s,jobId){
 return tryCareerSwitch(s,jobId,()=>rng(s),(title,text,extra={})=>log(s,title,text,extra),d=>effect(s,d));
}
export function manageMoney(s,action){
 return moneyAction(s,action,d=>effect(s,d),(title,text,extra={})=>log(s,title,text,extra));
}
export {jobOptions,moneySummary};
export function upgradeSave(old){
 if(!old||!Number.isInteger(old.version))return null;
 if(old.version===VERSION)return validateSave(old)?old:null;
 if(![1,2].includes(old.version)||!ERAS.some(e=>e.id===old.eraId)||!REGIONS.some(r=>r.id===old.regionId))return null;
 if(!Number.isInteger(old.age)||old.age<0||old.age>110||old.year!==old.birthYear+old.age)return null;
 if(!old.stats||!['health','knowledge','bonds','joy','wealth'].every(k=>Number.isFinite(old.stats[k])&&old.stats[k]>=0&&old.stats[k]<=100))return null;
 if(!Array.isArray(old.log)||old.log.length>240||!old.family||!Number.isInteger(old.rng)||old.rng<0)return null;
 const migrated=JSON.parse(JSON.stringify(old));
 migrated.version=VERSION;
 if(!Array.isArray(migrated.eventQueue))migrated.eventQueue=[];
 migratePeople(migrated);migrateCareer(migrated);migrateMoney(migrated);
 migrated.meta={...migrated.meta,upgradedFrom:old.version};
 return validateSave(migrated)?migrated:null;
}
export function validateSave(obj){
 if(!obj||obj.version!==VERSION||!ERAS.some(e=>e.id===obj.eraId)||!REGIONS.some(r=>r.id===obj.regionId))return false;
 if(!Number.isInteger(obj.age)||obj.age<0||obj.age>110||obj.year!==obj.birthYear+obj.age)return false;
 if(!Number.isInteger(obj.rng)||obj.rng<0||!['living','event','ended'].includes(obj.phase))return false;
 if(!obj.stats||!['health','knowledge','bonds','joy','wealth'].every(k=>Number.isFinite(obj.stats[k])&&obj.stats[k]>=0&&obj.stats[k]<=100))return false;
 if(!Array.isArray(obj.log)||obj.log.length>LIMITS.log)return false;
 if(!obj.family||!Number.isInteger(obj.family.children)||obj.family.children<0||obj.family.children>5)return false;
 if(!Array.isArray(obj.people)||obj.people.length>25||!Number.isInteger(obj.nextPersonId)||obj.nextPersonId<0)return false;
 const personIds=new Set();
 for(const p of obj.people){
  if(!p||typeof p.id!=='string'||personIds.has(p.id)||typeof p.name!=='string'||!Number.isInteger(p.birthYear)||
   !Number.isFinite(p.closeness)||p.closeness<0||p.closeness>100||typeof p.alive!=='boolean')return false;
  personIds.add(p.id);
 }
 if(obj.family.children!==obj.people.filter(p=>p.role==='child').length)return false;
 if(!obj.career||typeof obj.career.jobId!=='string'||!Number.isFinite(obj.career.skill)||obj.career.skill<0||obj.career.skill>100||
 !Number.isInteger(obj.career.rank)||!Array.isArray(obj.career.history))return false;
 if(!validateMoney(obj))return false;
 if(obj.phase==='event'&&(!obj.pending||!Array.isArray(obj.pending.options)))return false;
 if(obj.eventQueue!=null&&(!Array.isArray(obj.eventQueue)||obj.eventQueue.length>6))return false;
 if(obj.historyThreads!=null&&(!Array.isArray(obj.historyThreads)||obj.historyThreads.length>30))return false;
 return true;
}
