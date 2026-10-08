/** Música y efectos originales sintetizados localmente; se inicia tras un gesto. */
export class AudioSystem {
  constructor({ muted = false, musicEnabled = true, volume = 0.55 } = {}) {
    this.muted = Boolean(muted);
    this.musicEnabled = Boolean(musicEnabled);
    this.volume = Math.max(0, Math.min(1, volume));
    this.scene = 'menu';
    this.ready = false;
    this.context = null;
    this.suspended = false;
    this.step = 0;
    this.nextStep = 0;
    this.timer = null;
    this.lastSfx = new Map();
    this.voices = new Set();
    this.lifecycle = 0;
  }

  async unlock() {
    try {
      if (!this.context) {
        const Context = globalThis.AudioContext || globalThis.webkitAudioContext;
        if (!Context) return false;
        this.context = new Context({ latencyHint: 'interactive' });
        const ctx = this.context;
        this.master = ctx.createGain();
        this.music = ctx.createGain();
        this.effects = ctx.createGain();
        this.limiter = ctx.createDynamicsCompressor();
        this.limiter.threshold.value = -12;
        this.limiter.knee.value = 18;
        this.limiter.ratio.value = 6;
        this.limiter.attack.value = 0.004;
        this.limiter.release.value = 0.18;
        this.master.gain.value = this.muted ? 0 : this.volume;
        this.music.gain.value = this.musicEnabled ? 0.38 : 0;
        this.effects.gain.value = 0.72;
        this.music.connect(this.master);
        this.effects.connect(this.master);
        this.master.connect(this.limiter);
        this.limiter.connect(ctx.destination);
        this.noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
        const samples = this.noiseBuffer.getChannelData(0);
        let previous = 0;
        for (let i = 0; i < samples.length; i++) {
          const white = Math.random() * 2 - 1;
          previous = (previous + 0.08 * white) / 1.08;
          samples[i] = white * 0.68 + previous * 2.8;
        }
      }
      await this.context.resume();
      this.ready = this.context.state === 'running';
      this.suspended = false;
      this.lifecycle++;
      this._applyVolume();
      if (this.ready) this._startClock();
      return this.ready;
    } catch {
      return false;
    }
  }

  setMuted(value) { this.muted = Boolean(value); this._applyVolume(); }
  toggleMuted() { this.setMuted(!this.muted); return this.muted; }
  setMusicEnabled(value) {
    this.musicEnabled = Boolean(value);
    if (this.music && this.context) this.music.gain.setTargetAtTime(this.musicEnabled ? 0.38 : 0, this.context.currentTime, 0.045);
  }
  setVolume(value) { this.volume = Math.max(0, Math.min(1, Number(value) || 0)); this._applyVolume(); }
  _applyVolume() {
    if (this.master && this.context) this.master.gain.setTargetAtTime(this.muted || this.suspended ? 0 : this.volume, this.context.currentTime, 0.02);
  }
  setScene(scene) {
    const next = scene === 'boss' ? 'playing' : ['menu', 'playing', 'won', 'dead', 'intro', 'ending', 'credits'].includes(scene) ? scene : 'playing';
    if (next === this.scene) return;
    this.scene = next;
    this.step = 0;
    if (this.context) this.nextStep = this.context.currentTime + 0.06;
  }
  suspend() {
    this.suspended = true;
    this.lifecycle++;
    this._applyVolume();
    clearInterval(this.timer);
    this.timer = null;
    // Keep the context alive: resuming a paused game must not require a second gesture.
    // Already scheduled notes finish within 120 ms behind the muted master bus.
  }
  async resume() {
    if (!this.context || !this.ready) return false;
    const operation = ++this.lifecycle;
    try {
      if (this.context.state === 'suspended') await this.context.resume();
      if (operation !== this.lifecycle) return false;
      this.suspended = false;
      this._applyVolume();
      this._startClock();
      return true;
    } catch { return false; }
  }
  update() {}
  destroy() {
    clearInterval(this.timer);
    this.timer = null;
    this.lifecycle++;
    for (const voice of this.voices) { try { voice.stop(); } catch {} }
    this.voices.clear();
    this.context?.close().catch(() => {});
    this.context = null;
    this.ready = false;
  }

