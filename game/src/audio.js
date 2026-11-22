// Synthesised sound for Costa Verde: no audio files, everything is built with the
// Web Audio API — engine hum, sirens, gunshots, pickups and a bass music loop.
export function createAudio() {
  let ctx = null;
  let engineOsc = null;
  let engineGain = null;
  let musicTimer = null;
  let muted = false;
  const bassNotes = [55, 55, 65.41, 49, 55, 55, 82.41, 73.42];
  let bassStep = 0;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      // Engine: a sawtooth through a low-pass filter, pitch follows speed.
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 60;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 320;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(filter);
      filter.connect(engineGain);
      engineGain.connect(ctx.destination);
      engineOsc.start();
      return true;
    } catch {
      return false;
    }
  }

  function unlock() {
    if (ensure() && ctx.state === 'suspended') ctx.resume().catch(() => {});
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (!ctx || muted) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur);
      gain.gain.setValueAtTime(vol || 0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + dur + 0.02);
    } catch { /* sound is best-effort */ }
  }

  function noiseBurst(dur, vol) {
    if (!ctx || muted) return;
    try {
      const len = Math.floor(ctx.sampleRate * dur);
      const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      const gain = ctx.createGain();
      gain.gain.value = vol || 0.25;
      src.connect(gain);
      gain.connect(ctx.destination);
      src.start();
    } catch { /* sound is best-effort */ }
  }

  return {
    unlock,
    toggleMute() {
      muted = !muted;
      if (engineGain) engineGain.gain.value = 0;
      return muted;
    },
    isMuted() {
      return muted;
    },
    // speed01: 0 when parked, 1 at top speed.
    setEngine(speed01, driving) {
      if (!ctx || muted || !engineGain) return;
      const target = driving ? 0.03 + speed01 * 0.05 : 0;
      engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.1);
      engineOsc.frequency.setTargetAtTime(55 + speed01 * 130, ctx.currentTime, 0.1);
    },
    shoot() {
      noiseBurst(0.12, 0.3);
      tone(160, 0.08, 'square', 0.1, 60);
    },
    punch() {
      noiseBurst(0.07, 0.18);
    },
    crash() {
      noiseBurst(0.25, 0.35);
      tone(90, 0.25, 'sawtooth', 0.15, 40);
    },
    pickup() {
      tone(660, 0.09, 'sine', 0.12);
      setTimeout(() => tone(880, 0.12, 'sine', 0.12), 70);
    },
    coin() {
      tone(988, 0.08, 'triangle', 0.14);
      setTimeout(() => tone(1319, 0.14, 'triangle', 0.14), 80);
    },
    missionDone() {
      [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.22, 'triangle', 0.14), i * 110));
    },
    busted() {
      tone(220, 0.5, 'sawtooth', 0.16, 110);
    },
    startMusic() {
      if (!ensure() || musicTimer) return;
      musicTimer = setInterval(() => {
        if (muted || !ctx || ctx.state !== 'running') return;
        tone(bassNotes[bassStep % bassNotes.length], 0.42, 'triangle', 0.07);
        if (bassStep % 2 === 0) tone(220, 0.1, 'sine', 0.03);
        bassStep++;
      }, 430);
    },
    // Two-tone police siren while a chase is on; call once per frame.
    siren(on, time) {
      if (!ctx || muted) return;
      if (!on) return;
      const phase = Math.floor(time * 2.4) % 2;
      if (phase !== this._sirenPhase) {
        this._sirenPhase = phase;
        tone(phase === 0 ? 700 : 950, 0.4, 'sine', 0.035);
      }
    },
    _sirenPhase: 0,
  };
}
