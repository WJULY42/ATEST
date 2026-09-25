// WebAudio 合成音效引擎：全部程序化生成，无外部音频文件
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.engineGain = null;
    this.enabled = true;
  }

  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);
    // 引擎持续低音（随油门变化）
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0;
    this.engineGain.connect(this.master);
    const osc1 = this.ctx.createOscillator();
    osc1.type = 'sawtooth'; osc1.frequency.value = 55;
    const osc2 = this.ctx.createOscillator();
    osc2.type = 'triangle'; osc2.frequency.value = 110;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass'; filter.frequency.value = 320;
    osc1.connect(filter); osc2.connect(filter);
    filter.connect(this.engineGain);
    osc1.start(); osc2.start();
    this._engineOsc = [osc1, osc2];
  }

  resume() { this.ctx?.resume?.(); }

  setEngine(throttle01) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.engineGain.gain.setTargetAtTime(this.enabled ? throttle01 * 0.14 : 0, t, 0.12);
    this._engineOsc[0].frequency.setTargetAtTime(48 + throttle01 * 60, t, 0.2);
  }

  blip(freq = 880, dur = 0.09, type = 'square', vol = 0.12) {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur);
  }

  sweep(from, to, dur = 0.5, vol = 0.15) {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(from, t);
    o.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur);
  }

  uiClick() { this.blip(1200, 0.05, 'square', 0.07); }
  scanPing() { this.sweep(600, 1800, 0.35, 0.1); }
  collect() { this.blip(700, 0.07); setTimeout(() => this.blip(1050, 0.09), 70); }
  warp() { this.sweep(120, 2400, 1.1, 0.2); }
  land() { this.sweep(300, 60, 0.8, 0.18); }
  damage() { this.blip(140, 0.2, 'sawtooth', 0.16); }
  quest() { this.blip(880, 0.1); setTimeout(() => this.blip(1320, 0.14), 100); }
}
