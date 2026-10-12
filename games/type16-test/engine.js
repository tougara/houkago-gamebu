/* 診断スコア計算は画面表示から分離。4軸×10問、選択肢の採点方向は各5問ずつ。 */
(function(){
  'use strict';
  const D=globalThis.HG_TYPE16_DATA;
  const valid=(v)=>Number.isInteger(v)&&[-2,-1,0,1,2].includes(v);
  const validBonus=(v)=>Number.isInteger(v)&&[-2,-1,1,2].includes(v);
  function order(){
    const out=[];
    for(let round=0;round<10;round++){
      for(let axis=0;axis<4;axis++){
        out.push(D.questions[axis*10+(round*3+axis*2)%10]);
      }
    }
    return out;
  }
  function baseScores(answers){
    const scores=[0,0,0,0],daily=[0,0,0,0],unexpected=[0,0,0,0];
    let answered=0;
    for(const q of D.questions){
      const value=answers[q.id];
      if(!valid(value))continue;
      const points=value*q.direction;
      scores[q.axis]+=points;
      (q.phase==='daily'?daily:unexpected)[q.axis]+=points;
      answered++;
    }
    return {scores,daily,unexpected,answered};
  }
  function pendingAxes(base){return base.scores.map((s,i)=>s===0?i:null).filter(i=>i!==null)}
  function finalScores(base,bonuses){
    const scores=base.scores.slice();
    for(const axis of pendingAxes(base)){
      const v=bonuses[axis];
      if(validBonus(v))scores[axis]+=v*D.bonuses[axis].direction;
    }
    return scores;
  }
  function typeId(scores){
    if(scores.length!==4||scores.some(x=>!Number.isFinite(x)||x===0))return null;
    return 1+(scores[0]<0?8:0)+(scores[1]<0?4:0)+(scores[2]<0?2:0)+(scores[3]<0?1:0);
  }
  function percent(score){return Math.max(0,Math.min(100,Math.round(50+score*2.5)))}
  globalThis.HG_TYPE16_ENGINE=Object.freeze({order,baseScores,pendingAxes,finalScores,typeId,percent,valid,validBonus});
})();