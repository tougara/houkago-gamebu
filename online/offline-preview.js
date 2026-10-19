/* 放課後ゲーム部オンライン：共有・通信なしプレビュー
 * ?testPlay=1 のときだけ使用。ゲーム本体のHTML/CSS/レンダラーはそのまま。
 * WebSocket はローカル模擬版に差し替える。通常ページでは一切動作しない。
 */
(()=>{
'use strict';
const names={
 'minna-wa-docchi':'みんなはどっち？','word-wolf':'ことばのオオカミ',
 'pitadome-challenge':'ピタ止めチャレンジ','kankaku-meter':'感覚メーター',
 'kyokasho-tower':'教科書タワー','link-burst':'リンクバースト！'
};
const game=location.pathname.split('/').filter(Boolean).at(-1);
if(new URLSearchParams(location.search).get('testPlay')!=='1'||!Object.hasOwn(names,game))return;
const session={id:'demo-a',name:'あなた',icon:'🐶',code:'DEMO2026',token:'0'.repeat(64)};
const baseMembers=[
 {id:'demo-a',name:'あなた',icon:'🐶'},
 {id:'demo-b',name:'ゆい',icon:'🐱'},
 {id:'demo-c',name:'けん',icon:'🐼'},
 {id:'demo-d',name:'みお',icon:'🦊'}
];
const members=game==='link-burst'?baseMembers.slice(0,2):game==='kyokasho-tower'?baseMembers.slice(0,3):baseMembers;
const ids=members.map(m=>m.id);
const me=ids[0],other=ids[1];
const labels={
 'minna-wa-docchi':{setup:'モード・設定',preview:'お題確認',voting:'回答・投票',allAnswered:'全員回答完了',result:'結果発表',finished:'終了'},
 'word-wolf':{setup:'ゲーム設定',customInput:'お題入力',reveal:'秘密のお題',discussion:'話し合い',voting:'投票',voteComplete:'投票完了',runoffReady:'決選投票準備',reverse:'逆転チャンス',result:'結果発表'},
 'pitadome-challenge':{setup:'遊び方',playing:'ストップ操作',review:'結果発表',finished:'最終結果'},
 'kankaku-meter':{setup:'ゲーム設定',preview:'お題確認',reveal:'秘密の数字',arrange:'順番決め',result:'数字発表',finished:'最終結果'},
 'kyokasho-tower':{setup:'遊び方',roundIntro:'配布・開始',playing:'教科書の配置',roundResult:'ラウンド結果',finished:'最終順位'},
 'link-burst':{setup:'対戦準備',countdown:'カウントダウン',playing:'対戦操作',interrupted:'一時停止',finished:'勝敗表示'}
};
const initial=Object.keys(labels[game])[0];
const categories=['学校','日常','食べ物','遊び','もしも','趣味','家族','おでかけ'];
const subjects=['japanese','math','science','social','english'];
const emptyHand=()=>({japanese:2,math:3,science:2,social:2,english:3});
const PITA_PREVIEW_PREP_MS=3*1120+1500; // オフライン2Pの3・2・1・START
function drawPitaPreviewTarget(){
 const easy=state.pitaDifficulty==='easy';
 const max=easy?100:state.pitaVariant==='150'?150:state.pitaVariant==='200'?200:100;
 const margin=Math.max(10,Math.round(max*.08));
 const lo=easy?1:margin,hi=easy?100:max-margin;
 const previous=state.pitaTarget;
 const avoid=Number.isInteger(previous)&&previous>=lo&&previous<=hi&&hi>lo;
 const drawn=lo+Math.floor(Math.random()*(hi-lo+1-(avoid?1:0)));
 state.pitaTarget=avoid&&drawn>=previous?drawn+1:drawn;
}
let state={stage:initial,round:1,mode:'secret',role:'host',question:0,order:[...ids],
 shown:[],seen:false,topic:{category:'日常',q:'休みの日にしたいことは？',low:'まったくしたくない',high:'毎日でもしたい'},
 customTopics:[],results:[],answers:0,mySubmitted:false,submittedCount:0,complete:false,
 settings:{difficulty:'normal',roundCount:5,categories:[...categories]},wolfSettings:{
 source:'auto',mode:'reverse',duration:180,categories:['日常','食べ物','学校'],authorId:me},
 pitaSpeed:32,pitaDifficulty:'normal',pitaVariant:'basic',pitaTarget:50,pitaStartedAt:Date.now()+PITA_PREVIEW_PREP_MS,hand:emptyHand(),board:[],moves:0,selected:-1,
 incoming:3,score:0,opponentScore:1280,linkPiece:{a:'blue',b:'red',x:3,y:2,rot:1},
 linkBoard:null,opponentBoard:null};
let connection=null,openSockets=new Set(),toolbar=null;
function boardRows(opponent=false){
 const rows=Array.from({length:13},()=>Array(7).fill('0'));
 const matrix=opponent?
  ['0000000','0000000','0000000','0000000','0000000','0000000','0000000','0000000','0000000','0020000','0231000','0421400','3355120']:
  ['0000000','0000000','0000000','0000000','0000000','0000000','0000000','0000000','0000000','0000000','0010200','0321400','1324450'];
 return matrix.map(x=>x);
}
function reset(){
 const role=state.role,mode=state.mode;
 state.stage=initial;state.round=1;state.question=0;state.order=[...ids];state.shown=[];
 state.seen=false;state.customTopics=[];state.results=[];state.answers=0;state.mySubmitted=false;
 state.submittedCount=0;state.complete=false;state.hand=emptyHand();state.board=[];
 state.moves=0;state.incoming=3;state.score=0;state.opponentScore=1280;state.pitaStartedAt=Date.now()+PITA_PREVIEW_PREP_MS;state.pitaDifficulty='normal';state.pitaVariant='basic';state.pitaTarget=50;
 state.linkPiece={a:'blue',b:'red',x:3,y:2,rot:1};state.linkBoard=boardRows();
 state.opponentBoard=boardRows(true);state.role=role;state.mode=mode;
}
reset();
function snapshot(){
 const hostId=state.role==='host'?me:other;
 const room={phase:{'minna-wa-docchi':'secret','word-wolf':'wolf',
  'pitadome-challenge':'pita','kankaku-meter':'meter','kyokasho-tower':'tower',
  'link-burst':'link'}[game],code:session.code,gameId:game,hostId,
  members:members.map(m=>({...m})),allReady:true};
 const stage=state.stage,round=state.round;
 if(game==='minna-wa-docchi'){
  const question=[{category:'日常',q:'休日に遊ぶなら？',a:'家でゲーム',b:'外で遊ぶ'},
   {category:'食べ物',q:'好きなのはどっち？',a:'カレー',b:'ラーメン'}][state.question%2];
  const battle=state.mode==='battle';
  room.secret={
   stage,mode:state.mode,modeSelected:true,round,roundCount:5,question,
   categories,selectedCategories:state.settings.categories,
   customQuestions:state.customTopics,includeCustom:false,
   alternatives:true,answered:state.answers,total:members.length,
   counts:{a:3,b:1},battleResult:{tie:false,players:members.map((m,i)=>({...m,answer:i===0?'b':'a',prediction:'majority',gain:i?1:0}))},
   scores:Object.fromEntries(ids.map((id,i)=>[id,5-i]))
  };
 }
 if(game==='word-wolf'){
  const s=state.wolfSettings;
  const word=stage==='reveal'?'カレー':null;
  room.wolf={
   stage,settings:{...s,categories:[...s.categories]},categories:['日常','食べ物','学校'],
   questionsTotal:150,members:room.members,activeIds:[...ids],
   authorId:s.source==='custom'?s.authorId:null,playing:true,author:s.source==='custom'&&s.authorId===me,
   isWolf:stage==='reverse',myWord:word,myRevealed:state.seen, revealedCount:state.seen?4:3,
   voted:state.mySubmitted,voteCount:state.submittedCount,
   candidates:[other,'demo-c'],runoff:stage==='runoffReady',
   firstTally:Object.fromEntries(ids.map((id,i)=>[id,i===1?2:i===2?2:0])),
   durationLeft:180,deadline:0,paused:true,
   result:stage==='result'?{
    winner:'human',wolfId:other,majority:'カレー',minority:'シチュー',
    eliminated:other,firstTally:{[me]:0,[other]:3,'demo-c':1,'demo-d':0},
    runoff:false,finalTally:null,guess:''
   }:null
  };
 }
 if(game==='pitadome-challenge'){
  const easy=state.pitaDifficulty==='easy';
  const profile={minValue:easy?1:0,maxValue:100,refPoint:50,barScale:.86,
   speed:easy?26:32,movement:'normal',blind:false,blindStart:30,blindEnd:55,gimmicks:['基本']};
  if(state.pitaVariant==='short'){profile.barScale=.58;profile.gimmicks=['短尺']}
  if(state.pitaVariant==='long'){profile.barScale=1;profile.gimmicks=['長尺']}
  if(state.pitaVariant==='blind'){profile.blind=true;profile.gimmicks=['隠し'];profile.blindStart=20;profile.blindEnd=45}
  if(state.pitaVariant==='fast'){profile.speed=easy?45:118;profile.movement=easy?'normal':'hyper';profile.gimmicks=['高速']}
  if(state.pitaVariant==='variable'){profile.speed=40;profile.movement='change';profile.gimmicks=['変速']}
  if(state.pitaVariant==='reverse'){profile.speed=48;profile.movement='reverse';profile.gimmicks=['折り返し']}
  if(state.pitaVariant==='reference'&&!easy){profile.refPoint=72;profile.gimmicks=['基準変化']}
  if(state.pitaVariant==='150'&&!easy){profile.maxValue=150;profile.refPoint=75;profile.gimmicks=['上限150']}
  if(state.pitaVariant==='200'&&!easy){profile.maxValue=200;profile.refPoint=100;profile.gimmicks=['上限200']}
  const examples=members.map((m,i)=>({
   id:m.id,grade:['perfect','excellent','great','miss'][i%4],
   value:[state.pitaTarget,state.pitaTarget+1,state.pitaTarget+3,state.pitaTarget+29][i%4],error:[0,1,3,29][i%4],
   points:[100,95,80,0][i%4],combo:[2,3,1,0][i%4],
   special:i===0,triple:false,chargeReward:0,charge:120+i*45,
   heal:i===0?1:0,attack:i===0?2:0,damage:i===3?1:0,safe:15,
   lifeBefore:3,lifeAfter:i===3?2:3,eliminated:false,pressure:i%2,timedOut:false
  }));
  room.pita={
   stage,round,maxRounds:25,target:state.pitaTarget,speed:profile.speed,
   difficulty:state.pitaDifficulty,
   profile,
   initialMotion:{value:profile.minValue,dir:1,elapsed:0,legIndex:0,reversePhase:0,reverseBaseDir:1},
   deadline:state.pitaStartedAt+18000,startedAt:state.pitaStartedAt,
   pressure:0,baseSafe:state.pitaDifficulty==='easy'?20:15,safe:state.pitaDifficulty==='easy'?20:15,chargeLimit:350,mySubmitted:state.mySubmitted,
   submittedCount:state.submittedCount,activeCount:members.length,
   members:members.map((m,i)=>({...m,difficulty:i===0?state.pitaDifficulty:'normal',lives:stage==='finished'?(i===0?2:0):3,eliminated:stage==='finished'&&i!==0,score:i*70+200,charge:120+i*45,combo:i+2,streak:i%3,perfects:i===0?3:1})),
   results:['review','finished'].includes(stage)?examples:[],
   finalRound:round>=5,winnerIds:stage==='finished'?[me]:[],
   limits:{perfect:2,excellent:5,great:10}
  };
 }
 if(game==='kankaku-meter'){
  const numbers=Object.fromEntries(ids.map((id,i)=>[id,[72,18,94,45][i]]));
  const fully=state.shown.length===ids.length||stage==='finished';
  const viewMembers=room.members.map(m=>({...m,seen:state.seen||m.id!==me}));
  room.meter={
   stage,settings:{...state.settings,categories:[...state.settings.categories]},
   categories,poolCount:160,customTopics:state.customTopics,
   members:viewMembers,round,topic:state.topic,seenCount:state.seen?members.length:members.length-1,
   myNumber:['reveal','arrange'].includes(stage)?numbers[me]:null,
   mySeen:state.seen,order:['arrange','result','finished'].includes(stage)?[...state.order]:[],
   shown:stage==='result'?[...state.shown]:[],
   shownNumbers:stage==='result'?Object.fromEntries(state.shown.map(id=>[id,numbers[id]])):null,
   roundScore:fully?85:null,correctOrder:fully?[...ids].sort((a,b)=>numbers[b]-numbers[a]):[],
   totalScore:stage==='finished'?425:null,
   scores:stage==='finished'?[85,90,100,80,70]:[],
   progressScore:stage==='finished'?undefined:(round-1)*85
  };
 }
 if(game==='kyokasho-tower'){
  const board=state.board,bs=board.filter(p=>p.level===0),xs=bs.map(p=>p.x);
  const min=xs.length?Math.min(...xs):0,max=xs.length?Math.max(...xs):0;
  const currentId=stage==='playing'?(state.role==='host'?me:other):null;
  const choices=Object.fromEntries(subjects.map(sub=>[sub,
   stage==='playing'&&currentId===me?(
    bs.length===0?[{level:0,x:0}]:[
     ...(bs.length<8?[{level:0,x:min-1},{level:0,x:max+1}]:[]),
     ...board.filter(p=>p.level===0&&board.some(n=>n.level===0&&n.x===p.x+1))
       .filter(p=>p.subject===sub||board.some(n=>n.level===0&&n.x===p.x+1&&n.subject===sub))
       .map(p=>({level:1,x:p.x})).filter(p=>!board.some(n=>n.level===1&&n.x===p.x))
    ]):[]
  ]));
  const viewMembers=members.map((m,i)=>({...m,score:i===0?0:i*2,
   cards:i===0?Object.values(state.hand).reduce((a,b)=>a+b,0):i+4,active:true}));
  room.tower={
   stage,round,totalRounds:members.length,startId:me,currentId,
   movesMade:state.moves,board:[...board],
   bottom:{count:bs.length,min,max},members:viewMembers,lastEvent:state.moves?{kind:'placed',id:me,subject:board.at(-1)?.subject||'japanese'}:null,
   myTurn:stage==='playing'&&currentId===me,
   myHand:['roundIntro','playing'].includes(stage)?{...state.hand}:null,
   choices:stage==='playing'&&currentId===me?choices:null,
   outcomes:['roundResult','finished'].includes(stage)?Object.fromEntries(ids.map((id,i)=>[id,{kind:i===0?'clear':'stuck',returned:i===0?2:0,remaining:i*2}])):null,
   rankings:stage==='finished'?[...viewMembers].sort((a,b)=>a.score-b.score):null
  };
 }
 if(game==='link-burst'){
  const self={
   board:[...state.linkBoard],piece:stage==='playing'?{...state.linkPiece}:null,
   next:[{a:'yellow',b:'green'},{a:'red',b:'blue'}],
   phase:stage==='playing'?'falling':'interturn',score:state.score,pieces:8,maxLink:3,
   combo:0,link:3,burst:[],incoming:state.incoming,sent:4,countered:2,
   notice:'',over:stage==='finished'&&state.role==='guest',elapsed:40
  };
  const opponent={...self,board:[...state.opponentBoard],piece:stage==='playing'?{a:'yellow',b:'green',x:3,y:3,rot:1}:null,
   score:state.opponentScore,incoming:4,sent:6,notice:'',over:stage==='finished'&&state.role!=='guest'};
  room.link={
   stage,members:room.members,meId:me,opponentId:other,
   countdown:stage==='countdown'?2500:0,sequence:state.moves,
   self,opponent,winners:stage==='finished'?[me]:[],reason:'サンプル対戦終了'
  };
 }
 return room;
}
function emit(){
 if(!connection||connection.readyState!==1)return;
 const payload=JSON.stringify({type:'room',room:snapshot()});
 queueMicrotask(()=>{if(connection?.readyState===1)connection.onmessage?.({data:payload})});
 updateTools();
}
function choosePitaVariant(variant){
 if(game!=='pitadome-challenge'||!['basic','short','long','blind','fast','variable','reverse','reference','150','200'].includes(variant))return false;
 state.pitaVariant=variant;choose('playing');return true;
}
function choose(stage){
 if(!Object.hasOwn(labels[game],stage))return;
 state.stage=stage;state.mySubmitted=false;state.submittedCount=0;state.shown=[];
 state.seen=false;
 if(game==='pitadome-challenge'&&stage==='playing'){
  drawPitaPreviewTarget();state.pitaStartedAt=Date.now()+PITA_PREVIEW_PREP_MS;
 }
 if(game==='kyokasho-tower'&&['roundResult','finished'].includes(stage)&&!state.board.length){
  state.board=[{level:0,x:0,subject:'japanese'},{level:0,x:1,subject:'math'},{level:1,x:0,subject:'japanese'}];
 }
 emit();
}
function handle(data){
 const type=data?.type||'';
 if(type==='leave'||(type.endsWith('-stop')&&type!=='pita-stop')||type==='pita-stop-game'||type==='link-stop'||type==='meter-stop'||type==='tower-stop'){
  reset();emit();return;
 }
 if(game==='minna-wa-docchi'){
  if(type==='secret-mode'){state.mode=data.mode||'secret'}
  if(type==='secret-config'){state.settings.categories=data.categories||categories;state.settings.roundCount=data.roundCount||5}
  if(type==='secret-custom-add'&&data.question)state.customTopics.push({...data.question});
  if(type==='secret-custom-delete')state.customTopics.splice(data.index,1);
  if(type==='secret-use-question'&&data.question)state.topic={...data.question};
  if(type==='secret-begin'||type==='secret-next'){
   if(type==='secret-next')state.question++;
   state.round=Math.min(5,state.round+(type==='secret-next'?1:0));
   state.stage=state.round>=5&&type==='secret-next'?'finished':'preview';
   state.answers=0;state.mySubmitted=false;
  }
  if(type==='secret-change-question')state.question++;
  if(type==='secret-accept-question')state.stage='voting';
  if(type==='secret-vote'){state.answers=members.length;state.mySubmitted=true;state.stage='allAnswered'}
  if(type==='battle-predict')state.stage='allAnswered';
  if(type==='secret-reveal')state.stage='result';
 }
 if(game==='word-wolf'){
  if(type==='wolf-config'&&data.settings)state.wolfSettings={...data.settings};
  if(type==='wolf-begin')state.stage=state.wolfSettings.source==='custom'?'customInput':'reveal';
  if(type==='wolf-custom-topics')state.stage='reveal';
  if(type==='wolf-word-done'){state.stage='discussion';state.seen=true}
  if(type==='wolf-start-vote')state.stage='voting';
  if(type==='wolf-vote'){state.stage='voteComplete';state.mySubmitted=true;state.submittedCount=ids.length}
  if(type==='wolf-runoff')state.stage='voting';
  if(type==='wolf-publish')state.stage='result';
  if(type==='wolf-skip-guess'||type==='wolf-guess')state.stage='result';
  if(type==='wolf-again')state.stage='setup';
 }
 if(game==='pitadome-challenge'){
  if(type==='pita-difficulty'&&state.stage==='setup'&&['easy','normal'].includes(data.difficulty))state.pitaDifficulty=data.difficulty;
  if(type==='pita-begin'){state.stage='playing';drawPitaPreviewTarget();state.pitaStartedAt=Date.now()+PITA_PREVIEW_PREP_MS}
  if(type==='pita-stop'||type==='pita-close'){state.stage='review';state.mySubmitted=true;state.submittedCount=ids.length}
  if(type==='pita-next'){
   state.stage=state.round>=5?'finished':'playing';state.round++;
   if(state.stage==='playing')drawPitaPreviewTarget();
   state.pitaStartedAt=Date.now()+PITA_PREVIEW_PREP_MS;
   state.mySubmitted=false;state.submittedCount=0;
  }
 }
 if(game==='kankaku-meter'){
  if(type==='meter-config'&&data.settings)state.settings={...data.settings};
  if(type==='meter-add-topic'&&data.topic)state.customTopics.push({...data.topic,category:'みんなのお題'});
  if(type==='meter-delete-topic')state.customTopics.splice(data.index,1);
  if(type==='meter-begin')state.stage='preview';
  if(type==='meter-change-topic')state.topic={...state.topic,q:'夏休みにしてみたいことは？'};
  if(type==='meter-use-topic'&&data.topic)state.topic={...data.topic,category:'みんなのお題'};
  if(type==='meter-deal')state.stage='reveal';
  if(type==='meter-seen'){state.seen=true;state.stage='arrange'}
  if(type==='meter-swap'&&Number.isInteger(data.index)){
   const a=data.index,b=a+data.direction;
   if(a>=0&&b>=0&&b<state.order.length)
    [state.order[a],state.order[b]]=[state.order[b],state.order[a]];
  }
  if(type==='meter-finalize')state.stage='result';
  if(type==='meter-show'&&ids.includes(data.memberId)&&!state.shown.includes(data.memberId))state.shown.push(data.memberId);
  if(type==='meter-next'){state.stage=state.round>=5?'finished':'preview';state.round++}
 }
 if(game==='kyokasho-tower'){
  if(type==='tower-begin')state.stage='roundIntro';
  if(type==='tower-round-start')state.stage='playing';
  if(type==='tower-place'&&subjects.includes(data.subject)&&state.hand[data.subject]>0){
   state.board.push({subject:data.subject,level:data.level,x:data.x});
   state.hand[data.subject]--;state.moves++;
   if(state.moves>=9)state.stage='roundResult';
  }
  if(type==='tower-next'){
   if(state.round>=members.length)state.stage='finished';
   else{state.round++;state.board=[];state.moves=0;state.hand=emptyHand();state.stage='roundIntro'}
  }
 }
 if(game==='link-burst'){
  if(type==='link-begin'||type==='link-resume')state.stage='countdown';
  if(type==='link-control'&&state.stage==='playing'&&data.pressed){
   const p=state.linkPiece;
   if(data.action==='left')p.x=Math.max(0,p.x-1);
   if(data.action==='right')p.x=Math.min(6,p.x+1);
   if(data.action==='rotate')p.rot=(p.rot+1)%4;
   if(data.action==='down')p.y=Math.min(10,p.y+1);
   state.moves++;state.score+=10;
  }
 }
 emit();
}
class DemoWebSocket{
 static CONNECTING=0;static OPEN=1;static CLOSING=2;static CLOSED=3;
 constructor(_url){
  this.readyState=0;this.onopen=null;this.onmessage=null;this.onclose=null;this.onerror=null;
  openSockets.add(this);connection=this;
  queueMicrotask(()=>{
   if(this.readyState!==0)return;
   this.readyState=1;this.onopen?.({});
   const payload=JSON.stringify({type:'welcome',selfId:me,room:snapshot()});
   queueMicrotask(()=>{if(this.readyState===1)this.onmessage?.({data:payload})});
  });
 }
 send(payload){
  if(this.readyState!==1)throw new Error('Preview socket closed');
  let parsed;try{parsed=JSON.parse(payload)}catch{return}
  queueMicrotask(()=>handle(parsed));
 }
 close(){
  if(this.readyState===3)return;
  this.readyState=3;openSockets.delete(this);
  if(connection===this)connection=null;
 }
}
window.WebSocket=DemoWebSocket;
function tools(){
 if(toolbar)return;
 const el=document.createElement('aside');el.className='hog-demo-tools';
 const stageButtons=Object.entries(labels[game]).map(([key,label])=>
  '<button type="button" data-demo-stage="'+key+'">'+label+'</button>').join('');
 el.innerHTML='<details class="hog-demo-details" id="hog-demo-details">'+
 '<summary><strong>試遊モード</strong><span id="hog-demo-status"></span></summary>'+
 '<div class="hog-demo-body"><div class="hog-demo-label">'+names[game]+'｜画面切替</div>'+
 '<div class="hog-demo-grid">'+stageButtons+'</div>'+
 '<div class="hog-demo-label">操作する立場</div>'+
 '<div class="hog-demo-grid two"><button type="button" data-demo-role="host">ホスト</button>'+
 '<button type="button" data-demo-role="guest">参加者</button></div>'+
 (game==='pitadome-challenge'?'<div class="hog-demo-label">ピタ止め：メーター確認（試遊用）</div>'+
 '<div class="hog-demo-grid">'+
 [['basic','基本'],['short','短尺'],['long','長尺'],['blind','隠し'],['fast','高速'],['variable','変速'],['reverse','折り返し'],['reference','基準変更'],['150','上限150'],['200','上限200']]
  .map(([key,title])=>'<button type="button" data-demo-pita="'+key+'">'+title+'</button>').join('')+'</div>':'')+
 (game==='minna-wa-docchi'?'<div class="hog-demo-label">ゲームモード</div><div class="hog-demo-grid two">'+
 '<button type="button" data-demo-mode="secret">ひみつ投票</button>'+
 '<button type="button" data-demo-mode="battle">よみあいバトル</button></div>':'')+
 '<div class="hog-demo-grid two"><button type="button" data-demo-reset>最初から</button>'+
 '<a class="hog-demo-menu" href="../preview/">ゲームを選び直す</a></div>'+
 '<p class="hog-demo-help">実際のオンライン画面をローカルの仮データで表示。ほかの端末との同期・通信速度・勝敗の正確さを検証するものではありません。</p>'+
 '</div></details>';
 document.body.appendChild(el);toolbar=el;
 el.addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b)return;
  if(b.dataset.demoStage){choose(b.dataset.demoStage);el.querySelector('details').open=false}
  else if(b.dataset.demoRole){state.role=b.dataset.demoRole;emit()}
  else if(b.dataset.demoMode){state.mode=b.dataset.demoMode;choose('setup')}
  else if(b.dataset.demoPita){choosePitaVariant(b.dataset.demoPita);el.querySelector('details').open=false}
  else if(b.hasAttribute('data-demo-reset')){reset();emit()}
 });
 updateTools();
}
function updateTools(){
 if(!toolbar)return;
 const status=toolbar.querySelector('#hog-demo-status');
 if(status)status.textContent=labels[game][state.stage]||'確認中';
 toolbar.querySelectorAll('[data-demo-stage]').forEach(b=>{
  b.classList.toggle('selected',b.dataset.demoStage===state.stage);
  b.setAttribute('aria-pressed',String(b.dataset.demoStage===state.stage));
 });
 toolbar.querySelectorAll('[data-demo-role]').forEach(b=>{
  b.classList.toggle('selected',b.dataset.demoRole===state.role);
 });
 toolbar.querySelectorAll('[data-demo-pita]').forEach(b=>b.classList.toggle('selected',b.dataset.demoPita===state.pitaVariant));
 toolbar.querySelectorAll('[data-demo-mode]').forEach(b=>{
  b.classList.toggle('selected',b.dataset.demoMode===state.mode);
 });
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',tools,{once:true});
else tools();
window.HoukagoOfflinePreview=Object.freeze({session,get stage(){return state.stage},
 get game(){return game},snapshot,choose,choosePitaVariant,handle,labels:labels[game]});
})();