  _startClock() {
    if (this.timer || !this.context || this.suspended) return;
    this.nextStep = this.context.currentTime + 0.045;
    this._schedule();
    this.timer = setInterval(() => this._schedule(), 40);
  }
  _schedule() {
    const ctx = this.context;
    if (!ctx || ctx.state !== 'running' || this.suspended) return;
    if (this.nextStep < ctx.currentTime - 0.15) this.nextStep = ctx.currentTime + 0.02;
    const bpm = this.scene === 'intro' ? 84 : this.scene === 'ending' ? 68 : this.scene === 'credits' ? 108 : this.scene === 'playing' ? 112 : this.scene === 'won' ? 100 : 78;
    const sixteenth = 60 / bpm / 4;
    while (this.nextStep < ctx.currentTime + 0.12) {
      if (this.musicEnabled && !this.muted) this._musicStep(this.step, this.nextStep, sixteenth);
      this.step++;
      this.nextStep += sixteenth;
    }
  }
  _musicStep(step, time, duration) {
    if (this.scene === 'intro') return this._introStep(step, time, duration);
    if (this.scene === 'ending') return this._endingStep(step, time, duration);
    if (this.scene === 'credits') return this._creditsStep(step, time, duration);
    if (this.scene === 'playing' || this.scene === 'boss') return this._battleStep(step, time, duration);
    const beat = step % 16;
    const bar = Math.floor(step / 16) % 8;
    const battle = this.scene === 'playing' || this.scene === 'boss';
    const boss = this.scene === 'boss';
    const victory = this.scene === 'won';
    const defeated = this.scene === 'dead';
    // D minor, B-flat, C, A: a deliberately simple, looping sword-and-sorcery ostinato.
    const roots = victory ? [50, 53, 58, 60, 50, 53, 60, 62] : [38, 38, 34, 34, 36, 36, 33, 33];
    const root = roots[bar];
    if (beat === 0) {
      const padTime = duration * 15.5;
      this._tone(this._note(root + 24), padTime, 0.045, 'triangle', time, this.music, { attack: 0.22, release: 0.4, filter: 1200 });
      this._tone(this._note(root + (victory ? 28 : 27)), padTime, 0.028, 'triangle', time, this.music, { attack: 0.3, release: 0.45, pan: -0.3, filter: 1050 });
      this._tone(this._note(root + 31), padTime, 0.025, 'triangle', time, this.music, { attack: 0.35, release: 0.45, pan: 0.3, filter: 1200 });
    }
    if (defeated) return;
    if (beat % (battle ? 2 : 4) === 0) {
      const bassNote = root + (beat === 10 || beat === 14 ? 12 : 0);
      this._tone(this._note(bassNote), duration * (battle ? 1.4 : 2.5), battle ? 0.13 : 0.065, 'sawtooth', time, this.music, { filter: boss ? 600 : 360, attack: 0.008, release: 0.09 });
    }
    if (battle || victory) {
      if (beat === 0 || beat === 8 || (boss && beat === 6) || (bar % 2 && beat === 11)) this._kick(time, this.music, boss ? 0.28 : 0.23);
      if (beat === 4 || beat === 12) {
        this._noise(0.13, 0.13, time, this.music, { frequency: 1500, kind: 'highpass' });
        this._tone(175, 0.08, 0.07, 'triangle', time, this.music, { endFrequency: 90 });
      }
      if (beat % 2 === 0 || (boss && beat > 11)) this._noise(beat % 4 === 2 ? 0.07 : 0.028, beat % 4 === 2 ? 0.042 : 0.025, time, this.music, { frequency: 5800, kind: 'highpass', pan: beat % 4 === 0 ? -0.25 : 0.25 });
    }
    // Sparse high-register call-and-response leaves room for readable combat audio.
    const motif = [0, null, 7, null, 12, null, 10, null, 7, null, 3, null, 5, 3, 0, null];
    if ((battle && bar % 2 === 1) || victory || (!battle && beat % 4 === 0)) {
      const interval = motif[beat];
      if (interval !== null) this._tone(this._note(root + 24 + interval), duration * (boss ? 0.8 : 1.7), battle ? 0.047 : 0.035, 'square', time, this.music, { filter: 1600, attack: 0.006, release: 0.07, pan: (bar % 2 ? 1 : -1) * 0.25 });
    }
  }

