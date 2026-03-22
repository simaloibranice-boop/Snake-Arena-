export const he      = (s) => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
export const clamp   = (v, mn, mx) => Math.min(mx, Math.max(mn, v))
export const lerp    = (a, b, t) => a + (b - a) * t
export const wrap    = (v, max) => ((v % max) + max) % max
export const dist2   = (ax, ay, bx, by) => (ax-bx)**2 + (ay-by)**2
export const uid     = () => Math.random().toString(36).slice(2, 9)
export const pick    = (arr) => arr[Math.floor(Math.random() * arr.length)]
export const today   = () => Math.floor(Date.now() / 86400000)
export const fmtTime = (s) => `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`
export const fmtMs   = (ms) => fmtTime(Math.ceil(ms / 1000))
