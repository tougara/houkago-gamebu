/* Pure rules used by the turn-based Pitadome KO duel; also testable in Node. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.PitadomeVersusRules=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const NORMAL_SAFE=[12,12,9,9,7,7,5,5,3,3,2,2,1,1,0,0];
  const EASY_SAFE=[15,15,12,12,10,10,8,8,6,6,4,4,2,2,1,1,0,0];
  function clamp(n,min,max){return Math.max(min,Math.min(max,n))}
  function safeLimit(round,difficulty){
    const levels=difficulty==='easy'?EASY_SAFE:NORMAL_SAFE;
    return levels[clamp(Math.floor(round)||1,1,levels.length)-1];
  }
  function firstPlayer(round){return (round-1)%2}
  function evaluateStop(value,target){
    const stopped=clamp(Math.round(value),0,100);
    const error=Math.abs(stopped-target);
    return{value:stopped,error,perfect:error===0};
  }
  function nextRandomInt(rng,lo,hi){return lo+Math.floor(rng()*(hi-lo+1))}
  function roundProfile(round,difficulty,rng=Math.random){
    const easy=difficulty==='easy';
    const target=nextRandomInt(rng,18,82);
    const speed=(easy?25:32)+Math.min(round-1,14)*(easy?2.4:3.1);
    const movement=round>=9&&round%3===0?'change':round>=5&&round%3===2?'accel':'normal';
    let blind=null;
    if(round>=7&&round%2===0){
      const width=easy?15:20;
      const candidates=[];
      for(let start=9;start<=90-width;start+=2){
        if(start+width<target-9||start>target+9)candidates.push(start);
      }
      if(candidates.length){
        const start=candidates[nextRandomInt(rng,0,candidates.length-1)];
        blind={start,end:start+width};
      }
    }
    return{round,target,speed,movement,blind,safe:safeLimit(round,difficulty),easy};
  }
  function resolveRound(lives,attempts,safe){
    if(!Array.isArray(lives)||lives.length!==2||!Array.isArray(attempts)||attempts.length!==2||attempts.some(a=>!a))throw Error('Both players must stop before resolving a round');
    const perfect=attempts.map(a=>a.perfect);
    const damage=attempts.map((a,i)=>Number(a.error>safe||(!perfect[i]&&perfect[1-i])));
    const after=lives.map((life,i)=>clamp(life-damage[i]+Number(perfect[i]),0,3));
    const healed=lives.map((life,i)=>after[i]-clamp(life-damage[i],0,3));
    const knockout=after[0]<=0||after[1]<=0;
    const winner=after[0]<=0&&after[1]<=0?null:after[0]<=0?1:after[1]<=0?0:null;
    return{lives:after,damage,healed,knockout,winner};
  }
  return{safeLimit,firstPlayer,evaluateStop,roundProfile,resolveRound};
});