  /** One uninterrupted thirty-two-bar arcade march for all combat. */
  _battleStep(step, time, duration) {
    const beat = step % 16;
    const bar = Math.floor(step / 16) % 32;
    const section = Math.floor(bar / 8);
    const roots = [38, 34, 41, 36, 38, 43, 34, 33];
    const root = roots[bar % roots.length];
    const third = [38, 43, 31].includes(root) ? 3 : 4;
    const bus = this.music;
    const breakdown = section === 2;
    if (beat === 0) {
      [24, 24 + third, 31].forEach((interval, voice) => {
        this._tone(this._note(root + interval), duration * 15, 0.026, 'triangle', time, bus,
          { attack: 0.08, release: 0.18, filter: 1600, pan: (voice - 1) * 0.3 });
      });
      if (bar % 8 === 0) this._noise(0.35, 0.048, time, bus, { frequency: 4200, kind: 'highpass', pan: 0.3 });
    }
    // Palm-muted pulse, with fifths and octave pickups instead of one repeating bass note.
    if (beat % 2 === 0) {
      const interval = [0, 0, 7, 12, 0, 7, 0, 12][Math.floor(beat / 2)];
      this._tone(this._note(root + interval), duration * 1.15, 0.12, 'sawtooth', time, bus,
        { attack: 0.005, release: 0.055, filter: 520 });
    }
    const phrases = [
      [[0,62,3],[4,69,2],[8,65,3],[12,64,2],[15,65,1]],
      [[0,65,3],[4,70,3],[8,69,2],[12,65,3]],
      [[0,69,3],[4,72,2],[7,74,1],[8,77,3],[12,72,3]],
      [[0,67,3],[4,72,3],[8,76,3],[12,72,2],[15,69,1]],
      [[0,74,3],[4,69,3],[8,65,3],[12,62,3]],
      [[0,67,2],[3,70,1],[4,74,3],[8,72,3],[12,70,3]],
      [[0,70,3],[4,74,3],[8,77,3],[12,74,3]],
      [[0,69,2],[3,64,1],[4,61,3],[8,64,2],[12,69,2],[15,61,1]]
    ];
    if (!breakdown || bar % 2 === 0) {
      for (const [position, note, length] of phrases[bar % 8]) {
        if (beat !== position) continue;
        const midi = note + (section === 3 ? 12 : 0);
        this._tone(this._note(midi), duration * length * 0.85, breakdown ? 0.036 : 0.065, 'square', time, bus,
          { attack: 0.007, release: 0.06, filter: 2200, pan: -0.15 });
        if (!breakdown && (section === 1 || section === 3)) {
          this._tone(this._note(midi - 12), duration * length * 0.8, 0.024, 'sawtooth', time, bus,
            { filter: 1300, attack: 0.015, release: 0.08, pan: 0.2 });
        }
      }
    }
    if (section !== 0 && beat % 2 === 1) {
      const arp = [0, 7, 12, third + 12, 19, 12, 7, 12];
      this._tone(this._note(root + 24 + arp[Math.floor(beat / 2)]), duration * 0.6, 0.021, 'square', time, bus,
        { filter: 1800, release: 0.03, pan: beat % 4 === 1 ? -0.45 : 0.45 });
    }
    if ([0,8].includes(beat) || (!breakdown && [6,14].includes(beat))) this._kick(time, bus, 0.24);
    if (beat === 4 || beat === 12 || (bar % 8 === 7 && beat >= 14)) {
      this._noise(0.105, breakdown ? 0.07 : 0.11, time, bus, { frequency: 1650, kind: 'highpass', pan: 0.12 });
      this._tone(185, 0.09, 0.065, 'triangle', time, bus, { endFrequency: 90 });
    }
    if (beat % 2 === 0) {
      this._noise(beat === 10 ? 0.065 : 0.025, 0.027, time, bus, { frequency: 6200, kind: 'highpass', pan: 0.35 });
    }
    if (bar % 8 === 7 && beat >= 12) this._tone(120 - (beat - 12) * 14, 0.12, 0.055, 'triangle', time, bus, { endFrequency: 45 });
  }

