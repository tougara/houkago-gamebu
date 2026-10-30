/* Sourced national institution timeline; no game balance, save or RNG changes. */
import {getRegion} from './scenarios.js';
export const INSTITUTION_SOURCES=Object.freeze({"historyTax":{"name":"国税庁「税金の歴史」","url":"https://www.nta.go.jp/about/organization/kanazawa/education/fukukyozai/elementary/ishikawa/13/index.html"},"landTax":{"name":"国立公文書館「地租改正法」","url":"https://www.jacar.archives.go.jp/das/meta/A07060190700"},"edoLearn":{"name":"文部科学省「幕末期の教育」","url":"https://www.mext.go.jp/b_menu/hakusho/html/others/detail/mext_03454.html"},"gakusei":{"name":"国立公文書館「学制」","url":"https://www.archives.go.jp/learning/archive_collection_4/collection_1/"},"kyouikurei":{"name":"国立教育政策研究所「学制」","url":"https://www.nier.go.jp/library/rarebooks/seido/373.2-308/"},"school":{"name":"国立公文書館「小学校令」","url":"https://www.archives.go.jp/learning/archive_collection_4/collection_3/"},"schoolChange":{"name":"国立公文書館「小学校令改正」","url":"https://www.archives.go.jp/exhibition/digital/meiji/contents3_04/"}});
const raw=[["medieval-tax","tax",1400,1602,"税と暮らし","年貢と地域ごとの負担","中世・戦国には年貢や労役などの負担があった。内容は時期や地域によって異なり、全国一律の税率として扱えない。","historyTax"],["edo-tax","tax",1603,1872,"税と暮らし","年貢と運上・冥加","江戸時代には田畑の年貢に加え、商いに関わる運上などもあった。明治初期の制度移行は全国一律・同時ではない。","historyTax"],["land-tax","tax",1873,1912,"税と暮らし","地租改正と土地課税","1873年に地租改正条例が公布された。地価を基準に金銭で課税する仕組みへ移り、測量や地券の整備は各地で段階的に進んだ。","landTax"],["edo-learning","education",1603,1871,"学び","寺子屋と藩校","江戸時代には武家の藩校や庶民の寺子屋があった。寺子屋が広く普及したのは主に江戸後期で、学習機会に地域差があった。","edoLearn"],["gakusei","education",1872,1878,"学び","学制の公布","1872年に近代学校制度の基本法令「学制」が公布された。法令の制定と、全員が実際に学校へ通えたかは別の問題。","gakusei"],["kyouikurei","education",1879,1885,"学び","教育令への移行","学制は全国での実施が難しく、1879年の教育令へ改められた。各地域での実際の就学状況は別途検証が必要。","kyouikurei"],["school1886","education",1886,1899,"学び","小学校令","1886年に公布された小学校令では尋常小学校の4年間を義務制としたが、授業料は無償ではなかった。","school"],["school1900","education",1900,1906,"学び","公立小学校の授業料が原則無償に","1900年の小学校令改正で公立小学校の授業料が原則無償となった。就学機会が完全に平等だったことは意味しない。","schoolChange"],["school1907","education",1907,1912,"学び","義務教育の6年への延長","1907年の小学校令改正により義務教育期間は4年から6年に延長された。制度と個人の就学経験は区別する。","schoolChange"]];
export const INSTITUTION_POLICIES=Object.freeze(raw.map(([id,group,from,to,topic,title,fact,source])=>Object.freeze({id,group,from,to,topic,title,fact,source})));
function describeRelevance(policy,s){
 const age=Number(s?.age)||0,children=Number(s?.family?.children)||0;
 if(policy.group==='education'){
  if(age>=6&&age<=15)return '本人は学ぶ年齢。ただし、実際に通えたかは地域・家計などが未調査で未判定。';
  if(children>0)return 'この家には子どもがいる。就学・費用への個別の影響はまだ未判定。';
  return '本人と家族が学べたかは個別には未判定。';
 }
 if(s?.career?.jobId==='farm'||s?.backgroundIndex===0)
  return policy.id==='land-tax'?'農業に関わっていても土地の所有者とは限らない。課税対象かどうかは未判定。':'農業と関わりがある。実際の年貢や負担額は未判定。';
 return policy.id==='land-tax'?'土地を所有しているか不明なため、本人への課税は未判定。':'仕事・家の負担は地域や制度で異なるため未判定。';
}
export function getInstitutionContext(s){
 const year=Number(s?.year),region=getRegion(s?.regionId).name;
 const entries=Number.isInteger(year)?INSTITUTION_POLICIES.filter(p=>p.from<=year&&year<=p.to).map(p=>({
  ...p,sourceName:INSTITUTION_SOURCES[p.source].name,sourceUrl:INSTITUTION_SOURCES[p.source].url,perspective:describeRelevance(p,s)
 })):[];
 return {region,entries,heading:entries.length?year+'年の制度：'+entries.map(p=>p.topic).join('・'):'この年代の制度資料は準備中',
  caution:'史実の制度・慣行の紹介です。'+region+'での実施時期や本人への影響は未検証。収支・能力・確率にはまだ反映していません。'};
}
