// Redirect straight to the game
import { useEffect } from 'react'

export default function App() {
  useEffect(() => {
    // Just redirect to game.html directly
    window.location.href = '/game.html'
  }, [])

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: '#050810',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'monospace', color: '#39ff14', fontSize: '1rem',
      letterSpacing: '0.3em'
    }}>
      LOADING...
    </div>
  )
}