  /** «La última cena»: sixteen bars, D minor, from distant tolls to a war march. */
  _introStep(step, time, duration) {
    const beat = step % 16;
    const bar = Math.floor(step / 16) % 16;
    const movement = Math.floor(bar / 4);
    const roots = [38, 38, 34, 36, 38, 41, 43, 33, 38, 34, 36, 33, 38, 34, 33, 38];
    const root = roots[bar];
    const third = [2, 3, 5, 7, 9, 10, 11, 13, 14].includes(bar) ? 4 : 3;
    const bus = this.music;
    if (beat === 0) {
      // Low, widely spaced voices leave the narration's midrange unoccupied.
      [0, 12, 19, 24 + third].forEach((interval, voice) => {
        this._tone(this._note(root + interval), duration * 15.3, 0.025 + movement * 0.003, 'triangle', time, bus,
          { attack: 0.26, release: 0.48, filter: 780 + movement * 170, pan: (voice % 2 ? 1 : -1) * 0.28 });
      });
      if (bar % 4 === 0) {
        this._tone(this._note(74), duration * 10, 0.035, 'sine', time, bus, { attack: 0.003, release: duration * 6 });
        this._tone(this._note(86), duration * 5, 0.009, 'triangle', time, bus, { release: duration * 3, pan: 0.3 });
      }
    }
    // A dotted, descending four-note summons; the last movement answers an octave up.
    const phrases = [
      [[0, 62, 4], [6, 69, 1], [8, 65, 3], [12, 64, 3]],
      [[2, 62, 5], [10, 57, 2], [14, 60, 1]],
      [[0, 62, 3], [4, 65, 2], [8, 70, 4], [14, 69, 1]],
      [[0, 67, 5], [8, 64, 3], [12, 60, 3]],
      [[0, 65, 3], [4, 69, 2], [7, 74, 1], [8, 72, 3], [12, 69, 3]],
      [[0, 69, 4], [6, 72, 1], [8, 77, 3], [12, 74, 3]],
      [[0, 67, 3], [4, 70, 3], [8, 69, 2], [12, 65, 3]],
      [[0, 64, 3], [4, 61, 3], [8, 57, 3], [12, 61, 1], [14, 64, 1]]
    ];
    const phrase = bar === 11 || bar === 14 ? 7 : bar === 15 ? 0 : bar % 8;
    for (const [position, note, length] of phrases[phrase]) {
      if (position !== beat) continue;
      const transpose = movement === 3 ? 12 : 0;
      this._tone(this._note(note + transpose), duration * length, 0.043 + movement * 0.009,
        movement === 0 ? 'triangle' : 'square', time, bus,
        { filter: movement === 3 ? 2100 : 1300, attack: 0.012, release: 0.14, pan: -0.13 });
    }
    if (movement >= 1 && beat % (movement === 1 ? 4 : 2) === 0) {
      const interval = [0, 7, 12, 7][Math.floor(beat / 2) % 4];
      this._tone(this._note(root + interval), duration * 1.35, 0.065 + movement * 0.015, 'sawtooth', time, bus,
        { filter: 420 + movement * 80, attack: 0.007, release: 0.085 });
    }
    if (movement >= 1 && (beat === 0 || (movement >= 2 && beat === 8) || (movement === 3 && beat === 10))) {
      this._kick(time, bus, 0.13 + movement * 0.035);
    }
    if (movement >= 2 && (beat === 4 || beat === 12)) {
      this._noise(0.16, 0.075 + movement * 0.015, time, bus, { frequency: 1400, kind: 'highpass', pan: 0.1 });
      this._tone(162, 0.11, 0.055, 'triangle', time, bus, { endFrequency: 82 });
    }
    if (movement === 3 && beat % 2 === 0) this._noise(0.035, 0.028, time, bus, { frequency: 5400, kind: 'highpass', pan: 0.3 });
    if (bar % 4 === 3 && beat >= 12) {
      this._tone(110 - (beat - 12) * 10, 0.15, 0.045 + movement * 0.014, 'triangle', time, bus, { endFrequency: 45 });
      if (movement > 1) this._noise(0.07, 0.04, time, bus, { frequency: 1500, kind: 'bandpass' });
    }
  }

