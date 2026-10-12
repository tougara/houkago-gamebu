import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const dir=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../games/type16-test');
const sandbox={};
for(const file of ['diagnosis-data.js','engine.js']){
  vm.runInNewContext(fs.readFileSync(path.join(dir,file),'utf8'),sandbox,{filename:file});
}
const D=sandbox.HG_TYPE16_DATA;
const E=sandbox.HG_TYPE16_ENGINE;

test('40問・4軸各10問・日常/予想外各5問・A/Bの向き各5問',()=>{
  assert.equal(D.questions.length,40);
  assert.equal(D.types.length,16);
  for(let axis=0;axis<4;axis++){
    const q=D.questions.filter(v=>v.axis===axis);
    assert.equal(q.length,10);
    assert.equal(q.filter(v=>v.phase==='daily').length,5);
    assert.equal(q.filter(v=>v.phase==='unexpected').length,5);
    assert.equal(q.filter(v=>v.direction===1).length,5);
    assert.equal(q.filter(v=>v.direction===-1).length,5);
  }
});

test('表示順に重複や抜けがない',()=>{
  assert.equal(E.order().length,40);
  assert.equal(new Set(E.order().map(q=>q.id)).size,40);
});

test('16通りの軸の組み合わせが全16タイプに分かれる',()=>{
  for(let id=1;id<=16;id++){
    const poles=[8,4,2,1].map(bit=>!((id-1)&bit));
    const ans=Object.fromEntries(D.questions.map(q=>[q.id,(poles[q.axis]?2:-2)*q.direction]));
    const base=E.baseScores(ans);
    assert.equal(base.answered,40);
    assert.equal(E.pendingAxes(base).length,0);
    assert.equal(E.typeId(E.finalScores(base,{})),id);
  }
});

test('全部A/全部Bの機械的な連打は特定の軸に偏らない',()=>{
  for(const v of [2,-2]){
    const ans=Object.fromEntries(D.questions.map(q=>[q.id,v]));
    assert.equal(E.baseScores(ans).scores.join(','),'0,0,0,0');
  }
});

test('中立回答は0点でも回答済みとして数える',()=>{
  const ans=Object.fromEntries(D.questions.map(q=>[q.id,0]));
  const base=E.baseScores(ans);
  assert.equal(base.answered,40);
  assert.equal(E.pendingAxes(base).join(','),'0,1,2,3');
  assert.equal(E.typeId(E.finalScores(base,{})),null);
});

test('同点時の補助4問でタイプを決められる',()=>{
  const ans=Object.fromEntries(D.questions.map(q=>[q.id,0]));
  const base=E.baseScores(ans);
  const totals=E.finalScores(base,{0:1,1:-1,2:2,3:-2});
  assert.equal(totals.join(','),'1,-1,2,-2');
  assert.equal(E.typeId(totals),6);
  assert.equal(D.bonuses.length,4);
});

test('未回答や不正値は採点対象にならない',()=>{
  assert.equal(E.baseScores({}).answered,0);
  assert.equal(E.valid(null),false);
  assert.equal(E.valid(0),true);
  assert.equal(E.validBonus(0),false);
  assert.equal(E.validBonus(-1),true);
});

test('各タイプに確定した名称・当て字読み・おすすめボドゲがある',()=>{
  for(const type of D.types){
    assert.ok(type.name&&type.reading&&type.boardgame&&type.nature&&type.verdict);
  }
  assert.equal(D.types[0].boardgame,'ニムト');
  assert.equal(D.types[6].boardgame,'カルカソンヌ');
});
