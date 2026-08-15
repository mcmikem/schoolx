import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const envPath = path.join(root, ".env.local");

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const raw = fs.readFileSync(filePath, "utf8");
  return raw.split(/\r?\n/).reduce((acc, line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return acc;
    const idx = trimmed.indexOf("=");
    if (idx < 0) return acc;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    acc[key] = value;
    return acc;
  }, {});
}

const fileEnv = parseEnvFile(envPath);
const resolveValue = (key) => process.env[key] || fileEnv[key] || "";

const required = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
];

const recommended = [
  "SCAN_QR_SIGNING_SECRET",
  "CRON_SECRET",
  "GEMINI_API_KEY",
  "SENTRY_DSN",
  "NEXT_PUBLIC_SENTRY_DSN",
];

const optionalFlags = [
  "ENABLE_DEV_TEST_ROUTES",
  "NEXT_PUBLIC_ENABLE_DEV_TEST_ROUTES",
  "ALLOW_SUPABASE_MOCK",
];

const missingRequired = required.filter((key) => !resolveValue(key));
const missingRecommended = recommended.filter((key) => !resolveValue(key));
const hasGoogleGenAiKey = Boolean(resolveValue("GOOGLE_GENAI_API_KEY"));
const hasGeminiKey = Boolean(resolveValue("GEMINI_API_KEY"));

console.log("Environment readiness check");
console.log(`- .env.local present: ${fs.existsSync(envPath) ? "yes" : "no"}`);
for (const key of required) {
  console.log(`- ${key}: ${resolveValue(key) ? "set" : "missing"}`);
}
for (const key of recommended) {
  console.log(`- ${key}: ${resolveValue(key) ? "set" : "missing (recommended)"}`);
}
console.log(
  `- GOOGLE_GENAI_API_KEY: ${hasGoogleGenAiKey ? "set" : hasGeminiKey ? "not set (covered by GEMINI_API_KEY)" : "missing (optional alternative)"}`,
);
for (const key of optionalFlags) {
  console.log(`- ${key}: ${resolveValue(key) ? resolveValue(key) : "not set"}`);
}

if (missingRequired.length > 0) {
  console.error("\nMissing required environment variables:");
  for (const key of missingRequired) {
    console.error(`- ${key}`);
  }
  process.exit(1);
}

if (missingRecommended.length > 0) {
  console.warn("\nMissing recommended environment variables:");
  for (const key of missingRecommended) {
    console.warn(`- ${key}`);
  }
}

console.log("\nEnvironment is ready for real Supabase-backed validation.");