  /** «Cenizas y corona»: a slower requiem ending in a warm D-major Picardy cadence. */
  _endingStep(step, time, duration) {
    const beat = step % 16;
    const bar = Math.floor(step / 16) % 16;
    const roots = [50, 46, 53, 48, 43, 46, 45, 50, 53, 48, 46, 43, 46, 45, 50, 50];
    const root = roots[bar];
    const third = [0, 4, 7, 11].includes(bar) ? 3 : 4;
    const bus = this.music;
    const finale = bar >= 14;
    if (beat === 0) {
      [0, third, 7, 12].forEach((interval, voice) => {
        this._tone(this._note(root + interval), duration * 15.5, voice === 0 ? 0.048 : 0.032, 'triangle', time, bus,
          { attack: 0.2, release: 0.7, filter: 1700, pan: (voice - 1.5) * 0.2 });
      });
      this._tone(this._note(root - 12), duration * 13, 0.073, 'sine', time, bus, { attack: 0.04, release: 0.55 });
      // A soft gong marks only the two broad phrases; no battle snare or fast hi-hat.
      if (bar === 0 || bar === 8) {
        this._kick(time, bus, 0.085);
        this._noise(0.8, 0.025, time, bus, { frequency: 2600, kind: 'highpass', pan: 0.2 });
      }
    }
    const phrases = [
      [[0, 69, 5], [6, 65, 2], [8, 67, 3], [12, 69, 3]],
      [[0, 70, 7], [8, 69, 3], [12, 65, 3]],
      [[0, 72, 5], [6, 69, 2], [8, 77, 7]],
      [[0, 76, 7], [8, 72, 7]],
      [[0, 70, 5], [6, 69, 2], [8, 67, 7]],
      [[0, 65, 5], [6, 62, 2], [8, 70, 7]],
      [[0, 69, 5], [6, 67, 2], [8, 64, 3], [12, 61, 3]],
      [[0, 62, 11], [12, 65, 3]],
      [[0, 77, 7], [8, 76, 3], [12, 72, 3]],
      [[0, 76, 5], [6, 72, 2], [8, 79, 7]],
      [[0, 77, 7], [8, 74, 7]],
      [[0, 74, 5], [6, 70, 2], [8, 67, 7]],
      [[0, 70, 5], [6, 74, 2], [8, 77, 7]],
      [[0, 76, 5], [6, 73, 2], [8, 69, 3], [12, 73, 3]],
      [[0, 74, 11], [12, 78, 3]],
      [[0, 74, 15]]
    ];
    for (const [position, note, length] of phrases[bar]) {
      if (position !== beat) continue;
      this._tone(this._note(note), duration * length, 0.065, 'square', time, bus,
        { filter: 1300, attack: 0.025, release: 0.24, pan: -0.12 });
      this._tone(this._note(note + 12), duration * Math.min(length, 4), 0.017, 'sine', time, bus,
        { attack: 0.005, release: 0.32, pan: 0.25 });
    }
    if (!finale && beat % 4 === 2) {
      const interval = [0, 7, 12, third + 12][Math.floor(beat / 4)];
      this._tone(this._note(root + 12 + interval), duration * 2.5, 0.024, 'triangle', time, bus,
        { filter: 1800, attack: 0.018, release: 0.17, pan: 0.3 });
    }
    if (finale && beat === 8) this._tone(this._note(86), duration * 7, 0.022, 'sine', time, bus, { attack: 0.01, release: 0.6, pan: 0.35 });
  }

