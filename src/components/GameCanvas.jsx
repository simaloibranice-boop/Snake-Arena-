import { useEffect, useRef } from 'react'
import s from './GameCanvas.module.css'

export default function GameCanvas({canvasRef,mmapRef,hud,onAbility,setBoostHeld,setPendingDir,setKey}){
  const touchStart=useRef({x:0,y:0})
  const boosting=hud.boostE<95

  useEffect(()=>{
    const dn=(e)=>{
      setKey(e.key,true)
      if([' ','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)) e.preventDefault()
      if(e.key==='q'||e.key==='Q') onAbility('dash')
      if(e.key==='e'||e.key==='E') onAbility('ghost')
      if(e.key==='r'||e.key==='R') onAbility('trap')
      if(e.key==='f'||e.key==='F') onAbility('venom')
    }
    const up=(e)=>setKey(e.key,false)
    window.addEventListener('keydown',dn)
    window.addEventListener('keyup',up)
    return()=>{window.removeEventListener('keydown',dn);window.removeEventListener('keyup',up)}
  },[onAbility,setKey])

  const dirs={up:{x:0,y:-1},down:{x:0,y:1},left:{x:-1,y:0},right:{x:1,y:0}}

  return(
    <div className={s.wrap}>
      <div className={`${s.vig} ${boosting?s.on:''}`}/>
      <canvas ref={canvasRef} className={s.canvas}
        onMouseDown={(e)=>{e.preventDefault();setBoostHeld(true)}}
        onMouseUp={()=>setBoostHeld(false)}
        onMouseLeave={()=>setBoostHeld(false)}
        onTouchStart={(e)=>{e.preventDefault();setBoostHeld(true);touchStart.current={x:e.touches[0].clientX,y:e.touches[0].clientY}}}
        onTouchMove={(e)=>{e.preventDefault();const dx=e.touches[0].clientX-touchStart.current.x,dy=e.touches[0].clientY-touchStart.current.y;if(Math.abs(dx)>14||Math.abs(dy)>14){if(Math.abs(dx)>Math.abs(dy))setPendingDir({x:dx>0?1:-1,y:0});else setPendingDir({x:0,y:dy>0?1:-1});touchStart.current={x:e.touches[0].clientX,y:e.touches[0].clientY}}}}
        onTouchEnd={()=>setBoostHeld(false)}
      />
      <canvas ref={mmapRef} className={s.mmap} width={110} height={110}/>
      <div className={s.dpad}>
        <div className={s.dr}><div className={s.dblank}/><button className={s.db} onTouchStart={e=>{e.preventDefault();setPendingDir(dirs.up)}} onMouseDown={()=>setPendingDir(dirs.up)}>▲</button><div className={s.dblank}/></div>
        <div className={s.dr}><button className={s.db} onTouchStart={e=>{e.preventDefault();setPendingDir(dirs.left)}} onMouseDown={()=>setPendingDir(dirs.left)}>◀</button><div className={s.dblank}/><button className={s.db} onTouchStart={e=>{e.preventDefault();setPendingDir(dirs.right)}} onMouseDown={()=>setPendingDir(dirs.right)}>▶</button></div>
        <div className={s.dr}><div className={s.dblank}/><button className={s.db} onTouchStart={e=>{e.preventDefault();setPendingDir(dirs.down)}} onMouseDown={()=>setPendingDir(dirs.down)}>▼</button><div className={s.dblank}/></div>
      </div>
    </div>
  )
}
