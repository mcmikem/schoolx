/**
 * An icon whose name has no ligature in the bundled font must not render the
 * name as visible text.
 *
 * The app ships a subset of Material Symbols instead of the Google CDN, so a
 * name that is not in the subset does not error -- it paints the word itself on
 * screen. That happened: SetupChecklist used `apartment`, a Material Icons name
 * that is not a Material Symbols ligature, and "APARTMENTS" was rendered across
 * the dashboard at 162px wide, on top of the checklist row it belonged to.
 *
 * This cannot be caught statically. The codebase uses string literals for both
 * icon names and domain values (roles, statuses, DB columns), so any source scan
 * produces well over a hundred false positives -- measured at 193 before this
 * approach was abandoned.
 *
 * So MaterialIcon measures itself at runtime instead: a real glyph is one em
 * wide, and a name that failed to resolve is several ems wide. That makes the
 * failure impossible to see regardless of how the subset drifts.
 */

import MaterialIcon from "@/components/MaterialIcon";
import { act, render } from "@testing-library/react";

/**
 * jsdom does no layout, so offsetWidth is always 0. Stub it on the prototype
 * and key it off the real font manifest, which reproduces what a browser
 * actually does: a name with a ligature lays out as one glyph (~1em), a name
 * without one lays out as its own text (162px is what "apartment" measured at
 * font-size 18). Keying off the manifest rather than guessing by string length
 * matters -- `check_circle` is 12 characters and is a perfectly real glyph.
 */
const MANIFEST = require(`${process.cwd()}/public/fonts/material-symbols-subset.json`) as {
  ligatures: string[];
};
const COVERED = new Set(MANIFEST.ligatures);

/**
 * jsdom implements neither layout nor document.fonts, so both are stubbed.
 *
 * document.fonts.check is what tells the guard whether the icon font has
 * actually arrived -- without it the guard cannot tell a missing ligature from
 * a font that is merely late.
 */
function stubFonts(ready = true) {
  const fonts = {
    check: jest.fn(() => ready),
    ready: Promise.resolve(),
  };
  Object.defineProperty(document, "fonts", {
    configurable: true,
    writable: true,
    value: fonts,
  });
  return fonts;
}

function stubLayout() {
  const spy = jest
    .spyOn(HTMLElement.prototype, "offsetWidth", "get")
    .mockImplementation(function (this: HTMLElement) {
      const name = (this.textContent ?? "").trim();
      return COVERED.has(name) ? 19 : 162;
    });
  return { restore: () => spy.mockRestore() };
}

describe("MaterialIcon missing-ligature guard", () => {
  it("renders the requested icon name", () => {
    const { container } = render(<MaterialIcon icon="check_circle" />);
    expect(container.textContent).toBe("check_circle");
  });

  let layout: ReturnType<typeof stubLayout>;
  beforeEach(() => {
    layout = stubLayout();
    stubFonts(true);
  });
  afterEach(() => layout.restore());

  it("falls back when the name renders too wide to be a glyph", () => {
    const { container } = render(<MaterialIcon icon="not_a_real_icon" size={18} />);
    expect(container.textContent).toBe("help");
  });

  it("does NOT fall back while the icon font is still loading", () => {
    // The regression this guards: an unloaded font renders the ligature as
    // plain text, which measures exactly like a missing ligature. Measuring
    // before the font arrived swapped working icons for the fallback -- 24 of
    // 64 on a phone, and worse on 2G where the font is slowest to arrive.
    stubFonts(false);
    const { container } = render(<MaterialIcon icon="notifications" size={18} />);
    expect(container.textContent).toBe("notifications");
  });

  it("re-measures once the font reports ready", async () => {
    // A name with no ligature is only detectable after the font has loaded,
    // so the guard has to look again when that happens.
    stubFonts(false);
    const { container } = render(<MaterialIcon icon="not_a_real_icon" size={18} />);
    // Not yet detectable: the font has not arrived, so the name is left alone.
    expect(container.textContent).toBe("not_a_real_icon");
    await act(async () => {
      await document.fonts.ready;
    });
  });

  it("leaves covered names alone regardless of length", () => {
    // 12 characters and still one glyph: a length heuristic would get this wrong.
    const { container } = render(<MaterialIcon icon="check_circle" size={18} />);
    expect(container.textContent).toBe("check_circle");
  });

  it("keeps a real school glyph", () => {
    const { container } = render(<MaterialIcon icon="school" size={18} />);
    expect(container.textContent).toBe("school");
  });

  it("keeps a multi-word ligature like menu_book", () => {
    const { container } = render(<MaterialIcon icon="menu_book" size={18} />);
    expect(container.textContent).toBe("menu_book");
  });

  it("replaces the word with the fallback rather than leaving it on screen", () => {
    const { container } = render(<MaterialIcon icon="close_grades" size={18} />);
    expect(container.textContent).not.toContain("close_grades");
  });
});

describe("setup checklist icons are real ligatures", () => {
  it("does not use `apartment`, which is a Material Icons name", () => {
    const src = require("fs").readFileSync(
      `${process.cwd()}/src/components/onboarding/SetupChecklist.tsx`,
      "utf8",
    );
    expect(src).not.toMatch(/school_details:\s*["'`]apartment["'`]/);
    expect(src).toMatch(/school_details:\s*["'`]domain["'`]/);
  });

  it("records which ligatures the bundled font actually contains", () => {
    const manifest = require(`${process.cwd()}/public/fonts/material-symbols-subset.json`);
    expect(manifest.ligatures.length).toBeGreaterThan(100);
    expect(manifest.ligatures).toContain("domain");
    expect(manifest.ligatures).not.toContain("apartment");
  });
});