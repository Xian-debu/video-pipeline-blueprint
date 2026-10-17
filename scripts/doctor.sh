#!/usr/bin/env bash
# Read-only environment check. Prints PASS/FAIL lines and exits non-zero on any FAIL.
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
[ -x "$ROOT/.tools/node/bin/node" ] && export PATH="$ROOT/.tools/node/bin:$PATH"

fails=0
ok()   { printf 'PASS  %s\n' "$*"; }
bad()  { printf 'FAIL  %s\n' "$*"; fails=$((fails+1)); }
warn() { printf 'WARN  %s\n' "$*"; }

need_cmd() {
  if command -v "$1" >/dev/null 2>&1; then ok "$1 found: $($1 --version 2>&1 | head -1)"; else bad "$1 missing"; fi
}

echo "== toolchain"
need_cmd node
need_cmd npm
need_cmd ffmpeg
need_cmd ffprobe
need_cmd python3
node -e 'const m=process.versions.node.split(".")[0]; process.exit(+m>=20?0:1)' && ok "node >= 20" || bad "node >= 20 required"
python3 -c 'import numpy' 2>/dev/null && ok "python3 numpy (needed by the flicker gate)" || bad "python3 cannot import numpy (apt install python3-numpy, or set PYTHON=... to a venv that has it)"

echo "== node_modules"
[ -d node_modules/remotion ] && ok "remotion installed" || bad "remotion not installed (run npm install)"
[ -f package-lock.json ] && ok "lockfile present" || warn "no package-lock.json (versions may drift)"

echo "== headless Chromium"
chrome="$(find node_modules/.remotion -maxdepth 3 -name 'chrome-headless-shell' -o -maxdepth 3 -name 'chrome' 2>/dev/null | head -1)"
if [ -n "$chrome" ]; then
  ok "browser binary: $chrome"
  missing="$(ldd "$chrome" 2>/dev/null | grep -c 'not found' || true)"
  [ "$missing" = "0" ] && ok "shared libraries resolved" || bad "$missing shared libraries missing for Chromium (run the apt step in scripts/bootstrap.sh)"
else
  warn "renderer binary not downloaded yet (npm run browser; the renderer also fetches it on first use)"
fi

echo "== fonts and media"
if command -v fc-list >/dev/null 2>&1; then
  n="$(fc-list :lang=zh 2>/dev/null | wc -l)"
  [ "$n" -gt 0 ] && ok "CJK fonts: $n faces (renders Chinese subtitles)" || bad "no CJK font (install fonts-noto-cjk)"
else
  warn "fc-list not available; cannot verify CJK fonts"
fi
ffmpeg -hide_banner -encoders 2>/dev/null | grep -q 'libx264' && ok "ffmpeg has libx264" || bad "ffmpeg lacks libx264"
ffmpeg -hide_banner -filters 2>/dev/null | grep -q 'loudnorm' && ok "ffmpeg has loudnorm" || bad "ffmpeg lacks loudnorm"

echo "== assets"
[ -f public/voice/sample.wav ] && ok "narration sample present" || warn "narration sample missing (narration path untested)"
[ -d public/music ] && ok "public/music present" || warn "public/music missing"

echo "== disk"
avail_gb="$(df -BG --output=avail "$ROOT" 2>/dev/null | tail -1 | tr -dc '0-9' || echo 0)"
[ "${avail_gb:-0}" -ge 5 ] && ok "free space: ${avail_gb} GB" || bad "less than 5 GB free"

echo
if [ "$fails" -eq 0 ]; then echo "doctor: all checks passed"; else echo "doctor: $fails check(s) failed"; fi
exit $fails
