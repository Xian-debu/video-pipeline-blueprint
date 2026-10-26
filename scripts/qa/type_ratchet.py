#!/usr/bin/env python3
"""Type literal ratchet.

The design contract is the only place a font size may live. The 305 s lecture and the
showcase samples predate that rule and carry ~40 literal sizes; freezing them into the
contract would make forty arbitrary numbers look like a scale. So they are grandfathered in
data/type-exceptions.json instead, and this script makes the list a ratchet:

  - a literal that is not on the list      -> FAIL (add a token to the contract first)
  - a literal that grew a second use       -> FAIL (one more place naming a pixel value)
  - a literal that is gone                 -> FAIL (delete it from the list in the same commit)

Only storyboard/ reads type tokens today; the exception list is what is left to drain.

Usage: python3 scripts/qa/type_ratchet.py [--write]
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "src"
EXCEPTIONS = ROOT / "data" / "type-exceptions.json"

PATTERNS = {
    "fontSize": re.compile(r"fontSize:\s*(\d+(?:\.\d+)?)"),
    "letterSpacing": re.compile(r"letterSpacing:\s*(\d+(?:\.\d+)?)"),
}


def scan() -> dict[str, dict[str, dict[str, int]]]:
    """file -> property -> literal -> uses."""
    found: dict[str, dict[str, dict[str, int]]] = {}
    # Mounted content is not engine code: a pack's literals belong to that pack, and the
    # engine has no business freezing them into its own design contract.
    mounted = set()
    manifest = ROOT / ".films" / "index.json"
    if manifest.exists():
        doc = json.loads(manifest.read_text(encoding="utf-8"))
        for entry in doc.get("films", []) + doc.get("series", []):
            for m in entry.get("mounts", []):
                to = m.get("to", "")
                if to.startswith("src/"):
                    mounted.add(to.split("/")[1])
    for path in sorted(SRC.rglob("*")):
        if path.suffix not in {".ts", ".tsx"}:
            continue
        rel = path.relative_to(SRC)
        if rel.parts and rel.parts[0] in mounted:
            continue
        text = path.read_text(encoding="utf-8")
        per: dict[str, dict[str, int]] = {}
        for prop, pattern in PATTERNS.items():
            for match in pattern.finditer(text):
                value = match.group(1)
                bucket = per.setdefault(prop, {})
                bucket[value] = bucket.get(value, 0) + 1
        if per:
            found[path.relative_to(ROOT).as_posix()] = per
    return found


def flat(table: dict[str, dict[str, dict[str, int]]]) -> dict[str, int]:
    out: dict[str, int] = {}
    for file, props in table.items():
        for prop, values in props.items():
            for value, count in values.items():
                out[file + " " + prop + ":" + value] = count
    return out


def main() -> int:
    write = "--write" in sys.argv[1:]
    current = flat(scan())
    committed: dict[str, int] = {}
    if EXCEPTIONS.exists():
        committed = json.loads(EXCEPTIONS.read_text(encoding="utf-8")).get("literals", {})

    if write:
        doc = {
            "note": (
                "fontSize/letterSpacing literals outside the design contract, grandfathered by "
                "scripts/qa/type_ratchet.py. The list may only shrink: new work takes a token from "
                "data/design.spec.json (type.scale or type.families). Regenerate with --write only "
                "when a commit removes literals."
            ),
            "literals": dict(sorted(current.items())),
        }
        EXCEPTIONS.write_text(json.dumps(doc, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        print("type ratchet: wrote " + str(len(current)) + " grandfathered literals to " + EXCEPTIONS.relative_to(ROOT).as_posix())
        return 0

    added = {k: current[k] for k in current if k not in committed}
    grown = {k: (committed[k], current[k]) for k in current if k in committed and current[k] > committed[k]}
    shrunk = {k: (committed[k], current[k]) for k in current if k in committed and current[k] < committed[k]}
    gone = {k: committed[k] for k in committed if k not in current}

    if added or grown or shrunk or gone:
        for key, count in sorted(added.items()):
            print("NEW        " + key + " x" + str(count) + " -> take a token from data/design.spec.json")
        for key, (was, now) in sorted(grown.items()):
            print("DUPLICATED " + key + " " + str(was) + " -> " + str(now) + " uses")
        for key, (was, now) in sorted(shrunk.items()):
            print("SHRUNK     " + key + " " + str(was) + " -> " + str(now) + " uses")
        for key, was in sorted(gone.items()):
            print("STALE      " + key + " (listed " + str(was) + "x, no longer in src) -> regenerate with --write")
        print("type ratchet: FAIL - the exception list and src/ disagree")
        return 1

    files = len({key.split(" ")[0] for key in current})
    print("type ratchet: PASS - " + str(len(current)) + " grandfathered literals across " + str(files) + " files, list unchanged")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
