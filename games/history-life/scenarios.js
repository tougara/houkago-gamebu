/* Original world definitions. All birth weights and effects here are GAME DESIGN
 * placeholders, NOT measured historical probabilities. */
export const ERAS=Object.freeze([
 {id:'sengoku',name:'戦国〜安土桃山',period:'1467〜1603年',birthYears:[1535,1586],subtitle:'戦乱と流動する社会で暮らす',
 intro:'国や領主の情勢が変わる時代。生まれた家と地域が、何を選べるかを大きく左右する。',
 backgrounds:['田畑を耕す家','小さな商いの家','職人の家','武家に縁のある家','寺社に縁のある家'],
 careers:['農業','商売','手仕事','武家への奉公','寺社での仕事'],
 livelihood:'村や町の仕事',education:'文字や技能を学ぶ機会'},
 {id:'edo',name:'江戸時代',period:'1603〜1868年',birthYears:[1690,1810],subtitle:'町や村、人のつながりの中で生きる',
 intro:'町、村、地域の制度が暮らしを形づくる。仕事や家の事情によって可能な選択が変わる。',
 backgrounds:['農村の家','町の商家','職人の家','武家の家','海沿いの家'],
 careers:['農業','商売','手仕事','武家の務め','漁や船の仕事'],
 livelihood:'家業や奉公',education:'寺子屋・学びの機会'},
 {id:'bakumatsu-meiji',name:'幕末〜明治',period:'1853〜1912年',birthYears:[1845,1878],subtitle:'社会の仕組みが変わる人生を生きる',
 intro:'幕末から明治へ。新しい教育や職業が広がる一方、制度の変化が家族の暮らしを揺らす。',
 backgrounds:['農家','商家','職人の家','旧武家につながる家','運送・船の仕事をする家'],
 careers:['農業','商売','手仕事','役所や公務に関わる仕事','運送の仕事'],
 livelihood:'働き方を見直す',education:'学校・技能の学び'}
]);
export const REGIONS=Object.freeze([
 {id:'tokai',name:'尾張・東海',local:['owari','tokai','sekigahara']},
 {id:'kinai',name:'京・近畿',local:['kyoto','osaka','sekigahara']},
 {id:'kanto',name:'江戸・関東',local:['edo','kanto','uraga']},
 {id:'tohoku',name:'東北地方',local:['tohoku']},
 {id:'kyushu',name:'九州地方',local:['kyushu','shimabara']},
 {id:'setouchi',name:'瀬戸内地方',local:['setouchi']}
]);
export const FOCI=Object.freeze([
 {id:'work',name:'仕事・家業',short:'生活を支える',effect:'財産・技能が伸びやすい',icon:'⚒'},
 {id:'learn',name:'学び',short:'知識を蓄える',effect:'知識が伸びやすい',icon:'書'},
 {id:'family',name:'家族・交友',short:'周囲を大切に',effect:'人間関係・幸福が伸びやすい',icon:'♡'},
 {id:'rest',name:'健康・休息',short:'身体をいたわる',effect:'健康が回復しやすい',icon:'☘'},
 {id:'explore',name:'新しい挑戦',short:'変化を求める',effect:'成功と失敗の幅が大きい',icon:'✧'}
]);
export const FIRST_NAMES=Object.freeze({
 male:['太郎','庄吉','新助','与吉','宗助','弥助','吉之助','藤吉','清太'],
 female:['はる','きく','おとよ','お梅','お鈴','たね','いと','ふみ','千代']
});
export function getEra(id){return ERAS.find(e=>e.id===id)||ERAS[0]}
export function getRegion(id){return REGIONS.find(r=>r.id===id)||REGIONS[0]}
export function relevantLocal(event,regionId){
 if(event.regionId==='japan')return 'nationwide';
 const region=getRegion(regionId);
 return region.local.includes(event.regionId)?'nearby':'distant';
}
