// ═══════════════════════════════════════════════════════════════
//  VENOM RUSH — WebSocket Multiplayer Server
//  Node.js + Socket.io
//
//  Architecture:
//  - Room-based matchmaking (auto-join or create)
//  - Server-authoritative positions (anti-cheat)
//  - 60 tick rate game loop per room
//  - Graceful disconnect handling
//  - REST API for health, rooms, leaderboard
// ═══════════════════════════════════════════════════════════════

require('dotenv').config();
const express   = require('express');
const http      = require('http');
const { Server } = require('socket.io');
const cors      = require('cors');

const app    = express();
const server = http.createServer(app);

const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';
const PORT       = process.env.PORT || 3001;
const MAX_ROOM_PLAYERS = parseInt(process.env.MAX_PLAYERS_PER_ROOM) || 16;

// ── CORS ───────────────────────────────────────────────────────
app.use(cors({ origin: ['http://localhost:5173', CLIENT_URL, /\.vercel\.app$/] }));
app.use(express.json());

const io = new Server(server, {
  cors: {
    origin: ['http://localhost:5173', CLIENT_URL, /\.vercel\.app$/],
    methods: ['GET', 'POST'],
  },
  pingTimeout:  20000,
  pingInterval: 10000,
});

// ── Constants ──────────────────────────────────────────────────
const W = 3000, H = 3000, SEG = 20, TICK = 50; // 20 ticks/sec server-side
const COLS = ['#39ff14','#00d4ff','#ff1744','#ffd600','#e040fb','#ff8800','#44ffcc','#ff44aa','#aaff00','#ff6644'];
const BOT_NAMES = ['VenomX','NullFang','GridBeast','HexCoil','ByteViper','CyberSurge','DataReaper','GhostLoop','LaserKing','IronCoil'];

// ── In-memory state ────────────────────────────────────────────
const rooms      = new Map(); // roomId → RoomState
const playerRoom = new Map(); // socketId → roomId
const leaderboard = [];       // top scores all time

// ── Room factory ───────────────────────────────────────────────
function createRoom(mode = 'survival') {
  const id = 'room_' + Math.random().toString(36).slice(2, 8);
  const room = {
    id,
    mode,
    players:  new Map(), // socketId → PlayerState
    food:     [],
    pups:     [],
    mines:    [],
    started:  false,
    tickId:   null,
    tickCount: 0,
    royalR:   Math.max(W, H),
    kothSc:   {},  // socketId → seconds held
    mTimer:   180000,
    createdAt: Date.now(),
  };
  initFood(room);
  startRoomLoop(room);
  rooms.set(id, room);
  console.log(`[Room] Created ${id} mode=${mode}`);
  return room;
}

function initFood(room) {
  room.food = [];
  for (let i = 0; i < 400; i++) room.food.push(mkFood());
}

function mkFood() {
  return {
    id: Math.random().toString(36).slice(2, 9),
    x:  50 + Math.random() * (W - 100),
    y:  50 + Math.random() * (H - 100),
    r:  5  + Math.random() * 4,
    val: Math.random() < .06 ? 5 : Math.random() < .15 ? 2 : 1,
    c:  COLS[Math.floor(Math.random() * COLS.length)],
  };
}

// ── Player factory ─────────────────────────────────────────────
function createPlayer(socketId, name, color, trail) {
  const x = 200 + Math.random() * (W - 400);
  const y = 200 + Math.random() * (H - 400);
  const segs = [];
  for (let i = 0; i < 10; i++) segs.push({ x: x - i * SEG, y });
  return {
    id:       socketId,
    name:     name.slice(0, 14).toUpperCase() || 'PLAYER',
    color,
    trail:    trail || color,
    segs,
    dir:      { x: 1, y: 0 },
    ndir:     { x: 1, y: 0 },
    boost:    false,
    boostE:   100,
    alive:    true,
    score:    0,
    kills:    0,
    ghost:    false,
    shield:   false,
    infected: false,
    lastInput: Date.now(),
    // Anti-cheat: track last known position
    lastX:    x,
    lastY:    y,
    lastTick: 0,
  };
}