  /** «Que tiemble el reino»: a full sixteen-bar heroic fanfare, built from both story motifs. */
  _creditsStep(step, time, duration) {
    const beat = step % 16;
    const bar = Math.floor(step / 16) % 16;
    const roots = [38, 34, 41, 36, 38, 43, 34, 33, 38, 41, 43, 34, 36, 33, 38, 38];
    const root = roots[bar];
    const third = [0, 4, 5, 8, 10].includes(bar) ? 3 : 4;
    const finalChord = bar === 15;
    const bus = this.music;
    if (beat === 0) {
      // Broad brass triads, separate from the bright melodic voice and driving bass.
      [12, 24 + third, 31].forEach((interval, voice) => {
        this._tone(this._note(root + interval), duration * (finalChord ? 15.8 : 6.5), 0.033, 'sawtooth', time, bus,
          { attack: 0.035, release: finalChord ? 0.75 : 0.2, filter: 1250, pan: (voice - 1) * 0.35 });
      });
      [24, 24 + third, 31, 36].forEach((interval, voice) => {
        this._tone(this._note(root + interval), duration * 15.5, 0.024, 'triangle', time, bus,
          { attack: 0.045, release: 0.4, filter: 2200, pan: (voice - 1.5) * 0.17 });
      });
      if (bar % 4 === 0 || finalChord) this._noise(0.55, 0.055, time, bus, { frequency: 4100, kind: 'highpass', pan: 0.25 });
    }
    // Re–la–fa–mi is the introduction's summons, now a triumphant upper-register fanfare.
    // The second four-bar phrase answers with the ending's la–fa–sol–la motif.
    const phrases = [
      [[0, 74, 3], [4, 81, 3], [8, 77, 3], [12, 76, 3]],
      [[0, 74, 3], [4, 77, 2], [7, 81, 1], [8, 82, 5], [14, 81, 1]],
      [[0, 81, 3], [4, 84, 3], [8, 89, 3], [12, 88, 3]],
      [[0, 84, 5], [6, 79, 1], [8, 76, 3], [12, 72, 3]],
      [[0, 81, 3], [4, 77, 3], [8, 79, 3], [12, 81, 3]],
      [[0, 82, 5], [6, 81, 1], [8, 79, 3], [12, 74, 3]],
      [[0, 77, 3], [4, 82, 3], [8, 86, 3], [12, 89, 3]],
      [[0, 88, 3], [4, 85, 3], [8, 81, 3], [12, 85, 3]],
      [[0, 86, 3], [4, 81, 3], [8, 77, 3], [12, 76, 3]],
      [[0, 77, 3], [4, 81, 3], [8, 84, 3], [12, 89, 3]],
      [[0, 86, 3], [4, 82, 3], [8, 79, 5], [14, 81, 1]],
      [[0, 82, 3], [4, 86, 3], [8, 89, 5], [14, 86, 1]],
      [[0, 88, 3], [4, 84, 3], [8, 79, 3], [12, 76, 3]],
      [[0, 81, 3], [4, 85, 3], [8, 88, 3], [12, 85, 3]],
      [[0, 86, 5], [6, 81, 1], [8, 78, 3], [12, 81, 3]],
      [[0, 86, 15]]
    ];
    for (const [position, note, length] of phrases[bar]) {
      if (position !== beat) continue;
      this._tone(this._note(note), duration * length, 0.067, 'square', time, bus,
        { filter: 3200, attack: 0.008, release: finalChord ? 0.6 : 0.075, pan: -0.12 });
      this._tone(this._note(note - 12), duration * length, 0.028, 'sawtooth', time, bus,
        { filter: 1500, attack: 0.018, release: finalChord ? 0.5 : 0.1, pan: 0.18 });
    }
    if (!finalChord || beat === 0) {
      if (beat % 2 === 0) {
        this._tone(this._note(root + (beat === 6 || beat === 14 ? 12 : 0)), duration * (finalChord ? 15 : 1.55), 0.12, 'sawtooth', time, bus,
          { filter: 650, attack: 0.006, release: finalChord ? 0.55 : 0.08 });
      }
      const arp = [0, 7, 12, third + 12, 7, 12, 19, 12];
      this._tone(this._note(root + 24 + arp[beat % 8]), duration * 0.68, 0.025, 'square', time, bus,
        { filter: 2300, attack: 0.003, release: 0.04, pan: beat % 2 ? 0.5 : -0.5 });
      if ([0, 6, 8, 14].includes(beat)) this._kick(time, bus, beat === 0 ? 0.27 : 0.22);
      if (beat === 4 || beat === 12 || (bar % 4 === 3 && beat >= 14)) {
        this._noise(0.115, 0.11, time, bus, { frequency: 1700, kind: 'highpass', pan: 0.12 });
        this._tone(185, 0.095, 0.075, 'triangle', time, bus, { endFrequency: 92 });
      }
      if (beat % 2 === 0) this._noise(beat % 4 === 2 ? 0.075 : 0.025, 0.035, time, bus, { frequency: 6200, kind: 'highpass', pan: 0.35 });
    }
  }

