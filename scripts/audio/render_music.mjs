import { renderMusic, peakOf, writeWav } from "./engine.mjs";

// Accept both "--k=v" and "--k v": a space-separated value used to be swallowed as
// the string "true", which quietly wrote the score to a file literally named "true".
const argv = process.argv.slice(2);
const args = {};
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (!a.startsWith("--")) continue;
  const [k, v] = a.slice(2).split("=");
  if (v !== undefined) args[k] = v;
  else if (i + 1 < argv.length && !argv[i + 1].startsWith("--")) args[k] = argv[++i];
  else args[k] = "true";
}
if (args.out === "true") throw new Error("--out needs a path, e.g. --out=out/music.wav");
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
