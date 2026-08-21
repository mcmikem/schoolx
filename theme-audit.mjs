import { chromium } from "playwright";

const paths = ["/", "/login", "/contact", "/register"];
const browser = await chromium.launch();
let totalIssues = 0;

for (const path of paths) {
  const page = await browser.newPage();
  await page.addInitScript(() => {
    try {
      localStorage.setItem("skoolmate-theme", "dark");
    } catch {}
    document.documentElement.setAttribute("data-theme", "dark");
  });
  await page.goto(`http://localhost:3000${path}`, { waitUntil: "networkidle" });

  const report = await page.evaluate(() => {
    const DARK = new Map();
    function lum(rgb) {
      const m = rgb.match(/([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)/);
      if (!m) return null;
      const a = [m[1], m[2], m[3]].map((x) => {
        x = +x / 255;
        return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
    }
    function effBg(el) {
      let n = el;
      while (n && n !== document.body) {
        const c = getComputedStyle(n).backgroundColor;
        if (c && c !== "rgba(0, 0, 0, 0)" && c !== "transparent") return c;
        n = n.parentElement;
      }
      return getComputedStyle(document.body).backgroundColor;
    }
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
    let el;
    while ((el = walker.nextNode())) {
      const cs = getComputedStyle(el);
      const text = (el.textContent || "").trim();
      if (!text || el.children.length !== 0) continue;
      if (el.offsetParent === null) continue;
      const fg = cs.color;
      const bg = effBg(el);
      const fgL = lum(fg);
      const bgL = lum(bg);
      if (fgL === null || bgL === null) continue;
      // unreadable: dark text on dark-ish bg
      if (fgL < 0.3 && bgL < 0.25) {
        // skip IF the fg equals a known theme token (already validated readable)
        if (["rgb(127, 138, 155)", "rgb(154, 165, 180)", "rgb(232, 236, 241)", "rgb(255, 255, 255)"].includes(fg)) continue;
        const cls = (el.getAttribute("class") || "").split(" ").find((c) => c.includes("text-")) || el.tagName;
        const key = `${cls} | ${text.slice(0, 32)} | bg=${bg} fg=${fg}`;
        DARK.set(key, (DARK.get(key) || 0) + 1);
      }
    }
    return Object.fromEntries([...DARK.entries()].sort((a, b) => b[1] - a[1]));
  });

  console.log(`\n== ${path} ==`);
  const entries = Object.entries(report);
  if (!entries.length) {
    console.log("  clean");
    continue;
  }
  for (const [k, v] of entries.slice(0, 25)) {
    console.log(`  ${v}x  ${k}`);
    totalIssues++;
  }
  await page.close();
}
await browser.close();
console.log(`\n==== TOTAL unreadable elements: ${totalIssues} ====`);
process.exit(totalIssues === 0 ? 0 : 1);