  play(name, options = {}) {
    if (!this.ready || !this.context || this.suspended || this.muted || this.context.state !== 'running') return;
    const aliases = { light: 'attack', slash: 'attack', swing: 'attack', enemy: 'kill', gameover: 'death', victory: 'win', rage: 'special', arenaStart: 'boss', arenaClear: 'checkpoint', stage: 'checkpoint' };
    name = aliases[name] || name;
    const now = this.context.currentTime;
    const delay = name === 'hit' ? 0.025 : name === 'attack' ? 0.05 : ['win', 'death'].includes(name) ? 0.5 : 0.035;
    if (now - (this.lastSfx.get(name) ?? -Infinity) < delay) return;
    this.lastSfx.set(name, now);
    const intensity = Math.max(0.2, Math.min(2, Number(options.intensity) || 1));
    const pan = Math.max(-1, Math.min(1, Number(options.pan) || 0));
    const bus = this.effects;
    const tone = (freq, length, gain, wave = 'square', offset = 0, config = {}) => this._tone(freq, length, gain * intensity, wave, now + offset, bus, { pan, ...config });
    const noise = (length, gain, frequency, offset = 0, config = {}) => this._noise(length, gain * intensity, now + offset, bus, { pan, frequency, ...config });
    switch (name) {
      case 'attack':
        noise(0.115, 0.11, 1700, 0, { endFrequency: 4200 });
        tone(280, 0.085, 0.025, 'sawtooth', 0, { endFrequency: 90, filter: 1600 });
        break;
      case 'heavy':
        noise(0.2, 0.18, 700, 0, { endFrequency: 3200 });
        tone(170, 0.16, 0.1, 'sawtooth', 0, { endFrequency: 45, filter: 700 });
        this._kick(now + 0.07, bus, 0.14);
        break;
      case 'hit':
        noise(0.085, 0.18, 1300, 0, { endFrequency: 500, kind: 'lowpass' });
        tone(130 + Math.random() * 40, 0.09, 0.12, 'triangle', 0, { endFrequency: 48 });
        tone(680, 0.034, 0.03, 'square', 0, { endFrequency: 220, filter: 2200 });
        break;
      case 'hurt':
        tone(240, 0.19, 0.12, 'sawtooth', 0, { endFrequency: 75, filter: 1000 });
        tone(251, 0.17, 0.05, 'square', 0.015, { endFrequency: 85, filter: 1000 });
        noise(0.1, 0.08, 600);
        break;
      case 'jump':
        tone(130, 0.15, 0.067, 'square', 0, { endFrequency: 440, filter: 1800 });
        break;
      case 'land':
        noise(0.07, 0.065, 400, 0, { kind: 'lowpass' });
        tone(100, 0.07, 0.05, 'triangle', 0, { endFrequency: 42 });
        break;
      case 'dash':
        noise(0.2, 0.13, 3000, 0, { endFrequency: 450, kind: 'bandpass' });
        tone(500, 0.1, 0.023, 'triangle', 0, { endFrequency: 120 });
        break;
      case 'special':
        [0, 7, 12, 19, 24].forEach((semitones, i) => tone(this._note(38 + semitones), 0.32, 0.075, 'sawtooth', i * 0.045, { filter: 2000, endFrequency: this._note(39 + semitones) }));
        noise(0.5, 0.18, 450, 0.12, { endFrequency: 5000 });
        this._kick(now + 0.1, bus, 0.35);
        break;
      case 'magic':
        [45,52,57,64].forEach((note,i)=>tone(this._note(note),.3,.065,'square',i*.07,{filter:2200}));
        noise(.35,.1,700,0,{endFrequency:3500});
        break;
      case 'magicImpact':
        this._kick(now,bus,.45);noise(.65,.25,options.kind==='storm'?3200:500,0,{endFrequency:120});
        tone(85,.45,.16,'sawtooth',0,{endFrequency:32,filter:800});
        break;
      case 'kill':
        tone(330, 0.18, 0.045, 'sawtooth', 0, { endFrequency: 55, filter: 800 });
        noise(0.14, 0.08, 1000, 0.02, { endFrequency: 200 });
        break;
      case 'pickup': {
        const notes = options.kind === 'meat' ? [62, 69] : options.kind === 'rage' ? [69, 74, 81] : [81, 86];
        notes.forEach((note, i) => tone(this._note(note), 0.12, 0.065, 'square', i * 0.065, { filter: 2600 }));
        break;
      }
      case 'boss':
        [38, 39, 45].forEach((note, i) => tone(this._note(note), 0.8, 0.07, 'sawtooth', i * 0.055, { filter: 600, attack: 0.06, release: 0.3 }));
        noise(0.55, 0.13, 900, 0, { endFrequency: 120, kind: 'lowpass' });
        break;
      case 'win':
        [62, 65, 69, 74, 69, 74, 77].forEach((note, i) => tone(this._note(note), i === 6 ? 0.55 : 0.17, 0.075, 'square', i * 0.12, { filter: 2400, release: 0.1 }));
        break;
      case 'death':
        [62, 60, 57, 53, 50].forEach((note, i) => tone(this._note(note), 0.3, 0.067, 'triangle', i * 0.17, { release: 0.16 }));
        break;
      case 'checkpoint':
        [62, 69, 74].forEach((note, i) => tone(this._note(note), 0.2, 0.056, 'triangle', i * 0.09));
        break;
      case 'combo':
        tone(this._note(69 + Math.min(12, Math.floor((options.combo || options.count || 2) / 5) * 2)), 0.1, 0.04, 'square', 0, { filter: 1800 });
        break;
      case 'ui':
        tone(660, 0.055, 0.04, 'square', 0, { endFrequency: 880, filter: 2000 });
        break;
      default: break;
    }
  }

