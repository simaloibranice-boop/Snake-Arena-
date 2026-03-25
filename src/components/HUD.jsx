import { getRank, getNextXP } from '../store/gameStore'
import s from './HUD.module.css'

const MODES = {
  survival: { l: 'SURVIVAL', c: 'bS' },
  deathmatch: { l: 'DEATHMATCH', c: 'bD' },
  koth: { l: 'KING ZONE', c: 'bK' },
  royale: { l: 'BATTLE ROYALE', c: 'bR' },
  maze: { l: 'MAZE', c: 'bS' },
  teams: { l: '2v2 TEAMS', c: 'bS' }
}

const ABS = [
  { id: 'dash', ico: '⚡', key: 'Q', color: '#00e5ff' },
  { id: 'ghost', ico: '👻', key: 'E', color: '#d500f9' },
  { id: 'trap', ico: '💣', key: 'R', color: '#ffab00' },
  { id: 'venom', ico: '💉', key: 'F', color: '#aaff00' }
]

const PUTS = [
  { id: 'magnet', ico: '🧲', c: '#ff44aa', dur: 8000 },
  { id: 'shield', ico: '🛡️', c: '#00e5ff', dur: 6000 },
  { id: 'speed', ico: '⚡', c: '#c8ff00', dur: 5000 },
  { id: 'x2', ico: '✖️', c: '#00ffcc', dur: 10000 },
  { id: 'mini', ico: '🔻', c: '#d500f9', dur: 6000 }
]

// 🔝 TOP BAR
function HudTop({ mode, hud, coins }) {
  const m = MODES[mode] || MODES.survival

  return (
    <div className={s.top}>
      <div className={`${s.logo} grad-text`}>SA</div>
      <div className={`${s.badge} ${s[m.c]}`}>{m.l}</div>
      <div className={s.stat}>ALIVE <b>{hud.alive}</b></div>
      <div className={s.stat}>KILLS <b>{hud.kills}</b></div>
      <div className={s.sp} />
      {hud.timer && <div className={s.timer}>{hud.timer}</div>}
      <div className={s.coins}>🪙{coins || 0}</div>
    </div>
  )
}

// 📊 SIDE PANEL
function SidePanel({ hud, onAbility }) {
  const rank = getRank(hud.level || 1)
  const nx = getNextXP(hud.level || 1)
  const xpPct = Math.min(100, ((hud.xp - rank.xp) / (nx - rank.xp)) * 100) || 0

  return (
    <div className={s.panel}>
      <div className={s.sec}>
        <div className={s.tit}>PROGRESS</div>
        <div className={s.lvRow}>
          <div className={s.lvNum} style={{ color: rank.c }}>{hud.level}</div>
          <div>
            <div className={s.rnk}>{rank.n}</div>
            <div className={s.xpt}>{hud.xp}/{nx} XP</div>
          </div>
        </div>

        <div className="bar-bg">
          <div className="bar-fill bar-xp" style={{ width: `${xpPct}%` }} />
        </div>

        <div style={{ marginTop: 8 }}>
          <div className={s.tit}>BOOST</div>
          <div className="bar-bg">
            <div className="bar-fill bar-boost" style={{ width: `${hud.boostE || 100}%` }} />
          </div>
        </div>
      </div>

      <div className={s.sec}>
        <div className={s.tit}>SCORE</div>
        <div className={s.scNum}>{hud.score}</div>
      </div>

      <div className={s.sec}>
        <div className={s.tit}>ABILITIES</div>
        <div className={s.abRow}>
          {ABS.map(ab => {
            const cd = hud.abCD?.[ab.id] || 0
            const ready = cd <= 0

            return (
              <button
                key={ab.id}
                className={`${s.ab} ${ready ? s.abR : ''}`}
                onClick={() => onAbility(ab.id)}
              >
                {ab.ico}
                {!ready && <span>{Math.ceil(cd / 1000)}s</span>}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// 🎮 MAIN HUD WRAPPER (THIS WAS MISSING ❗)
const HUD = ({ hud, onAbility }) => {
  if (!hud) return null

  return (
    <>
      <HudTop mode={hud.mode} hud={hud} coins={hud.coins} />
      <SidePanel hud={hud} onAbility={onAbility} />
    </>
  )
}

export default HUD