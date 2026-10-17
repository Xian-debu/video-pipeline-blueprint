#!/usr/bin/env bash
# Two-pass EBU R128 normalisation that keeps the video stream untouched.
# Usage: bash scripts/audio/loudnorm.sh <in.mp4> <out.mp4>
# Env:   I (default -15 LUFS), TP (default -2 dBTP), LRA (default 11)
set -euo pipefail

IN="$1"
OUT="$2"
I="${I:--15}"
TP="${TP:--2}"
LRA="${LRA:-11}"

pass1="$(ffmpeg -hide_banner -nostats -i "$IN" -vn \
  -af "loudnorm=I=$I:TP=$TP:LRA=$LRA:print_format=json" -f null - 2>&1 || true)"

read -r MI MTP MLRA MTHRE MOL <<EOF
$(printf '%s' "$pass1" | python3 -c '
import json, re, sys
text = sys.stdin.read()
m = re.search(r"\{[^{}]*input_i[^{}]*\}", text, re.S)
if not m:
    sys.exit("loudnorm: first pass produced no JSON block")
d = json.loads(m.group(0))
print(d["input_i"], d["input_tp"], d["input_lra"], d["input_thresh"], d["target_offset"])
')
EOF

ffmpeg -hide_banner -nostats -y -i "$IN" -c:v copy \
  -af "loudnorm=I=$I:TP=$TP:LRA=$LRA:measured_I=$MI:measured_TP=$MTP:measured_LRA=$MLRA:measured_thresh=$MTHRE:offset=$MOL:linear=true:print_format=summary" \
  -c:a aac -b:a 192k -ar 48000 "$OUT"

echo "loudnorm: in I=$MI TP=$MTP -> out I=$I TP=$TP (linear)"
