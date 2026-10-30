import {test} from 'node:test';
import assert from 'node:assert/strict';
import {formatDeltas,eventPreview,focusPreview} from '../games/history-life/choice-preview.js';
test('direct event numerical preview uses real game-accounting units',()=>{
 assert.deepEqual(eventPreview({delta:{health:2,wealth:-3,bonds:4}}).success,['健康+2','関係+4','家計−3生活点']);
 assert.equal(eventPreview({delta:{joy:4}}).probability,null);
});
test('different success and failure outcomes use explicit probability and actual deltas',()=>{
 const o=eventPreview({success:.48,delta:{wealth:5,knowledge:2,joy:-2},failDelta:{wealth:-6,joy:-3}});
 assert.equal(o.probability,48);assert.deepEqual(o.success,['知恵+2','幸福−2','家計+5生活点']);
 assert.deepEqual(o.failure,['幸福−3','家計−6生活点']);
 assert.deepEqual(eventPreview({success:.6,delta:{joy:3}}).failure,['数値変化なし']);
});
test('non-stat effects are separate and shown without inventing automatic gains',()=>{
 const p=eventPreview({delta:{},job:'農業',personId:'p',closeness:12,partnerChance:.68});
 assert.deepEqual(p.extra,['職業：「農業」に進む','相手の親密度+12','新しい縁 68%（成立時は関係+5・幸福+4）']);
});
test('annual focus figures reflect current engine logic',()=>{
 const f=focusPreview('family',40);assert.deepEqual(f.success,['関係+7','幸福+4']);assert.deepEqual(f.failure,['関係+3','幸福+1']);
 const w=focusPreview('work',40);assert.equal(w.chance,'70%');assert.ok(w.success.includes('家計+7生活点'));
 assert.equal(focusPreview('explore',60).chance,'60%');
});
