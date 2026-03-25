import { useRef, useState, useEffect, useCallback } from 'react'
import { useSound } from './useSound'

const W=3200,H=3200,SEG=20,TICK=80,MAX_BOTS=14
const KCX=W/2,KCY=H/2,KR=210
const COLS=['#c8ff00','#00e5ff','#ff1744','#ffab00','#d500f9','#ff8800','#44ffcc','#ff44aa','#aaff00','#ff6644']
const BNAMES=['VenomX','NullFang','GridBeast','HexCoil','ByteViper','CyberSurge','DataReaper','GhostLoop','LaserKing','IronCoil','ShadowBit','PulseSnek','ZeroFang','NetCrawl']

export function useGameEngine({ onKill, onLevelUp, onDeath, onSessionEnd }) {
  const canvasRef = useRef(null)
  const mmapRef   = useRef(null)
  const { sfx, wakeAC } = useSound()
  const G = useRef(null)

  const [hud, setHud] = useState({
    score:0,level:1,xp:0,kills:0,alive:1,boostE:100,
    combo:0,timer:'',leaderboard:[],
    abCD:{dash:0,ghost:0,trap:0,venom:0},
    puActive:{},kothPct:0,royalR:3200,
  })

  function initG(mode, skinColor, skinTrail, playerName) {
    return {
      snakes:[],food:[],mines:[],pups:[],parts:[],
      ps:null, running:false,
      camX:0,camY:0,shakeX:0,shakeY:0,shakeMag:0,
      tickAcc:0,lastTS:0,rafId:0,
      keys:{},pendingDir:null,boostHeld:false,
      mode, map:mode==='maze'?'maze':'arena',
      mTimer:180000,kothSc:0,royalR:Math.max(W,H),
      pKills:0,pXP:0,pLv:1,pMaxLen:1,pScore:0,
      sTime:0,sNoHit:0,sPU:0,
      abCD:{dash:0,ghost:0,trap:0,venom:0},
      ghostOn:false,ghostT:0,dashOn:false,dashT:0,venomOn:false,
      puState:{magnet:0,shield:0,speed:0,x2:0,mini:0},
      combo:0,comboT:0,lastKill:0,
      botAdaptLv:0,
      skinColor, skinTrail, playerName,
    }
  }

  const mkFood = useCallback(() => ({
    x:50+Math.random()*(W-100), y:50+Math.random()*(H-100),
    r:5+Math.random()*4, val:Math.random()<.06?5:Math.random()<.15?2:1,
    c:COLS[Math.floor(Math.random()*COLS.length)], p:Math.random()*Math.PI*2
  }), [])

  function mkSnake({isPlayer,name,color,trail,x,y,boss=false}) {
    const segs=[]
    for(let i=0;i<10;i++) segs.push({x:x-i*SEG,y,a:0})
    return {
      isPlayer,name,color,trail:trail||color,boss,
      segs,score:0,kills:0,alive:true,
      dir:{x:1,y:0},ndir:{x:1,y:0},
      boost:false,boostE:100,ghost:false,shield:false,
      venomFX:false,venomT:0,
      wiggle:0,wigSpd:.13+Math.random()*.09,
      wAngle:Math.random()*Math.PI*2,evTick:0,
      willCut:false,willBoostChase:false,
    }
  }

  function spawnBot(g,i,boss=false) {
    const m=280,x=m+Math.random()*(W-m*2),y=m+Math.random()*(H-m*2)
    const c=boss?'#ff1744':COLS[(i+2)%COLS.length]
    const s=mkSnake({isPlayer:false,name:boss?'⚡ BOSS':BNAMES[i%BNAMES.length],color:c,x,y,boss})
    if(boss) for(let k=0;k<50;k++) s.segs.push({...s.segs[s.segs.length-1]})
    s.willCut=g.botAdaptLv>=2&&Math.random()<.4
    s.willBoostChase=g.botAdaptLv>=1&&Math.random()<.6
    return s
  }

  function setDir(s,dx,dy){
    // Prevent 180 turn
    if(s.dir.x !== 0 && dx === -s.dir.x) return
    if(s.dir.y !== 0 && dy === -s.dir.y) return
    s.ndir={x:dx,y:dy}
  }

  function getNextXP(l){
    const R=[{l:1,xp:0},{l:2,xp:120},{l:3,xp:300},{l:4,xp:560},{l:5,xp:900},
             {l:6,xp:1350},{l:7,xp:1900},{l:8,xp:2700},{l:9,xp:3700},{l:10,xp:5000}]
    for(let i=0;i<R.length-1;i++) if(R[i].l===l) return R[i+1].xp
    return R[R.length-1].xp+(l-R[R.length-1].l)*2200
  }

  function addXP(g,n){
    g.pXP+=n
    while(g.pXP>=getNextXP(g.pLv)){
      g.pLv++; sfx.lvlup()
      onLevelUp?.({level:g.pLv})
    }
  }

  function burst(g,x,y,c,n){
    for(let i=0;i<n;i++){
      const a=Math.random()*Math.PI*2,s=.5+Math.random()*4.5
      g.parts.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:1,c,size:1.5+Math.random()*3.5})
    }
  }

  function shake(g,m){g.shakeMag=Math.max(g.shakeMag,m)}

  function killSnake(g,s,killer,cause='col'){
    if(!s.alive) return
    s.alive=false
    for(let i=0;i<s.segs.length;i+=2) g.food.push({x:s.segs[i].x,y:s.segs[i].y,r:7+Math.random()*3,val:2,c:s.color,p:Math.random()*Math.PI*2})
    burst(g,s.segs[0].x,s.segs[0].y,s.color,40)
    shake(g,killer?.isPlayer?12:7)
    if(killer){
      killer.score+=Math.floor(s.segs.length/2); killer.kills=(killer.kills||0)+1
      if(killer.isPlayer){
        g.pKills++; sfx.kill()
        const now=Date.now()
        if(now-g.lastKill<5000){g.combo++;g.comboT=5000;sfx.combo()} else{g.combo=1;g.comboT=5000}
        g.lastKill=now
        addXP(g,70+s.segs.length+g.combo*25)
        onKill?.({killerName:killer.name,victimName:s.name,combo:g.combo,cause})
      }
    }
    if(s.isPlayer){
      sfx.death(); g.sNoHit=0
      onDeath?.({killer,score:s.score,kills:g.pKills,level:g.pLv,maxLen:g.pMaxLen,combo:g.combo})
    } else {
      const idx=g.snakes.indexOf(s)
      setTimeout(()=>{if(idx!==-1) g.snakes[idx]=spawnBot(g,Math.floor(Math.random()*MAX_BOTS),s.boss)},3500+Math.random()*7000)
    }
  }

  function botAI(g,s){
    const h=s.segs[0],m=160
    if(h.x<m||h.x>W-m||h.y<m||h.y>H-m){
      const a=Math.atan2(H/2-h.y,W/2-h.x)
      setDir(s,Math.round(Math.cos(a)),Math.round(Math.sin(a)))
      s.evTick=10; return
    }
    if(s.evTick>0){s.evTick--;return}
    if(g.mode==='koth'&&Math.random()<.3){const dx=KCX-h.x,dy=KCY-h.y;Math.abs(dx)>Math.abs(dy)?setDir(s,dx>0?1:-1,0):setDir(s,0,dy>0?1:-1);return}
    if(g.mode==='royale'){const dx=KCX-h.x,dy=KCY-h.y,d=Math.sqrt(dx*dx+dy*dy);if(d>g.royalR-200){Math.abs(dx)>Math.abs(dy)?setDir(s,dx>0?1:-1,0):setDir(s,0,dy>0?1:-1);return}}
    if(s.boss&&g.ps?.alive){const ph=g.ps.segs[0],dx=ph.x-h.x,dy=ph.y-h.y;if(dx*dx+dy*dy<700**2){Math.abs(dx)>Math.abs(dy)?setDir(s,dx>0?1:-1,0):setDir(s,0,dy>0?1:-1);s.boost=s.boostE>15;return}}
    if(s.willCut&&g.ps?.alive&&g.botAdaptLv>=2){const ph=g.ps.segs[0],pd=g.ps.dir,px=ph.x+pd.x*SEG*3,py=ph.y+pd.y*SEG*3,dx=px-h.x,dy=py-h.y,d=Math.sqrt(dx*dx+dy*dy);if(d<400){Math.abs(dx)>Math.abs(dy)?setDir(s,dx>0?1:-1,0):setDir(s,0,dy>0?1:-1);s.boost=s.boostE>20&&s.willBoostChase;return}}
    let bf=null,bd=Infinity
    const samp=g.food.length>100?g.food.filter((_,i)=>i%5===0):g.food
    for(const f of samp){const dx=f.x-h.x,dy=f.y-h.y,d=dx*dx+dy*dy;if(d<bd){bd=d;bf=f}}
    if(bf){const dx=bf.x-h.x,dy=bf.y-h.y;Math.abs(dx)>Math.abs(dy)?setDir(s,dx>0?1:-1,0):setDir(s,0,dy>0?1:-1)}
    if(Math.random()<.022){s.wAngle+=(Math.random()-.5)*Math.PI;Math.random()<.5?setDir(s,Math.cos(s.wAngle)>0?1:-1,0):setDir(s,0,Math.sin(s.wAngle)>0?1:-1)}
    s.boost=bd<(SEG*11)**2&&s.boostE>18&&(s.willBoostChase||Math.random()<.3)
  }

  function step(g){
    if(g.ps && Math.random() < 0.02) console.log("PLAYER POSITION:", Math.round(g.ps.segs[0].x), Math.round(g.ps.segs[0].y));
    console.log("STEP RUNNING", g.ps?.dir);
    g.sTime+=TICK/1000; g.sNoHit+=TICK/1000
    if(g.mode==='deathmatch'){g.mTimer-=TICK;if(g.mTimer<=0){endGame(g,'DM_END');return}}
    if(g.mode==='koth'&&g.ps?.alive){
      const h=g.ps.segs[0],dx=h.x-KCX,dy=h.y-KCY
      if(dx*dx+dy*dy<KR*KR) g.kothSc+=TICK/1000
      if(g.kothSc>=60){endGame(g,'KOTH_WIN');return}
    }
    if(g.mode==='royale'){
      g.royalR=Math.max(220,g.royalR-TICK/1000*55)
      for(const s of g.snakes){if(!s.alive)continue;const h=s.segs[0],dx=h.x-KCX,dy=h.y-KCY;if(dx*dx+dy*dy>(g.royalR-8)**2) killSnake(g,s,null,'zone')}
    }
    for(const id of Object.keys(g.abCD)) if(g.abCD[id]>0) g.abCD[id]=Math.max(0,g.abCD[id]-TICK)
    if(g.ghostOn){g.ghostT-=TICK;if(g.ghostT<=0){g.ghostOn=false;if(g.ps)g.ps.ghost=false}}
    if(g.dashOn) {g.dashT -=TICK;if(g.dashT<=0) {g.dashOn=false; if(g.ps)g.ps.dash=false }}
    for(const id of Object.keys(g.puState)) if(g.puState[id]>0) g.puState[id]=Math.max(0,g.puState[id]-TICK)
    if(g.comboT>0){g.comboT-=TICK;if(g.comboT<=0) g.combo=0}
    for(let i=g.mines.length-1;i>=0;i--){g.mines[i].t-=TICK;if(g.mines[i].t<=0) g.mines.splice(i,1)}
    for(const s of g.snakes) if(s.venomFX){s.venomT-=TICK;if(s.venomT<=0) s.venomFX=false}
    g.botAdaptLv=Math.min(3,Math.floor(g.sTime/60))
    // Input
    if(g.ps?.alive){
      if(g.pendingDir){const d=g.pendingDir;g.pendingDir=null;setDir(g.ps,d.x,d.y)}
      else {
        if(g.keys['ArrowUp']  ||g.keys['w']||g.keys['W']) setDir(g.ps,0,-1)
        if(g.keys['ArrowDown'] ||g.keys['s']||g.keys['S']) setDir(g.ps,0,1)
        if(g.keys['ArrowLeft'] ||g.keys['a']||g.keys['A']) setDir(g.ps,-1,0)
        if(g.keys['ArrowRight']||g.keys['d']||g.keys['D']) setDir(g.ps,1,0)
      }
      g.ps.boost=(g.boostHeld||g.keys[' '])&&g.ps.boostE>0
      if(g.ps.boost) sfx.boost()
    }
    for(const s of g.snakes) if(!s.isPlayer&&s.alive) botAI(g,s)
    for(const s of g.snakes) if(s.alive) moveSnake(g,s)
    for(const s of g.snakes) if(s.alive) eatFood(g,s)
    if(g.ps?.alive){collectPU(g);if(g.puState.magnet>0) applyMagnet(g);if(g.venomOn) applyVenom(g)}
    checkMines(g); checkCol(g)
    g.shakeMag*=.82; if(g.shakeMag<.5) g.shakeMag=0
    g.shakeX=(Math.random()-.5)*g.shakeMag; g.shakeY=(Math.random()-.5)*g.shakeMag
    updateHUD(g)
  }

  function moveSnake(g,s){
    if(s.isPlayer) console.log("MOVE", s.dir, "pos:", s.segs[0].x, s.segs[0].y);
    s.dir={...s.ndir}
    s.wiggle+=s.wigSpd
    const vMult=s.venomFX?.45:1
    const spMult=s.dash?3:(g.puState.speed>0&&s.isPlayer?2:1)
    const spd=(s.boost&&s.boostE>0?SEG*1.85:SEG)*spMult*vMult
    const h=s.segs[0]
    s.segs.unshift({x:h.x+s.dir.x*spd, y:h.y+s.dir.y*spd, a:Math.atan2(s.dir.y,s.dir.x)})
    if(s.boost&&s.boostE>0){
      s.boostE=Math.max(0,s.boostE-4.5)
      if(s.segs.length>8){
        const sh=s.segs.pop()
        g.food.push({x:sh.x,y:sh.y,r:4,val:1,c:s.color,p:0})
      }
    } else {
      s.boostE=Math.min(100,s.boostE+1.8)
      s.segs.pop()
    }
  }

  function eatFood(g,s){
    const h=s.segs[0],rr=(SEG*1.18)**2
    for(let i=g.food.length-1;i>=0;i--){
      const f=g.food[i],dx=h.x-f.x,dy=h.y-f.y
      if(dx*dx+dy*dy<rr){
        g.food.splice(i,1); g.food.push(mkFood())
        const grow=f.val*4,tail=s.segs[s.segs.length-1]
        for(let k=0;k<grow;k++) s.segs.push({...tail})
        const pts=f.val*(g.puState.x2>0&&s.isPlayer?2:1)*(s.boss?4:1)
        s.score+=pts
        if(s.isPlayer){g.pScore=s.score;sfx.eat();addXP(g,pts);g.pMaxLen=Math.max(g.pMaxLen,s.segs.length);burst(g,f.x,f.y,f.c,5)}
        break
      }
    }
  }

  const PUTS_DEF=[{id:'magnet',ico:'🧲',c:'#ff44aa',dur:8000},{id:'shield',ico:'🛡️',c:'#00e5ff',dur:6000},{id:'speed',ico:'⚡',c:'#c8ff00',dur:5000},{id:'x2',ico:'✖️',c:'#00ffcc',dur:10000},{id:'mini',ico:'🔻',c:'#d500f9',dur:6000}]

  function collectPU(g){
    const h=g.ps.segs[0]
    for(let i=g.pups.length-1;i>=0;i--){
      const p=g.pups[i],dx=h.x-p.x,dy=h.y-p.y
      if(dx*dx+dy*dy<(SEG*2.8)**2){g.pups.splice(i,1);g.puState[p.id]=p.dur;if(p.id==='shield')g.ps.shield=true;burst(g,p.x,p.y,p.c,18);sfx.pu();shake(g,5);g.sPU++}
    }
  }

  function applyMagnet(g){const h=g.ps.segs[0];for(const f of g.food){const dx=h.x-f.x,dy=h.y-f.y,d=Math.sqrt(dx*dx+dy*dy);if(d<220&&d>2){f.x+=dx/d*5;f.y+=dy/d*5}}}
  function applyVenom(g){const h=g.ps.segs[0];for(const s of g.snakes){if(!s.alive||s===g.ps)continue;const sh=s.segs[0],dx=sh.x-h.x,dy=sh.y-h.y;if(dx*dx+dy*dy<160**2){s.venomFX=true;s.venomT=3000}}}

  function checkMines(g){
    for(let i=g.mines.length-1;i>=0;i--){
      const m=g.mines[i]
      for(const s of g.snakes){if(!s.alive||s===m.owner)continue;const h=s.segs[0],dx=h.x-m.x,dy=h.y-m.y;if(dx*dx+dy*dy<(SEG*2.2)**2){killSnake(g,s,m.owner,'mine');g.mines.splice(i,1);burst(g,m.x,m.y,'#ffab00',28);sfx.mine();shake(g,16);break}}
    }
  }

  function checkCol(g){
    const alive=g.snakes.filter(s=>s.alive)
    for(const s of alive){
      if(!s.alive||s.ghost)continue
      const h=s.segs[0]
      for(const o of alive){
        if(!o.alive)continue
        const body=s===o?o.segs.slice(6):o.segs
        for(const seg of body){
          const dx=h.x-seg.x,dy=h.y-seg.y
          if(dx*dx+dy*dy<(SEG*.74)**2){
            if(s.isPlayer&&s.shield){s.shield=false;g.puState.shield=0;shake(g,8);return}
            killSnake(g,s,s===o?null:o,'col');break
          }
        }
        if(!s.alive)break
      }
    }
  }

  function endGame(g,reason){
    g.running=false
    const earned=Math.floor((g.ps?.score||0)/8)+g.pKills*6+(g.pLv>1?(g.pLv-1)*10:0)
    onSessionEnd?.({reason,score:g.ps?.score||0,kills:g.pKills,level:g.pLv,maxLen:g.pMaxLen,combo:g.combo,time:g.sTime,coinsEarned:earned})
  }

  function getTimerText(g){
    if(g.mode==='deathmatch'){const s=Math.ceil(g.mTimer/1000),m=Math.floor(s/60);return `${m}:${String(s%60).padStart(2,'0')}`}
    if(g.mode==='royale') return `⭕ ${Math.round(g.royalR)}`
    return ''
  }

  function updateHUD(g){
    if(!g.ps) return
    const sorted=[...g.snakes].filter(s=>s.alive).sort((a,b)=>b.score-a.score).slice(0,10)
    setHud({
      score:g.ps.score, level:g.pLv, xp:g.pXP, kills:g.pKills,
      alive:g.snakes.filter(s=>s.alive).length, boostE:g.ps.boostE,
      combo:g.combo, timer:getTimerText(g),
      leaderboard:sorted.map((s,i)=>({id:i,name:s.name,color:s.color,score:s.score,isMe:s===g.ps,isBoss:s.boss})),
      abCD:{...g.abCD}, puActive:Object.fromEntries(Object.entries(g.puState).filter(([,v])=>v>0)),
      kothPct:g.mode==='koth'?(g.kothSc/60)*100:0, royalR:g.royalR,
    })
  }

  function render(g){
    const cvs=canvasRef.current; if(!cvs) return
    const ctx=cvs.getContext('2d'), cw=cvs.width, ch=cvs.height
    ctx.clearRect(0,0,cw,ch)
    const tgt=g.ps?.alive?g.ps.segs[0]:null
    if(tgt){g.camX+=(tgt.x-cw/2-g.camX)*.15;g.camY+=(tgt.y-ch/2-g.camY)*.15}
    ctx.save()
    ctx.translate(Math.round(-g.camX+g.shakeX),Math.round(-g.camY+g.shakeY))
    const bg=ctx.createRadialGradient(g.camX+cw/2,g.camY+ch/2,0,g.camX+cw/2,g.camY+ch/2,Math.max(cw,ch))
    bg.addColorStop(0,'#0c1525');bg.addColorStop(1,'#03050a')
    ctx.fillStyle=bg;ctx.fillRect(g.camX,g.camY,cw,ch)
    const gx0=Math.floor(g.camX/SEG)*SEG,gy0=Math.floor(g.camY/SEG)*SEG
    ctx.strokeStyle='rgba(0,229,255,0.04)';ctx.lineWidth=1
    for(let x=gx0;x<g.camX+cw+SEG;x+=SEG){ctx.beginPath();ctx.moveTo(x,g.camY);ctx.lineTo(x,g.camY+ch);ctx.stroke()}
    for(let y=gy0;y<g.camY+ch+SEG;y+=SEG){ctx.beginPath();ctx.moveTo(g.camX,y);ctx.lineTo(g.camX+cw,y);ctx.stroke()}
    ctx.strokeStyle='rgba(0,229,255,.3)';ctx.lineWidth=4;ctx.strokeRect(2,2,W-4,H-4)
    if(g.mode==='royale'){ctx.beginPath();ctx.arc(KCX,KCY,g.royalR,0,Math.PI*2);ctx.strokeStyle=`rgba(213,0,249,${.4+Math.sin(Date.now()*.003)*.2})`;ctx.lineWidth=4;ctx.stroke();ctx.save();ctx.beginPath();ctx.rect(g.camX,g.camY,cw,ch);ctx.arc(KCX,KCY,g.royalR,0,Math.PI*2,true);ctx.fillStyle='rgba(213,0,249,.04)';ctx.fill();ctx.restore()}
    if(g.mode==='koth'){const t=Date.now()*.001;ctx.beginPath();ctx.arc(KCX,KCY,KR,0,Math.PI*2);ctx.fillStyle='rgba(255,171,0,.04)';ctx.fill();ctx.strokeStyle=`rgba(255,171,0,${.3+Math.sin(t*2.5)*.2})`;ctx.lineWidth=3;ctx.stroke();ctx.font='bold 13px sans-serif';ctx.fillStyle='rgba(255,171,0,.7)';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('👑 KING ZONE',KCX,KCY-KR-16)}
    for(const m of g.mines){const t=Date.now()*.006;ctx.save();ctx.beginPath();ctx.arc(m.x,m.y,13+Math.sin(t)*2.5,0,Math.PI*2);ctx.fillStyle='rgba(255,100,0,.1)';ctx.fill();ctx.strokeStyle=`rgba(255,171,0,${.5+Math.sin(t)*.3})`;ctx.lineWidth=2;ctx.stroke();ctx.font='14px serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('💣',m.x,m.y);ctx.restore()}
    for(const p of g.pups){p.p+=.07;const pr=15+Math.sin(p.p)*3;ctx.save();ctx.beginPath();ctx.arc(p.x,p.y,pr,0,Math.PI*2);ctx.fillStyle=p.c+'18';ctx.fill();ctx.strokeStyle=p.c;ctx.lineWidth=2;ctx.shadowColor=p.c;ctx.shadowBlur=20;ctx.stroke();ctx.shadowBlur=0;ctx.font='16px serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(p.ico,p.x,p.y);ctx.restore()}
    for(const f of g.food){f.p+=.075;const pr=f.r+Math.sin(f.p)*2;ctx.beginPath();ctx.arc(f.x,f.y,pr,0,Math.PI*2);ctx.fillStyle=f.c;ctx.shadowColor=f.c;ctx.shadowBlur=11;ctx.fill();ctx.shadowBlur=0;if(f.val>1){ctx.font=`bold ${Math.round(pr+2)}px monospace`;ctx.fillStyle='#fff';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(f.val,f.x,f.y)}}
    for(let i=g.parts.length-1;i>=0;i--){const p=g.parts[i];p.x+=p.vx;p.y+=p.vy;p.vx*=.87;p.vy*=.87;p.life-=.042;if(p.life<=0){g.parts.splice(i,1);continue}ctx.beginPath();ctx.arc(p.x,p.y,p.size*p.life,0,Math.PI*2);ctx.fillStyle=p.c;ctx.globalAlpha=p.life*.85;ctx.fill();ctx.globalAlpha=1}
    const order=[...g.snakes.filter(s=>s.alive&&!s.isPlayer),...(g.ps?.alive?[g.ps]:[])]
    for(const s of order) drawSnake(ctx,g,s)
    ctx.restore()
    drawMinimap(g)
  }

  function drawSnake(ctx,g,s){
    const mini=g.puState.mini>0&&s.isPlayer
    const baseR=mini?SEG*.2:Math.min(SEG*.48,SEG*.3+s.segs.length*.004)
    const alpha=s.ghost?.25:1
    s.wiggle+=s.wigSpd
    for(let i=s.segs.length-1;i>=0;i--){
      const seg=s.segs[i],t=(s.segs.length-i)/s.segs.length
      const wAmp=SEG*.28*(1-Math.abs(t-.5)*1.5)
      const wo=i>0?Math.sin(s.wiggle-i*.38)*wAmp:0
      const px=-s.dir.y*wo,py=s.dir.x*wo
      const r=baseR*(i===0?1.25:.55+t*.45)
      const dx=seg.x+px,dy=seg.y+py
      if(i===0){
        ctx.globalAlpha=alpha;ctx.shadowColor=s.color;ctx.shadowBlur=s.isPlayer?30:s.boss?24:10
        ctx.beginPath();ctx.arc(dx,dy,r,0,Math.PI*2);ctx.fillStyle=s.color;ctx.fill();ctx.shadowBlur=0
        const ex=s.dir.x*r*.5,ey=s.dir.y*r*.5,ep={x:-s.dir.y*r*.42,y:s.dir.x*r*.42}
        for(const sd of[-1,1]){ctx.beginPath();ctx.arc(dx+ex+ep.x*sd,dy+ey+ep.y*sd,r*.3,0,Math.PI*2);ctx.fillStyle='#060c18';ctx.fill();ctx.beginPath();ctx.arc(dx+ex+ep.x*sd+s.dir.x*1.5,dy+ey+ep.y*sd+s.dir.y*1.5,r*.14,0,Math.PI*2);ctx.fillStyle='#fff';ctx.fill()}
        if(s.shield||(g.puState.shield>0&&s.isPlayer)){ctx.beginPath();ctx.arc(dx,dy,r*1.85,0,Math.PI*2);ctx.strokeStyle='rgba(0,229,255,.85)';ctx.lineWidth=2.5;ctx.shadowColor='#00e5ff';ctx.shadowBlur=16;ctx.stroke();ctx.shadowBlur=0}
        if(s.ghost){ctx.beginPath();ctx.arc(dx,dy,r*2.3,0,Math.PI*2);ctx.strokeStyle='rgba(213,0,249,.4)';ctx.lineWidth=2;ctx.stroke()}
        ctx.globalAlpha=.88;ctx.font=`bold ${s.boss?15:11}px sans-serif`;ctx.textAlign='center';ctx.textBaseline='bottom'
        ctx.fillStyle=s.boss?'#ff1744':s.isPlayer?'#c8ff00':'rgba(220,235,255,.85)'
        ctx.fillText(s.name,dx,dy-r*1.8)
        if(s.boss){ctx.font='15px serif';ctx.fillText('⚡',dx,dy-r*1.8-18)}
      } else {
        ctx.globalAlpha=alpha*(i===s.segs.length-1?.2:.28+t*.65)
        ctx.beginPath();ctx.arc(dx,dy,r,0,Math.PI*2);ctx.fillStyle=i%4===0?s.trail:s.color;ctx.fill()
      }
    }
    if(s.boost&&s.boostE>0){for(let t2=1;t2<Math.min(12,s.segs.length);t2++){const ts=s.segs[t2],wo=Math.sin(s.wiggle-t2*.38)*SEG*.2,px=-s.dir.y*wo,py=s.dir.x*wo;ctx.beginPath();ctx.arc(ts.x+px,ts.y+py,baseR*.55*(1-t2/12),0,Math.PI*2);ctx.fillStyle=s.trail;ctx.globalAlpha=.18*(1-t2/12);ctx.fill()}}
    ctx.globalAlpha=1
  }

  function drawMinimap(g){
    const cv=mmapRef.current;if(!cv)return
    const mx=cv.getContext('2d'),mw=cv.width,mh=cv.height,sx=mw/W,sy=mh/H
    mx.fillStyle='rgba(3,5,10,.93)';mx.fillRect(0,0,mw,mh)
    mx.strokeStyle='rgba(0,229,255,.2)';mx.strokeRect(0,0,mw,mh)
    mx.fillStyle='rgba(255,255,255,.14)';for(const f of g.food) mx.fillRect(f.x*sx-.5,f.y*sy-.5,1,1)
    for(const p of g.pups){mx.beginPath();mx.arc(p.x*sx,p.y*sy,3,0,Math.PI*2);mx.fillStyle=p.c;mx.fill()}
    if(g.mode==='koth'||g.mode==='royale'){mx.beginPath();mx.arc(KCX*sx,KCY*sy,(g.mode==='royale'?g.royalR:KR)*sx,0,Math.PI*2);mx.strokeStyle=g.mode==='royale'?'rgba(213,0,249,.45)':'rgba(255,171,0,.4)';mx.lineWidth=1;mx.stroke()}
    for(const s of g.snakes){if(!s.alive)continue;const h=s.segs[0];mx.beginPath();mx.arc(h.x*sx,h.y*sy,s.isPlayer?4.5:s.boss?4:2,0,Math.PI*2);mx.fillStyle=s.color;mx.fill()}
    const cvs=canvasRef.current;if(cvs){mx.strokeStyle='rgba(255,255,255,.14)';mx.lineWidth=1;mx.strokeRect(g.camX*sx,g.camY*sy,cvs.width*sx,cvs.height*sy)}
  }

  function loop(ts){
    const g=G.current;if(!g)return
    g.rafId=requestAnimationFrame(loop)
    const dt=Math.min(ts-g.lastTS,150);g.lastTS=ts
    if(!g.running)return
    g.tickAcc+=dt;while(g.tickAcc>=TICK){g.tickAcc-=TICK;step(g)}
    render(g)
  }

  // ── Public API ────────────────────────────────────────────
  const startGame = useCallback((opts={}) => {
    wakeAC()
    const {mode='survival',playerName='WARRIOR',skinColor='#c8ff00',skinTrail='#c8ff00'}=opts
    const g=initG(mode,skinColor,skinTrail,playerName)
    G.current=g
    g.food=[];for(let i=0;i<500;i++) g.food.push(mkFood())
    g.ps=mkSnake({isPlayer:true,name:playerName,color:skinColor,trail:skinTrail,x:W/2,y:H/2})
    g.snakes=[g.ps]
    for(let i=0;i<MAX_BOTS;i++) g.snakes.push(spawnBot(g,i))
    if(mode!=='koth'&&mode!=='teams') g.snakes.push(spawnBot(g,99,true))
    for(let i=0;i<4;i++){const t=PUTS_DEF[Math.floor(Math.random()*PUTS_DEF.length)];g.pups.push({x:80+Math.random()*(W-160),y:80+Math.random()*(H-160),...t,p:0})}
    const cvs=canvasRef.current
    if(cvs){g.camX=g.ps.segs[0].x-cvs.width/2;g.camY=g.ps.segs[0].y-cvs.height/2}
    g.running=true;g.lastTS=performance.now();g.tickAcc=0
    cancelAnimationFrame(g.rafId)
    g.rafId=requestAnimationFrame(loop)
  }, [mkFood])

  const stopGame  = useCallback(()=>{const g=G.current;if(g){g.running=false;cancelAnimationFrame(g.rafId)}},[])
  const respawn   = useCallback((opts={})=>{
    const g=G.current;if(!g)return
    const {playerName='WARRIOR',skinColor='#c8ff00',skinTrail='#c8ff00'}=opts
    const x=250+Math.random()*(W-500),y=250+Math.random()*(H-500)
    const newP=mkSnake({isPlayer:true,name:playerName,color:skinColor,trail:skinTrail,x,y})
    const idx=g.snakes.findIndex(s=>s.isPlayer)
    if(idx!==-1)g.snakes[idx]=newP;else g.snakes.push(newP)
    g.ps=newP;g.running=true
  },[])

  const useAbility = useCallback((id)=>{
    const g=G.current;if(!g?.ps?.alive||g.abCD[id]>0)return
    wakeAC();sfx.ab()
    const CDS={dash:7000,ghost:14000,trap:18000,venom:11000}
    g.abCD[id]=CDS[id]
    if(id==='dash') {g.ps.dash=true;g.dashOn=true;g.dashT=420;burst(g,g.ps.segs[0].x,g.ps.segs[0].y,'#00e5ff',14);shake(g,8)}
    if(id==='ghost'){g.ps.ghost=true;g.ghostOn=true;g.ghostT=3000}
    if(id==='trap') {const t=g.ps.segs[g.ps.segs.length-1];g.mines.push({x:t.x,y:t.y,owner:g.ps,t:12000});burst(g,t.x,t.y,'#ffab00',10)}
    if(id==='venom'){g.venomOn=true;setTimeout(()=>{if(G.current)G.current.venomOn=false},3000);burst(g,g.ps.segs[0].x,g.ps.segs[0].y,'#aaff00',18)}
  },[])

  const setPendingDir = useCallback((dir)=>{if(G.current) G.current.pendingDir=dir},[])
  const setBoostHeld  = useCallback((v)  =>{if(G.current) G.current.boostHeld=v},[])
  const setKey        = useCallback((k,v)=>{if(G.current) G.current.keys[k]=v},[])

  useEffect(()=>{
    function onResize(){
      const cvs=canvasRef.current;if(!cvs)return
      const wrap=cvs.parentElement;if(!wrap)return
      cvs.width=wrap.clientWidth;cvs.height=wrap.clientHeight
    }
    onResize()
    window.addEventListener('resize',onResize)
    return ()=>window.removeEventListener('resize',onResize)
  },[])

  return {canvasRef,mmapRef,hud,startGame,stopGame,useAbility,respawn,setPendingDir,setBoostHeld,setKey}
}
