import { useState } from 'react'
import { useStore, SKINS, ACHIEVEMENTS, getRank, getNextXP } from '../store/gameStore'
import s from './TitleScreen.module.css'

const MODES=[
  {id:'survival',  ico:'🐍',n:'SURVIVAL',    desc:'Eat · Grow · Outlast all',  tag:'HOT', tc:'th'},
  {id:'deathmatch',ico:'💀',n:'DEATHMATCH',  desc:'Most kills in 3 min',       tag:'3MIN',tc:'th'},
  {id:'koth',      ico:'👑',n:'KING ZONE',   desc:'Hold the crown zone 60s',   tag:'ZONE',tc:'tn'},
  {id:'royale',    ico:'🌀',n:'BATTLE ROYALE',desc:'Zone shrinks · Last alive', tag:'🔥',  tc:'th'},
  {id:'maze',      ico:'🧩',n:'MAZE',        desc:'Navigate walls · Trap foes', tag:null,  tc:null},
  {id:'teams',     ico:'🤝',n:'2v2 TEAMS',   desc:'Squad up · Win together',   tag:'NEW', tc:'tn'},
]

export default function TitleScreen({onPlay}){
  const {save,dispatch,getSkin}=useStore()
  const [tab,setTab]=useState('play')
  const [mode,setMode]=useState('survival')
  const [name,setName]=useState('')

  const play=()=>{
    const sk=getSkin()
    onPlay({mode,playerName:name.trim().toUpperCase()||'WARRIOR_01',skinColor:sk.c,skinTrail:sk.tr})
  }

  const tabs=[{id:'play',l:'⚔ PLAY'},{id:'skins',l:'🎨 SKINS'},{id:'missions',l:'📋 DAILY'},{id:'stats',l:'🏆 STATS'}]

  return(
    <div className={s.screen}>
      <div className="grid-bg"/>
      <div className={s.hero}>
        <div className={s.eye}>[ MULTIPLAYER BATTLE ROYALE ]</div>
        <h1 className={s.title}>SNAKE<br/><span className={s.acc}>ARENA</span></h1>
        <div className={s.sub}>Slither · Devour · Dominate</div>
      </div>
      <div className={s.nav}>
        {tabs.map(t=><button key={t.id} className={`${s.tab} ${tab===t.id?s.on:''}`} onClick={()=>setTab(t.id)}>{t.l}</button>)}
      </div>

      {tab==='play'&&(
        <div className={s.panel}>
          <div className={s.fl}>Your Name</div>
          <input className={s.ni} value={name} onChange={e=>setName(e.target.value)} onKeyDown={e=>e.key==='Enter'&&play()} placeholder="WARRIOR_01" maxLength={14} autoFocus spellCheck={false}/>
          <div className={s.fl} style={{marginTop:16}}>Game Mode</div>
          <div className={s.mg}>
            {MODES.map(m=>(
              <div key={m.id} className={`${s.mc} ${mode===m.id?s.mo:''}`} onClick={()=>setMode(m.id)}>
                {m.tag&&<span className={`${s.mt} ${s[m.tc]}`}>{m.tag}</span>}
                <span className={s.mi}>{m.ico}</span>
                <div className={s.mn}>{m.n}</div>
                <div className={s.md}>{m.desc}</div>
              </div>
            ))}
          </div>
          <button className={`${s.pb} btn-clip`} onClick={play}>⚡ ENTER ARENA</button>
          <div className={s.ctrl}>
            <span>Move <kbd>WASD/↑↓</kbd></span><span>Boost <kbd>SPACE</kbd></span><span>Dash <kbd>Q</kbd></span>
            <span>Phase <kbd>E</kbd></span><span>Mine <kbd>R</kbd></span><span>Venom <kbd>F</kbd></span>
          </div>
        </div>
      )}

      {tab==='skins'&&(
        <div className={s.panel}>
          <div className={s.wallet}>🪙 {save.coins} coins</div>
          <div className={s.sg}>
            {SKINS.map(sk=>{
              const owned=save.ownedSkins.includes(sk.id),active=save.activeSkin===sk.id
              return(
                <div key={sk.id} className={`${s.sk} ${active?s.skeq:''} ${!owned?s.sklk:''}`} onClick={()=>{
                  if(!owned){if(save.coins>=sk.cost)dispatch({type:'BUY_SKIN',skin:sk});else alert(`Need ${sk.cost-save.coins} more coins!`);return}
                  dispatch({type:'EQUIP_SKIN',skinId:sk.id})
                }}>
                  <div className={s.skp} style={{background:`radial-gradient(circle at 40% 40%,${sk.c},${sk.tr}88)`,boxShadow:`0 0 18px ${sk.c}44`}}><span style={{fontSize:'1.4rem'}}>{sk.ico}</span></div>
                  <div className={s.skn}>{sk.n}</div>
                  <div className={s.skc}>{owned?(active?'✓ EQUIPPED':'Equip'):`🪙 ${sk.cost}`}</div>
                  {!owned&&<span className={s.sklck}>🔒</span>}
                  {active&&<span className={s.skeqb}>EQ</span>}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {tab==='missions'&&(
        <div className={s.panel}>
          <div className={s.wallet}>🔥 {save.streak}-day streak</div>
          {(save.missions||[]).map((ms,i)=>{
            const prog=Math.min(ms.tgt,save.mProg?.[ms.stat]||0),pct=(prog/ms.tgt)*100,done=prog>=ms.tgt
            return(
              <div key={i} className={s.mit}>
                <div className={s.mip}><div className={s.min}>{ms.ico} {ms.n}</div><div className={s.mir}>{done?'✓ DONE':`🪙 +${ms.rew}`}</div></div>
                <div className={s.mib}><div className={s.mif} style={{width:`${pct}%`}}/></div>
                <div className={s.mig}>{prog} / {ms.tgt}</div>
              </div>
            )
          })}
        </div>
      )}

      {tab==='stats'&&(
        <div className={s.panel}>
          <div className={s.stg}>
            {[{v:save.totalKills,l:'Total Kills'},{v:save.maxLen,l:'Max Length'},{v:save.totalScore,l:'Best Score'},{v:save.maxLevel,l:'Max Level'},{v:save.maxCombo,l:'Best Combo'},{v:Math.floor(save.totalTime/60),l:'Mins Played'}].map((x,i)=>(
              <div key={i} className={s.stb}><div className={s.stv}>{x.v}</div><div className={s.stl}>{x.l}</div></div>
            ))}
          </div>
          <div className={s.fl} style={{marginBottom:10}}>Achievements</div>
          {ACHIEVEMENTS.map(a=>{
            const done=save.achs?.[a.id]
            const statMap={kills:'totalKills',time:'totalTime',length:'maxLen',score:'totalScore',powerups:'maxPU',level:'maxLevel',combo:'maxCombo'}
            const cur=save[statMap[a.stat]]||0
            return(
              <div key={a.id} className={`${s.ai} ${done?s.adn:''}`}>
                <div className={s.aico}>{a.ico}</div>
                <div style={{flex:1}}>
                  <div className={s.anm}>{a.n}</div>
                  <div className={s.adc}>{a.d}</div>
                  <div className={s.apr}>{Math.min(a.tgt,cur)}/{a.tgt}{done?` — 🏆 +${a.rew} coins`:''}</div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
