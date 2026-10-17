# Environments: difficulty, substitutes, and how to choose

The pipeline has four independent capability clusters. Their requirements are very different, so
"can I run this?" has four answers.

| Cluster | Needs | Difficulty |
| --- | --- | --- |
| Render (Remotion + Chromium) | 2+ cores, 4 GB RAM, 5 GB disk, ffmpeg libs, CJK fonts | Easy |
| Score (node-web-audio-api) | Node 20+ | Easy |
| TTS narration (IndexTTS-2) | NVIDIA GPU with ~8 GB VRAM (or slow CPU), 10 GB disk | Hard |
| Manim overlay | TeX (~1 GB), cairo/pango | Medium |
| 3D scenes | WebGL via ANGLE; no GPU compute needed | Easy |

## Difficulty matrix

| Target | Verdict | Notes |
| --- | --- | --- |
| Linux + NVIDIA GPU >= 8 GB | **Reference** — everything as documented | This is what was measured |
| Linux, no GPU | **Easy without local TTS** | rendering is CPU-bound; use another TTS or captions only |
| WSL2 on Windows | **Easy**, but see K11 for disk | needs the Chromium libs; mirrored networking is recommended |
| Windows native | Doable, unverified here | Chromium libs are preinstalled; paths and ffmpeg differ |
| macOS (Apple silicon) | Doable for render/score | IndexTTS-2 on MPS is unproven — prefer another TTS |
| 8 GB RAM, 2-core VPS | **Painful** | concurrency 1, 720p, expect ~1 h for 5 min; swap needed |
| CI (GitHub Actions) | Render/score yes, TTS no | cache node_modules and the Chromium binary; TTS needs a GPU runner |

## Lower-tier substitutions

The pipeline's contracts are deliberately loose, so weaker machines can swap stages:

- **Narration.** Any TTS that writes a wav per line works: edge-tts (free, online, per-line),
  Piper (CPU, offline, fast). `retime_narration.py` only needs files plus measured durations —
  it measures them itself, so a different model only changes voice, not the pipeline.
- **Music.** The score is optional. Set `music: null` in the composition props and the film renders
  silent; or reuse one track. The score renderer itself is CPU-only and needs no GPU.
- **3D.** Replace with a still or a short clip if headless WebGL is unavailable.
- **Manim.** Skip it; the KaTeX proof scene covers the same content statically.
- **Resolution / concurrency.** 720p and `--concurrency=1` cut memory dramatically; a 5-minute film
  then takes ~20-40 minutes on 2 cores.
- **TTS off-host.** Synthesize on a GPU machine, copy the wav directory in; the timing script does
  not care where the audio came from. This is the recommended split for laptops.

## Sizing rules of thumb

- Chromium render: ~3-6 frames/s at 1080p with 2 concurrent renderers on 20 cores; scales with cores,
  not with the GPU.
- Still: 3-8 s each (startup dominated); a 12-frame contact sheet is the cheapest review tool.
- TTS: RTF ~1.75 on an 8 GB laptop GPU (41 lines ≈ 9 min); on CPU expect 10-30x slower.
- Disk: node_modules 400 MB, Chromium 99 MB, weights 10 GB, wav assets ~150 MB, renders ~15 MB/min.

## Control and supervision

- Never run a long stage from a shell that may exit (K9). Use a supervisor and read its log.
- Do not run TTS and a 3D render concurrently on 8 GB of VRAM; the TTS model alone uses ~7.9 GB.
- Keep the render deterministic: no wall-clock time, no random without a seed, no network calls.
  Then a failed render costs only time, and stills can be compared across machines.
