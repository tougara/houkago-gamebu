/* Pitadome two-player rules: solo bar profiles/scoring, strict one-stop turn alternation. */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 root.PitadomeVersusRules=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const NORMAL_SAFE=[12,12,9,9,7,7,5,5,3,3,2,2,1,1,0];
 const EASY_SAFE=[15,15,12,12,10,10,8,8,6,6,4,4,2,2,1,1,0];
 const CHARGE_LIMIT=500,MAX_PRESSURE=3;
 const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
 function levelForTurn(turn){return Math.ceil(Math.max(1,turn)/2)}
 function baseSafe(turn,difficulty){const a=difficulty==='easy'?EASY_SAFE:NORMAL_SAFE;return a[clamp(levelForTurn(turn)-1,0,a.length-1)]}
 function effectiveSafe(base,pressure){return Math.max(0,base-clamp(pressure||0,0,MAX_PRESSURE))}
 function comboMultiplierFor(n){return n>=10?1.5:n>=7?1.4:n>=5?1.3:n>=3?1.2:n>=2?1.1:1}
 function baseScore(error){return error===0?100:error===1?95:error===2?90:error<=3?80:error<=5?70:error<=8?50:error<=12?30:10}
 function tier(error,safe){return error===0?'perfect':error===1?'excellent':error<=3?'great':error<=5?'good':error<=safe?'safe':'miss'}
 function evaluateStop(value,target,previous={},safe=10){
   const resultValue=Math.round(value),error=Math.abs(resultValue-target);
   const kind=tier(error,safe),perfect=error===0;
   const combo=error<=3?(previous.combo||0)+(perfect?2:1):0;
   // GREAT or better without PERFECT: e=1..3, three consecutive own stops earns one special.
   const streak=error>=1&&error<=3?(previous.greatStreak||0)+1:0;
   const triple=streak>=3;
   const points=Math.round(baseScore(error)*comboMultiplierFor(combo));
   const accrued=(previous.charge||0)+points;
   return {value:resultValue,error,tier:kind,perfect,combo,greatStreak:triple?0:streak,
     triple,points,total:(previous.score||0)+points,charge:accrued%CHARGE_LIMIT,
     chargeReward:Math.floor(accrued/CHARGE_LIMIT),special:perfect||triple,safe};
 }
 function applyRewards(life,attempt){
   let after=clamp(life-Number(attempt.error>attempt.safe),0,3);
   let pressure=0,healed=0;
   if(attempt.special){
     if(after<3){after++;healed++}
     pressure+=2;
   }
   for(let i=0;i<attempt.chargeReward;i++){
     if(after<3){after++;healed++}
     else pressure++;
   }
   return{life:after,healed,damage:Number(attempt.error>attempt.safe),pressure:clamp(pressure,0,MAX_PRESSURE)};
 }
 function chooseRandom(rng=()=>Math.random()){return rng()<.5?0:1}
 function randomInt(rng,lo,hi){return lo+Math.floor(rng()*(hi-lo+1))}
 function shuffle(arr,rng){const a=[...arr];for(let i=a.length-1;i>0;i--){const j=randomInt(rng,0,i);[a[i],a[j]]=[a[j],a[i]]}return a}
 function randomRef(max,rng){const ratios=[.22,.28,.33,.38,.62,.67,.72,.78];return Math.round(max*ratios[randomInt(rng,0,7)])}
 function blind(rng){const width=randomInt(rng,18,28),start=randomInt(rng,14,72-width);return{start,end:start+width}}
 function baseProfile(){return{speed:34,movement:'normal',barScale:.86,minValue:0,maxValue:100,refPoint:50,blind:false,blindStart:36,blindEnd:62,gimmicks:['基本']}}
 function gimmick(p,k,rng){
   if(k==='short'){p.barScale=.58;p.gimmicks.push('短尺')}
   if(k==='wide'){p.barScale=1;p.gimmicks.push('長尺')}
   if(k==='ref'){p.refPoint=randomRef(p.maxValue,rng);p.gimmicks.push('基準変化')}
   if(k==='blind'){const b=blind(rng);p.blind=true;p.blindStart=b.start;p.blindEnd=b.end;p.gimmicks.push('隠し')}
   if(k==='range150'){p.maxValue=150;p.gimmicks.push('上限150')}
   if(k==='range200'){p.maxValue=200;p.gimmicks.push('上限200')}
   if(k==='accel'){p.movement='accel';p.gimmicks.push('加速')}
   if(k==='change'){p.movement='change';p.gimmicks.push('変速')}
   if(k==='reverse'){p.movement='reverse';p.gimmicks.push('反転')}
   if(k==='hyper'){p.speed=Math.max(p.speed,118);p.movement='hyper';p.gimmicks.push('超高速')}
   if(k==='fast'){p.speed+=14;p.gimmicks.push('高速')}
 }
 function tenProfile(round,rng){
   const p=baseProfile();p.gimmicks=[];
   if(round===1){p.speed=32;p.gimmicks=['基本']}
   if(round===2){p.speed=40;p.gimmicks=['速度UP']}
   if(round===3){p.speed=40;gimmick(p,'short',rng)}
   if(round===4){p.speed=42;gimmick(p,'ref',rng)}
   if(round===5){p.speed=46;gimmick(p,'change',rng)}
   if(round===6){p.speed=46;gimmick(p,'blind',rng)}
   if(round===7){p.speed=48;gimmick(p,'range150',rng);p.refPoint=75}
   if(round===8){p.speed=52;gimmick(p,'reverse',rng);gimmick(p,'short',rng)}
   if(round===9){p.speed=118;gimmick(p,'hyper',rng);gimmick(p,'wide',rng)}
   if(round===10){p.speed=58;p.gimmicks=['FINAL'];gimmick(p,'range200',rng);shuffle(['ref','blind','change'],rng).slice(0,2).forEach(k=>gimmick(p,k,rng))}
   return p;
 }
 function easyTenProfile(round,rng){
   const p=baseProfile();p.minValue=1;p.maxValue=100;p.refPoint=50;p.gimmicks=[];
   if(round===1){p.speed=26;p.gimmicks=['基本']}
   if(round===2){p.speed=30;p.gimmicks=['速度UP']}
   if(round===3){p.speed=31;p.barScale=.76;p.gimmicks=['短尺']}
   if(round===4){p.speed=32;p.movement='change';p.gimmicks=['変速']}
   if(round===5){p.speed=33;gimmick(p,'blind',rng)}
   if(round===6){p.speed=35;p.movement='accel';p.gimmicks=['加速']}
   if(round===7){p.speed=37;p.barScale=1;p.gimmicks=['長尺']}
   if(round===8){p.speed=39;p.movement='reverse';p.gimmicks=['反転']}
   if(round===9){p.speed=45;p.gimmicks=['高速']}
   if(round===10){p.speed=42;p.movement='change';gimmick(p,'blind',rng);p.gimmicks.unshift('FINAL')}
   return p;
 }
 function roundProfile(turn,difficulty,rng=Math.random){
   const level=levelForTurn(turn),easy=difficulty==='easy';
   const p=easy?easyTenProfile(Math.min(10,level),rng):tenProfile(Math.min(10,level),rng);
   if(level>10){
     const extra=Math.min(22,level-10);
     p.speed+=(easy?1.1:1.5)*extra;
     p.gimmicks=p.gimmicks.filter(x=>x!=='FINAL');
     if(level%3===1){p.movement='accel';p.gimmicks.push('加速')}
     if(level%3===2){p.movement='change';p.gimmicks.push('変速')}
     if(level%4===0)gimmick(p,'blind',rng);
   }
   if(!easy&&p.gimmicks.includes('基準変化'))p.refPoint=randomRef(p.maxValue,rng);
   else if(p.refPoint===50&&p.maxValue!==100)p.refPoint=Math.round(p.maxValue/2);
   const margin=Math.max(10,Math.round(p.maxValue*.08));
   const target=easy?randomInt(rng,1,100):randomInt(rng,margin,p.maxValue-margin);
   // SOLO easy: the blind zone must never cover the target neighborhood.
   if(easy&&p.blind){
     const targetPct=((target-p.minValue)/(p.maxValue-p.minValue))*100,width=p.blindEnd-p.blindStart;
     if(p.blindStart<=targetPct+11&&p.blindEnd>=targetPct-11){
       const choices=[];
       if(targetPct-11-width>=0)choices.push({start:0,end:width});
       if(targetPct+11+width<=100)choices.push({start:100-width,end:100});
       if(choices.length){const b=choices[randomInt(rng,0,choices.length-1)];p.blindStart=b.start;p.blindEnd=b.end}
       else p.blind=false;
     }
   }
   return{...p,target,level,baseSafe:baseSafe(turn,difficulty)};
 }
 function initialMotion(profile,rng=Math.random){
   const value=rng()<.5?profile.minValue:profile.maxValue;
   const dir=value===profile.minValue?1:-1;
   return{value,dir,elapsed:rng()*Math.PI*2,legIndex:0,reversePhase:0,reverseBaseDir:dir};
 }
 function advanceMotion(motion,dt,profile){
   const m={...motion};
   dt=Math.max(0,Math.min(.04,dt));
   m.elapsed+=dt;
   let mult=1;
   if(profile.movement==='accel')mult=.78+Math.min(.95,m.elapsed*.09);
   if(profile.movement==='change')mult=.68+.68*(.5+.5*Math.sin(m.elapsed*2.2));
   const range=profile.maxValue-profile.minValue;
   m.value+=m.dir*profile.speed*(range/100)*mult*dt;
   if(m.value>=profile.maxValue){m.value=profile.maxValue;m.dir=-1;m.legIndex++;m.reversePhase=0;m.reverseBaseDir=-1}
   else if(m.value<=profile.minValue){m.value=profile.minValue;m.dir=1;m.legIndex++;m.reversePhase=0;m.reverseBaseDir=1}
   else if(profile.movement==='reverse'&&m.legIndex%2===1){
     const pct=((m.value-profile.minValue)/range)*100;
     if(m.reversePhase===0){
       if(m.dir===1&&pct>=70){m.reverseBaseDir=1;m.dir=-1;m.reversePhase=1}
       else if(m.dir===-1&&pct<=30){m.reverseBaseDir=-1;m.dir=1;m.reversePhase=1}
     }else if(m.reversePhase===1){
       if(m.reverseBaseDir===1&&pct<=35){m.dir=1;m.reversePhase=2}
       else if(m.reverseBaseDir===-1&&pct>=65){m.dir=-1;m.reversePhase=2}
     }
   }
   return m;
 }
 return{CHARGE_LIMIT,MAX_PRESSURE,levelForTurn,baseSafe,effectiveSafe,chooseRandom,scoreForError:baseScore,
   comboMultiplierFor,tier,evaluateStop,applyRewards,roundProfile,initialMotion,advanceMotion};
});