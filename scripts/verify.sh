#!/usr/bin/env bash
# End-to-end smoke test: typecheck -> stills -> 30 s video with score -> loudness -> flicker QA.
# It does NOT need the local TTS model; narration is verified separately (docs/deployment.md step 4).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
[ -x "$ROOT/.tools/node/bin/node" ] && export PATH="$ROOT/.tools/node/bin:$PATH"
OUT="$ROOT/out/verify"
PYTHON="${PYTHON:-python3}"
mkdir -p "$OUT"

step() { printf '\n== %s\n' "$*"; }

step "1/6 typecheck"
npx tsc --noEmit

step "1.5/6 headless browser (downloads on first run, ~99 MB)"
npx remotion browser ensure --log=error || true

step "2/6 still frames (layout / font / no overflow)"
npx remotion still Storyboard "$OUT/still_storyboard.png" --frame=60 --log=error
npx remotion still Lecture "$OUT/still_lecture_proof.png" --frame=2500 --log=error --props='{"music":null,"narration":null}'
npx remotion still Typesetting "$OUT/still_typesetting.png" --frame=60 --log=error

step "3/6 programmatic score (deterministic)"
node scripts/audio/render_music.mjs --out=public/music/demo.wav --duration=32 --bpm=92 --seed=11 --energy=0.55

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