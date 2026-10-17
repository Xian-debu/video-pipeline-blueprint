import { renderMusic, peakOf, writeWav } from "./engine.mjs";

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? "true"];
  })
);
const out = args.out ?? "out/music.wav";
const durationSec = Number(args.duration ?? 30);
const bpm = Number(args.bpm ?? 84);
const seed = Number(args.seed ?? 1);
const prog = args.prog ?? "minor";
const energy = Number(args.energy ?? 0.8);

const buf = await renderMusic({ durationSec, bpm, seed, prog, energy, out });
const peak = peakOf(buf);
const dbfs = 20 * Math.log10(peak);
console.log(JSON.stringify({ out, durationSec, bpm, seed, prog, channels: buf.numberOfChannels, sampleRate: buf.sampleRate, peak: Number(peak.toFixed(6)), peakDbFS: Number(dbfs.toFixed(2)) }));
