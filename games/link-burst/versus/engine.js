/* Link Burst versus: standalone two-board rules. No JAM in phase 2.
   Pure per-player state: no global solo state, saves or game records. */
(function(global){
  'use strict';
  const COLS=7,ROWS=15,HIDDEN=2,LOCK_MS=300;
  const COLORS=['blue','red','yellow','green','purple'];
  const SYMBOL={blue:'○',red:'△',yellow:'★',green:'◇',purple:'♠'};
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
  function fill(st){while(st.queue.length<3)st.queue.push(template())}
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
  function make(player){
    const st={player:player||null,board:board(),piece:null,queue:[],score:0,maxLink:0,maxCombo:0,
      clears:0,pieces:0,over:false,phase:'falling',fallMs:0,lockMs:0,phaseMs:0,
      link:0,groups:[],currentCombo:0,flashMs:0};
    fill(st);spawn(st);
    return st;
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
      if(!color||seen[y][x])continue;
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
  function topOut(st){
    for(let y=0;y<HIDDEN;y++)for(let x=0;x<COLS;x++)if(st.board[y][x])return true;
    return false;
  }
  function scan(st){
    const groups=findGroups(st);
    if(groups.length){
      st.groups=groups;st.phase='charge';st.phaseMs=260;return;
    }
    st.groups=[];st.link=0;st.phaseMs=0;
    if(topOut(st)){st.over=true;st.phase='over';st.piece=null;return}
    spawn(st);
  }
  function lock(st){
    if(st.phase!=='falling'||!st.piece)return;
    for(const c of cells(st.piece,st.piece.x,st.piece.y,st.piece.rot))st.board[c.y][c.x]=c.color;
    st.piece=null;st.pieces++;
    compress(st);
    st.link=0;
    scan(st);
  }
  function finishClear(st){
    if(st.phase!=='charge')return;
    const groups=st.groups,total=groups.reduce(function(n,g){return n+g.length},0);
    const combo=groups.length,link=st.link+1;
    st.score+=scoreGain(total,link,combo);
    st.maxLink=Math.max(st.maxLink,link);
    st.maxCombo=Math.max(st.maxCombo,combo);
    st.clears+=total;st.link=link;
    for(const g of groups)for(const p of g)st.board[p.y][p.x]=null;
    st.groups=[];
    compress(st);
    st.phase='settle';
    st.phaseMs=220;
    st.flashMs=400;
  }
  function speed(st){
    const steps=st.pieces<20?0:Math.floor((st.pieces-20)/8)+1;
    return Math.max(120,820-steps*40);
  }
  function tick(st,dt,softDrop){
    if(st.over)return;
    dt=Math.max(0,Math.min(50,Number(dt)||0));
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
    if(!st.piece)return;
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
    findGroups:findGroups,scoreGain:scoreGain,speed:speed
  });
})(window);
