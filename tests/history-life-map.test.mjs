import {test} from 'node:test';
import assert from 'node:assert/strict';
import {historicalMapMarkup,HISTORICAL_MAP_LOCATIONS} from '../games/history-life/historical-map.js';
test('all six historical game regions have independent on-island approximate markers',()=>{
 const keys=['kyushu','setouchi','kinai','tokai','kanto','tohoku'];
 assert.deepEqual(Object.keys(HISTORICAL_MAP_LOCATIONS).sort(),keys.sort());
 for(const k of keys){
  const pos=HISTORICAL_MAP_LOCATIONS[k];
  assert.ok(pos.lon>=129&&pos.lon<=146&&pos.lat>=31&&pos.lat<=46);
  const svg=historicalMapMarkup(k,'edo');
  assert.match(svg,new RegExp('data-region-id="'+k+'"'));
  assert.match(svg,/history-map-target/);
  assert.match(svg,/historical-map-accuracy/);
  assert.match(svg,/aria-label="日本列島の大まかな位置図/);
 }
});
test('era styling and captions change without inventing historic political borders',()=>{
 const eras=['sengoku','edo','bakumatsu-meiji'];
 const all=eras.map(id=>historicalMapMarkup('kanto',id));
 for(let i=0;i<3;i++){assert.match(all[i],new RegExp('data-era="'+eras[i]+'"'));assert.ok(all[i].includes('藩境'))}
 assert.notEqual(all[0],all[1]);assert.notEqual(all[1],all[2]);
});
test('markers preserve west-to-east and north-to-south position ordering',()=>{
 const p=HISTORICAL_MAP_LOCATIONS;
 assert.ok(p.kyushu.lon<p.setouchi.lon&&p.setouchi.lon<p.kinai.lon&&p.kinai.lon<p.tokai.lon&&p.tokai.lon<p.kanto.lon);
 assert.ok(p.tohoku.lat>p.kanto.lat&&p.kanto.lat>p.kyushu.lat);
});
