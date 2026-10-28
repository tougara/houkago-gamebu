/* Career catalogue, qualifications and fictional balance economy.
 * Era-specific availability is a gameplay approximation, not a census of occupations.
 */
import {createMentor,alivePeople,peopleByRole} from './social.js';
const clamp=(n)=>Math.max(0,Math.min(100,Math.round(n)));
export const JOBS=[
 {id:'farm',name:'農業',eras:['sengoku','edo','bakumatsu-meiji'],familyIndex:[0],requirements:{knowledge:0,skill:0},income:4,healthCost:2,description:'田畑を守り、季節とともに働く'},
 {id:'merchant',name:'商売',eras:['sengoku','edo','bakumatsu-meiji'],familyIndex:[1],requirements:{knowledge:12,skill:0},income:6,healthCost:1,description:'品物と人を結び、商いで暮らす'},
 {id:'craft',name:'手仕事',eras:['sengoku','edo','bakumatsu-meiji'],familyIndex:[2],requirements:{knowledge:10,skill:0},income:5,healthCost:1,description:'技を磨き、道具や品物を作る'},
 {id:'service',name:'武家への奉公',eras:['sengoku'],familyIndex:[3],requirements:{knowledge:12,skill:0},income:5,healthCost:2,description:'仕える先の家の仕事を支える'},
 {id:'temple',name:'寺社での仕事',eras:['sengoku','edo'],familyIndex:[4],requirements:{knowledge:22,skill:0},income:4,healthCost:1,description:'寺社に関わる日々の仕事'},
 {id:'retainer',name:'武家の務め',eras:['edo'],familyIndex:[3],requirements:{knowledge:18,skill:0},income:6,healthCost:1,description:'武家に関わる務めに従事する'},
 {id:'fishing',name:'漁や船の仕事',eras:['edo'],familyIndex:[4],requirements:{knowledge:0,skill:0},income:5,healthCost:3,description:'漁と船の仕事に携わる'},
 {id:'office',name:'役所や公務に関わる仕事',eras:['bakumatsu-meiji'],familyIndex:[3],requirements:{knowledge:42,skill:0},income:8,healthCost:1,description:'制度が変わる社会で書類や人を支える'},
 {id:'transport',name:'運送の仕事',eras:['bakumatsu-meiji'],familyIndex:[4],requirements:{knowledge:8,skill:0},income:6,healthCost:2,description:'人や物を運び、暮らしをつなぐ'},
 {id:'apprentice',name:'見習い・奉公',eras:['sengoku','edo','bakumatsu-meiji'],familyIndex:[],requirements:{knowledge:0,skill:0},income:2,healthCost:1,description:'修業しながら仕事を覚える'},
 {id:'scholar',name:'学びながらの仕事',eras:['sengoku','edo','bakumatsu-meiji'],familyIndex:[],requirements:{knowledge:12,skill:0},income:2,healthCost:0,description:'学びを重ねながら生計を立てる'},
 {id:'teacher',name:'読み書きを教える仕事',eras:['edo','bakumatsu-meiji'],familyIndex:[],requirements:{knowledge:55,skill:18},income:7,healthCost:1,description:'得た知識を次の人へ伝える'}
];
export const getJob=id=>JOBS.find(j=>j.id===id)||null;
export function initCareer(s){
 s.career={jobId:'dependent',skill:0,rank:0,years:0,lastSwitchYear:null,history:[]};
 return s.career;
}
export function migrateCareer(s){
 if(s.career){return s.career}
 const j=JOBS.find(j=>j.name===s.profession);
 s.career={jobId:j?.id||(s.age>=15?'apprentice':'dependent'),skill:Math.min(80,Math.max(0,Math.floor((s.age-15)*1.4))),
 rank:0,years:Math.max(0,s.age-15),lastSwitchYear:null,history:[]};
 return s.career;
}
export function jobOptions(s){
 if(s.age<15||s.phase!=='living')return [];
 return JOBS.filter(j=>j.eras.includes(s.eraId)).map(j=>{
  const familyAccess=j.familyIndex.includes(s.backgroundIndex);
  const needKnowledge=Math.max(0,j.requirements.knowledge-(familyAccess?10:0));
  const needSkill=j.requirements.skill;
  const missing=[];
  if(s.stats.knowledge<needKnowledge)missing.push('知恵'+needKnowledge+'以上');
  if(s.career.skill<needSkill)missing.push('職業技能'+needSkill+'以上');
  if(s.career.lastSwitchYear===s.year)missing.push('今年は転職済み');
  if(s.career.jobId===j.id)missing.push('現在の仕事');
  // Historical access restrictions are represented as frictions, not categorical caste rules.
  const difficult=!!j.familyIndex.length&&!familyAccess;
  return {...j,needKnowledge,needSkill,familyAccess,difficult,
   available:missing.length===0,reason:missing.join('・')};
 });
}
export function switchCareer(s,jobId,rand,log,effect){
 if(s.phase!=='living'||s.age<15)return {ok:false,reason:'仕事を選べる年齢ではありません'};
 const opt=jobOptions(s).find(j=>j.id===jobId);
 if(!opt||!opt.available)return {ok:false,reason:opt?.reason||'今はこの仕事を選べません'};
 s.career.lastSwitchYear=s.year;
 const socialSupport=alivePeople(s).filter(p=>['friend','mentor','partner'].includes(p.role)&&p.closeness>=70).length;
 const odds=opt.familyAccess?.96:Math.min(.94,Math.max(.32,.56+s.stats.knowledge*.003+
  (s.career.skill||0)*.002-(opt.difficult?.14:0)+Math.min(.08,socialSupport*.035)));
 const success=rand()<odds;
 if(success){
  s.career.jobId=opt.id;s.career.years=0;s.career.rank=0;s.career.skill=clamp(Math.floor(s.career.skill*.6));
  s.profession=opt.name;
  s.career.history.push({year:s.year,jobId:opt.id,name:opt.name});
  if(s.career.history.length>25)s.career.history.shift();
  effect({knowledge:2,wealth:-2,joy:3});
  log('仕事の転機',opt.name+'の道を歩み始めた。家の縁や経験が、新しい仕事への一歩を支えた。',{kind:'career'});
  if(!peopleByRole(s,'mentor').some(p=>p.alive))createMentor(s,rand,log);
 }else{
  effect({wealth:-3,joy:-3,knowledge:2});
  log('仕事の転機',opt.name+'を目指したが、今は縁や機会に恵まれなかった。',{kind:'career'});
 }
 return {ok:true,success,jobId:success?opt.id:s.career.jobId};
}
export function setCareerFromLegacy(s,label,log,rand=()=>.4){
 const job=JOBS.find(j=>j.name===label);
 if(!job)return;
 s.career.jobId=job.id;s.career.years=0;s.career.rank=0;
 s.career.history.push({year:s.year,jobId:job.id,name:job.name});
 if(log)log('仕事を始める',job.name+'の道へ進んだ。',{kind:'career'});
 if(!peopleByRole(s,'mentor').some(p=>p.alive))createMentor(s,rand,log||(()=>{}));
}
export function careerYear(s,focus,rand,log,effect){
 if(s.age<15)return;
 const job=getJob(s.career?.jobId);
 if(!job)return;
 const c=s.career;
 c.years++;
 let proficiency=focus==='work'?7:focus==='learn'?4:2;
 if(s.stats.health<25)proficiency=Math.max(1,Math.round(proficiency*.5));
 c.skill=clamp(c.skill+proficiency+(rand()<.3?2:0));
 const income=Math.max(1,Math.floor(job.income*(.50+c.skill/130)*(1+c.rank*.15)));
 const maintenance=3+Math.min(5,Math.floor(s.family.children/2));
 // Wealth is a 0-100 gameplay comfort index, not currency or historical income.
 effect({wealth:income-maintenance,health:focus==='work'?-job.healthCost:0});
 if(c.skill>=30&&c.years>=4&&c.rank===0){
  c.rank=1;effect({wealth:3,joy:2});
  log('仕事で成長',job.name+'の腕を認められ、任される仕事が増えた。',{kind:'career'});
 }else if(c.skill>=68&&c.years>=11&&c.rank===1){
  c.rank=2;effect({wealth:4,bonds:2});
  log('仕事の熟練',job.name+'を長く続け、腕を頼られるようになった。',{kind:'career'});
 }
 if(s.age===65&&c.jobId==='apprentice'){
  log('暮らしの変化','仕事の負担を見直し、できる範囲で働き続けた。',{kind:'career'});
 }
 return {income,maintenance,skill:c.skill,jobName:job.name};
}
