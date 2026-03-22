import s from './DeathScreen.module.css'
export default function DeathScreen({stats,onRespawn,onSpectate,onMenu}){
  if(!stats)return null
  const{score=0,level=1,kills=0,maxLen=1,killerName,coinsEarned=0,isGameOver=false}=stats
  return(
    <div className={s.overlay}>
      <div className={s.title}>{isGameOver?'GAME OVER':'ELIMINATED'}</div>
      <div className={s.grid}>
        <div><div className={s.val}>{score}</div><div className={s.lbl}>Score</div></div>
        <div><div className={s.val}>{level}</div><div className={s.lbl}>Level</div></div>
        <div><div className={s.val}>{kills}</div><div className={s.lbl}>Kills</div></div>
        <div><div className={s.val}>{maxLen}</div><div className={s.lbl}>Length</div></div>
      </div>
      {killerName&&<div className={s.killer}>Killed by <span className={s.killerName}>{killerName}</span></div>}
      <div className={s.earned}>+{coinsEarned} 🪙 coins earned</div>
      <div className={s.btns}>
        <button className={s.btnR} onClick={onRespawn}>⟳ RESPAWN</button>
        <button className={s.btnS} onClick={onSpectate}>👁 SPECTATE</button>
      </div>
      <button className={s.btnM} onClick={onMenu}>← MAIN MENU</button>
    </div>
  )
}
