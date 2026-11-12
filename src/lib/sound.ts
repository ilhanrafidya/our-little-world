'use client';

/**
 * Efek suara lembut, dibuat langsung dengan Web Audio API (tanpa file audio).
 * - Volume pelan, nada bulat (sine/triangle) + noise yang difilter untuk efek "swish"/"whoosh".
 * - iOS: audioSession "ambient" → ikut diam saat tombol silent aktif (Safari 17+).
 * - AudioContext baru dibuat/di-resume pada interaksi pertama (aturan autoplay browser).
 */

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noise: AudioBuffer | null = null;

function audio(): { ctx: AudioContext; out: GainNode } | null {
  if (typeof window === 'undefined') return null;
  try {
    if (!ctx) {
      const nav = navigator as Navigator & { audioSession?: { type: string } };
      if (nav.audioSession) nav.audioSession.type = 'ambient';
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.22;
      // sedikit lowpass agar semua suara terasa hangat, tidak tajam
      const warm = ctx.createBiquadFilter();
      warm.type = 'lowpass';
      warm.frequency.value = 6000;
      master.connect(warm).connect(ctx.destination);
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return { ctx, out: master! };
  } catch {
    return null;
  }
}

function noiseBuffer(c: AudioContext) {
  if (noise) return noise;
  const len = c.sampleRate * 2;
  noise = c.createBuffer(1, len, c.sampleRate);
  const d = noise.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return noise;
}

/** Nada tunggal dengan envelope attack cepat + decay eksponensial. */
function tone(freq: number, opts: { at?: number; dur?: number; gain?: number; type?: OscillatorType } = {}) {
  const a = audio();
  if (!a) return;
  const { ctx: c, out } = a;
  const t = c.currentTime + (opts.at ?? 0);
  const dur = opts.dur ?? 0.6;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = opts.type ?? 'sine';
  osc.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(opts.gain ?? 0.5, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(out);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

/** Noise yang disapu filter (untuk swish / whoosh). */
function sweep(opts: { from: number; to: number; dur: number; gain: number; q?: number; peakAt?: number }) {
  const a = audio();
  if (!a) return;
  const { ctx: c, out } = a;
  const t = c.currentTime;
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c);
  const f = c.createBiquadFilter();
  f.type = 'bandpass';
  f.Q.value = opts.q ?? 1.2;
  f.frequency.setValueAtTime(opts.from, t);
  f.frequency.exponentialRampToValueAtTime(opts.to, t + opts.dur);
  const g = c.createGain();
  const peak = t + opts.dur * (opts.peakAt ?? 0.4);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(opts.gain, peak);
  g.gain.exponentialRampToValueAtTime(0.0001, t + opts.dur);
  src.connect(f).connect(g).connect(out);
  src.start(t);
  src.stop(t + opts.dur + 0.05);
}

export const sound = {
  /** "tik" kaca yang halus untuk setiap tap tombol */
  tap() {
    tone(1760, { dur: 0.09, gain: 0.16 });
    tone(2640, { dur: 0.05, gain: 0.05 });
  },
  /** kertas digeser — buka & balik Polaroid */
  swish() {
    sweep({ from: 700, to: 3200, dur: 0.32, gain: 0.35, q: 0.9, peakAt: 0.35 });
  },
  /** denting dua nada hangat — kenangan tersimpan */
  chime() {
    tone(1318.5, { dur: 1.1, gain: 0.32 }); // E6
    tone(1975.5, { at: 0.11, dur: 1.4, gain: 0.26 }); // B6
    tone(659.25, { dur: 1.2, gain: 0.08, type: 'triangle' });
  },
  /** angin pelan — kendaraan berangkat */
  whoosh() {
    sweep({ from: 260, to: 1400, dur: 1.4, gain: 0.28, q: 0.7, peakAt: 0.55 });
  },
  /** lonceng lembut — tiba di kota */
  arrive() {
    tone(1046.5, { dur: 1.6, gain: 0.22 }); // C6
    tone(1568, { at: 0.07, dur: 1.8, gain: 0.14 }); // G6
    tone(523.25, { dur: 1.4, gain: 0.06, type: 'triangle' });
  },
  /** akord naik yang manis — unlock berhasil */
  unlock() {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, { at: i * 0.07, dur: 1.3, gain: 0.2 }));
  },
  /** ringan & rendah — kembali ke globe / masuk peta */
  soft() {
    sweep({ from: 1800, to: 400, dur: 0.5, gain: 0.18, q: 0.8, peakAt: 0.3 });
  },
};

/** Pasang suara "tik" global untuk semua tombol (dipanggil sekali di layout). */
export function installTapSound() {
  const onDown = () => audio(); // buka kunci audio pada sentuhan pertama (iOS)
  const onClick = (e: MouseEvent) => {
    const el = (e.target as Element | null)?.closest?.('button, [role="button"], .olw-marker, a[href]');
    if (!el || (el as HTMLButtonElement).disabled || el.closest('[data-silent]')) return;
    sound.tap();
  };
  window.addEventListener('pointerdown', onDown, { capture: true, passive: true });
  window.addEventListener('click', onClick, { capture: true, passive: true });
  return () => {
    window.removeEventListener('pointerdown', onDown, { capture: true });
    window.removeEventListener('click', onClick, { capture: true });
  };
}