  _note(midi) { return 440 * 2 ** ((midi - 69) / 12); }
  _kick(time, bus, gain) {
    this._tone(140, 0.23, gain, 'sine', time, bus, { endFrequency: 42, release: 0.18 });
    this._noise(0.022, gain * 0.13, time, bus, { frequency: 1800, kind: 'lowpass' });
  }
  _connect(source, gain, bus, pan = 0, filterFrequency, filterType = 'lowpass', endFrequency, time, length) {
    let current = source;
    const nodes = [];
    if (filterFrequency) {
      const filter = this.context.createBiquadFilter();
      filter.type = filterType;
      filter.frequency.setValueAtTime(Math.max(30, filterFrequency), time);
      filter.Q.value = filterType === 'bandpass' ? 0.8 : 0.55;
      if (endFrequency) filter.frequency.exponentialRampToValueAtTime(Math.max(30, endFrequency), time + length);
      current.connect(filter); current = filter; nodes.push(filter);
    }
    current.connect(gain); current = gain; nodes.push(gain);
    if (pan && this.context.createStereoPanner) {
      const panner = this.context.createStereoPanner(); panner.pan.value = pan;
      current.connect(panner); current = panner; nodes.push(panner);
    }
    current.connect(bus);
    this.voices.add(source);
    source.onended = () => {
      source.disconnect();
      for (const node of nodes) node.disconnect();
      this.voices.delete(source);
    };
  }
  _tone(frequency, length, amplitude, wave, time, bus, { attack = 0.004, release = 0.05, endFrequency, filter, pan = 0 } = {}) {
    if (!this.context || this.voices.size > 100) return;
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    const duration = Math.max(0.025, length);
    const fadeIn = Math.min(attack, duration * 0.35);
    const fadeOut = Math.min(release, duration * 0.65);
    osc.type = wave;
    osc.frequency.setValueAtTime(Math.max(20, frequency), time);
    if (endFrequency) osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), time + duration);
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, amplitude), time + fadeIn);
    gain.gain.setValueAtTime(Math.max(0.0002, amplitude), time + Math.max(fadeIn, duration - fadeOut));
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    this._connect(osc, gain, bus, pan, filter, 'lowpass', null, time, duration);
    osc.start(time); osc.stop(time + duration + 0.015);
  }
  _noise(length, amplitude, time, bus, { frequency = 2000, endFrequency, kind = 'bandpass', pan = 0 } = {}) {
    if (!this.context || !this.noiseBuffer || this.voices.size > 100) return;
    const source = this.context.createBufferSource();
    source.buffer = this.noiseBuffer;
    const gain = this.context.createGain();
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, amplitude), time + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + Math.max(0.02, length));
    this._connect(source, gain, bus, pan, frequency, kind, endFrequency, time, length);
    source.start(time, Math.random() * 0.5); source.stop(time + length + 0.015);
  }
}
