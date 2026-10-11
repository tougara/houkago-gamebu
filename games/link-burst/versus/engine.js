/* Link Burst versus: JAM + COUNTER trial engine, separate from solo mode. */
(function(global){
  'use strict';
  const COLS=7,ROWS=15,HIDDEN=2,LOCK_MS=300;
  const COLORS=['blue','red','yellow','green'];
  const SYMBOL={blue:'○',red:'△',yellow:'★',green:'◇',jam:'J'};
  const ATTACK=[0,0,1,3,6,10,14,18,21],JAM_WAVE=7,ATTACK_MAX=21;
  const ROT=[[[0,0],[1,0]],[[0,0],[0,1]],[[0,0],[-1,0]],[[0,0],[0,-1]]];
  function board(){return Array.from({length:ROWS},()=>Array(COLS).fill(null))}
  function cells(piece,x,y,rot){
    return ROT[rot].map(function(p,i){return{x:x+p[0],y:y+p[1],color:i?piece.b:piece.a}});
  }
  function fits(st,x,y,rot){
    if(!st.piece)return false;
    return cells(st.piece,x,y,rot).every(function(c){
      return c.x>=0&&c.x<COLS&&c.y>=0&&c.y<ROWS&&!st.board[c.y][c.x];
    });
  }
  function template(){
    return {a:COLORS[Math.floor(Math.random()*COLORS.length)],b:COLORS[Math.floor(Math.random()*COLORS.length)]};
  }
  function fill(st){while(st.queue.length<3){
    const given=st.pairSource?st.pairSource(st.pairIndex++):null;
    const pair=given&&COLORS.includes(given.a)&&COLORS.includes(given.b)?given:template();
    st.queue.push({a:pair.a,b:pair.b});
  }}
  function spawn(st){
    fill(st);
    const pair=st.queue.shift();
    fill(st);
    st.piece={x:3,y:1,rot:1,a:pair.a,b:pair.b};
    st.fallMs=0;st.lockMs=0;
    if(!fits(st,3,1,1)){st.over=true;st.piece=null;st.phase='over';return false}
    st.phase='falling';
    return true;
  }
  function make(player,pairSource){
    const st={player:player||null,board:board(),piece:null,queue:[],score:0,maxLink:0,maxCombo:0,
      clears:0,pieces:0,over:false,phase:'falling',fallMs:0,lockMs:0,phaseMs:0,
      link:0,groups:[],currentCombo:0,flashMs:0,
      elapsedMs:0,turnMaxCombo:0,readyAttack:0,jamQueue:[],jamCursor:0,
      receivedJam:0,sentJam:0,counteredJam:0,clearedJam:0,notice:'',noticeMs:0,
      pairSource:typeof pairSource==='function'?pairSource:null,pairIndex:0};
    fill(st);spawn(st);return st;
  }
  function move(st,dx){
    if(st.phase!=='falling'||!st.piece)return false;
    if(!fits(st,st.piece.x+dx,st.piece.y,st.piece.rot))return false;
    st.piece.x+=dx;st.lockMs=0;return true;
  }
  function rotate(st){
    if(st.phase!=='falling'||!st.piece)return false;
    const next=(st.piece.rot+1)%4;
    for(const dx of [0,-1,1]){
      if(fits(st,st.piece.x+dx,st.piece.y,next)){
        st.piece.x+=dx;st.piece.rot=next;st.lockMs=0;return true;
      }
    }
    return false;
  }
  function down(st){
    if(st.phase!=='falling'||!st.piece)return false;
    if(!fits(st,st.piece.x,st.piece.y+1,st.piece.rot))return false;
    st.piece.y++;st.fallMs=0;st.lockMs=0;return true;
  }
  function compress(st){
    for(let x=0;x<COLS;x++){
      let target=ROWS-1;
      for(let y=ROWS-1;y>=0;y--){
        const color=st.board[y][x];
        if(color){if(y!==target){st.board[target][x]=color;st.board[y][x]=null}target--}
      }
    }
  }
  function findGroups(st){
    const seen=Array.from({length:ROWS},()=>Array(COLS).fill(false));
    const groups=[];
    for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++){
      const color=st.board[y][x];
      if(!COLORS.includes(color)||seen[y][x])continue;
      const group=[],q=[[x,y]];seen[y][x]=true;
      for(let i=0;i<q.length;i++){
        const pos=q[i],px=pos[0],py=pos[1];
        group.push({x:px,y:py});
        for(const d of [[1,0],[-1,0],[0,1],[0,-1]]){
          const nx=px+d[0],ny=py+d[1];
          if(nx<0||nx>=COLS||ny<0||ny>=ROWS||seen[ny][nx])continue;
          if(st.board[ny][nx]===color){seen[ny][nx]=true;q.push([nx,ny])}
        }
      }
      if(group.length>=4)groups.push(group);
    }
    return groups;
  }
  function scoreGain(cleared,link,combo){
    return cleared*100*link+Math.max(0,combo-1)*400+Math.max(0,cleared-4)*50;
  }
  function attackFor(link,maxCombo){
    if(link<=0)return 0;
    const base=ATTACK[Math.min(link,8)];
    return Math.min(ATTACK_MAX,base+Math.min(2,Math.max(0,maxCombo-1)));
  }
  function topOut(st){
    for(let y=0;y<HIDDEN;y++)for(let x=0;x<COLS;x++)if(st.board[y][x])return true;
    return false;
  }
  function scan(st){
    const groups=findGroups(st);
    if(groups.length){
      st.groups=groups;st.phase='charge';st.phaseMs=260;return;
    }
    st.groups=[];st.phaseMs=0;
    if(topOut(st)){st.over=true;st.phase='over';st.piece=null;return}
    // Hold at a safe boundary until both boards' attacks have been resolved.
    st.readyAttack=attackFor(st.link,st.turnMaxCombo);
    st.phase='interturn';st.piece=null;
  }
  function lock(st){
    if(st.phase!=='falling'||!st.piece)return;
    for(const c of cells(st.piece,st.piece.x,st.piece.y,st.piece.rot))st.board[c.y][c.x]=c.color;
    st.piece=null;st.pieces++;
    compress(st);
    st.link=0;st.turnMaxCombo=0;st.readyAttack=0;
    scan(st);
  }
  function finishClear(st){
    if(st.phase!=='charge')return;
    const groups=st.groups,total=groups.reduce(function(n,g){return n+g.length},0);
    const combo=groups.length,link=st.link+1;
    st.score+=scoreGain(total,link,combo);
    st.maxLink=Math.max(st.maxLink,link);
    st.maxCombo=Math.max(st.maxCombo,combo);
    st.turnMaxCombo=Math.max(st.turnMaxCombo,combo);
    st.clears+=total;st.link=link;
    // Only JAM directly touching a cleared COLOR disappears; no diagonal or chain explosion.
    const adjacentJam=new Set();
    for(const g of groups)for(const p of g)for(const d of [[1,0],[-1,0],[0,1],[0,-1]]){
      const x=p.x+d[0],y=p.y+d[1];
      if(x>=0&&x<COLS&&y>=0&&y<ROWS&&st.board[y][x]==='jam')adjacentJam.add(y+':'+x);
    }
    for(const g of groups)for(const p of g)st.board[p.y][p.x]=null;
    for(const key of adjacentJam){
      const pos=key.split(':');st.board[Number(pos[0])][Number(pos[1])]=null;
    }
    st.clearedJam+=adjacentJam.size;
    st.groups=[];
    compress(st);
    st.phase='settle';
    st.phaseMs=220;
    st.flashMs=400;
  }
  function speed(st){
    const steps=st.pieces<20?0:Math.floor((st.pieces-20)/8)+1;
    const byPieces=Math.max(120,820-steps*40);
    // Continuous speed-up at 90,150,210,270,330 seconds, without sudden jumps.
    const minute=st.elapsedMs/60000,points=[[0,820],[1.5,700],[2.5,560],[3.5,430],[4.5,320],[5.5,240]];
    let timed=points[points.length-1][1];
    if(minute<=0)timed=820;
    else for(let i=1;i<points.length;i++)if(minute<=points[i][0]){
      const a=points[i-1],b=points[i];
      timed=a[1]+(b[1]-a[1])*(minute-a[0])/(b[0]-a[0]);break;
    }
    return Math.max(120,Math.round(Math.min(byPieces,timed)));
  }
  function notice(st,msg){st.notice=String(msg||'');st.noticeMs=1550;}
  function incomingCount(st){return st.jamQueue.reduce(function(n,b){return n+b.count},0);}
  function counterJam(st,attack){
    let left=Math.max(0,Math.floor(attack)),countered=0;
    for(const batch of st.jamQueue){
      const used=Math.min(left,batch.count);
      batch.count-=used;left-=used;countered+=used;
      if(!left)break;
    }
    st.jamQueue=st.jamQueue.filter(function(b){return b.count>0});
    st.counteredJam+=countered;
    if(countered)notice(st,'COUNTER −'+countered);
    return {remaining:left,countered};
  }
  function queueJam(st,count){
    count=Math.max(0,Math.floor(Number(count)||0));
    if(!count||st.over)return;
    // An already falling pair never counts as the mandatory new defensive pair.
    const delay=st.phase==='falling'?2:1;
    st.jamQueue.push({count,readyAfter:st.pieces+delay});
    st.receivedJam+=count;
  }
  function dropDueJam(st){
    let room=JAM_WAVE,dropped=0;
    for(const batch of st.jamQueue){
      if(!room)break;
      if(batch.readyAfter>st.pieces)continue;
      const take=Math.min(room,batch.count);
      batch.count-=take;room-=take;
      for(let j=0;j<take;j++){
        const x=st.jamCursor++%COLS;
        let y=ROWS-1;
        while(y>=0&&st.board[y][x])y--;
        if(y<0){st.over=true;st.piece=null;st.phase='over';return dropped;}
        st.board[y][x]='jam';dropped++;
      }
    }
    st.jamQueue=st.jamQueue.filter(function(b){return b.count>0});
    if(dropped){compress(st);notice(st,'JAM ×'+dropped);}
    return dropped;
  }
  function finishTurn(st){
    if(st.over||st.phase!=='interturn')return false;
    st.readyAttack=0;st.link=0;st.turnMaxCombo=0;
    dropDueJam(st);
    if(st.over)return false;
    if(topOut(st)){st.over=true;st.phase='over';st.piece=null;return false;}
    return spawn(st);
  }
  function tick(st,dt,softDrop){
    if(st.over)return;
    dt=Math.max(0,Math.min(50,Number(dt)||0));
    st.elapsedMs+=dt;
    st.noticeMs=Math.max(0,st.noticeMs-dt);
    if(st.noticeMs<=0)st.notice='';
    st.flashMs=Math.max(0,st.flashMs-dt);
    if(st.phase==='charge'){
      st.phaseMs-=dt;
      if(st.phaseMs<=0)finishClear(st);
      return;
    }
    if(st.phase==='settle'){
      st.phaseMs-=dt;
      if(st.phaseMs<=0)scan(st);
      return;
    }
    if(st.phase!=='falling'||!st.piece)return;
    if(fits(st,st.piece.x,st.piece.y+1,st.piece.rot)){
      st.lockMs=0;st.fallMs+=dt;
      const interval=softDrop?65:speed(st);
      if(st.fallMs>=interval){st.piece.y++;st.fallMs=0}
    }else{
      st.fallMs=0;st.lockMs+=dt;
      if(st.lockMs>=LOCK_MS)lock(st);
    }
  }
  function ghost(st){
    const result=new Map();
    if(st.phase!=='falling'||!st.piece)return result;
    const p=st.piece;
    let landingY=p.y;
    while(fits(st,p.x,landingY+1,p.rot))landingY++;
    const copy=st.board.map(function(row){return row.slice()});
    const marks=cells(p,p.x,landingY,p.rot).map(function(c){return{y:c.y,x:c.x,color:c.color,id:{c:c.color}}});
    for(const m of marks)copy[m.y][m.x]=m.id;
    let moving=true,count=0;
    while(moving&&count++<ROWS+2){
      moving=false;
      for(let y=ROWS-2;y>=0;y--)for(let x=0;x<COLS;x++)if(copy[y][x]&&!copy[y+1][x]){
        copy[y+1][x]=copy[y][x];copy[y][x]=null;moving=true;
      }
    }
    for(let y=HIDDEN;y<ROWS;y++)for(let x=0;x<COLS;x++){
      const m=marks.find(function(v){return v.id===copy[y][x]});
      if(m)result.set(y+':'+x,m.color);
    }
    return result;
  }
  global.LinkBurstVersusEngine=Object.freeze({
    COLS:COLS,ROWS:ROWS,HIDDEN:HIDDEN,COLORS:COLORS,SYMBOL:SYMBOL,
    make:make,move:move,rotate:rotate,down:down,tick:tick,ghost:ghost,
    findGroups:findGroups,scoreGain:scoreGain,speed:speed,
    attackFor,counterJam,queueJam,incomingCount,finishTurn,notice
  });
})(window);
