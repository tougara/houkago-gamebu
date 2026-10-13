import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const r=require('../games/pitadome-challenge/versus/versus-rules.js');

test('normal difficulty gradually reaches exact-only and stays there',()=>{
  assert.deepEqual([1,3,5,7,9,11,13,15,30].map(n=>r.safeLimit(n,'normal')),[12,9,7,5,3,2,1,0,0]);
});
test('easy difficulty reaches exact-only a little later',()=>{
  assert.deepEqual([1,3,5,7,9,11,13,15,17,30].map(n=>r.safeLimit(n,'easy')),[15,12,10,8,6,4,2,1,0,0]);
});
test('initiative alternates each round',()=>{for(let i=1;i<=40;i++)assert.equal(r.firstPlayer(i),(i-1)%2)});
test('stopping is based only on accuracy, without an early-stop bonus',()=>{
  const out=r.evaluateStop(25.4,25);
  assert.deepEqual(out,{value:25,error:0,perfect:true});
  assert.equal(Object.hasOwn(out,'points'),false);
  assert.equal(Object.hasOwn(out,'fast'),false);
});
test('same inputs share a single round profile and safe rule',()=>{
  const out=r.roundProfile(9,'normal',()=>0.5);
  assert.equal(out.safe,3);
  assert.ok(out.target>=18&&out.target<=82);
});
test('perfect heals and damages a non-perfect opponent even when within safe range',()=>{
  const result=r.resolveRound([1,1],[{error:0,perfect:true},{error:1,perfect:false}],3);
  assert.deepEqual(result.lives,[2,0]);
  assert.deepEqual(result.damage,[0,1]);
  assert.equal(result.winner,0);
});
test('perfect cannot heal beyond three hearts',()=>{
  const result=r.resolveRound([3,2],[{error:0,perfect:true},{error:0,perfect:true}],0);
  assert.deepEqual(result.lives,[3,3]);
  assert.deepEqual(result.damage,[0,0]);
  assert.equal(result.knockout,false);
});
test('a miss and perfect strike never double the damage',()=>{
  const result=r.resolveRound([2,2],[{error:10,perfect:false},{error:0,perfect:true}],3);
  assert.deepEqual(result.damage,[1,0]);
  assert.deepEqual(result.lives,[1,3]);
});
test('both players missing while on one heart yields a draw',()=>{
  const result=r.resolveRound([1,1],[{error:20,perfect:false},{error:30,perfect:false}],3);
  assert.equal(result.knockout,true);
  assert.equal(result.winner,null);
  assert.deepEqual(result.lives,[0,0]);
});
test('knockout is not adjudicated until both stops exist',()=>{
  assert.throws(()=>r.resolveRound([1,1],[{error:0,perfect:true},null],3),/Both players/);
});
