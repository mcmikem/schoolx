import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const srcRoot = path.join(root, "src");

const patterns = [
  /demo-school/,
  /ALLOW_SUPABASE_MOCK/,
  /skoolmate_demo_2024/,
  /DEMO_ADMIN_PASSWORD/,
];

const allowed = [
  "src/app/api/demo-login/route.ts",
  "src/app/login/page.tsx",
  "src/lib/demo-data.ts",
  "src/lib/demo-utils.ts",
  "src/lib/hooks/utils.ts",
  "src/lib/parent-portal-demo.ts",
  "src/lib/seed-demo.ts",
  "src/lib/sms-automation.ts",
  "src/lib/supabase/server.ts",
  "src/lib/supabase.ts",
  "src/proxy.ts",
];

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(fullPath);
    return fullPath;
  });
}

const allowedSet = new Set(allowed.map((item) => path.normalize(item)));
const findings = [];

for (const file of walk(srcRoot)) {
  if (!/\.(ts|tsx|js|jsx)$/.test(file)) continue;
  const rel = path.normalize(path.relative(root, file));
  if (allowedSet.has(rel) || rel.includes("__tests__")) continue;

  const contents = fs.readFileSync(file, "utf8");
  for (const pattern of patterns) {
    if (pattern.test(contents)) {
      findings.push(`${rel}: ${pattern}`);
    }
  }
}

if (findings.length > 0) {
  console.error("Production leakage check failed:");
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log("Production leakage check passed.");
