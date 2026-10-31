/* Fictional person-level relationships for historical-life gameplay.
 * All risks and social outcomes are gameplay placeholders, not measured historical rates. */
const bound=(n)=>Math.max(0,Math.min(100,Math.round(n)));
const GIVEN=['宗吉','清','弥一','きぬ','つね','さよ','たね','庄助','ふさ','よし','喜助','松','寅吉','千代','源','とよ'];
const TRAITS=[
 {id:'kind',name:'面倒見がいい',reaction:'支え合うことを好む'},
 {id:'proud',name:'誇り高い',reaction:'努力を認めてほしい'},
 {id:'quiet',name:'物静か',reaction:'落ち着いた時間を好む'},
 {id:'curious',name:'好奇心旺盛',reaction:'新しい話を好む'},
 {id:'careful',name:'慎重',reaction:'安定を重んじる'},
 {id:'open',name:'人懐っこい',reaction:'人の話を聞くのが好き'}
];
export const RELATION_ACTIONS=[
 {id:'talk',name:'話を聞く',cost:0,closeness:8,stat:{bonds:2,joy:1},description:'相手の話に耳を傾けた'},
 {id:'help',name:'手伝う',cost:2,closeness:12,stat:{bonds:3,health:-2,wealth:-2},description:'自分の時間を使って支えた'},
 {id:'gift',name:'贈り物',cost:5,closeness:11,stat:{bonds:2,wealth:-5,joy:2},description:'気持ちを込めて贈り物をした'},
 {id:'reconcile',name:'関係を修復',cost:1,closeness:16,stat:{bonds:1,joy:-1,wealth:-1},description:'すれ違いに向き合い、関係を見直した'}
];
// One draw per new person, then a deterministic no-repeat fallback. The current
// protagonist and all existing relatives count, including deceased family members.
// Preserve stable IDs and old saves; never rename anyone already in a saved life.
const pickUnusedName=(s,rand,preferred=null)=>{
 const used=new Set([s.name,...(s.people||[]).map(p=>p.name)].filter(Boolean));
 if(preferred&&!used.has(preferred))return preferred;
 const start=Math.floor(rand()*GIVEN.length);
 for(let i=0;i<GIVEN.length;i++){
  const candidate=GIVEN[(start+i)%GIVEN.length];
  if(!used.has(candidate))return candidate;
 }
 // A safeguard for modded/legacy households larger than the standard name pool.
 const base=GIVEN[start];
 for(let suffix=2;suffix<10000;suffix++){
  const candidate=base+'・'+suffix;
  if(!used.has(candidate))return candidate;
 }
 throw Error('Family name pool exhausted');
};
const newPerson=(s,role,birthYear,rand,name=null,closeness=65)=>{
 const trait=TRAITS[Math.floor(rand()*TRAITS.length)];
 const personName=pickUnusedName(s,rand,name);
 const p={id:'npc-'+(++s.nextPersonId),role,name:personName,
  birthYear,trait:trait.id,traitLabel:trait.name,closeness:bound(closeness),alive:true,
  metYear:s.year,notes:[],lastInteractionYear:null};
 s.people.push(p);return p;
};
export function peopleByRole(s,role){return (s.people||[]).filter(p=>p.role===role)}
export function alivePeople(s){return (s.people||[]).filter(p=>p.alive)}
export function personAge(p,year){return Math.max(0,year-p.birthYear)}
export function initPeople(s,rand){
 s.people=[];s.nextPersonId=0;s.lastSocialYear=null;
 newPerson(s,'father',s.birthYear-22-Math.floor(rand()*17),rand,null,75);
 newPerson(s,'mother',s.birthYear-19-Math.floor(rand()*14),rand,null,81);
 if(rand()<.48)newPerson(s,'sibling',s.birthYear-(2+Math.floor(rand()*6)),rand,null,60);
 syncFamily(s);return s;
}
export function syncFamily(s){
 const list=s.people||[];
 s.family={
  partner:list.some(p=>p.role==='partner'&&p.alive),
  children:list.filter(p=>p.role==='child').length,
  parentsAlive:list.some(p=>(p.role==='father'||p.role==='mother')&&p.alive)
 };
 return s.family;
}
export function createMentor(s,rand,log){
 if(peopleByRole(s,'mentor').some(p=>p.alive))return null;
 const p=newPerson(s,'mentor',s.birthYear-8-Math.floor(rand()*27),rand,null,54);
 log('仕事の師匠',p.name+'という仕事の先輩と出会った。技を学ぶ機会が生まれた。',{kind:'relationship',personId:p.id});
 return p;
}
export function createPartner(s,rand,log){
 if(peopleByRole(s,'partner').some(p=>p.alive))return null;
 const p=newPerson(s,'partner',s.birthYear+(2-Math.floor(rand()*8)),rand,null,65);
 syncFamily(s);log('大切な縁',p.name+'と暮らしを共にすることになった。',{kind:'relationship',personId:p.id});
 return p;
}
export function createChild(s,rand,log){
 if(peopleByRole(s,'child').length>=5||!s.family.partner)return null;
 const p=newPerson(s,'child',s.year,rand,null,85);syncFamily(s);
 log('家族が増えた',p.name+'が生まれた。新しい暮らしと責任が始まる。',{kind:'relationship',personId:p.id});
 return p;
}
export function migratePeople(s){
 if(Array.isArray(s.people)){s.nextPersonId=Math.max(s.nextPersonId||0,...s.people.map(p=>Number(p.id?.split('-')[1])||0),0);syncFamily(s);return}
 s.people=[];s.nextPersonId=0;s.lastSocialYear=null;
 const simple=(role,name,birthYear,alive,closeness)=>{
  const p={id:'npc-'+(++s.nextPersonId),role,name,birthYear,trait:'quiet',
   traitLabel:'物静か',closeness,alive,metYear:s.birthYear,notes:[],lastInteractionYear:null};
  s.people.push(p);
 };
 simple('father','父',s.birthYear-30,!!s.family?.parentsAlive,68);
 simple('mother','母',s.birthYear-26,!!s.family?.parentsAlive,74);
 if(s.family?.partner)simple('partner','伴侶',s.birthYear, true,67);
 for(let i=0;i<(s.family?.children||0);i++)simple('child','子'+(i+1),s.year-Math.max(0,8-i*2),true,70);
 syncFamily(s);
}
export function interact(s,personId,actionId,log,effect){
 if(!s.people||s.phase!=='living'||s.age<7||s.lastSocialYear===s.year)return {ok:false,reason:'今の年は交流できません'};
 const p=s.people.find(x=>x.id===personId&&x.alive),action=RELATION_ACTIONS.find(x=>x.id===actionId);
 if(!p||!action)return {ok:false,reason:'相手または行動が無効'};
 if(s.stats.wealth<action.cost)return {ok:false,reason:'暮らしの余裕が足りません'};
 // Personalities change which gestures work best; not just decorative labels.
 const traitBonus=(p.trait==='curious'&&actionId==='talk')?5:
  (p.trait==='kind'&&actionId==='help')?5:
  (p.trait==='quiet'&&actionId==='talk')?3:
  (p.trait==='proud'&&actionId==='reconcile')?5:
  (p.trait==='careful'&&actionId==='help')?3:
  (p.trait==='open'&&actionId==='gift')?4:0;
 const matched=(actionId==='reconcile'&&p.closeness>=65?2:action.closeness)+traitBonus;
 p.closeness=bound(p.closeness+matched);
 p.lastInteractionYear=s.year;s.lastSocialYear=s.year;
 effect({...action.stat});
 log('人とのつながり',p.name+'（'+labelRole(p.role)+'）と過ごした。'+action.description+'。',{kind:'relationship',personId:p.id});
 return {ok:true,person:p.id,closeness:p.closeness};
}
export function labelRole(role){
 return ({father:'父',mother:'母',sibling:'きょうだい',grandparent:'祖父母',partner:'伴侶',child:'子ども',friend:'友人',mentor:'仕事の師匠'})[role]||'知人';
}
export function tickPeople(s,focus,rand,log,effect){
 if(!Array.isArray(s.people))return;
 const familyFocus=focus==='family';
 // Relationships evolve yearly; repeated attention has durable effects.
 for(const p of s.people){
  if(!p.alive)continue;
  if(familyFocus&&(p.role==='father'||p.role==='mother'||p.role==='partner'||p.role==='child'||p.role==='sibling')){
   p.closeness=bound(p.closeness+2);
  }else if(s.age>=14&&rand()<.28){
   p.closeness=bound(p.closeness-1);
  }
  const age=personAge(p,s.year);
  // A consciously fictional old-age roll. Never represent as a historical life table.
  if(age>59&&rand()<Math.min(.21,.018+(age-59)*.0025)){
   p.alive=false;
   const important=p.closeness>=65;
   effect({joy:important?-8:-4,bonds:important?-4:-2});
   log('別れ',p.name+'（'+labelRole(p.role)+'）を見送った。時間を共にした思い出は残る。',{kind:'relationship',personId:p.id});
  }
 }
 // Good long-term ties supply emotional support. This is a fictional
 // gameplay modifier, never a measured historical effect.
 if(familyFocus&&s.age>15&&s.age%5===0&&alivePeople(s).some(p=>p.closeness>=78)){
  effect({joy:2});
  log('支え合う暮らし','時間を重ねた人との縁が、日々の心の支えになった。',{kind:'relationship'});
 }
 if(s.age===11&&!peopleByRole(s,'friend').length){
  const p=newPerson(s,'friend',s.birthYear+(2-Math.floor(rand()*5)),rand,null,47);
  log('新しい出会い',p.name+'という同世代の知人ができた。',{kind:'relationship',personId:p.id});
 }
 for(const child of peopleByRole(s,'child')){
  if(!child.alive)continue;
  const age=personAge(child,s.year);
  if([7,15,20].includes(age)){
   log('成長する家族',child.name+'が'+age+'歳になった。子どもの成長を感じる。',{kind:'relationship',personId:child.id});
   effect({bonds:2,joy:2});
  }
 }
 syncFamily(s);
}
export function relationshipEvent(s,rand){
 const p=alivePeople(s).filter(x=>!['father','mother'].includes(x.role)&&x.closeness>=20);
 if(!p.length||s.age<14||s.age%8!==0)return null;
 const who=p[Math.floor(rand()*p.length)];
 return {id:'relation-'+s.age,kind:'relationship',personId:who.id,
 title:who.name+'とのすれ違い',
 description:who.name+'（'+labelRole(who.role)+'）は最近、あなたと十分に話せていないようだ。'+who.traitLabel+'相手と、どう向き合おう。',
 options:[
  {id:'listen',label:'時間をつくって話を聞く',delta:{bonds:4,joy:2,wealth:-2},personId:who.id,closeness:12,result:who.name+'は、話を聞いてもらえて少し安心したようだ。'},
  {id:'support',label:'困りごとを一緒に解決する',delta:{bonds:3,wealth:-4,health:-2},personId:who.id,closeness:16,result:who.name+'とともに悩みに取り組んだ。'},
  {id:'distance',label:'今は距離を置く',delta:{joy:1},personId:who.id,closeness:-8,result:'しばらく距離を置いた。互いの気持ちはすぐには埋まらなかった。'}
 ]};
}
