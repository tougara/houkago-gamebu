/* Numeric game-effect previews only; does not mutate simulation or roll random. */
const names={health:'健康',knowledge:'知恵',bonds:'関係',joy:'幸福',wealth:'家計'};
const keys=['health','knowledge','bonds','joy','wealth'];
export function formatDeltas(delta={}){
 const result=keys.filter(k=>Number.isFinite(delta?.[k])&&delta[k]!==0).map(k=>names[k]+(delta[k]>0?'+':'−')+Math.abs(delta[k])+(k==='wealth'?'生活点':''));
 return result.length?result:['数値変化なし'];
}
export function eventPreview(option){
 const probability=typeof option.success==='number'?Math.round(Math.max(0,Math.min(1,option.success))*100):null;
 const extra=[];
 if(option.job)extra.push('職業：「'+option.job+'」に進む');
 if(option.personId&&Number.isFinite(option.closeness))extra.push('相手の親密度'+(option.closeness>0?'+':'−')+Math.abs(option.closeness));
 if(typeof option.partnerChance==='number')extra.push('新しい縁 '+Math.round(option.partnerChance*100)+'%（成立時は関係+5・幸福+4）');
 return {probability,success:formatDeltas(option.delta),failure:probability===null?null:formatDeltas(option.failDelta),extra};
}
export function focusPreview(id,knowledge=0){
 const chance=p=>Math.round(Math.min(.95,p)*100)+'%';
 const common=chance(.66+knowledge*.001),explore=chance(.48+knowledge*.002);
 const data={
  work:[common,{wealth:7,knowledge:2,health:-2,joy:-1},{wealth:3,health:-2,joy:-1}],
  learn:[common,{knowledge:7,wealth:-2,joy:1},{knowledge:3,wealth:-2,joy:1}],
  family:[common,{bonds:7,joy:4},{bonds:3,joy:1}],
  rest:[common,{health:8,joy:2,wealth:-3},{health:4,joy:2,wealth:-3}],
  explore:[explore,{knowledge:5,wealth:6,joy:3,health:-2},{knowledge:2,wealth:-5,joy:-3,health:-1}]
 }[id];
 return data?{chance:data[0],success:formatDeltas(data[1]),failure:formatDeltas(data[2])}:null;
}