// ── Bot factory ────────────────────────────────────────────────
function createBot(i) {
  const id   = 'bot_' + i;
  const x    = 200 + Math.random() * (W - 400);
  const y    = 200 + Math.random() * (H - 400);
  const segs = [];
  for (let k = 0; k < 10; k++) segs.push({ x: x - k * SEG, y });
  return {
    id,
    name:    BOT_NAMES[i % BOT_NAMES.length],
    color:   COLS[(i + 2) % COLS.length],
    trail:   COLS[(i + 2) % COLS.length],
    segs,
    dir:     { x: 1, y: 0 },
    ndir:    { x: 1, y: 0 },
    boost:   false,
    boostE:  100,
    alive:   true,
    score:   0,
    kills:   0,
    ghost:   false,
    shield:  false,
    infected: false,
    isBot:   true,
    wAngle:  Math.random() * Math.PI * 2,
    evTick:  0,
  };
}

// ── Set direction ──────────────────────────────────────────────
function setDir(s, dx, dy) {
  if (dx && s.dir.x || dy && s.dir.y) return;
  s.ndir = { x: dx, y: dy };
}

// ── Bot AI ─────────────────────────────────────────────────────
function botTick(bot, room) {
  if (!bot.alive) return;
  const h = bot.segs[0], m = 150;

  // Wall avoidance
  if (h.x < m || h.x > W - m || h.y < m || h.y > H - m) {
    const a = Math.atan2(H / 2 - h.y, W / 2 - h.x);
    setDir(bot, Math.round(Math.cos(a)), Math.round(Math.sin(a)));
    bot.evTick = 8;
    return;
  }
  if (bot.evTick > 0) { bot.evTick--; return; }

  // Seek nearest food
  let bf = null, bd = Infinity;
  for (const f of room.food) {
    const dx = f.x - h.x, dy = f.y - h.y, d = dx * dx + dy * dy;
    if (d < bd) { bd = d; bf = f; }
  }
  if (bf) {
    const dx = bf.x - h.x, dy = bf.y - h.y;
    Math.abs(dx) > Math.abs(dy)
      ? setDir(bot, dx > 0 ? 1 : -1, 0)
      : setDir(bot, 0, dy > 0 ? 1 : -1);
  }
  // Random wander
  if (Math.random() < 0.02) {
    bot.wAngle += (Math.random() - .5) * Math.PI;
    Math.random() < .5
      ? setDir(bot, Math.cos(bot.wAngle) > 0 ? 1 : -1, 0)
      : setDir(bot, 0, Math.sin(bot.wAngle) > 0 ? 1 : -1);
  }
  bot.boost = bd < (SEG * 10) ** 2 && bot.boostE > 20 && Math.random() < .3;
}

// ── Move snake ─────────────────────────────────────────────────
function moveSnake(s) {
  if (!s.alive) return;
  s.dir = { ...s.ndir };
  const spd = (s.boost && s.boostE > 0) ? SEG * 1.8 : SEG;
  const h   = s.segs[0];
  const nx  = ((h.x + s.dir.x * spd) % W + W) % W;
  const ny  = ((h.y + s.dir.y * spd) % H + H) % H;
  s.segs.unshift({ x: nx, y: ny });
  if (s.boost && s.boostE > 0) {
    s.boostE = Math.max(0, s.boostE - 5);
    if (s.segs.length > 8) s.segs.pop();
  } else {
    s.boostE = Math.min(100, s.boostE + 2);
    s.segs.pop();
  }
}

// ── Eat food ───────────────────────────────────────────────────
function eatFood(s, room) {
  if (!s.alive) return;
  const h = s.segs[0], rr = (SEG * 1.2) ** 2;
  for (let i = room.food.length - 1; i >= 0; i--) {
    const f  = room.food[i];
    const dx = h.x - f.x, dy = h.y - f.y;
    if (dx * dx + dy * dy < rr) {
      room.food.splice(i, 1);
      room.food.push(mkFood());
      const grow = f.val * 4;
      const tail = s.segs[s.segs.length - 1];
      for (let k = 0; k < grow; k++) s.segs.push({ ...tail });
      s.score += f.val;
      return f; // return eaten food for event broadcast
    }
  }
  return null;
}

