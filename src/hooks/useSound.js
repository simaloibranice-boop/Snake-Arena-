import { useRef, useCallback } from 'react'

export function useSound() {
  const acRef = useRef(null)

  const getAC = useCallback(() => {
    if (!acRef.current) acRef.current = new (window.AudioContext || window.webkitAudioContext)()
    if (acRef.current.state === 'suspended') acRef.current.resume()
    return acRef.current
  }, [])

  const tone = useCallback((freq, dur, type='sine', vol=0.13, f2=0) => {
    try {
      const ac=getAC(), o=ac.createOscillator(), g=ac.createGain()
      o.connect(g); g.connect(ac.destination)
      o.type=type; o.frequency.value=f2||freq
      if (f2) o.frequency.exponentialRampToValueAtTime(freq, ac.currentTime+dur*.4)
      g.gain.setValueAtTime(vol, ac.currentTime)
      g.gain.exponentialRampToValueAtTime(.001, ac.currentTime+dur)
      o.start(); o.stop(ac.currentTime+dur+.01)
    } catch {}
  }, [getAC])

  const noise = useCallback((dur, vol=0.1, cut=600) => {
    try {
      const ac=getAC(), buf=ac.createBuffer(1,ac.sampleRate*dur,ac.sampleRate)
      const d=buf.getChannelData(0); for(let i=0;i<d.length;i++) d[i]=Math.random()*2-1
      const s=ac.createBufferSource(), f=ac.createBiquadFilter(), g=ac.createGain()
      s.buffer=buf; f.type='lowpass'; f.frequency.value=cut
      s.connect(f); f.connect(g); g.connect(ac.destination)
      g.gain.setValueAtTime(vol,ac.currentTime)
      g.gain.exponentialRampToValueAtTime(.001,ac.currentTime+dur)
      s.start()
    } catch {}
  }, [getAC])

  const sfx = {
    eat:   () => { tone(500,.05); tone(750,.04,'sine',.05) },
    kill:  () => { noise(.18,.22,800); tone(100,.35,'sawtooth',.15,350) },
    lvlup: () => { [523,659,784,1047].forEach((f,i)=>setTimeout(()=>tone(f,.15,'sine',.14),i*85)) },
    boost: () => tone(900,.07,'sawtooth',.04,450),
    pu:    () => { tone(880,.1,'sine',.12); setTimeout(()=>tone(1100,.14,'sine',.1),80) },
    death: () => { noise(.45,.3); tone(70,.55,'sawtooth',.18,220) },
    ab:    () => tone(660,.1,'square',.08),
    ach:   () => { [784,988,1175].forEach((f,i)=>setTimeout(()=>tone(f,.12,'sine',.1),i*75)) },
    mine:  () => { noise(.35,.38); tone(55,.45,'sawtooth',.22,160) },
    combo: () => tone(1400,.07,'sine',.1),
  }

  return { sfx, wakeAC: getAC }
}
