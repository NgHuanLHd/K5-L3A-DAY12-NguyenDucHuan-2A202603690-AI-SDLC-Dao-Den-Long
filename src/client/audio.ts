// Procedural audio (WebAudio): night music + effects. No audio files, so nothing to license (see CREDITS.md).
export type Sfx =
  | "pick" | "light" | "pulse" | "hit" | "jump" | "dash" | "win" | "lose" | "spawn" | "countdown" | "ui" | "charm" | "steal" | "wind";

export class GameAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicTimer: number | null = null;
  private drone: OscillatorNode[] = [];
  private volume = 0.7;

  /** Browsers only allow audio after a user gesture, so everything is created lazily. */
  private ensure(): AudioContext | null {
    if (this.ctx) {
      if (this.ctx.state === "suspended") void this.ctx.resume();
      return this.ctx;
    }
    try {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(this.ctx.destination);
    } catch {
      this.ctx = null;
    }
    return this.ctx;
  }

  setVolume(v: number): void {
    this.volume = v;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.02);
  }

  private tone(freq: number, dur: number, type: OscillatorType = "sine", vol = 0.2, slideTo?: number, delay = 0): void {
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private noise(dur: number, vol: number, freq: number, delay = 0): void {
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    const n = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.value = vol;
    src.connect(f).connect(g).connect(this.master);
    src.start(ctx.currentTime + delay);
  }

  play(name: Sfx): void {
    switch (name) {
      case "pick": this.tone(880, 0.12, "sine", 0.15, 1320); break;
      case "light": [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.5, "triangle", 0.14, undefined, i * 0.07)); break;
      case "pulse": this.tone(300, 0.5, "sine", 0.22, 1200); this.noise(0.4, 0.08, 2000); break;
      case "hit": this.tone(140, 0.3, "sawtooth", 0.25, 50); this.noise(0.2, 0.15, 400); break;
      case "jump": this.tone(330, 0.15, "square", 0.07, 660); break;
      case "dash": this.noise(0.25, 0.18, 1500); break;
      case "win": [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.6, "triangle", 0.16, undefined, i * 0.12)); break;
      case "lose": [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.6, "sine", 0.18, undefined, i * 0.18)); break;
      case "spawn": this.tone(90, 0.5, "sawtooth", 0.1, 60); break;
      case "countdown": this.tone(988, 0.1, "square", 0.08); break;
      case "ui": this.tone(660, 0.07, "sine", 0.1); break;
      case "charm": this.tone(659, 0.3, "triangle", 0.15, 1319); break;
      case "steal": this.tone(500, 0.25, "triangle", 0.15, 150); break;
      // 2 s warning before a gust: rising breath of wind
      case "wind": this.noise(1.8, 0.16, 500); this.noise(1.2, 0.1, 1100, 0.6); break;
    }
  }

  /** Soft night pad + a slow pentatonic melody. */
  startMusic(): void {
    const ctx = this.ensure();
    if (!ctx || !this.master || this.musicTimer !== null) return;
    for (const f of [110, 164.81]) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = f;
      g.gain.value = 0.035;
      o.connect(g).connect(this.master);
      o.start();
      this.drone.push(o);
    }
    const scale = [220, 261.63, 293.66, 329.63, 392, 440];
    let i = 0;
    this.musicTimer = window.setInterval(() => {
      i = (i + 1 + Math.floor(Math.random() * 2)) % scale.length;
      this.tone(scale[i]!, 1.6, "sine", 0.045);
    }, 900);
  }

  stopMusic(): void {
    if (this.musicTimer !== null) window.clearInterval(this.musicTimer);
    this.musicTimer = null;
    for (const o of this.drone) {
      try { o.stop(); } catch { /* already stopped */ }
    }
    this.drone = [];
  }
}