// ── Kill snake ─────────────────────────────────────────────────
function killSnake(s, killer, room, cause = 'col') {
  if (!s.alive) return;
  s.alive = false;
  // Drop food
  for (let i = 0; i < s.segs.length; i += 2) {
    room.food.push({ ...mkFood(), x: s.segs[i].x, y: s.segs[i].y, val: 2, c: s.color });
  }
  if (killer) {
    killer.score += Math.floor(s.segs.length / 2);
    killer.kills = (killer.kills || 0) + 1;
  }

  // Emit kill event to room
  io.to(room.id).emit('snake_killed', {
    id:       s.id,
    killerId: killer?.id || null,
    killerName: killer?.name || 'arena',
    victimName: s.name,
    cause,
  });

  // Respawn bots after delay
  if (s.isBot) {
    setTimeout(() => {
      if (!rooms.has(room.id)) return;
      const newBot = createBot(parseInt(s.id.split('_')[1]) || 0);
      newBot.id = s.id;
      room.players.set(s.id, newBot);
    }, 4000 + Math.random() * 6000);
  }
}

// ── Collision check ────────────────────────────────────────────
function checkCollisions(room) {
  const alive = [...room.players.values()].filter(s => s.alive);
  for (const s of alive) {
    if (!s.alive) continue;
    const h = s.segs[0];
    for (const o of alive) {
      if (!o.alive) continue;
      const body = s === o ? o.segs.slice(6) : o.segs;
      for (const seg of body) {
        const dx = h.x - seg.x, dy = h.y - seg.y;
        if (dx * dx + dy * dy < (SEG * .72) ** 2) {
          if (s.shield) { s.shield = false; break; }
          killSnake(s, s === o ? null : o, room, 'col');
          break;
        }
      }
      if (!s.alive) break;
    }
  }
}

// ── Room game loop ─────────────────────────────────────────────
function startRoomLoop(room) {
  room.tickId = setInterval(() => {
    room.tickCount++;
    const players = [...room.players.values()];
    const alive   = players.filter(s => s.alive);

    // Bot AI
    for (const p of players) {
      if (p.isBot && p.alive) botTick(p, room);
    }

    // Move all
    for (const p of players) if (p.alive) moveSnake(p);

    // Eat food
    const eatenEvents = [];
    for (const p of players) {
      if (!p.alive) continue;
      const eaten = eatFood(p, room);
      if (eaten) eatenEvents.push({ playerId: p.id, foodId: eaten.id, score: p.score });
    }

    // Mode logic
    if (room.mode === 'royale') {
      room.royalR = Math.max(220, room.royalR - TICK / 1000 * 55);
      for (const s of alive) {
        const h = s.segs[0], dx = h.x - W/2, dy = h.y - H/2;
        if (dx*dx + dy*dy > (room.royalR - 8) ** 2) killSnake(s, null, room, 'zone');
      }
    }
    if (room.mode === 'deathmatch') {
      room.mTimer -= TICK;
      if (room.mTimer <= 0) {
        io.to(room.id).emit('game_over', { reason: 'DM_END', scores: getScores(room) });
        stopRoom(room);
        return;
      }
    }

    // Collisions
    checkCollisions(room);

    // Broadcast state every tick
    const state = {
      t: room.tickCount,
      players: players.map(p => ({
        id:      p.id,
        name:    p.name,
        color:   p.color,
        trail:   p.trail,
        alive:   p.alive,
        score:   p.score,
        kills:   p.kills,
        boost:   p.boost,
        boostE:  p.boostE,
        ghost:   p.ghost,
        shield:  p.shield,
        infected: p.infected,
        segs:    p.segs.slice(0, 80), // limit segments sent
        dir:     p.dir,
        isBot:   p.isBot || false,
      })),
      food:    room.food.slice(0, 200), // send nearest food
      mines:   room.mines,
      royalR:  room.royalR,
      mTimer:  room.mTimer,
      alive:   alive.length,
      tickCount: room.tickCount,
    };
    io.to(room.id).emit('state', state);

    // Broadcast eaten food
    if (eatenEvents.length) io.to(room.id).emit('food_eaten', eatenEvents);

    // Clean up empty rooms after 5 min
    const humanPlayers = [...room.players.values()].filter(p => !p.isBot);
    if (humanPlayers.length === 0 && Date.now() - room.createdAt > 300000) {
      stopRoom(room);
    }
  }, TICK);
}

