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

const bottomNavBlock = css.slice(css.indexOf(".mobile-bottom-nav {"), css.indexOf(".mobile-nav-item {"));

describe("bottom nav clears the home indicator exactly once", () => {
  it("sits at the bottom edge and pads its content by the inset", () => {
    expect(bottomNavBlock).toContain("bottom: 0;");
    expect(bottomNavBlock).toMatch(/padding:\s*8px 8px calc\(8px \+ env\(safe-area-inset-bottom\)\)/);
  });

  it("does not both lift the bar and pad it", () => {
    // Lifting by the inset *and* padding by it is what produced the gap.
    expect(bottomNavBlock).not.toMatch(/bottom:\s*max\([^)]*safe-area-inset-bottom/);
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

describe("Owly's blink is honest and accessible", () => {
  it("has a real animation rather than the old permanent status pulse", () => {
    expect(css).toContain("@keyframes owly-attention");
    expect(css).toContain(".animate-owly-pulse");
  });

  it("stops for people who ask for reduced motion", () => {
    const reduced = css.slice(css.indexOf("prefers-reduced-motion: reduce"));
    expect(reduced).toContain(".animate-owly-pulse");
  });

  it("no longer blinks a generic 'online' dot", () => {
    // The deprecated signal: pulsing forever whether or not anything was wrong.
    expect(owl).not.toMatch(/bg-green-400 animate-pulse/);
  });
});
