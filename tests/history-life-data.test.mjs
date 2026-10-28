import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const root=new URL('../games/history-life/data/',import.meta.url);
const read=name=>JSON.parse(readFileSync(new URL(name,root),'utf8'));
const sources=read('data-sources.json'),timeline=read('historical-events.jp.json'),era=read('era-presets.json');
const ids=new Set(sources.sources.map(s=>s.id));
test('historical data references distinct original sources with verifiable external URLs',()=>{
 assert.equal(ids.size,sources.sources.length);
 assert.ok(sources.sources.length>=15);
 for(const s of sources.sources){
  assert.ok(s.name&&s.license&&s.coverage&&s.use,JSON.stringify(s));
  assert.match(s.url,/^https:\/\//);
 }
 assert.ok(sources.sources.find(s=>s.id==='game-official').kind==='reference_only');
 assert.ok(sources.sources.find(s=>s.id==='ndl-population'));
});
test('Japanese historical events are chronological and always cite an independent source',()=>{
 assert.ok(timeline.events.length>=30);
 const seen=new Set();
 let last=-Infinity;
 for(const e of timeline.events){
  assert.ok(e.year>=1467&&e.year<=1912);
  assert.ok(e.year>=last,'chronological order');
  last=e.year;
  assert.ok(!seen.has(e.id),'unique id '+e.id);seen.add(e.id);
  assert.ok(ids.has(e.sourceId),'provenance '+e.id);
  assert.notEqual(e.sourceId,'game-official','never recycle original game content');
  assert.ok(e.title&&e.category&&e.regionId&&e.gameplayHooks.length);
  assert.ok(e.status==='historical_fact');
  assert.ok(!('probability' in e)&&!('deathRate' in e)&&!('casualties' in e));
  if(e.endYear)assert.ok(e.endYear>=e.year);
 }
});
test('era presets and historical population distinguish estimated totals from draws',()=>{
 assert.deepEqual(era.eras.map(e=>e.id),['sengoku','edo','bakumatsu-meiji']);
 assert.ok(era.historicalPopulationResearch.doNotInferBirthProbability);
 for(const p of era.historicalPopulationResearch.sample){
  assert.ok(ids.has(p.sourceId));
  assert.ok(p.kind.includes('estimate')||p.kind.includes('census'));
  assert.ok(p.note.length>=10);
 }
 assert.ok(era.probabilityRules.includes('unknown_probability_must_be_marked_as_game_balance'));
 assert.ok(era.probabilityRules.includes('do_not_derive_infant_mortality_from_total_life_expectancy'));
});
