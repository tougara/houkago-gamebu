import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import path from 'node:path';

const base=new URL('../',import.meta.url);
const guard=readFileSync(new URL('../game-back-guard.js',import.meta.url),'utf8');
const pages=[
  'games/nise-transfer-student/index.html','games/minna-wa-docchi/index.html',
  'games/kankaku-meter/index.html','games/kyokasho-tower/index.html',
  'games/gesture-battle/index.html','games/pitadome-challenge/index.html',
  'games/link-burst/index.html','games/pitadome-challenge/versus/index.html',
  'games/link-burst/versus/index.html','games/link-burst/versus/play.html',
  'online/minna-wa-docchi/index.html'
];

test('all seven offline games, two duel modes, and online use one correctly resolved guard',()=>{
  for(const name of pages){
    const html=readFileSync(new URL('../'+name,import.meta.url),'utf8');
    const matches=[...html.matchAll(/<script[^>]*src="([^"]*game-back-guard\.js[^"]*)"[^>]*><\/script>/g)];
    assert.equal(matches.length,1,name+' must load guard exactly once');
    const relative=matches[0][1].split('?')[0];
    assert.equal(path.posix.normalize(path.posix.join(path.posix.dirname(name),relative)),
      'game-back-guard.js',name+' guard URL');
  }
});
function harness(active=true){
  const events={};
  const controls={};
  const emitted=[];
  const history={state:null,length:4,pushed:0,replaced:0,goArgs:[],
    pushState(state){this.state=state;this.pushed++},
    replaceState(state){this.state=state;this.replaced++},
    go(x){this.goArgs.push(x)},
    back(){this.goArgs.push(-1)}
  };
  const location={pathname:'/games/link-burst/versus/play.html',href:'https://example.test/games/link-burst/versus/play.html',
    assigned:null,assign(v){this.assigned=v}};
  const body={classList:{add(){},remove(){}},last:null,appendChild(node){this.last=node}};
  const document={
    body,head:{appendChild(){}},
    querySelector(selector){return active&&selector.includes('.match-arenas')?{}:null},
    getElementById(){return null},
    createElement(tag){
      if(tag==='style')return {id:'',textContent:''};
      const node={className:'',innerHTML:'',removed:false,
        remove(){this.removed=true},
        querySelector(selector){
          controls[selector]??={addEventListener(type,cb){this[type]=cb},focus(){}};
          return controls[selector];
        }
      };
      return node;
    }
  };
  const win={history,addEventListener(type,fn){events[type]=fn},
    dispatchEvent(e){emitted.push(e.type)}};
  function CustomEvent(name){this.type=name}
  runInNewContext(guard,{window:win,document,history,location,CustomEvent});
  return {events,controls,emitted,history,win,location,body};
}
test('accidental Back opens a confirmation and Continue preserves the same live page',()=>{
  const x=harness(true);
  assert.equal(x.history.pushed,1);
  assert.equal(x.history.replaced,1);
  x.events.popstate();
  assert.ok(x.body.last);
  assert.equal(x.history.pushed,2);
  assert.ok(x.emitted.includes('houkago-back-guard-open'));
  x.controls['.hg-back-stay'].click();
  assert.equal(x.body.last.removed,true);
  assert.ok(x.emitted.includes('houkago-back-guard-stay'));
  assert.deepEqual(x.history.goArgs,[]);
});
test('intentional leave dispatches save and returns to the previous page',()=>{
  const x=harness(true);
  x.events.popstate();
  x.controls['.hg-back-leave'].click();
  assert.ok(x.emitted.includes('houkago-back-guard-save'));
  assert.deepEqual(x.history.goArgs,[-2]);
});
test('inactive menus are not blocked and existing game snapshots activate guard',()=>{
  const x=harness(false);
  x.events.popstate();
  assert.deepEqual(x.history.goArgs,[-1]);
  const y=harness(false);
  y.win.HoukagoBackGuard.setActive(true);
  y.events.popstate();
  assert.ok(y.body.last&&!y.body.last.removed);
});
