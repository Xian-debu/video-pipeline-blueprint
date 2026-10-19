#!/usr/bin/env bash
# End-to-end smoke test: typecheck -> design check -> still lint -> stills -> 30 s video with score
# -> loudness -> flicker QA.
# It does NOT need the local TTS model; narration is verified separately (docs/deployment.md step 4).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
[ -x "$ROOT/.tools/node/bin/node" ] && export PATH="$ROOT/.tools/node/bin:$PATH"
OUT="$ROOT/out/verify"
PYTHON="${PYTHON:-python3}"
mkdir -p "$OUT"

step() { printf '\n== %s\n' "$*"; }

# Derived numbers are not committed (data/gears/*.json is ignored): a clean clone only has the
# two sources, so the generator must run before anything imports the derived files. Keeping the
# generator in the gate also means a stale hand-edit cannot survive a release.
step "0.5/6 gear data (derive every number from data/gears/params.json)"
"$PYTHON" scripts/generate_gear_data.py
if git rev-parse --git-dir >/dev/null 2>&1; then
  if git ls-files data/gears | grep -qvE '^data/gears/(params|voice)\.json$'; then
    echo "FAIL derived gear data is tracked — only params.json and voice.json are sources" >&2
    exit 1
  fi
fi

step "1/6 typecheck"
npx tsc --noEmit

step "1.1/6 film isolation (a film may not read another film's data or source)"
node scripts/qa/film_isolation.mjs

step "1.2/6 design contract (data/design.spec.json)"
"$PYTHON" scripts/qa/design_check.py

step "1.3/6 type literal ratchet (no new hard-coded font sizes)"
"$PYTHON" scripts/qa/type_ratchet.py

step "1.5/6 headless browser (downloads on first run, ~99 MB)"
npx remotion browser ensure --log=error || true

step "2/6 still frames (layout / font / no overflow)"
npx remotion still Storyboard "$OUT/still_storyboard.png" --frame=60 --log=error
npx remotion still Lecture "$OUT/still_lecture_proof.png" --frame=2500 --log=error --props='{"music":null,"narration":null}'
npx remotion still Typesetting "$OUT/still_typesetting.png" --frame=60 --log=error

step "2.5/6 still lint (DOM boxes: off-frame, edge text, spill, overlap)"
node scripts/qa/still_lint.mjs

step "2.6/6 3D asset lint (GLB structure, triangle budget, watertight)"
node scripts/qa/model_lint.mjs "public/models/*.glb" --watertight --allow=no-normals

step "2.7/6 3D frames (coverage, not black, deterministic)"
node scripts/qa/three_frame_lint.mjs --composition=ThreeStage --frames=150,450,750 --repeat

# Offline plates are an optional branch (Blender is not a dependency of the daily
# path). The gate is real whenever the plates exist, and says why it skipped when
# they do not — a silent skip is how a stale plate set survives a release.
if [ -d public/plates/showcase ]; then
  step "2.8/6 plate set (contiguous, byte-stable, matches the stage duration)"
  node scripts/qa/plate_lint.mjs
else
  step "2.8/6 plate set — skipped (public/plates/showcase not rendered; see docs/blender-plates.md)"
fi

# Generated props are produced by code, so the artifacts are in the repo and this gate is
# unconditional: a prop that stopped being watertight is a broken file, not a stale cache.
step "2.9/6 generated props (watertight, inside the triangle budget)"
npm run --silent lint:props

# The gears film computes its own geometry, so its gates are arithmetic ones: the
# involute identity, the ratio, the Willis equation and the backlash angle must still
# close, and two meshing profiles must not overlap anywhere over a tooth pitch.
step "2.10/6 gear geometry (involute identity, ratio, Willis, backlash)"
npm run --silent lint:geometry

step "2.11/6 gear meshing (no profile crossings over a tooth pitch)"
node scripts/qa/mesh_check.mjs

step "2.12/6 3D scene budget (3D share floor, pure-2D ceiling)"
npm run --silent lint:budget

step "2.13/6 gear 3D frames (coverage, not black, deterministic)"
node scripts/qa/three_frame_lint.mjs --composition=Gears --frames=900,2400,3150,4067,6400,6915,7786,8300 --repeat

step "3/6 programmatic score (deterministic)"
node scripts/audio/render_music.mjs --out=public/music/demo.wav --duration=32 --bpm=92 --seed=11 --energy=0.55

step "3.4/6 music gate self-test (the gate must still fire on a sub-only bed)"
"$PYTHON" scripts/qa/music_gate.py --self-test

step "3.5/6 score a small speaker can hear (power in 250-4k, not in 20-120 Hz)"
"$PYTHON" scripts/qa/music_gate.py --music public/music/demo.wav

step "4/6 render 30 s showreel with audio"
npx remotion render Showreel "$OUT/showreel.mp4" --log=error

step "5/6 loudness (EBU R128, two-pass loudnorm)"
bash scripts/audio/loudnorm.sh "$OUT/showreel.mp4" "$OUT/showreel_norm.mp4"
measured="$(ffmpeg -hide_banner -nostats -i "$OUT/showreel_norm.mp4" -vn -af ebur128=peak=true -f null - 2>&1 | tail -20)"
I="$(printf '%s' "$measured" | grep -A4 'Integrated loudness' | grep 'I:' | head -1 | tr -dc '0-9.-')"
TP="$(printf '%s' "$measured" | grep -A4 'True peak' | grep 'Peak:' | head -1 | tr -dc '0-9.-')"
echo "integrated loudness = $I LUFS, true peak = $TP dBFS"
awk -v i="$I" -v tp="$TP" 'BEGIN { if (i < -16.5 || i > -13 || tp > -1.5) { print "FAIL loudness out of range (want I in [-16,-13], TP <= -1.5)"; exit 1 } print "PASS loudness" }'

step "6/6 flicker QA on background region"
"$PYTHON" -c "import numpy" 2>/dev/null || { echo "FAIL python with numpy required for QA (set PYTHON=...)" >&2; exit 1; }
"$PYTHON" scripts/qa/luma_blink.py "$OUT/showreel_norm.mp4" --thresh 12 --region full

echo
echo "verify: PASS — stills in out/verify/, video in out/verify/showreel_norm.mp4"