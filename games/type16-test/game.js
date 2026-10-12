/* 放課後タイプ診断16｜40問の試験診断。送信なし・端末内保存のみ。 */
(function(){
  'use strict';
  const D=globalThis.HG_TYPE16_DATA;
  const E=globalThis.HG_TYPE16_ENGINE;
  if(!D||!E)return;
  const $=id=>document.getElementById(id);
  const order=E.order();
  const STORAGE='houkago-type16-test-v1';
  const answersText=[
    {value:2,label:'かなりAに近い'},
    {value:1,label:'ややAに近い'},
    {value:0,label:'どちらも同じくらい'},
    {value:-1,label:'ややBに近い'},
    {value:-2,label:'かなりBに近い'}
  ];
  const bonusText=answersText.filter(x=>x.value!==0);
  const gameComments=[
    '自信満々に一手を打って、予想外の展開に一番驚くのはお前だ。',
    '独特なヒントで全員の反応を試したい。その表情観察、もうゲームの一部だ。',
    '計画的に宝石を集める。場当たり的な買い物だけは許せないらしい。',
    '相手の感情を読むのが得意なつもり。自分の演技が通じないと内心ざわつく。',
    'デッキ構築に没頭する。最強の仕組みを作るまで説明は後回し。',
    '一言のヒントに思惑を全部詰め込む。伝わらなくても天才顔を崩すな。',
    '未完成の道を見るとつなぎたくなる。お前の改善癖にちょうどいい。',
    '言葉にならない感覚を合わせる。相手を気にする力が役に立つかもしれない。',
    '静かに情報を貯めて、ここぞという瞬間に勝負を仕掛けたい。',
    '会話の違和感を探しているうちに、全員の本音を読みすぎる。',
    '資源と交渉と計画。予定どおりにいかない仲間たちまで含めて攻略しろ。',
    '仲間の動きを読んで任務を進める。自分の希望も作戦に入れておけ。',
    '発言の裏を読みまくる。黙りすぎると逆に疑われるぞ。',
    'ひらめきで謎の名前を作る。自分がつけた名前を忘れても驚くな。',
    '完成形へのこだわりが盤面に現れる。タイルの一枚で世界が変わるらしい。',
    '仲間のヒントから全体を整える。自分の判断もちゃんと信じろ。'
  ];
  let state={answers:{},bonuses:{},current:0,bonusIndex:0,stage:'intro'};
  try{
    const saved=JSON.parse(localStorage.getItem(STORAGE)||'null');
    if(saved&&typeof saved==='object'&&saved.answers&&saved.bonuses&&
       ['quiz','bonus','result'].includes(saved.stage)){
      state.answers=saved.answers;
      state.bonuses=saved.bonuses;
      state.current=Number.isInteger(saved.current)?Math.min(39,Math.max(0,saved.current)):0;
      state.bonusIndex=Number.isInteger(saved.bonusIndex)?Math.max(0,saved.bonusIndex):0;
      state.stage=saved.stage;
    }
  }catch(_){}
  const save=()=>{try{localStorage.setItem(STORAGE,JSON.stringify(state))}catch(_){}};
  function show(id){
    for(const name of ['intro','quiz','bonus','result'])$(name).hidden=name!==id;
    window.scrollTo({top:0,behavior:'instant'});
  }
  function intro(){
    show('intro');
    const hasProgress=state.stage!=='intro';
    $('start').textContent=hasProgress?'前回の続きから':'診断をはじめる →';
    $('resume-note').hidden=!hasProgress;
    $('reset-intro').hidden=!hasProgress;
  }
  function options(container,items,chosen,callback){
    container.replaceChildren();
    for(const item of items){
      const btn=document.createElement('button');
      btn.type='button';
      btn.className='answer-option'+(chosen===item.value?' selected':'');
      btn.setAttribute('aria-pressed',String(chosen===item.value));
      const dot=document.createElement('span');
      dot.className='radio-dot';dot.setAttribute('aria-hidden','true');
      const label=document.createElement('span');label.textContent=item.label;
      btn.append(dot,label);
      btn.addEventListener('click',()=>callback(item.value));
      container.append(btn);
    }
  }
  function renderQuiz(){
    state.stage='quiz';save();show('quiz');
    const q=order[state.current],chosen=state.answers[q.id];
    $('progress-number').textContent=String(state.current+1).padStart(2,'0')+' / 40';
    $('progress-fill').style.width=((state.current+1)/40*100)+'%';
    $('question-kicker').textContent=q.phase==='daily'?'DAILY SCENE':'UNEXPECTED SCENE';
    $('question-prompt').textContent=q.prompt;
    $('choice-a').textContent=q.a;
    $('choice-b').textContent=q.b;
    options($('answer-options'),answersText,chosen,v=>{
      state.answers[q.id]=v;save();
      renderQuizOptionsOnly(q);
    });
    $('quiz-next').disabled=!E.valid(chosen);
    $('quiz-next').textContent=state.current===39?'診断結果へ →':'次へ →';
  }
  function renderQuizOptionsOnly(q){
    const chosen=state.answers[q.id];
    options($('answer-options'),answersText,chosen,v=>{
      state.answers[q.id]=v;save();renderQuizOptionsOnly(q);
    });
    $('quiz-next').disabled=!E.valid(chosen);
  }
  function getTies(){return E.pendingAxes(E.baseScores(state.answers))}
  function renderBonus(){
    const ties=getTies();
    if(!ties.length){renderResult();return}
    state.bonusIndex=Math.min(state.bonusIndex,ties.length-1);
    state.stage='bonus';save();show('bonus');
    const axis=ties[state.bonusIndex],q=D.bonuses[axis];
    $('bonus-progress').textContent='確認 '+(state.bonusIndex+1)+' / '+ties.length;
    $('bonus-prompt').textContent=q.prompt;
    $('bonus-a').textContent=q.a;$('bonus-b').textContent=q.b;
    $('bonus-next').textContent=state.bonusIndex===ties.length-1?'結果を見る →':'次の確認へ →';
    renderBonusOptionsOnly(axis);
  }
  function renderBonusOptionsOnly(axis){
    const chosen=state.bonuses[axis];
    options($('bonus-options'),bonusText,chosen,v=>{
      state.bonuses[axis]=v;save();renderBonusOptionsOnly(axis);
    });
    $('bonus-next').disabled=!E.validBonus(chosen);
  }
  function goAfterQuiz(){
    const base=E.baseScores(state.answers);
    if(base.answered!==40){renderQuiz();return}
    const ties=E.pendingAxes(base);
    if(ties.length){state.bonusIndex=0;renderBonus()}
    else renderResult();
  }
  function renderResult(){
    const base=E.baseScores(state.answers);
    if(base.answered!==40){state.current=0;renderQuiz();return}
    const ties=E.pendingAxes(base);
    if(ties.some(i=>!E.validBonus(state.bonuses[i]))){
      state.bonusIndex=ties.findIndex(i=>!E.validBonus(state.bonuses[i]));
      renderBonus();return;
    }
    const totals=E.finalScores(base,state.bonuses),typeId=E.typeId(totals);
    if(!typeId){state.bonusIndex=0;renderBonus();return}
    const type=D.types[typeId-1];
    state.stage='result';save();show('result');
    $('result-id').textContent='TYPE '+String(typeId).padStart(2,'0');
    $('result-reading').textContent=type.reading;
    $('result-title').textContent=type.name;
    $('result-label').textContent='その本性、解析完了。';
    $('result-nature').textContent=type.nature;
    $('result-verdict').textContent=type.verdict;
    $('result-game').textContent=type.boardgame;
    $('result-game-comment').textContent=gameComments[typeId-1];
    const axes=$('result-axes');axes.replaceChildren();
    D.axes.forEach((axis,i)=>{
      const percent=E.percent(totals[i]);
      const wrapper=document.createElement('div');
      const top=document.createElement('div');top.className='axis-head';
      const name=document.createElement('span');name.textContent=axis.label+'：'+(totals[i]>0?axis.positive:axis.negative)+'寄り';
      const point=document.createElement('span');point.textContent=axis.positive+' '+percent+'%';
      top.append(name,point);
      const track=document.createElement('div');track.className='axis-track';
      const front=document.createElement('div');front.className='axis-front';front.style.width=percent+'%';
      track.append(front);
      const foot=document.createElement('div');foot.className='axis-foot';
      const left=document.createElement('span');left.textContent=axis.positive;
      const right=document.createElement('span');right.textContent=axis.negative+' '+(100-percent)+'%';
      foot.append(left,right);
      wrapper.append(top,track,foot);
      axes.append(wrapper);
    });
    const borderline=totals.map((v,i)=>Math.abs(v)<=2?D.axes[i].label:null).filter(Boolean);
    const switched=D.axes.filter((a,i)=>base.daily[i]*base.unexpected[i]<0&&Math.abs(base.daily[i]-base.unexpected[i])>=6).map(a=>a.label);
    const notes=[];
    if(borderline.length)notes.push('境界上の軸：'+borderline.join('・')+'。少しの回答差で別タイプになることがあります。');
    if(ties.length)notes.push('同点だった軸は追加の確認質問で仮判定しました。');
    if(switched.length)notes.push('日常と予定外で傾向が切り替わった軸：'+switched.join('・')+'。');
    if(!notes.length)notes.push('4軸の回答の傾向から分類しました。点数は性格の優劣や確率を示しません。');
    $('result-borderline').textContent=notes.join(' ');
  }
  $('start').addEventListener('click',()=>{
    if(state.stage==='result')renderResult();
    else if(state.stage==='bonus')renderBonus();
    else {state.stage='quiz';renderQuiz()}
  });
  $('reset-intro').addEventListener('click',()=>{
    if(!window.confirm('途中回答を消して最初から始めますか？'))return;
    state={answers:{},bonuses:{},current:0,bonusIndex:0,stage:'quiz'};
    renderQuiz();
  });
  $('quiz-back').addEventListener('click',()=>{
    if(state.current===0){state.stage='quiz';save();intro();return}
    state.current--;renderQuiz();
  });
  $('quiz-next').addEventListener('click',()=>{
    if(!E.valid(state.answers[order[state.current].id]))return;
    if(state.current===39){goAfterQuiz();return}
    state.current++;renderQuiz();
  });
  $('bonus-back').addEventListener('click',()=>{
    if(state.bonusIndex===0){state.current=39;renderQuiz();return}
    state.bonusIndex--;renderBonus();
  });
  $('bonus-next').addEventListener('click',()=>{
    const ties=getTies(),axis=ties[state.bonusIndex];
    if(!E.validBonus(state.bonuses[axis]))return;
    if(state.bonusIndex+1<ties.length){state.bonusIndex++;renderBonus()}
    else renderResult();
  });
  $('retry').addEventListener('click',()=>{
    if(!window.confirm('診断結果を消して、最初から40問に回答しますか？'))return;
    state={answers:{},bonuses:{},current:0,bonusIndex:0,stage:'quiz'};
    renderQuiz();
  });
  intro();
})();