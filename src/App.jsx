import { useEffect, useRef } from 'react'

// The full game lives in public/game.html loaded into an iframe.
// This gives us full canvas control with no React interference.
export default function App() {
  return (
    <iframe
      src="/game.html"
      style={{
        position: 'fixed',
        inset: 0,
        width: '100%',
        height: '100%',
        border: 'none',
        display: 'block',
      }}
      title="Venom Rush"
    />
  )
}
