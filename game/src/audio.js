// All sound is synthesized in code with WebAudio — no audio files.
// A small engine hum, a two-tone siren, percussive effects and a laid-back
// bass-led music loop that fits a sun-soaked coastal city.

export function createAudio() {
  let ctx = null;
  let master = null;
  let musicGain = null;
  let engineOsc = null, engineGain = null;
  let sirenOsc = null, sirenGain = null;
  let muted = false;
  let musicTimer = null;
  let step = 0;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      musicGain = ctx.createGain();
      musicGain.gain.value = 0.16;
      musicGain.connect(master);
      // Engine: a low sawtooth whose pitch follows the car's speed.
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      const engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 320;
      engineOsc.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      // Siren: a sine that swings between two tones.
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'sine';
      sirenOsc.frequency.value = 720;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      return true;
    } catch {
      return false;
    }
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (!ensure() || muted) return;
    const t0 = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol || 0.2, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g); g.connect(master);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }

  function noise(dur, vol, filterFreq) {
    if (!ensure() || muted) return;
    const t0 = ctx.currentTime;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = filterFreq || 1200;
    const g = ctx.createGain();
    g.gain.value = vol || 0.3;
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t0);
  }

  // A 16-step loop: warm bass notes with a soft lead pluck, C minor pentatonic.
  const BASS = [0, 0, 0, 3, 0, 0, 5, 3, 0, 0, 0, 3, 8, 7, 5, 3];
  const BASS_FREQ = [130.81, 130.81, 130.81, 155.56, 130.81, 130.81, 196.0, 155.56, 130.81, 130.81, 130.81, 155.56, 233.08, 220.0, 196.0, 155.56];
  const LEAD = [0, -1, 12, -1, 10, -1, 12, 15, -1, 12, -1, 10, 8, 10, -1, 12];

  function musicStep() {
    if (!ctx || muted) return;
    const i = step % 16;
    const bf = BASS_FREQ[i];
    if (bf) {
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = bf;
      const g = ctx.createGain();
      const t0 = ctx.currentTime;
      g.gain.setValueAtTime(0.5, t0);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.42);
      o.connect(g); g.connect(musicGain);
      o.start(t0); o.stop(t0 + 0.45);
    }
    const lv = LEAD[i];
    if (lv >= 0) {
      const freq = 523.25 * Math.pow(2, lv / 12);
      const o = ctx.createOscillator();
      o.type = 'square';
      o.frequency.value = freq;
      const g = ctx.createGain();
      const t0 = ctx.currentTime;
      g.gain.setValueAtTime(0.10, t0);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.18);
      o.connect(g); g.connect(musicGain);
      o.start(t0); o.stop(t0 + 0.2);
    }
    step++;
  }

  return {
    unlock() { ensure(); if (ctx && ctx.state === 'suspended') ctx.resume(); },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    get muted() { return muted; },
    startMusic() {
      if (!ensure() || musicTimer) return;
      musicTimer = setInterval(musicStep, 240);
    },
    stopMusic() { if (musicTimer) { clearInterval(musicTimer); musicTimer = null; } },
    setEngine(speed01, driving) {
      if (!ensure() || muted) return;
      const target = driving ? 0.05 + speed01 * 0.09 : 0;
      engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.08);
      engineOsc.frequency.setTargetAtTime(55 + speed01 * 110, ctx.currentTime, 0.1);
    },
    setSiren(on, wanted) {
      if (!ensure()) return;
      const t0 = ctx.currentTime;
      sirenGain.gain.setTargetAtTime(on && !muted ? 0.05 + wanted * 0.008 : 0, t0, 0.2);
      if (on) {
        const phase = Math.floor(t0 * 1.6) % 2;
        sirenOsc.frequency.setTargetAtTime(phase ? 720 : 960, t0, 0.05);
      }
    },
    shoot() { noise(0.12, 0.35, 2600); tone(180, 0.08, 'square', 0.12, 60); },
    punch() { noise(0.08, 0.25, 700); },
    crash() { noise(0.22, 0.4, 500); tone(90, 0.2, 'sine', 0.3, 40); },
    pickup() { tone(660, 0.1, 'sine', 0.2); setTimeout(() => tone(990, 0.14, 'sine', 0.2), 90); },
    missionDone() {
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((f, i) => setTimeout(() => tone(f, 0.22, 'triangle', 0.22), i * 110));
    },
    busted() { tone(392, 0.4, 'sawtooth', 0.15, 196); },
    wasted() { tone(220, 0.7, 'sawtooth', 0.18, 55); },
    click() { tone(880, 0.05, 'sine', 0.12); },
    horn() { tone(370, 0.18, 'square', 0.12); tone(466, 0.18, 'square', 0.1); },
  };
}
