import * as fs from "node:fs";
import * as path from "node:path";

/**
 * Mobile chrome geometry, pinned as source.
 *
 * Three separate bugs lived in this area, all invisible to unit tests and all
 * obvious to a teacher holding a phone:
 *
 *   - the bottom nav added env(safe-area-inset-bottom) twice, once as `bottom`
 *     and once as padding, so the bar floated up with a band of dead space
 *     under the icons;
 *   - Owly sat at a hardcoded bottom-[88px] and landed on top of "More";
 *   - the topbar carried `h-[56px]` from Tailwind, which beat the `.topbar`
 *     `min-height` the notch padding depends on -- with a 47px inset that left
 *     a 9px content box and clipped the icons under the Dynamic Island.
 */

const ROOT = path.join(__dirname, "..", "..");
const css = fs.readFileSync(path.join(ROOT, "src/app/globals.css"), "utf8");
const topbar = fs.readFileSync(path.join(ROOT, "src/components/dashboard/TopBar.tsx"), "utf8");
const owl = fs.readFileSync(path.join(ROOT, "src/components/OwlAssistant.tsx"), "utf8");

/** Strips comments, so prose explaining a fix is never read as the defect. */
const cssCode = css.replace(/\/\*[\s\S]*?\*\//g, "");
const bottomNavBlock = cssCode.slice(cssCode.indexOf(".mobile-bottom-nav {"), cssCode.indexOf(".mobile-nav-item {"));
const itemBlock = cssCode.slice(cssCode.indexOf(".mobile-nav-item {"), cssCode.indexOf(".mobile-nav-item {") + 900);

describe("bottom nav clears the home indicator exactly once", () => {
  it("sits at the bottom edge and pads its content by the inset", () => {
    expect(bottomNavBlock).toContain("bottom: 0;");
    // The inset alone. It was `calc(8px + env(...))`, and the extra 8px stacked
    // on the inset and then on each item's own vertical padding.
    expect(bottomNavBlock).toMatch(/padding:\s*6px 8px env\(safe-area-inset-bottom, 0px\)/);
    // min-height forced a floor that the inset padding then had to fight, which
    // is what left dead space under the labels.
    expect(bottomNavBlock).toMatch(/min-height:\s*0;/);
  });

  it("does not both lift the bar and pad it", () => {
    // Lifting by the inset *and* padding by it is what produced the gap.
    expect(bottomNavBlock).not.toMatch(/bottom:\s*max\([^)]*safe-area-inset-bottom/);
  });

  it("does not stack item padding on top of the inset", () => {
    // The item is stretched to the bar's height, so its own vertical padding
    // lands between the labels and the home indicator. Measured on an iPhone
    // frame this was 104px of bar with 60.5px below the labels; the inset alone
    // accounts for 34px of that.
    expect(itemBlock).toMatch(/py-1\.5/);
    expect(itemBlock).not.toMatch(/py-2\.5/);
    // The 52px touch-target floor stays -- that is accessibility, not decoration.
    expect(itemBlock).toContain("min-height: 52px;");
  });

  it("squares off only the corners that touch the screen", () => {
    expect(bottomNavBlock).toContain("border-radius: 20px 20px 0 0;");
  });
});

describe("the topbar can grow for the notch", () => {
  it("uses min-height, never a fixed height", () => {
    expect(topbar).toContain("min-h-[56px]");
    // Negative lookbehind so the assertion does not match "min-h-[56px]" itself.
    expect(topbar).not.toMatch(/(?<!min-)h-\[56px\]/);
  });
});

describe("floating UI clears the bottom nav through one shared value", () => {
  it("exposes a clearance variable", () => {
    expect(css).toContain("--mobile-nav-clearance:");
    expect(css).toContain("env(safe-area-inset-bottom");
  });

  it("Owly positions from the variable, not a guessed pixel offset", () => {
    expect(owl).toContain("var(--mobile-nav-clearance)");
    // A hardcoded 88px was what put Owly on top of the "More" button.
    expect(owl).not.toContain("bottom-[88px]");
  });
});

describe("Owly's idle motion is alive, not a status blink", () => {
  it("bobs gently instead of pulsing a coloured halo", () => {
    expect(css).toContain("@keyframes owly-alive");
    expect(css).toContain(".animate-owly-alive");
    expect(css).not.toContain(".animate-owly-pulse");
    expect(owl).toContain("animate-owly-alive");
  });

  it("stops for people who ask for reduced motion", () => {
    const reduced = css.slice(css.indexOf("prefers-reduced-motion: reduce"));
    expect(reduced).toContain(".animate-owly-alive");
  });

  it("no longer blinks a generic 'online' dot", () => {
    // The deprecated signal: pulsing forever whether or not anything was wrong.
    expect(owl).not.toMatch(/bg-green-400 animate-pulse/);
  });
});
