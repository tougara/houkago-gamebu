/* Japanese historical currency presentation, not historically verified wages or in-game exchange rates.
 * All balances remain internally abstract game points to preserve existing saves and economy.
 * Historical yen comparisons are method-specific ranges, NEVER official conversion rates.
 */
const nf=new Intl.NumberFormat('ja-JP');
export const CURRENCY_SOURCES={
 boj:'https://www.imes.boj.or.jp/cm/history/edojidaino1ryowa/index.html',
 bojunits:'https://www.imes.boj.or.jp/cm/history/historyfaq/',
 sengoku:'https://crd.ndl.go.jp/reference/entry/reference/show?asc=desc&dtltbs=1&fi=5_%E5%80%8B%E4%BA%BA&id=1000170301&ldtl=1&mcmd=25&ndc1=337&ndc_lk=1&page=ref_view&st=update',
 meiji:'https://crd.ndl.go.jp/reference/entry/index.php?id=1000341363&page=ref_view'
};
export const LIFE_UNIT_TO_CURRENCY={
 sengoku:100, // 100 copper mon per former balance point (fictional bookkeeping)
 edo:500, // 500 copper mon per former balance point
 meiji:25 // 25 sen per former balance point (1871 onward)
};
export function periodFor(s){
 const year=s.year;
 if(s.eraId==='sengoku'&&year<1601)return 'sengoku';
 if(year>=1871)return 'meiji';
 return 'edo';
}
export function currencyInfo(s){
 const year=s.year;
 const period=periodFor(s);
 if(period==='sengoku'){
  // Rice calculation from NDL reference: 1591 Kyoto rice 1 koku=833 mon,
  // rice (2014 price) 1 koku=67,050 yen, giving ~80yen/mon.
  // NOT a general nationwide or 2026 purchasing-power conversion.
  return {period,unit:'文・貫文',unitPerPoint:100,quoteUnit:'1貫文',yenLow:80,yenHigh:80,
   basis:'1591年京都の米価を使った一例（現代円は2014年の米価を使用）',source:CURRENCY_SOURCES.sengoku,
   caution:'戦国期の貨幣価値は銭の種類・地域・年代で異なる。これは単一史料の米価を使う参考試算で、実勢相場や2026年物価ではない。'};
 }
 if(period==='edo'){
  const early=year<1700,late=year>=1842;
  const monPerRyo=late?6500:4000;
  const ryoLow=early?100000:late?4000:40000;
  const ryoHigh=early?100000:late?10000:60000;
  return {period,unit:'両・貫文・文',unitPerPoint:500,monPerRyo,quoteUnit:'1両',
   yenLow:ryoLow/monPerRyo,yenHigh:ryoHigh/monPerRyo,
   basis:early?'江戸初期の米価による換算目安':late?'幕末の米価による換算目安':'江戸中〜後期の米価による換算目安',
   source:CURRENCY_SOURCES.boj,
   caution:'金と銭の交換相場は変動した。両と文の表示は公定相場を簡略化したゲーム内表示。実際の買い物で常にこの比率だったわけではない。'};
 }
 // The points chosen are reference anchors from different years and criteria.
 // These are approximate illustrations, NOT interpolated or indexed series.
 let low,high,basis;
 if(year<1893){low=20000;high=40000;basis='1886年の警察官初任給による参考値を1871〜1892年にも仮適用';}
 else if(year<1907){low=6600;high=6600;basis='1893年の白米価格による参考値を1893〜1906年にも仮適用';}
 else{low=2569;high=2569;basis='1912年の白米価格による参考値を1907年以降にも仮適用';}
 return {period,unit:'円・銭',unitPerPoint:25,quoteUnit:'1円',
  yenLow:low/100,yenHigh:high/100,basis,source:CURRENCY_SOURCES.meiji,
  caution:'基準年以外の明治期への適用はゲーム上の近似。物価・賃金は異なるため、歴史的な為替レートや厳密な現代価値ではない。'};
}
export function coinsFromPoints(points,s){
 if(!Number.isFinite(points))return null;
 return Math.round(Math.abs(points)*currencyInfo(s).unitPerPoint);
}
export function formatCurrency(points,s,{sign=false}={}){
 const meta=currencyInfo(s);
 const qty=coinsFromPoints(points,s);
 if(qty===null)return '—';
 const prefix=points<0?'−':(sign&&points>0?'+':'');
 if(meta.period==='meiji'){
  const yen=Math.floor(qty/100),sen=qty%100;
  return prefix+(yen?nf.format(yen)+'円':'')+(sen?sen+'銭':yen?'':'0銭');
 }
 if(meta.period==='sengoku'){
  const kan=Math.floor(qty/1000),mon=qty%1000;
  return prefix+(kan?nf.format(kan)+'貫文':'')+(mon?nf.format(mon)+'文':kan?'':'0文');
 }
 const ryo=Math.floor(qty/meta.monPerRyo),remainder=qty%meta.monPerRyo;
 const kan=Math.floor(remainder/1000),mon=remainder%1000;
 return prefix+(ryo?nf.format(ryo)+'両':'')+(kan?' '+nf.format(kan)+'貫文':'')+
  (mon?' '+nf.format(mon)+'文':ryo||kan?'':'0文');
}
function displayYen(value){
 const rounded=Math.round(value);
 if(rounded<1000)return '約'+nf.format(rounded)+'円';
 if(rounded<100000)return '約'+nf.format(Math.round(rounded/100)*100)+'円';
 return '約'+nf.format(Math.round(rounded/1000)*1000)+'円';
}
export function yenEstimate(points,s){
 if(!Number.isFinite(points))return '—';
 const meta=currencyInfo(s),unit=coinsFromPoints(points,s);
 const lows=unit*meta.yenLow,highs=unit*meta.yenHigh;
 if(unit===0)return '約0円';
 return meta.yenLow===meta.yenHigh?displayYen(lows):displayYen(lows)+'〜'+displayYen(highs);
}
export function unitExample(s){
 const meta=currencyInfo(s);
 const one=meta.period==='meiji'?100:meta.period==='sengoku'?1000:meta.monPerRyo;
 const points=one/meta.unitPerPoint;
 return meta.quoteUnit+' ≒ '+yenEstimate(points,s)+'（'+meta.basis+'）';
}
