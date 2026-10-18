import React from "react";
import { AbsoluteFill } from "remotion";
import { C, FONT } from "../design/tokens";

/**
 * QA fixtures for scripts/qa/still_lint.mjs. Every element here is broken on
 * purpose, one rule per element; the lint script asserts it reports each rule.
 * This composition is never part of a film.
 */
export const LintFixtures: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: C.bg, fontFamily: FONT.sans, color: C.ink }}>
      {/* 1) text on text: the two boxes overlap by more than half */}
      <div data-lint="overlap-title" style={{ position: "absolute", left: 120, top: 300, fontSize: 64 }}>
        Overlapping title
      </div>
      <div data-lint="overlap-subtitle" style={{ position: "absolute", left: 120, top: 312, fontSize: 40 }}>
        a subtitle drawn on top of it
      </div>

      {/* 2) a panel that runs off the left edge of the canvas */}
      <div
        data-lint="offcanvas-panel"
        style={{ position: "absolute", left: -200, top: 700, width: 600, height: 200, background: C.panel, border: "2px solid " + C.panelLine }}
      />

      {/* 3) text wider than its own box */}
      <div
        data-lint="spilling-text"
        style={{ position: "absolute", left: 120, top: 820, width: 220, height: 60, fontSize: 30, color: C.inkDim, whiteSpace: "nowrap" }}
      >
        this line is far wider than its box
      </div>
    </AbsoluteFill>
  );
};
