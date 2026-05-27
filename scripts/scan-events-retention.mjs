import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const root = process.cwd();
const args = new Map(
  process.argv.slice(2).map((arg) => {
    const [key, value = "true"] = arg.replace(/^--/, "").split("=");
    return [key, value];
  }),
);

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

const envFile = parseEnvFile(path.join(root, ".env.local"));
const getEnv = (key) => process.env[key] || envFile[key] || "";

const supabaseUrl = getEnv("NEXT_PUBLIC_SUPABASE_URL");
const serviceKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");
const retentionDays = Number.parseInt(args.get("retention-days") || "90", 10);
const doDelete = args.get("delete") === "true";
const outputDir = path.resolve(root, args.get("output-dir") || "exports/scan-events");
const batchSize = 1000;

if (!supabaseUrl || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

if (!Number.isFinite(retentionDays) || retentionDays < 1) {
  console.error("retention-days must be a positive integer");
  process.exit(1);
}

fs.mkdirSync(outputDir, { recursive: true });

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const cutoff = new Date();
cutoff.setDate(cutoff.getDate() - retentionDays);
const cutoffIso = cutoff.toISOString();

function csvEscape(value) {
  const normalized = value == null ? "" : String(value);
  return `"${normalized.replace(/"/g, '""')}"`;
}

async function fetchBatch(offset) {
  const query = supabase
    .from("scan_event_logs")
    .select("id, school_id, entity_type, target_id, meal_type, attendance_action, operator_user_id, scanner_id, source, raw_scan_hash, is_signed, signature_valid, decision, reason_code, reason_message, metadata, created_at")
    .lt("created_at", cutoffIso)
    .order("created_at", { ascending: true })
    .range(offset, offset + batchSize - 1);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

async function main() {
  const rows = [];
  let offset = 0;

  while (true) {
    const batch = await fetchBatch(offset);
    if (batch.length === 0) break;
    rows.push(...batch);
    if (batch.length < batchSize) break;
    offset += batchSize;
  }

  if (rows.length === 0) {
    console.log(`No scan events older than ${retentionDays} days.`);
    return;
  }

  const filename = `scan-events-archive-${cutoffIso.slice(0, 10)}.csv`;
  const filePath = path.join(outputDir, filename);
  const headers = [
    "id",
    "school_id",
    "entity_type",
    "target_id",
    "meal_type",
    "attendance_action",
    "operator_user_id",
    "scanner_id",
    "source",
    "raw_scan_hash",
    "is_signed",
    "signature_valid",
    "decision",
    "reason_code",
    "reason_message",
    "metadata",
    "created_at",
  ];
  const csv = [
    headers.map(csvEscape).join(","),
    ...rows.map((row) => headers.map((key) => {
      const value = key === "metadata" ? JSON.stringify(row[key] || {}) : row[key];
      return csvEscape(value);
    }).join(",")),
  ].join("\n");

  fs.writeFileSync(filePath, csv, "utf8");
  console.log(`Archived ${rows.length} scan events to ${filePath}`);

  if (!doDelete) {
    console.log("Dry run only. Re-run with --delete=true to remove archived rows from the database.");
    return;
  }

  const ids = rows.map((row) => row.id);
  const { error } = await supabase.from("scan_event_logs").delete().in("id", ids);
  if (error) throw error;

  console.log(`Deleted ${ids.length} archived scan events from the database.`);
}

main().catch((error) => {
  console.error("scan-events retention failed:", error.message || error);
  process.exit(1);
});
