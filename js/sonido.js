'use strict';

// Sonidos sintetizados con Web Audio (no necesita archivos)
const Sonido = {
  on: true,
  ctx: null,

  init() {
    try { this.on = localStorage.getItem('alcalde_sonido') !== 'off'; } catch (e) { /* sin almacenamiento */ }
  },
  alternar() {
    this.on = !this.on;
    try { localStorage.setItem('alcalde_sonido', this.on ? 'on' : 'off'); } catch (e) { /* nada */ }
    if (this.on) this.bien();
  },
  tono(freq, dur, tipo = 'sine', vol = 0.07, delay = 0) {
    if (!this.on) return;
    try {
      if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      const t = this.ctx.currentTime + delay;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = tipo;
      o.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(this.ctx.destination);
      o.start(t);
      o.stop(t + dur + 0.02);
    } catch (e) { /* audio no disponible */ }
  },
  click() { this.tono(520, 0.05, 'triangle', 0.04); },
  bien() { [523, 659, 784].forEach((f, i) => this.tono(f, 0.14, 'triangle', 0.06, i * 0.07)); },
  mal() { [330, 262].forEach((f, i) => this.tono(f, 0.2, 'sawtooth', 0.035, i * 0.1)); },
  moneda() { this.tono(988, 0.07, 'square', 0.03); this.tono(1319, 0.18, 'square', 0.03, 0.07); },
  voto(si) { this.tono(si ? 700 : 220, 0.08, 'triangle', 0.05); },
  fanfarria() { [523, 659, 784, 1047, 784, 1047].forEach((f, i) => this.tono(f, 0.22, 'triangle', 0.06, i * 0.11)); },
};
Sonido.init();
