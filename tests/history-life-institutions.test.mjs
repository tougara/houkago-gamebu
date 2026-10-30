import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {getInstitutionContext,INSTITUTION_POLICIES,INSTITUTION_SOURCES} from '../games/history-life/institutions.js';
const s=(year,x={})=>({year,age:10,regionId:'tokai',backgroundIndex:0,career:{jobId:'farm'},family:{children:0},...x});
const category=(year,group)=>getInstitutionContext(s(year)).entries.find(p=>p.group===group)?.id;
test('policy source, years and IDs are valid',()=>{
 assert.equal(new Set(INSTITUTION_POLICIES.map(p=>p.id)).size,INSTITUTION_POLICIES.length);
 for(const p of INSTITUTION_POLICIES){assert.ok(p.from<=p.to);assert.ok(p.fact.length>20);assert.match(INSTITUTION_SOURCES[p.source].url,/^https:/)}
});
test('education and tax policy boundaries are precise',()=>{
 assert.equal(category(1603,'education'),'edo-learning');
 assert.equal(category(1871,'education'),'edo-learning');
 assert.equal(category(1872,'education'),'gakusei');
 assert.equal(category(1878,'education'),'gakusei');
 assert.equal(category(1879,'education'),'kyouikurei');
 assert.equal(category(1886,'education'),'school1886');
 assert.equal(category(1900,'education'),'school1900');
 assert.equal(category(1907,'education'),'school1907');
 assert.equal(category(1913,'education'),void 0);
 assert.equal(category(1500,'tax'),'medieval-tax');
 assert.equal(category(1872,'tax'),'edo-tax');
 assert.equal(category(1873,'tax'),'land-tax');
});
test('individual context is safe and does not mutate save state',()=>{
 const life=s(1886,{regionId:'kyushu',age:40,family:{children:2},career:{jobId:'merchant'},backgroundIndex:2});
 const before=JSON.stringify(life),info=getInstitutionContext(life);
 assert.equal(JSON.stringify(life),before);assert.match(info.region,/九州/);
 assert.match(info.entries.find(p=>p.group==='education').perspective,/子ども/);
 assert.match(info.caution,/未検証/);
 assert.match(getInstitutionContext(s(2020)).heading,/準備中/);
});
test('game HTML and render function use collapsed panel and sources',()=>{
 const html=readFileSync(new URL('../games/history-life/index.html',import.meta.url),'utf8');
 const app=readFileSync(new URL('../games/history-life/app.js',import.meta.url),'utf8');
 for(const id of ['institutionCard','institutionSummary','institutionDetails','institutionCaution'])assert.ok(html.includes('id="'+id+'"'));
 assert.match(app,/getInstitutionContext\(s\)/);assert.match(app,/renderInstitutions\(s\)/);
 assert.match(app,/rel="noopener noreferrer"/);
});
