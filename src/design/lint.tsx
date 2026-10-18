import React, { useLayoutEffect } from "react";
import { continueRender, delayRender, getInputProps, useCurrentFrame } from "remotion";

/**
 * Still lint probe.
 *
 * Pixels cannot tell a caption from a title, so the lint measures the DOM
 * instead: every leaf text element's box, the text range's box inside it, and
 * whether the text spills out. It is inert unless inputProps carry
 * `{ lint: true, lintFrame: <n> }`, which scripts/qa/still_lint.mjs passes, so
 * a normal render pays nothing but one component in the tree.
 *
 * The protocol to the Node side is one console line per measured frame:
 *   LINTBOXES {"frame":60,"width":1920,"height":1080,"boxes":[...]}
 * console.log reaches the script through @remotion/renderer's onBrowserLog.
 */

export type LintBox = {
  tag: string;
  text: string;
  /** element border box, in css pixels, relative to the canvas */
  x: number;
  y: number;
  w: number;
  h: number;
  /** union of the element's own text ranges */
  tx: number;
  ty: number;
  tw: number;
  th: number;
  fontSize: number;
  fontFamily: string;
  color: string;
  letterSpacing: number;
  /** true when the text range extends past the element's content box */
  spills: boolean;
  /** true when the element clips content (overflow hidden/auto/scroll) */
  clips: boolean;
  /** true when this entry is a painted element (panel), not text */
  boxClip: boolean;
  /** true when the element sits inside a KaTeX formula (layout is legitimate) */
  math: boolean;
};

const hasOwnText = (el: Element): boolean =>
  Array.from(el.childNodes).some((n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? "").trim().length > 0);

const hasTextChild = (el: Element): boolean =>
  Array.from(el.children).some((c) => (c.textContent ?? "").trim().length > 0);

const ownTextNodes = (el: Element): Text[] =>
  Array.from(el.childNodes).filter(
    (n): n is Text => n.nodeType === Node.TEXT_NODE && (n.textContent ?? "").trim().length > 0,
  );

const measureBoxes = (root: Element, origin: { x: number; y: number }): LintBox[] => {
  const out: LintBox[] = [];
  // Remotion positions the canvas inside a viewport that is not always at 0,0,
  // so every box is expressed relative to the canvas origin, not the viewport.
  const ox = origin.x;
  const oy = origin.y;
  const all = Array.from(root.querySelectorAll("*"));
  for (const el of all) {
    if (!hasOwnText(el) || hasTextChild(el)) continue;
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden" || Number(cs.opacity) === 0) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;

    const range = document.createRange();
    let tx = Infinity, ty = Infinity, tr = -Infinity, tb = -Infinity;
    for (const node of ownTextNodes(el)) {
      range.selectNodeContents(node);
      const rr = range.getBoundingClientRect();
      if (rr.width <= 0 && rr.height <= 0) continue;
      tx = Math.min(tx, rr.left);
      ty = Math.min(ty, rr.top);
      tr = Math.max(tr, rr.right);
      tb = Math.max(tb, rr.bottom);
    }
    if (!Number.isFinite(tx)) continue;

    // Whether the text simply paints outside its box (overflow: visible) or is
    // clipped by it (overflow: hidden), either way it is not where it was meant
    // to be, so the lint reports both through `spills`.
    const clips = cs.overflow !== "visible";
    // Horizontal overflow is a layout defect. Vertical overflow is normal
    // typography: a line box is shorter than its glyphs (descenders, accents,
    // KaTeX italic correction), so only flag it when it is large relative to
    // the font size.
    const px = parseFloat(cs.fontSize) || 16;
    const verticalTolerance = Math.max(6, px * 0.4);
    const spills =
      tx < r.left - 1 ||
      tr > r.right + 1 ||
      ty < r.top - verticalTolerance ||
      tb > r.bottom + verticalTolerance;

    out.push({
      tag: el.tagName.toLowerCase(),
      text: (el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 80),
      x: r.left - ox,
      y: r.top - oy,
      w: r.width,
      h: r.height,
      tx: tx - ox,
      ty: ty - oy,
      tw: tr - tx,
      th: tb - ty,
      fontSize: Number.parseFloat(cs.fontSize),
      fontFamily: cs.fontFamily,
      color: cs.color,
      letterSpacing: cs.letterSpacing === "normal" ? 0 : Number.parseFloat(cs.letterSpacing),
      spills,
      clips,
      boxClip: false,
      math: Boolean(el.closest(".katex")),
    });
  }

  // Elements that paint a panel but hold no text of their own: a card that runs
  // off the frame is invisible to the text pass above.
  const rootRect = root.getBoundingClientRect();
  for (const el of all) {
    if (hasOwnText(el) || hasTextChild(el)) continue;
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden" || Number(cs.opacity) === 0) continue;
    const paints = cs.backgroundImage !== "none" || cs.backgroundColor !== "rgba(0, 0, 0, 0)";
    const bordered = cs.borderTopWidth !== "0px" || cs.borderLeftWidth !== "0px";
    if (!paints && !bordered) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    // A deliberate full-bleed background is exactly the canvas.
    const fullBleed =
      r.left - ox <= 0.5 &&
      r.top - oy <= 0.5 &&
      r.right - ox >= rootRect.width - 0.5 &&
      r.bottom - oy >= rootRect.height - 0.5;
    if (fullBleed) continue;
    out.push({
      tag: el.tagName.toLowerCase(),
      text: "",
      x: r.left - ox,
      y: r.top - oy,
      w: r.width,
      h: r.height,
      tx: r.left,
      ty: r.top,
      tw: 0,
      th: 0,
      fontSize: 0,
      fontFamily: "",
      color: cs.backgroundColor,
      letterSpacing: 0,
      spills: false,
      clips: cs.overflow !== "visible",
      boxClip: true,
      math: Boolean(el.closest(".katex")),
    });
  }
  return out;
};

