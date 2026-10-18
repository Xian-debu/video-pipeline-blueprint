// Deterministic narration + score mix with speech ducking.
//
// The mix happens here, not inside the renderer, so the same stems can be re-levelled and
// re-gated without re-rendering frames. Output: 16-bit 48 kHz stereo PCM. Loudness
// normalisation is a separate two-pass step (scripts/audio/loudnorm.sh).
import fs from "node:fs";
import path from "node:path";

// accepts both --key=value and --key value (the shell examples in docs use the latter)
const args = {};
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  const raw = argv[i];
  if (!raw.startsWith("--")) continue;
  const eq = raw.indexOf("=");
  if (eq !== -1) {
    args[raw.slice(2, eq)] = raw.slice(eq + 1);
  } else if (i + 1 < argv.length && !argv[i + 1].startsWith("--")) {
    args[raw.slice(2)] = argv[++i];
  } else {
    args[raw.slice(2)] = "true";
  }
}
const need = (k) => {
  if (!args[k]) throw new Error("mix: missing --" + k);
  return args[k];
};

function readWav(file) {
  const b = fs.readFileSync(file);
  if (b.toString("ascii", 0, 4) !== "RIFF" || b.toString("ascii", 8, 12) !== "WAVE") {
    throw new Error("mix: not a WAV file: " + file);
  }
  let off = 12, fmt = null, data = null;
  while (off + 8 <= b.length) {
    const id = b.toString("ascii", off, off + 4);
    const size = b.readUInt32LE(off + 4);
    const body = off + 8;
    if (id === "fmt ") {
      fmt = {
        format: b.readUInt16LE(body),
        channels: b.readUInt16LE(body + 2),
        sampleRate: b.readUInt32LE(body + 4),
        bits: b.readUInt16LE(body + 14),
      };
    } else if (id === "data") {
      data = { start: body, size };
    }
    off = body + size + (size % 2);
  }
  if (!fmt || !data) throw new Error("mix: WAV without fmt/data chunk: " + file);
  if (fmt.format !== 1 || fmt.bits !== 16) {
    throw new Error("mix: only 16-bit PCM WAV supported (got format " + fmt.format + ", " + fmt.bits + " bits)");
  }
  const frames = Math.floor(data.size / (2 * fmt.channels));
  const chans = [];
  for (let c = 0; c < fmt.channels; c++) chans.push(new Float32Array(frames));
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < fmt.channels; c++) {
      chans[c][i] = b.readInt16LE(data.start + (i * fmt.channels + c) * 2) / 32768;
    }
  }
  return { ...fmt, frames, chans };
}

function writeWavStereo(file, left, right, sampleRate) {
  const frames = left.length;
  const bytes = 44 + frames * 4;
  const b = Buffer.alloc(bytes);
  b.write("RIFF", 0); b.writeUInt32LE(bytes - 8, 4); b.write("WAVE", 8);
  b.write("fmt ", 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20);
  b.writeUInt16LE(2, 22); b.writeUInt32LE(sampleRate, 24);
  b.writeUInt32LE(sampleRate * 4, 28); b.writeUInt16LE(4, 32); b.writeUInt16LE(16, 34);
  b.write("data", 36); b.writeUInt32LE(frames * 4, 40);
  let o = 44;
  for (let i = 0; i < frames; i++) {
    const l = Math.max(-1, Math.min(1, left[i]));
    const r = Math.max(-1, Math.min(1, right[i]));
    b.writeInt16LE(Math.round(l * 32767), o); o += 2;
    b.writeInt16LE(Math.round(r * 32767), o); o += 2;
  }
  fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  fs.writeFileSync(file, b);
}

const dbToGain = (db) => Math.pow(10, db / 20);
const db = (v) => 20 * Math.log10(v + 1e-12);

const narration = readWav(need("narration"));
const music = readWav(need("music"));
if (narration.sampleRate !== music.sampleRate) {
  throw new Error("mix: stems disagree on sample rate (" + narration.sampleRate + " vs " + music.sampleRate + ")");
}
const SR = narration.sampleRate;
const narrMono = narration.channels === 1 ? narration.chans[0] : mixdown(narration);
function mixdown(w) {
  const out = new Float32Array(w.frames);
  for (let c = 0; c < w.channels; c++) for (let i = 0; i < w.frames; i++) out[i] += w.chans[c][i] / w.channels;
  return out;
}

