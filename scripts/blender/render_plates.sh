#!/usr/bin/env bash
# Render a .glb into PNG plates with Blender's CLI (P16).
#
# Blender is NOT a dependency of the daily render path: it is an optional
# branch that produces immutable plates. This wrapper only finds the binary and
# forwards the arguments; every decision lives in render_plates.py so the same
# scene can be reproduced from the report.json it writes.
#
#   BLENDER=/path/to/blender npm run plates -- --glb public/models/x.glb \
#       --out public/plates/showcase --engine cycles --samples 64
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BLENDER="${BLENDER:-}"
if [ -z "$BLENDER" ]; then
  for candidate in /opt/aigen/video2/env/blender/blender "$(command -v blender 2>/dev/null || true)"; do
    if [ -n "$candidate" ] && [ -x "$candidate" ]; then BLENDER="$candidate"; break; fi
  done
fi
if [ -z "$BLENDER" ] || [ ! -x "$BLENDER" ]; then
  echo "FAIL no Blender found. Install it, or set BLENDER=/path/to/blender." >&2
  echo "      docs/blender-plates.md explains why this is optional and how to install it." >&2
  exit 2
fi

exec "$BLENDER" -b --factory-startup -noaudio \
  --python "$ROOT/scripts/blender/render_plates.py" -- "$@"
