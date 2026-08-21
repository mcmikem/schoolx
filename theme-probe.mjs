import { chromium } from "playwright";

const checks = {
  "/login": [
    ["bg-white", "bg", "26, 33, 41"],
    ["text-slate-700", "color", "154, 165, 180"],
  ],
  "/register": [
    ["bg-[#17325F]/10", "bg", "26, 33, 41"],
    ["text-[#17325F]", "color", "232, 236, 241"],
    ["from-[#f0f7ff]", "gc", "#18212b"],
  ],
  "/contact": [
    ["bg-[#eaf4ed]", "bg", "30, 38, 47"],
    ["text-[#2E9448]", "color", "110, 231, 183"],
  ],
};

const browser = await chromium.launch();
let failures = 0;
for (const [path, probes] of Object.entries(checks)) {
  const page = await browser.newPage();
  await page.addInitScript(() => {
    try {
      localStorage.setItem("skoolmate-theme", "dark");
    } catch {}
    document.documentElement.setAttribute("data-theme", "dark");
  });
  await page.goto(`http://localhost:3000${path}`, { waitUntil: "networkidle" });
  console.log(`\n== ${path} ==`);
  for (const [cls, prop, expect] of probes) {
    const res = await page.evaluate(({ c, p, e }) => {
      const node = document.querySelector(`[class*="${c}"]`);
      if (!node) return { found: false };
      let val = "";
      if (p === "gc") {
        const gm = node.computedStyleMap && node.computedStyleMap().get("--tw-gradient-from");
        val = gm ? gm.toString() : "";
      } else {
        val = getComputedStyle(node)[p === "bg" ? "backgroundColor" : p];
      }
      const ok = val.includes(e);
      return { found: true, val, ok };
    }, { c: cls, p: prop, e: expect });
    if (!res.found) { console.log(`  ${cls}: element not found`); continue; }
    console.log(`  ${cls} [${prop}] = ${res.val} ${res.ok ? "OK" : "?? << EXPECTED ~"+expect}`);
    if (!res.ok) failures++;
  }
  await page.close();
}
await browser.close();
console.log(failures === 0 ? "\nALL PROBES OK" : `\n${failures} PROBLEM(S)`);
process.exit(failures === 0 ? 0 : 1);