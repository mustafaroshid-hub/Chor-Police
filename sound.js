// ============================================================
// SOUND.JS — Lightweight synthesized SFX (Web Audio API)
// No external files needed, so nothing to go missing on deploy.
// A background "music" bed is a soft synthesized pad loop.
// ============================================================

class SoundEngine {
  constructor() {
    this.ctx = null;
    this.sfxOn = true;
    this.musicOn = true;
    this.sfxVolume = 0.7;
    this.musicVolume = 0.25;
    this.musicNodes = null;
  }

  _ensureCtx() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }

  _tone(freq, duration, type = 'sine', gainMul = 1, delay = 0) {
    if (!this.sfxOn) return;
    const ctx = this._ensureCtx();
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(this.sfxVolume * gainMul, t0 + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  _noiseBurst(duration, gainMul = 1, delay = 0) {
    if (!this.sfxOn) return;
    const ctx = this._ensureCtx();
    const t0 = ctx.currentTime + delay;
    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(this.sfxVolume * gainMul, t0);
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 800;
    src.connect(filter).connect(gain).connect(ctx.destination);
    src.start(t0);
  }

  cardShuffle() {
    for (let i = 0; i < 6; i++) this._noiseBurst(0.06, 0.5, i * 0.07);
  }
  cardDeal() { this._noiseBurst(0.08, 0.6); }
  cardFlip() { this._tone(600, 0.08, 'triangle', 0.5); this._noiseBurst(0.04, 0.3, 0.02); }
  cardSlide() { this._noiseBurst(0.1, 0.35); }
  buttonClick() { this._tone(440, 0.06, 'square', 0.3); }
  playerJoin() { this._tone(523, 0.1, 'sine', 0.5); this._tone(659, 0.12, 'sine', 0.5, 0.08); }
  playerLeave() { this._tone(392, 0.12, 'sine', 0.4); this._tone(261, 0.15, 'sine', 0.4, 0.08); }
  policeIdentified() { this._tone(220, 0.15, 'sawtooth', 0.4); this._tone(440, 0.25, 'sawtooth', 0.5, 0.1); }
  selecting() { this._tone(800, 0.04, 'square', 0.2); }
  correctGuess() {
    [523, 659, 784, 1047].forEach((f, i) => this._tone(f, 0.2, 'triangle', 0.6, i * 0.09));
  }
  wrongGuess() {
    this._tone(200, 0.3, 'sawtooth', 0.5);
    this._tone(150, 0.35, 'sawtooth', 0.4, 0.1);
  }
  scoreUp() { this._tone(700, 0.08, 'sine', 0.4); this._tone(950, 0.1, 'sine', 0.4, 0.06); }
  roundComplete() { [440, 550, 660].forEach((f, i) => this._tone(f, 0.15, 'sine', 0.4, i * 0.1)); }
  victory() {
    [523, 659, 784, 1047, 1319].forEach((f, i) => this._tone(f, 0.3, 'triangle', 0.6, i * 0.12));
  }

  startMusic() {
    if (!this.musicOn || this.musicNodes) return;
    const ctx = this._ensureCtx();
    const master = ctx.createGain();
    master.gain.value = this.musicVolume;
    master.connect(ctx.destination);
    const notes = [261.6, 329.6, 392.0, 523.3];
    const oscs = notes.map((f, i) => {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f / 2;
      const g = ctx.createGain();
      g.gain.value = 0.15;
      o.connect(g).connect(master);
      o.start();
      return o;
    });
    this.musicNodes = { master, oscs };
  }
  stopMusic() {
    if (!this.musicNodes) return;
    this.musicNodes.oscs.forEach(o => { try { o.stop(); } catch (e) {} });
    this.musicNodes = null;
  }
  setMusicOn(on) { this.musicOn = on; if (on) this.startMusic(); else this.stopMusic(); }
  setSfxOn(on) { this.sfxOn = on; }
  setSfxVolume(v) { this.sfxVolume = v; }
  setMusicVolume(v) { this.musicVolume = v; if (this.musicNodes) this.musicNodes.master.gain.value = v; }
}

if (typeof window !== 'undefined') {
  window.CP_Sound = new SoundEngine();
}
