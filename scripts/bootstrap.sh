#!/usr/bin/env bash
# Bootstrap the runtime this pipeline needs: system libraries for headless Chromium,
# CJK fonts, a pinned Node.js toolchain, the npm dependency tree and the renderer binary.
#
# Usage:  bash scripts/bootstrap.sh          (needs sudo for the apt step on Debian/Ubuntu)
# Env:    NODE_VERSION, NODE_MIRROR, SKIP_APT=1
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NODE_VERSION="${NODE_VERSION:-v22.21.1}"
NODE_MIRROR="${NODE_MIRROR:-https://npmmirror.com/mirrors/node}"
ARCH="$(uname -m)"
case "$ARCH" in
  x86_64) NODE_ARCH=x64 ;;
  aarch64|arm64) NODE_ARCH=arm64 ;;
  *) echo "unsupported arch: $ARCH" >&2; exit 1 ;;
esac

say() { printf '\n==> %s\n' "$*"; }

say "1/5 system libraries (headless Chromium + fonts + ffmpeg + python numpy)"
APT_PKGS="ffmpeg python3 python3-numpy fonts-noto-cjk libnss3 libnspr4 libxcomposite1 libxdamage1 libxrandr2 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libgbm1 libasound2t64"
if [ "${SKIP_APT:-0}" = "1" ]; then
  echo "skipped (SKIP_APT=1)"
elif command -v apt-get >/dev/null 2>&1; then
  SUDO=""
  [ "$(id -u)" -ne 0 ] && SUDO="sudo"
  $SUDO apt-get update -qq
  $SUDO apt-get install -y --no-install-recommends $APT_PKGS || $SUDO apt-get install -y --no-install-recommends ${APT_PKGS/libasound2t64/libasound2}
else
  echo "not a Debian/Ubuntu host: install ffmpeg, a CJK font family and the Chromium shared libraries manually"
fi

say "2/5 Node.js $NODE_VERSION into .tools/node"
if [ -x "$ROOT/.tools/node/bin/node" ]; then
  echo "already present: $("$ROOT/.tools/node/bin/node" -v)"
else
  mkdir -p "$ROOT/.tools"
  TARBALL="node-$NODE_VERSION-linux-$NODE_ARCH.tar.xz"
  curl -fsSL "$NODE_MIRROR/$NODE_VERSION/$TARBALL" -o "$ROOT/.tools/$TARBALL"
  tar -xJf "$ROOT/.tools/$TARBALL" -C "$ROOT/.tools"
  rm -f "$ROOT/.tools/$TARBALL"
  mv "$ROOT/.tools/node-$NODE_VERSION-linux-$NODE_ARCH" "$ROOT/.tools/node"
  echo "installed: $("$ROOT/.tools/node/bin/node" -v)"
fi
export PATH="$ROOT/.tools/node/bin:$PATH"

say "3/5 npm dependencies (pinned lockfile)"
cd "$ROOT"
if [ -f package-lock.json ]; then npm ci; else npm install; fi

say "4/5 headless Chromium for Remotion"
npx remotion browser ensure

say "5/5 environment report"
bash "$ROOT/scripts/doctor.sh" || true

cat <<'DONE'

Bootstrap finished.

  npm run studio      # live preview
  npm run verify      # end-to-end smoke test (render + audio + QA gates)
  npm run render -- Lecture out/lecture.mp4

Long renders: run them under a supervisor that survives your shell, e.g.
  systemd-run --unit=lecture --collect --property=StandardOutput=file:/tmp/lecture.log \
    /path/to/repo/scripts/render_lecture.sh
DONE
