import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const css=readFileSync(new URL('../styles.css',import.meta.url),'utf8');
const cssHistory=readFileSync(new URL('../update-history.css',import.meta.url),'utf8');

test('all home actions are present in the same home action stack',()=>{
  const start=html.indexOf('<div class="hero-action-wrap">');
  const end=html.indexOf('<div class="hg-resume-slot"',start);
  assert.ok(start>=0&&end>start);
  const stack=html.slice(start,end);
  for(const label of ['オフラインで遊ぶ','オンラインで遊ぶ',
    'いつものメンバーを登録','共通設定','更新履歴']){
    assert.ok(stack.includes(label),label+' disappeared from the main stack');
  }
  assert.match(stack,/<div class="home-tools-row">/);
});
test('mobile browser viewports do not clip the bottom settings and history row',()=>{
  assert.match(css,/@media \(max-width:760px\)\{/);
  assert.match(css,/body\.home-page\{\s*overflow-x:hidden;\s*overflow-y:auto/);
  assert.match(css,/\.home-page \.home-shell\{\s*height:auto;/);
  assert.match(css,/\.home-page \.hero\{\s*height:auto;/);
  assert.match(css,/\.home-page \.hero-inner\{\s*height:auto;/);
  assert.match(css,/\.home-page \.hero-inner > \.hero-action-wrap/);
  assert.match(css,/bottom:auto!important/);
  assert.match(css,/position:relative!important/);
  assert.match(css,/\.home-page \.home-tools-row\{\s*display:grid/);
  assert.match(cssHistory,/\.home-page \.home-tools-row \.home-settings-btn/);
  assert.match(cssHistory,/\.home-page \.home-tools-row \.hg-history-home-btn/);
});
test('home stylesheet version changes to avoid stale browser cache',()=>{
  for(const file of ['styles.css','update-history.css','settings.css','resume.css']){
    assert.match(html,new RegExp('href="'+file.replace('.','\\.')+'\\?v=20261014-homeflow"'));
  }
});