export const LintAudit: React.FC = () => {
  const marker = React.useRef<HTMLDivElement>(null);
  const frame = useCurrentFrame();
  const input = getInputProps() as { lint?: boolean; lintFrame?: number };
  const active = input.lint === true;
  const target = typeof input.lintFrame === "number" ? input.lintFrame : 0;

  useLayoutEffect(() => {
    if (!active || frame !== target) return;
    const handle = delayRender("still lint: measure frame " + frame);

    // Two things make the measurement timing-dependent, and both bite:
    //  - the page holds more than one mount (the Studio bundle keeps a hidden
    //    one, fixed at y = -999999 and laid out at zero width, and it mounts
    //    first). Measuring it reports every box in the wrong place.
    //  - the renderer mounts the composition into a detached container and only
    //    later moves that DOM into #remotion-canvas, so the layout effect runs
    //    before the node is inside the canvas and never runs again.
    // So wait for the marker to be inside a populated #remotion-canvas instead
    // of trusting the first effect, and keep the render blocked until then.
    const findCanvas = (): Element | null => {
      const canvases = document.querySelectorAll("#remotion-canvas");
      for (let i = 0; i < canvases.length; i += 1) {
        const canvas = canvases[i];
        if (canvas.contains(marker.current) && canvas.children.length > 0) return canvas;
      }
      return null;
    };

    let attempts = 0;
    const attempt = () => {
      const canvas = findCanvas();
      if (!canvas) {
        attempts += 1;
        if (attempts > 120) {
          console.warn("still lint: no #remotion-canvas mount after 120 attempts, skipping frame " + frame);
          continueRender(handle);
          return;
        }
        setTimeout(attempt, 25);
        return;
      }
      const canvasRect = canvas.getBoundingClientRect();
      const boxes = measureBoxes(canvas, { x: canvasRect.left, y: canvasRect.top });
      console.log(
        "LINTBOXES " +
          JSON.stringify({
            frame,
            width: Math.round(canvasRect.width),
            height: Math.round(canvasRect.height),
            canvas: canvas.id || canvas.tagName.toLowerCase(),
            boxes,
          }),
      );
      continueRender(handle);
    };

    // Webfonts decide line boxes; measuring before they settle measures a font
    // that is not the one in the picture.
    document.fonts.ready.then(attempt);
  }, [active, frame, target]);

  return <div ref={marker} style={{ position: "absolute", left: 0, top: 0, width: 0, height: 0 }} />;
};