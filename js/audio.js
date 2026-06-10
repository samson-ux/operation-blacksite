// WebAudio SFX synth — no external audio files.
const AudioSys = (() => {
  let ctx = null, master = null, volume = 0.7;

  function ensure() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = volume;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  function setVolume(v) { volume = v; if (master) master.gain.value = v; }

  function noiseBuffer(dur) {
    const c = ensure();
    const buf = c.createBuffer(1, Math.max(1, (dur * c.sampleRate) | 0), c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }
  function env(g, t0, a, peak, dec) {
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + dec);
  }
  function burst(dur, peak, filtType, freq, q) {
    const c = ensure(), t = c.currentTime;
    const src = c.createBufferSource(); src.buffer = noiseBuffer(dur);
    const f = c.createBiquadFilter(); f.type = filtType; f.frequency.value = freq; f.Q.value = q || 1;
    const g = c.createGain(); env(g, t, 0.002, peak, dur);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t); src.stop(t + dur + 0.05);
  }
  function tone(type, f0, f1, dur, peak, delay) {
    const c = ensure(), t = c.currentTime + (delay || 0);
    const o = c.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    const g = c.createGain(); env(g, t, 0.004, peak, dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.05);
  }

  const S = {
    rifle()   { burst(0.09, 0.5, 'lowpass', 900, 1); tone('square', 220, 60, 0.07, 0.25); },
    pistol()  { burst(0.06, 0.35, 'bandpass', 1400, 2); tone('square', 320, 90, 0.05, 0.18); },
    shotgun() { burst(0.22, 0.7, 'lowpass', 600, 1); tone('sawtooth', 130, 35, 0.18, 0.35); },
    pump()    { burst(0.05, 0.2, 'highpass', 1800, 3); burst(0.05, 0.2, 'highpass', 1200, 3); setTimeout(() => burst(0.06, 0.25, 'highpass', 900, 3), 130); },
    reload()  { tone('square', 700, 500, 0.04, 0.12); setTimeout(() => tone('square', 500, 800, 0.05, 0.12), 180); setTimeout(() => tone('square', 900, 600, 0.04, 0.14), 380); },
    dryfire() { tone('square', 1100, 900, 0.03, 0.1); },
    swap()    { burst(0.04, 0.15, 'highpass', 2200, 2); },
    hit()     { tone('square', 1500, 1200, 0.035, 0.22); },
    headshot(){ tone('square', 2100, 1600, 0.04, 0.26); tone('square', 2700, 2100, 0.045, 0.2, 0.03); },
    kill()    { tone('sawtooth', 300, 90, 0.12, 0.18); },
    explosion(){ burst(0.7, 0.9, 'lowpass', 300, 0.7); tone('sine', 90, 25, 0.6, 0.5); },
    ping()    { tone('sine', 1320, 1320, 0.1, 0.22); tone('sine', 1760, 1760, 0.18, 0.18, 0.11); },
    radioOn() { burst(0.06, 0.12, 'bandpass', 2400, 6); tone('square', 1900, 1900, 0.03, 0.06, 0.05); },
    radioOff(){ burst(0.05, 0.1, 'bandpass', 2000, 6); },
    hurt()    { burst(0.12, 0.3, 'lowpass', 500, 1); tone('sawtooth', 180, 70, 0.1, 0.2); },
    enemyShot(){ burst(0.08, 0.22, 'lowpass', 700, 1); tone('square', 180, 55, 0.06, 0.12); },
    step()    { burst(0.035, 0.06, 'lowpass', 400, 1); },
    jump()    { burst(0.05, 0.08, 'lowpass', 600, 1); },
    slide()   { burst(0.25, 0.1, 'lowpass', 350, 0.8); },
    checkpoint(){ tone('sine', 880, 880, 0.08, 0.18); tone('sine', 1108, 1108, 0.12, 0.16, 0.09); },
    objDone() { tone('sine', 660, 660, 0.09, 0.2); tone('sine', 880, 880, 0.09, 0.2, 0.1); tone('sine', 1320, 1320, 0.16, 0.2, 0.2); },
    bossShield(){ tone('sawtooth', 2400, 2000, 0.06, 0.14); },
    shieldDown(){ tone('sawtooth', 1500, 200, 0.4, 0.3); burst(0.3, 0.3, 'highpass', 1500, 2); },
    alarm()   { tone('square', 700, 700, 0.25, 0.12); tone('square', 560, 560, 0.25, 0.12, 0.3); },
    heli()    { for (let i = 0; i < 10; i++) burstDelayed(i * 0.09); },
    click()   { tone('square', 1000, 900, 0.025, 0.08); },
    death()   { tone('sawtooth', 220, 40, 0.8, 0.3); burst(0.5, 0.3, 'lowpass', 250, 1); },
  };
  function burstDelayed(d) { setTimeout(() => burst(0.05, 0.25, 'lowpass', 200, 1), d * 1000); }

  return { ensure, setVolume, play(name) { try { ensure(); S[name] && S[name](); } catch (e) {} } };
})();
