import { createContext, useContext, useReducer } from 'react'

export const RANKS = [
  {l:1, n:'Hatchling',   xp:0,     c:'#8eb8d8'},
  {l:2, n:'Crawler',     xp:120,   c:'#44aaff'},
  {l:3, n:'Coiler',      xp:300,   c:'#00e5ff'},
  {l:4, n:'Striker',     xp:560,   c:'#c8ff00'},
  {l:5, n:'Venom',       xp:900,   c:'#aaff00'},
  {l:6, n:'Predator',    xp:1350,  c:'#ffab00'},
  {l:7, n:'Apex',        xp:1900,  c:'#ff6d00'},
  {l:8, n:'Warlord',     xp:2700,  c:'#ff1744'},
  {l:9, n:'Champion',    xp:3700,  c:'#d500f9'},
  {l:10,n:'Serpent God', xp:5000,  c:'#c8ff00'},
  {l:15,n:'Immortal',    xp:8000,  c:'#ff1744'},
  {l:20,n:'⚡ LEGEND',   xp:13000, c:'#c8ff00'},
]

export const SKINS = [
  {id:'default',n:'Default', c:'#c8ff00',tr:'#c8ff00',cost:0,  ico:'🟢'},
  {id:'fire',   n:'Inferno', c:'#ff4400',tr:'#ff8800',cost:0,  ico:'🔥'},
  {id:'ice',    n:'Glacier', c:'#44ddff',tr:'#aaeeff',cost:150,ico:'🧊'},
  {id:'galaxy', n:'Galaxy',  c:'#d500f9',tr:'#ff44aa',cost:200,ico:'🌌'},
  {id:'gold',   n:'Golden',  c:'#ffab00',tr:'#ff6d00',cost:300,ico:'⭐'},
  {id:'neon',   n:'Neon',    c:'#00ffcc',tr:'#00ff88',cost:250,ico:'💡'},
  {id:'toxic',  n:'Toxic',   c:'#aaff00',tr:'#55aa00',cost:180,ico:'☣️'},
  {id:'shadow', n:'Shadow',  c:'#aa44ff',tr:'#440088',cost:350,ico:'👾'},
]

export const ACHIEVEMENTS = [
  {id:'f_blood',n:'First Blood',   d:'Get your first kill',       ico:'🩸',stat:'kills',   tgt:1,   rew:50 },
  {id:'slayer', n:'Slayer',        d:'Kill 10 snakes total',      ico:'⚔️', stat:'kills',   tgt:10,  rew:100},
  {id:'warlord',n:'Warlord',       d:'Kill 50 snakes total',      ico:'💀',stat:'kills',   tgt:50,  rew:300},
  {id:'surv5',  n:'Survivor',      d:'Survive 5 min in one game', ico:'⏱️',stat:'time',    tgt:300, rew:100},
  {id:'long',   n:'Big Snake',     d:'Reach length 120',          ico:'🐍',stat:'length',  tgt:120, rew:150},
  {id:'cent',   n:'Centurion',     d:'Score 1000 in one game',    ico:'💯',stat:'score',   tgt:1000,rew:200},
  {id:'lv10',   n:'Warlord Rank',  d:'Reach level 10',            ico:'🏆',stat:'level',   tgt:10,  rew:500},
  {id:'combo5', n:'Combo King',    d:'5x kill combo',             ico:'🔥',stat:'combo',   tgt:5,   rew:200},
  {id:'puget',  n:'Power Hungry',  d:'Collect 10 power-ups',      ico:'⚡',stat:'powerups',tgt:10,  rew:100},
  {id:'untch',  n:'Untouchable',   d:'3 min without being hit',   ico:'🛡️',stat:'nohit',   tgt:180, rew:300},
]

