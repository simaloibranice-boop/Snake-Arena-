import { getRank, getNextXP, RANKS } from '../store/gameStore'
import s from './HUD.module.css'

const MODES={survival:{l:'SURVIVAL',c:'bS'},deathmatch:{l:'DEATHMATCH',c:'bD'},koth:{l:'KING ZONE',c:'bK'},royale:{l:'BATTLE ROYALE',c:'bR'},maze:{l:'MAZE',c:'bS'},teams:{l:'2v2 TEAMS',c:'bS'}}
const ABS=[{id:'dash',ico:'⚡',key:'Q',color:'#00e5ff'},{id:'ghost',ico:'👻',key:'E',color:'#d500f9'},{id:'trap',ico:'💣',key:'R',color:'#ffab00'},{id:'venom',ico:'💉',key:'F',color:'#aaff00'}]
const PUTS=[{id:'magnet',ico:'🧲',c:'#ff44aa',dur:8000},{id:'shield',ico:'🛡️',c:'#00e5ff',dur:6000},{id:'speed',ico:'⚡',c:'#c8ff00',dur:5000},{id:'x2',ico:'✖️',c:'#00ffcc',dur:10000},{id:'mini',ico:'🔻',c:'#d500f9',dur:6000}]

export function HudTop({mode,hud,coins}){
  const m=MODES[mode]||MODES.survival
  return(
    <div className={s.top}>
      <div className={`${s.logo} grad-text`}>SA</div>
      <div className={`${s.badge} ${s[m.c]}`}>{m.l}</div>
      <div className={s.stat}>ALIVE <b>{hud.alive}</b></div>
      <div className={s.stat}>KILLS <b>{hud.kills}</b></div>
      <div className={s.sp}/>
      {hud.timer&&<div className={s.timer}>{hud.timer}</div>}
      <div className={s.coins}>🪙{coins||0}</div>
    </div>
  )
}

export function SidePanel({hud,onAbility}){
  const rank=getRank(hud.level||1)
  const nx=getNextXP(hud.level||1)
  const xpPct=Math.min(100,((hud.xp-rank.xp)/(nx-rank.xp))*100)||0
  return(
    <div className={s.panel}>
      <div className={s.sec}>
        <div className={s.tit}>PROGRESS</div>
        <div className={s.lvRow}>
          <div className={s.lvNum} style={{color:rank.c}}>{hud.level}</div>
          <div><div className={s.rnk}>{rank.n}</div><div className={s.xpt}>{hud.xp}/{nx} XP</div></div>
        </div>
        <div className="bar-bg"><div className="bar-fill bar-xp" style={{width:`${xpPct}%`}}/></div>
        <div style={{marginTop:8}}>
          <div className={s.tit} style={{marginBottom:3}}>BOOST</div>
          <div className="bar-bg"><div className="bar-fill bar-boost" style={{width:`${hud.boostE||100}%`}}/></div>
        </div>
      </div>
      <div className={s.sec}>
        <div className={s.tit}>SCORE</div>
        <div className={s.scNum}>{hud.score}</div>
        {hud.combo>1&&<div className={s.combo}>{hud.combo}x COMBO! 🔥</div>}
      </div>
      <div className={s.sec}>
        <div className={s.tit}>ABILITIES — Q·E·R·F</div>
        <div className={s.abRow}>
          {ABS.map(ab=>{const cd=hud.abCD?.[ab.id]||0,rdy=cd<=0;return(
            <button key={ab.id} className={`${s.ab} ${rdy?s.abR:''}`} style={{borderColor:rdy?ab.color:'rgba(255,255,255,.07)'}} onClick={()=>onAbility(ab.id)} title={ab.id}>
              <span className={s.abI}>{ab.ico}</span>
              <span className={s.abK}>{ab.key}</span>
              {!rdy&&<span className={s.abCd}>{Math.ceil(cd/1000)}s</span>}
              {!rdy&&<div className={s.abOv}/>}
            </button>
          )})}
        </div>
      </div>
      <div className={`${s.sec} ${s.secFlex}`}>
        <div className={s.tit}>LEADERBOARD</div>
        <div className={s.lb}>
          {hud.leaderboard?.map((p,i)=>(
            <div key={p.id} className={`${s.lbr} ${p.isMe?s.lbMe:''}`}>
              <div className={`${s.lbRk} ${i===0?s.g:i===1?s.sv:i===2?s.bz:''}`}>{i+1}</div>
              <div className={s.lbDot} style={{background:p.color,boxShadow:`0 0 4px ${p.color}`}}/>
              <div className={`${s.lbNm} ${p.isBoss?s.boss:''}`}>{p.name}{p.isMe?' ★':''}</div>
              <div className={s.lbSc}>{p.score}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function KillFeed({events}){
  return(
    <div className={s.kf}>
      {events.map(e=>(
        <div key={e.id} className={`${s.kfi} ${e.isMe?s.kfm:''}`}>
          <span dangerouslySetInnerHTML={{__html:e.html}}/>
        </div>
      ))}
    </div>
  )
}

export function PowerupHud({puActive}){
  return(
    <div className={s.puh}>
      {Object.entries(puActive||{}).map(([id,t])=>{
        const pt=PUTS.find(p=>p.id===id);if(!pt||t<=0)return null
        return(
          <div key={id} className={s.pui}>
            <span>{pt.ico}</span>
            <span style={{color:pt.c,fontSize:'.62rem'}}>{pt.name||id}</span>
            <div className={s.puB}><div className={s.puF} style={{width:`${(t/pt.dur)*100}%`,background:pt.c}}/></div>
          </div>
        )
      })}
    </div>
  )
}

export function LvlToast({level,rankName,visible}){
  if(!visible)return null
  return(<div className={s.lvT}><div className={s.tT}>⬆ LEVEL UP</div><div className={s.tS}>Level {level} — {rankName}</div></div>)
}

export function KothBar({pct}){
  if(!pct)return null
  return(<div className={s.kothB}><div className={s.kothL}>ZONE CONTROL</div><div className={s.kothT}><div className="bar-fill bar-koth" style={{width:`${pct}%`}}/></div></div>)
}

export default HUD