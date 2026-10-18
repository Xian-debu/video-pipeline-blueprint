// 程序化配乐引擎（node-web-audio-api，确定性：同 seed 同输出）
import { OfflineAudioContext } from "node-web-audio-api";
import fs from "node:fs";

export const SR = 48000;

export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

function noiseBuffer(ctx, seconds, rnd) {
  const n = Math.floor(SR * seconds);
  const buf = ctx.createBuffer(1, n, SR);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = rnd() * 2 - 1;
  return buf;
}

function impulse(ctx, seconds, decay, rnd) {
  const n = Math.floor(SR * seconds);
  const buf = ctx.createBuffer(2, n, SR);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < n; i++) {
      const t = i / n;
      d[i] = (rnd() * 2 - 1) * Math.pow(1 - t, decay);
    }
  }
  return buf;
}

function env(ctx, param, t0, peak, attack, release) {
  param.setValueAtTime(0.0001, t0);
  param.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t0 + attack);
  param.exponentialRampToValueAtTime(0.0001, t0 + attack + release);
}

/** 和弦进行（A 小调 / 通用小调氛围） */
const PROGS = {
  minor: [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]],
  lydian: [[60, 64, 67], [62, 66, 69], [57, 61, 64], [55, 59, 62]],
};

export async function renderMusic(opts = {}) {
  const {
    durationSec = 30,
    bpm = 84,
    seed = 1,
    prog = "minor",
    root = 0,
    energy = 0.8,
    out = null,
  } = opts;
  const rnd = mulberry32(seed * 7919 + 13);
  const ctx = new OfflineAudioContext({ numberOfChannels: 2, length: Math.ceil(SR * durationSec), sampleRate: SR });

  const master = ctx.createGain();
  master.gain.value = 0.85;
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -6; limiter.knee.value = 6; limiter.ratio.value = 6;
  limiter.attack.value = 0.003; limiter.release.value = 0.15;
  master.connect(limiter); limiter.connect(ctx.destination);

  // 混响（卷积，噪声衰减脉冲）
  const verb = ctx.createConvolver();
  verb.buffer = impulse(ctx, 2.6, 2.4, rnd);
  const verbGain = ctx.createGain();
  verbGain.gain.value = 0.22;
  verb.connect(verbGain); verbGain.connect(master);

  const chords = (PROGS[prog] ?? PROGS.minor).map((c) => c.map((n) => n + root));
  const bar = (60 / bpm) * 4;
  const beat = bar / 4;
  const nBars = Math.ceil(durationSec / bar);

  // ---- pad：每小节柱式和弦，双层失谐锯齿 + 低通 ----
  for (let b = 0; b < nBars; b++) {
    const t0 = b * bar;
    const notes = chords[b % chords.length];
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(1200 + energy * 900, t0);
    lp.Q.value = 0.6;
    const g = ctx.createGain();
    g.gain.value = 0.0;
    // Speech sits near -16 dBFS RMS; a bed whose audible band lands 19 dB below that reads as
    // "no music" on a laptop speaker. The sub layers are depth, the mid layers are the music:
    // see docs/known-issues.md K14 and the music gate in scripts/qa/music_gate.py.
    const p = 0.13 / notes.length;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(p, t0 + bar * 0.35);
    g.gain.linearRampToValueAtTime(0.0001, t0 + bar * 1.02);
    lp.connect(g); g.connect(master); g.connect(verb);
    for (const n of notes) {
      for (const det of [-6, 6]) {
        const o = ctx.createOscillator();
        o.type = "sawtooth";
        o.frequency.value = mtof(n);
        o.detune.value = det;
        o.connect(lp);
        o.start(t0); o.stop(t0 + bar * 1.05);
      }
    }
  }

  // ---- bass：每小节根音，长音 ----
  for (let b = 0; b < nBars; b++) {
    const t0 = b * bar;
    const rootNote = chords[b % chords.length][0] - 12;
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.value = mtof(rootNote);
    const g = ctx.createGain();
    env(ctx, g.gain, t0, 0.045, 0.04, bar * 0.9);
    o.connect(g); g.connect(master);
    o.start(t0); o.stop(t0 + bar);
  }

  // ---- arp：八分音符琶音（第二小节起） ----
  const steps = Math.floor(durationSec / (beat / 2));
  for (let i = 0; i < steps; i++) {
    const t0 = i * (beat / 2);
    if (t0 < bar * 0.5) continue;
    const barIdx = Math.floor(t0 / bar);
    const notes = chords[barIdx % chords.length];
    const n = notes[i % notes.length] + 12;
    const o = ctx.createOscillator();
    o.type = "triangle";
    o.frequency.value = mtof(n);
    const g = ctx.createGain();
    env(ctx, g.gain, t0, 0.13 + energy * 0.04, 0.008, 0.22);
    o.connect(g); g.connect(master); g.connect(verb);
    o.start(t0); o.stop(t0 + 0.3);
  }

  // ---- 打击：kick（低频下滑）+ 轻 hat ----
  for (let i = 0; i < Math.floor(durationSec / beat); i++) {
    const t0 = i * beat;
    if (t0 < bar) continue;
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(120, t0);
    o.frequency.exponentialRampToValueAtTime(46, t0 + 0.14);
    const g = ctx.createGain();
    env(ctx, g.gain, t0, 0.10 * energy, 0.005, 0.16);
    o.connect(g); g.connect(master);
    o.start(t0); o.stop(t0 + 0.25);
  }
  const hats = noiseBuffer(ctx, durationSec + 1, rnd);
  for (let i = 0; i < Math.floor(durationSec / (beat / 2)); i++) {
    const t0 = i * (beat / 2) + beat / 4;
    if (t0 < bar * 1.5) continue;
    const src = ctx.createBufferSource();
    src.buffer = hats;
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass"; hp.frequency.value = 7800;
    const g = ctx.createGain();
    env(ctx, g.gain, t0, 0.06 * energy, 0.002, 0.05);
    src.connect(hp); hp.connect(g); g.connect(master);
    src.start(t0); src.stop(t0 + 0.08);
  }

  const buffer = await ctx.startRendering();
  if (out) writeWav(out, buffer);
  return buffer;
}

export function writeWav(path, buffer) {
  const ch = buffer.numberOfChannels;
  const len = buffer.length;
  const data = [];
  for (let c = 0; c < ch; c++) data.push(buffer.getChannelData(c));
  const bytes = 44 + len * ch * 2;
  const b = Buffer.alloc(bytes);
  b.write("RIFF", 0); b.writeUInt32LE(bytes - 8, 4); b.write("WAVE", 8);
  b.write("fmt ", 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20);
  b.writeUInt16LE(ch, 22); b.writeUInt32LE(buffer.sampleRate, 24);
  b.writeUInt32LE(buffer.sampleRate * ch * 2, 28); b.writeUInt16LE(ch * 2, 32);
  b.writeUInt16LE(16, 34); b.write("data", 36); b.writeUInt32LE(len * ch * 2, 40);
  let off = 44;
  for (let i = 0; i < len; i++) {
    for (let c = 0; c < ch; c++) {
      const v = Math.max(-1, Math.min(1, data[c][i]));
      b.writeInt16LE(Math.round(v * 32767), off); off += 2;
    }
  }
  fs.writeFileSync(path, b);
}
export function peakOf(buffer) {
  let p = 0;
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const d = buffer.getChannelData(c);
    for (let i = 0; i < d.length; i++) p = Math.max(p, Math.abs(d[i]));
  }
  return p;
}
