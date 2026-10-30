/* Birth-location overview from public-domain Natural Earth coastline geometry.
 * Coordinate data: https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson
 * Ancient province/han boundaries, settlement positions and coastlines of a specific year
 * are NOT reconstructed. Markers are approximate centers of broad game regions.
 */
import {getRegion} from './scenarios.js';
const coastline=[[[134.6384,34.1492],[134.7664,33.8063],[134.2034,33.2012],[133.7929,33.522],[133.2803,33.2896],[133.0149,32.7046],[132.3631,32.9894],[132.3712,33.4636],[132.9244,34.0603],[133.493,33.9446],[133.9041,34.3649],[134.6384,34.1492]],[[140.9764,37.1421],[140.5998,36.344],[140.7741,35.8429],[140.2533,35.1381],[138.9755,34.6676],[137.2176,34.6063],[135.793,33.4648],[135.121,33.8491],[135.0794,34.5965],[133.3403,34.3759],[132.1568,33.9049],[130.9861,33.8858],[132,33.15],[131.3328,31.4504],[130.6863,31.0296],[130.2024,31.4182],[130.4477,32.3195],[129.8147,32.6103],[129.4085,33.2961],[130.3539,33.6042],[130.8785,34.2327],[131.8842,34.7497],[132.6177,35.4334],[134.6083,35.7316],[135.6775,35.5271],[136.7238,37.305],[137.3906,36.8274],[138.8576,37.8275],[139.4264,38.216],[140.0548,39.4388],[139.8834,40.5633],[140.3058,41.195],[141.369,41.3786],[141.9143,39.9916],[141.8846,39.1809],[140.9595,38.174],[140.9764,37.1421]],[[143.9102,44.1741],[144.6134,43.9609],[145.3208,44.3847],[145.5431,43.2621],[144.0597,42.9884],[143.1839,41.9952],[141.6115,42.6788],[141.0673,41.5846],[139.9551,41.5696],[139.8175,42.5638],[140.3121,43.3333],[141.3805,43.3888],[141.672,44.7721],[141.9676,45.5515],[143.1429,44.5104],[143.9102,44.1741]]];
const places=Object.freeze({
 kyushu:{lon:130.65,lat:32.6},setouchi:{lon:133.52,lat:34.36},
 kinai:{lon:135.68,lat:34.75},tokai:{lon:137.05,lat:35.15},
 kanto:{lon:139.67,lat:35.82},tohoku:{lon:140.38,lat:39.17}
});
const eraNotes=Object.freeze({
 sengoku:'戦国：諸勢力が各地を治めた時代',
 edo:'江戸：幕府と諸藩の時代',
 'bakumatsu-meiji':'幕末〜明治：地域の制度が変わっていく時代'
});
const x=lon=>+(95+(lon-129)*35).toFixed(1);
const y=lat=>+(25+(46-lat)*23).toFixed(1);
const shorePath=coastline.map(poly=>poly.map(([lon,lat],i)=>(i?'L':'M')+x(lon)+' '+y(lat)).join(' ')+'Z').join(' ');
export const HISTORICAL_MAP_LOCATIONS=places;
export function historicalMapMarkup(regionId,eraId){
 const location=places[regionId]||places.tokai;
 const region=getRegion(regionId).name;
 const px=x(location.lon),py=y(location.lat);
 const note=eraNotes[eraId]||eraNotes.sengoku;
 const markers=Object.entries(places).map(([key,v])=>
  '<circle class="history-map-point'+(key===regionId?' selected':'')+'" cx="'+x(v.lon)+'" cy="'+y(v.lat)+'" r="'+(key===regionId?7:3.7)+'"/>').join('');
 return '<div class="historical-map" data-region-id="'+regionId+'" data-era="'+eraId+'">'+
  '<div class="historical-map-heading"><span>古地図風・日本列島</span><b>'+region+'</b></div>'+
  '<svg viewBox="0 0 760 398" role="img" aria-label="日本列島の大まかな位置図。出生地域は'+region+'。国境や村の位置を再現した地図ではありません。" xmlns="http://www.w3.org/2000/svg">'+
   '<defs><pattern id="birthMapLines" width="32" height="32" patternUnits="userSpaceOnUse"><path d="M0 32 L32 0" stroke="currentColor" stroke-opacity=".055" stroke-width="1"/></pattern></defs>'+
   '<rect width="760" height="398" fill="url(#birthMapLines)"/>'+
   '<g class="history-map-coast"><path d="'+shorePath+'"/></g>'+
   '<g class="history-map-points">'+markers+'</g>'+
   '<g class="history-map-target" transform="translate('+px+' '+py+')">'+
    '<circle r="19" class="history-map-halo"/><circle r="9" class="history-map-pin"/><circle r="3.3" fill="#fffef8"/>'+
    '<path d="M9 -9 L29 -29" fill="none" stroke="currentColor" stroke-width="2.6"/>'+
    '<rect x="26" y="-53" width="91" height="31" rx="15" class="history-map-callout"/>'+
    '<text x="71.5" y="-33" text-anchor="middle" class="history-map-callout-text">ここ！</text>'+
   '</g>'+
  '</svg>'+
  '<div class="historical-map-era">'+note+'</div>'+
  '<small class="historical-map-accuracy">出生地の大まかな位置。列島の輪郭は自然地理データを使用。領国・藩境や当時の村の位置を示す復元図ではありません。</small>'+
 '</div>';
}
