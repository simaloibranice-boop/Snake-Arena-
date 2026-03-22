// ═══════════════════════════════════════════════════════════════
//  useMultiplayer — Socket.io client hook
//  Connects the game to the multiplayer server
//  Drop-in: works alongside the existing single-player engine
// ═══════════════════════════════════════════════════════════════

import { useRef, useState, useCallback, useEffect } from 'react'
import { io } from 'socket.io-client'

// Change this to your Railway server URL after deploy
const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001'

export function useMultiplayer() {
  const socketRef  = useRef(null)
  const [connected,  setConnected]  = useState(false)
  const [roomId,     setRoomId]     = useState(null)
  const [players,    setPlayers]    = useState([])
  const [gameState,  setGameState]  = useState(null)
  const [killFeed,   setKillFeed]   = useState([])
  const [latency,    setLatency]    = useState(0)

  // ── Connect ────────────────────────────────────────────────
  const connect = useCallback(() => {
    if (socketRef.current?.connected) return

    const socket = io(SERVER_URL, {
      transports:      ['websocket', 'polling'],
      reconnection:    true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    })
    socketRef.current = socket

    socket.on('connect', () => {
      console.log('[MP] Connected:', socket.id)
      setConnected(true)
    })

    socket.on('disconnect', () => {
      console.log('[MP] Disconnected')
      setConnected(false)
      setRoomId(null)
    })

    // Joined a room
    socket.on('joined', ({ roomId, playerId, mode, players }) => {
      setRoomId(roomId)
      setPlayers(players)
      console.log(`[MP] Joined room ${roomId} as ${playerId}`)
    })

    // Full game state (every tick)
    socket.on('state', (state) => {
      setGameState(state)
      setPlayers(state.players)
    })

    // Kill feed
    socket.on('snake_killed', ({ killerName, victimName, cause }) => {
      const id = Date.now()
      setKillFeed(prev => [{ id, killerName, victimName, cause }, ...prev].slice(0, 6))
      setTimeout(() => setKillFeed(prev => prev.filter(e => e.id !== id)), 3200)
    })

    // Someone joined
    socket.on('player_joined', ({ name, color }) => {
      console.log(`[MP] ${name} joined the room`)
    })

    // Someone left
    socket.on('player_left', ({ id }) => {
      setPlayers(prev => prev.filter(p => p.id !== id))
    })

    // Latency ping
    setInterval(() => {
      const start = Date.now()
      socket.emit('ping_check')
      socket.once('pong_check', () => setLatency(Date.now() - start))
    }, 5000)

  }, [])

  // ── Disconnect ─────────────────────────────────────────────
  const disconnect = useCallback(() => {
    socketRef.current?.disconnect()
    socketRef.current = null
    setConnected(false)
    setRoomId(null)
  }, [])

  // ── Join a game room ───────────────────────────────────────
  const joinGame = useCallback(({ name, color, trail, mode = 'survival' }) => {
    if (!socketRef.current?.connected) connect()
    setTimeout(() => {
      socketRef.current?.emit('join', { name, color, trail, mode })
    }, connected ? 0 : 500)
  }, [connect, connected])

  // ── Send movement input (called every frame) ───────────────
  const sendInput = useCallback((dir, boost) => {
    socketRef.current?.volatile.emit('input', { dir, boost })
  }, [])

  // ── Use ability ────────────────────────────────────────────
  const sendAbility = useCallback((id) => {
    socketRef.current?.emit('ability', { id })
  }, [])

  // ── Send emote ─────────────────────────────────────────────
  const sendEmote = useCallback((text) => {
    socketRef.current?.emit('emote', { text })
  }, [])

  // ── Respawn ────────────────────────────────────────────────
  const respawn = useCallback(() => {
    socketRef.current?.emit('respawn')
  }, [])

  // Cleanup on unmount
  useEffect(() => () => disconnect(), [])

  return {
    connected, roomId, players, gameState, killFeed, latency,
    connect, disconnect, joinGame, sendInput, sendAbility, sendEmote, respawn,
    socketId: socketRef.current?.id,
  }
}
