// One place that knows every film: its composition id, the script that owns its timeline, the
// prefix its delivery exports use, and the generators whose output it reads but cannot ship.
//
// Why this file exists: make.mjs and qa/still_lint.mjs each kept their own copy of this map, and
// when the Hawk film was added to only one of them the still gate ran over nothing and passed
// (docs/known-issues.md K27). A gate that is fed by a second, hand-maintained list is not a gate.
// Both now import this map, and qa/film_coverage.mjs fails when the tree and the map disagree.
//
//   derive   generators that must run before typecheck (their output is not committed)
//   derived  what those generators write, so a check can prove it is not tracked by git.
//            "*" is only supported as a trailing "/*.json"; "!" lines are exceptions.
export const FILMS = {
  Lecture: {
    script: "src/lecture/script.ts",
    prefix: "lecture",
    derive: [],
    derived: [],
  },
  Multiplication: {
    script: "src/mult/script.ts",
    prefix: "multiplication",
    derive: [],
    derived: [],
  },
  Gears: {
    script: "src/gears/script.ts",
    prefix: "gears",
    derive: ["scripts/generate_gear_data.py"],
    derived: ["data/gears/*.json", "!data/gears/params.json", "!data/gears/voice.json"],
  },
  Hawk: {
    script: "src/hawk/script.ts",
    prefix: "hawk",
    derive: ["scripts/generate_hawk_data.py"],
    derived: ["data/hawk/gray.json", "data/hawk/wave.json"],
  },
  Arc: {
    script: "src/arc/script.ts",
    prefix: "arc",
    derive: ["scripts/generate_arc_data.py"],
    derived: ["data/arc/sim.json"],
  },
  Quickselect: {
    script: "src/quickselect/script.ts",
    prefix: "quickselect",
    derive: ["scripts/generate_quickselect_data.py"],
    derived: [
      "data/quickselect/*.json",
      "!data/quickselect/sources.json",
      "!data/quickselect/voice.json",
    ],
  },
  Char: {
    script: "src/char/script.ts",
    prefix: "char",
    // The model and its plates are authored by Blender under scripts/char and committed as
    // ledgers (data/char/plates.json, data/char/gate.json); nothing here is generated at make time.
    derive: [],
    derived: [],
  },
};

/** Composition ids that have a film behind them (the rest are design demos). */
export const FILM_COMPOSITIONS = Object.keys(FILMS);

/** The film behind a composition, or null for a design demo (Storyboard, Showreel, ...). */
export function filmFor(composition) {
  return FILMS[composition] ?? null;
}