function stopRoom(room) {
  clearInterval(room.tickId);
  rooms.delete(room.id);
  console.log(`[Room] Stopped ${room.id}`);
}

function getScores(room) {
  return [...room.players.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
    .map(p => ({ name: p.name, score: p.score, kills: p.kills, color: p.color }));
}

// ── Matchmaking ────────────────────────────────────────────────
function findOrCreateRoom(mode) {
  // Find existing room with space and same mode
  for (const [, room] of rooms) {
    const humans = [...room.players.values()].filter(p => !p.isBot);
    if (room.mode === mode && humans.length < MAX_ROOM_PLAYERS) return room;
  }
  // Create new room
  const room = createRoom(mode);
  // Add 8 bots to fill it
  for (let i = 0; i < 8; i++) {
    const bot = createBot(i);
    room.players.set(bot.id, bot);
  }
  return room;
}

// ── Socket.io events ───────────────────────────────────────────
io.on('connection', socket => {
  console.log(`[Socket] Connected: ${socket.id}`);

  // ── JOIN GAME ────────────────────────────────────────────────
  socket.on('join', ({ name, color, trail, mode = 'survival' }) => {
    const room = findOrCreateRoom(mode);

    // Create player
    const player = createPlayer(socket.id, name, color, trail);
    room.players.set(socket.id, player);
    playerRoom.set(socket.id, room.id);

    // Join socket room
    socket.join(room.id);

    // Send room info back to this player
    socket.emit('joined', {
      roomId:   room.id,
      playerId: socket.id,
      mode:     room.mode,
      players:  [...room.players.values()].map(p => ({
        id: p.id, name: p.name, color: p.color, isBot: p.isBot || false,
      })),
    });

    // Tell others a new player joined
    socket.to(room.id).emit('player_joined', {
      id:    socket.id,
      name:  player.name,
      color: player.color,
    });

    console.log(`[Room ${room.id}] ${player.name} joined. Players: ${room.players.size}`);
  });

  // ── PLAYER INPUT ─────────────────────────────────────────────
  socket.on('input', ({ dir, boost }) => {
    const roomId = playerRoom.get(socket.id);
    if (!roomId) return;
    const room   = rooms.get(roomId);
    if (!room)   return;
    const player = room.players.get(socket.id);
    if (!player || !player.alive) return;

    // Anti-cheat: validate direction
    if (dir && (dir.x === 0 || dir.x === 1 || dir.x === -1) && (dir.y === 0 || dir.y === 1 || dir.y === -1)) {
      if (!(dir.x && player.dir.x) && !(dir.y && player.dir.y)) {
        player.ndir = dir;
      }
    }
    player.boost     = boost === true;
    player.lastInput = Date.now();
  });

  // ── ABILITY USED ─────────────────────────────────────────────
  socket.on('ability', ({ id: abilId }) => {
    const roomId = playerRoom.get(socket.id);
    if (!roomId) return;
    const room   = rooms.get(roomId);
    const player = room?.players.get(socket.id);
    if (!player || !player.alive) return;

    // Broadcast ability to room (visual effects on clients)
    socket.to(roomId).emit('ability_used', {
      playerId: socket.id,
      ability:  abilId,
      x:        player.segs[0]?.x,
      y:        player.segs[0]?.y,
    });

    if (abilId === 'ghost') {
      player.ghost = true;
      setTimeout(() => { if (player) player.ghost = false; }, 3000);
    }
    if (abilId === 'trap') {
      const tail = player.segs[player.segs.length - 1];
      if (tail) {
        room.mines.push({ x: tail.x, y: tail.y, owner: socket.id, t: 12000 });
      }
    }
  });

  // ── CHAT / EMOTE ─────────────────────────────────────────────
  socket.on('emote', ({ text }) => {
    const roomId = playerRoom.get(socket.id);
    if (!roomId) return;
    const room   = rooms.get(roomId);
    const player = room?.players.get(socket.id);
    if (!player) return;
    const safe = String(text).slice(0, 30).replace(/</g, '&lt;');
    io.to(roomId).emit('emote', { name: player.name, text: safe, color: player.color });
  });

  // ── RESPAWN ──────────────────────────────────────────────────
  socket.on('respawn', () => {
    const roomId = playerRoom.get(socket.id);
    if (!roomId) return;
    const room   = rooms.get(roomId);
    if (!room)   return;
    const old    = room.players.get(socket.id);
    if (!old)    return;

    // Keep name/color but reset position
    const newP = createPlayer(socket.id, old.name, old.color, old.trail);
    room.players.set(socket.id, newP);
    socket.emit('respawned', { playerId: socket.id });
  });

  // ── DISCONNECT ───────────────────────────────────────────────
  socket.on('disconnect', () => {
    const roomId = playerRoom.get(socket.id);
    if (roomId) {
      const room = rooms.get(roomId);
      if (room) {
        room.players.delete(socket.id);
        socket.to(roomId).emit('player_left', { id: socket.id });
        console.log(`[Room ${roomId}] ${socket.id} left. Players: ${room.players.size}`);
      }
      playerRoom.delete(socket.id);
    }
    console.log(`[Socket] Disconnected: ${socket.id}`);
  });
});

// ── REST API ───────────────────────────────────────────────────

// Health check
app.get('/health', (req, res) => {
  res.json({
    status:  'ok',
    uptime:  Math.floor(process.uptime()),
    rooms:   rooms.size,
    players: [...rooms.values()].reduce((n, r) =>
      n + [...r.players.values()].filter(p => !p.isBot).length, 0),
    memory:  Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB',
  });
});

// Active rooms
app.get('/rooms', (req, res) => {
  const list = [...rooms.values()].map(r => ({
    id:      r.id,
    mode:    r.mode,
    humans:  [...r.players.values()].filter(p => !p.isBot).length,
    bots:    [...r.players.values()].filter(p => p.isBot).length,
    total:   r.players.size,
  }));
  res.json(list);
});

// Global leaderboard (in-memory, reset on restart)
app.get('/leaderboard', (req, res) => {
  const scores = [...rooms.values()].flatMap(r =>
    [...r.players.values()]
      .filter(p => !p.isBot && p.score > 0)
      .map(p => ({ name: p.name, score: p.score, kills: p.kills, color: p.color }))
  ).sort((a, b) => b.score - a.score).slice(0, 20);
  res.json(scores);
});

// Submit score
app.post('/score', (req, res) => {
  const { name, score, kills, mode } = req.body;
  if (!name || !score) return res.status(400).json({ error: 'name and score required' });
  leaderboard.push({ name: String(name).slice(0,14), score: Number(score), kills: Number(kills)||0, mode, date: new Date() });
  leaderboard.sort((a,b) => b.score - a.score);
  if (leaderboard.length > 100) leaderboard.length = 100;
  res.json({ ok: true, rank: leaderboard.findIndex(e => e.name === name && e.score === score) + 1 });
});

// ── Start server ───────────────────────────────────────────────
server.listen(PORT, () => {
  console.log('');
  console.log('╔══════════════════════════════════════════════╗');
  console.log(`║  🐍 VENOM RUSH Server running on :${PORT}     ║`);
  console.log('╚══════════════════════════════════════════════╝');
  console.log(`  Health:      http://localhost:${PORT}/health`);
  console.log(`  Rooms:       http://localhost:${PORT}/rooms`);
  console.log(`  Leaderboard: http://localhost:${PORT}/leaderboard`);
  console.log('');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Shutting down...');
  for (const room of rooms.values()) stopRoom(room);
  server.close(() => process.exit(0));
});