// ---- narration envelope -> ducking gain ----
const duckDb = Number(args["duck-db"] ?? 4.5);
const duckGain = dbToGain(-duckDb);
const win = Math.round(SR * 0.02);
const env = new Float32Array(Math.ceil(narrMono.length / win));
for (let w = 0; w < env.length; w++) {
  let s = 0;
  const a = w * win, b = Math.min(narrMono.length, a + win);
  for (let i = a; i < b; i++) s += narrMono[i] * narrMono[i];
  env[w] = Math.sqrt(s / Math.max(1, b - a));
}
let peakEnv = 0;
for (const e of env) peakEnv = Math.max(peakEnv, e);
const gate = peakEnv * dbToGain(-46);
const attackCoef = 1 - Math.exp(-1 / (0.08 / 0.02));
const releaseCoef = 1 - Math.exp(-1 / (0.42 / 0.02));
let g = 1;
let duckedWindows = 0;
const duckCurve = new Float32Array(env.length);
for (let w = 0; w < env.length; w++) {
  const speaking = env[w] > gate;
  if (speaking) duckedWindows++;
  const target = speaking ? duckGain : 1;
  const coef = target < g ? attackCoef : releaseCoef;
  g += (target - g) * coef;
  duckCurve[w] = g;
}

const musicGain = dbToGain(Number(args["music-gain-db"] ?? 0));
const fadeIn = Number(args["fade-in"] ?? 1.5);
const fadeOut = Number(args["fade-out"] ?? 2.5);
const tail = Number(args["tail"] ?? 1.2);
const total = Math.max(narration.frames, Math.round((narration.frames / SR + tail) * SR));

const left = new Float32Array(total);
const right = new Float32Array(total);
let musicPeak = 0;
for (let i = 0; i < total; i++) {
  const n = i < narrMono.length ? narrMono[i] : 0;
  const mIdx = i % music.frames;
  const d = duckCurve[Math.min(duckCurve.length - 1, Math.floor(i / win))];
  const t = i / SR;
  const end = total / SR;
  let fade = 1;
  if (t < fadeIn) fade = t / fadeIn;
  if (t > end - fadeOut) fade = Math.max(0, (end - t) / fadeOut);
  const ml = music.chans[0][mIdx] * musicGain * d * fade;
  const mr = (music.channels > 1 ? music.chans[1][mIdx] : music.chans[0][mIdx]) * musicGain * d * fade;
  left[i] = n + ml;
  right[i] = n + mr;
  musicPeak = Math.max(musicPeak, Math.abs(ml), Math.abs(mr));
}

let peak = 0;
for (let i = 0; i < total; i++) peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]));
const ceiling = dbToGain(-1);
const preGain = peak > ceiling ? ceiling / peak : 1;
if (preGain !== 1) for (let i = 0; i < total; i++) { left[i] *= preGain; right[i] *= preGain; }

const out = args.out ?? "out/mix.wav";
writeWavStereo(out, left, right, SR);

const rms = (x) => Math.sqrt(x.reduce((s, v) => s + v * v, 0) / x.length);
const summary = {
  out,
  sampleRate: SR,
  seconds: Number((total / SR).toFixed(3)),
  narrationSeconds: Number((narration.frames / SR).toFixed(3)),
  musicSeconds: Number((music.frames / SR).toFixed(3)),
  musicGainDb: Number(args["music-gain-db"] ?? 0),
  duckDb,
  ducked: ((duckedWindows / env.length) * 100).toFixed(1) + "%",
  fadeIn,
  fadeOut,
  peakDbFS: Number(db(peak * preGain).toFixed(2)),
  peakBeforeLimitDbFS: Number(db(peak).toFixed(2)),
  rmsDbFS: Number(db(rms(left)).toFixed(2)),
  musicOnlyPeakDbFS: Number(db(musicPeak).toFixed(2)),
  preGain: Number(preGain.toFixed(4)),
};
console.log(JSON.stringify(summary));
