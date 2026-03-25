import { useState } from 'react'
import { useGameEngine } from './hooks/useGameEngine'
import TitleScreen from './components/TitleScreen'
import GameCanvas from './components/GameCanvas'
import HUD from './components/HUD'
import DeathScreen from './components/DeathScreen'
import './styles/global.css'

export default function App() {
  const [screen, setScreen] = useState('title')
  const [deathStats, setDeathStats] = useState(null)

  const {
    canvasRef,
    mmapRef,
    hud,
    startGame,
    stopGame,
    useAbility,
    respawn,
    setPendingDir,
    setBoostHeld,
    setKey
  } = useGameEngine({
    onDeath: (stats) => setDeathStats(stats)
  })

  const handlePlay = (opts) => {
    setScreen('game')
    setDeathStats(null)
    startGame(opts)
  }

  const handleRespawn = () => {
    setDeathStats(null)
    respawn()
  }

  const handleMenu = () => {
    stopGame()
    setScreen('title')
  }

  return (
    <>
      {screen === 'title' && <TitleScreen onPlay={handlePlay} />}

      {screen === 'game' && (
        <>
          <GameCanvas
            canvasRef={canvasRef}
            mmapRef={mmapRef}
            hud={hud}
            onAbility={useAbility}
            setBoostHeld={setBoostHeld}
            setPendingDir={setPendingDir}
            setKey={setKey}
          />

          <HUD hud={hud} onAbility={useAbility} />

          {deathStats && (
            <DeathScreen
              stats={deathStats}
              onRespawn={handleRespawn}
              onMenu={handleMenu}
            />
          )}
        </>
      )}
    </>
  )
}