function genMissions() {
  const day = Math.floor(Date.now() / 86400000)
  const pool = [
    {n:'Eat 100 food',          stat:'food', tgt:100,rew:60, ico:'🍎'},
    {n:'Kill 5 snakes',         stat:'kills',tgt:5,  rew:100,ico:'☠️'},
    {n:'Score 500 points',      stat:'score',tgt:500,rew:80, ico:'💯'},
    {n:'Collect 3 power-ups',   stat:'pu',   tgt:3,  rew:50, ico:'⚡'},
    {n:'Survive 3 minutes',     stat:'time', tgt:180,rew:90, ico:'⏱️'},
    {n:'Level up 3 times',      stat:'lvlup',tgt:3,  rew:70, ico:'⬆️'},
    {n:'Use all 4 abilities',   stat:'ab',   tgt:4,  rew:80, ico:'🔮'},
    {n:'Play 3 different modes',stat:'modes',tgt:3,  rew:120,ico:'🎮'},
  ]
  return [pool[day%8], pool[(day+3)%8], pool[(day+6)%8]]
}

export function getRank(l) {
  let r = RANKS[0]
  for (const d of RANKS) if (l >= d.l) r = d
  return r
}

export function getNextXP(l) {
  for (let i = 0; i < RANKS.length - 1; i++) if (RANKS[i].l === l) return RANKS[i+1].xp
  return RANKS[RANKS.length-1].xp + (l - RANKS[RANKS.length-1].l) * 2200
}

function getDefault() {
  return {
    coins:0, streak:1, lastDay:Math.floor(Date.now()/86400000),
    totalKills:0, totalTime:0, totalScore:0, maxLen:0,
    maxPU:0, maxLevel:0, maxCombo:0, campComplete:0,
    achs:{}, missions:genMissions(), mProg:{},
    mDay:Math.floor(Date.now()/86400000),
    activeSkin:'default', ownedSkins:['default','fire'],
    bpOwned:false,
  }
}

function loadSave() {
  try {
    const raw = localStorage.getItem('sa_v1')
    if (!raw) return getDefault()
    const s = {...getDefault(), ...JSON.parse(raw)}
    const today = Math.floor(Date.now()/86400000)
    if (s.mDay < today) { s.missions=genMissions(); s.mProg={}; s.mDay=today }
    if (s.lastDay === today-1) s.streak = (s.streak||0)+1
    else if (s.lastDay < today-1) s.streak = 1
    s.lastDay = today
    return s
  } catch { return getDefault() }
}

function reducer(state, action) {
  let next
  switch (action.type) {
    case 'ADD_COINS':   next={...state, coins:state.coins+action.amount}; break
    case 'BUY_SKIN':    next={...state, coins:state.coins-action.skin.cost, ownedSkins:[...state.ownedSkins,action.skin.id], activeSkin:action.skin.id}; break
    case 'EQUIP_SKIN':  next={...state, activeSkin:action.skinId}; break
    case 'UNLOCK_ACH':  next={...state, achs:{...state.achs,[action.id]:true}, coins:state.coins+action.reward}; break
    case 'TRACK':       next={...state, mProg:{...state.mProg,[action.stat]:(state.mProg[action.stat]||0)+action.val}}; break
    case 'SESSION_END': next={...state,
      totalKills: state.totalKills+(action.kills||0),
      totalTime:  state.totalTime+(action.time||0),
      totalScore: Math.max(state.totalScore,action.score||0),
      maxLen:     Math.max(state.maxLen,action.length||0),
      maxLevel:   Math.max(state.maxLevel,action.level||0),
      maxCombo:   Math.max(state.maxCombo,action.combo||0),
      coins:      state.coins+(action.coinsEarned||0),
    }; break
    case 'BP_BUY': next={...state, bpOwned:true, coins:state.coins-500}; break
    default: return state
  }
  try { localStorage.setItem('sa_v1', JSON.stringify(next)) } catch {}
  return next
}

const Ctx = createContext(null)

export function StoreProvider({ children }) {
  const [save, dispatch] = useReducer(reducer, null, loadSave)
  const getSkin = () => SKINS.find(s => s.id===save.activeSkin) || SKINS[0]
  return <Ctx.Provider value={{save,dispatch,getSkin}}>{children}</Ctx.Provider>
}

export const useStore = () => useContext(Ctx)
