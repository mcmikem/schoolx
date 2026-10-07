#!/usr/bin/env node
/**
 * Fail when the database has drifted away from supabase/schema.sql.
 *
 * Why this exists
 * ---------------
 * On 2026-09-27 several features were silently broken in production because the
 * repository and the database disagreed. Two row-level security policies had
 * been written against `activity_comments.school_id` and
 * `fee_term_lines.school_id`, columns that schema.sql declares and the live
 * tables do not have, so every write was refused. A further migration written to
 * fix an auth-column bug had never been applied at all. Reviewing the SQL in the
 * repository would have found none of it.
 *
 * Drift found that day: 21 tables declaring columns that do not exist, 35 tables
 * missing columns that do, 9 tables missing entirely.
 *
 * What it checks
 * --------------
 *   phantom-column  schema.sql declares a column the table does not have
 *   missing-column  the table has a column schema.sql does not declare
 *   missing-table   the table exists but schema.sql never declares it
 *   bad-policy      a policy predicate references a column the table lacks,
 *                   which is the failure mode that denies access silently
 *
 * Baseline
 * --------
 * Real drift is already present, so a clean run is impossible today. Findings
 * are compared against scripts/schema-drift-baseline.json and only NEW findings
 * fail, so the check is useful immediately and gets stricter as the baseline is
 * emptied. This mirrors how .gitleaksignore handles the known historical
 * secrets: ignored does not mean safe, it means not-yet-fixed.
 *
 * Usage
 * -----
 *   node scripts/check-schema-drift.mjs               fail on new findings
 *   node scripts/check-schema-drift.mjs --write-baseline
 *   node scripts/check-schema-drift.mjs --no-baseline  fail on everything
 */

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SCHEMA_PATH = path.join(ROOT, "supabase", "schema.sql");
const BASELINE_PATH = path.join(ROOT, "scripts", "schema-drift-baseline.json");

const args = process.argv.slice(2);
const WRITE_BASELINE = args.includes("--write-baseline");
const NO_BASELINE = args.includes("--no-baseline");

function loadEnvFile(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const value = m[2].replace(/^["']|["']$/g, "").trim();
    if (value && process.env[m[1]] === undefined) process.env[m[1]] = value;
  }
}

loadEnvFile(path.join(ROOT, ".env.local"));
loadEnvFile(path.join(ROOT, ".env"));

const SUPABASE_URL =
  process.env.SUPABASE_TEST_PROJECT_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Strip `-- ...` line comments, ignoring any `--` inside a string literal.
 *
 * Column lists are split on commas, so a trailing comment such as
 * `stream TEXT, -- e.g. "A", "B", "Science", "Arts"` used to invent phantom
 * columns (`b`, `science`, `arts`) and, because it consumed the real column
 * names that followed, also hid columns that do exist.
 */
function stripSqlComments(input) {
  let out = "";
  let inString = false;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (ch === "'") inString = !inString;
    if (!inString && ch === "-" && input[i + 1] === "-") {
      while (i < input.length && input[i] !== "\n") i++;
      out += "\n";
      continue;
    }
    out += ch;
  }
  return out;
}

/** Parse CREATE TABLE blocks out of schema.sql into { table: [columns] }. */
function parseSchema(raw) {
  const sql = stripSqlComments(raw);
  const tables = new Map();
  const re = /CREATE TABLE (?:IF NOT EXISTS )?([a-z_][a-z0-9_]*)\s*\(/gi;
  let m;
  while ((m = re.exec(sql)) !== null) {
    const name = m[1].toLowerCase();
    let i = m.index + m[0].length;
    let depth = 1;
    let current = "";
    const parts = [];
    while (i < sql.length && depth > 0) {
      const ch = sql[i];
      if (ch === "(") depth++;
      else if (ch === ")") {
        depth--;
        if (depth === 0) break;
      }
      if (ch === "," && depth === 1) {
        parts.push(current.trim());
        current = "";
      } else current += ch;
      i++;
    }
    if (current.trim()) parts.push(current.trim());

    const columns = [];
    for (const part of parts) {
      if (!part) continue;
      if (/^(CONSTRAINT|PRIMARY|FOREIGN|UNIQUE|CHECK|EXCLUDE|LIKE)\b/i.test(part)) continue;
      const token = part.split(/\s+/)[0].replace(/^"|"$/g, "").toLowerCase();
      if (/^[a-z_][a-z0-9_]*$/.test(token)) columns.push(token);
    }
    tables.set(name, new Set(columns));
  }
  return tables;
}

/**
 * Bare column references in a policy predicate, e.g. "school_id = my_school_id()".
 *
 * Qualified references are skipped on purpose: a predicate like
 *   EXISTS (SELECT 1 FROM users WHERE users.auth_id = auth.uid())
 * references users.auth_id, not a column on the policy's own table. Treating
 * those as local columns produced a flood of false positives.
 */
function referencedColumns(predicate) {
  const found = new Set();
  // not preceded by "." (qualified) or part of a :: cast, not a function call
  const re = /(?<![.\w])([a-z_][a-z0-9_]*)\s*(?![\w(])(=|IN\s*\(|>=|<=|>|<|LIKE\b)/gi;
  let m;
  while ((m = re.exec(predicate)) !== null) {
    const col = m[1].toLowerCase();
    if (!RESERVED.has(col)) found.add(col);
  }
  return found;
}

// Words that appear in a predicate but are not columns on the table.
const RESERVED = new Set([
  "select", "from", "where", "and", "or", "not", "in", "exists", "any", "all",
  "true", "false", "null", "as", "on", "with", "check", "using", "case", "when",
  "then", "else", "end", "coalesce", "now", "auth", "uid", "jwt", "current_user",
  "session_user", "role", "current_role", "public", "authenticated", "anon",
  "service_role", "distinct", "limit", "offset", "order", "by", "asc", "desc",
  "like", "ilike", "between", "is", "array", "::", "values", "insert", "update",
  "delete", "set", "returning", "begin", "commit", "for", "of", "both",
]);

function hasCredentials() {
  return Boolean(SUPABASE_URL && SERVICE_KEY);
}

async function fetchInventory() {
  if (!hasCredentials()) {
    throw new Error("SUPABASE_TEST_PROJECT_URL/NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  }
  const headers = {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    "Content-Type": "application/json",
  };
  const rows = [];
  for (let offset = 0; ; offset += 1000) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/ci_schema_inventory`, {
      method: "POST",
      headers,
      body: JSON.stringify({ p_limit: 1000, p_offset: offset }),
    });
    if (!res.ok) throw new Error(`inventory RPC failed: ${res.status} ${await res.text()}`);
    const page = await res.json();
    if (!Array.isArray(page) || page.length === 0) break;
    rows.push(...page);
    if (page.length < 1000) break;
  }
  return rows;
}

function main() {
  if (!fs.existsSync(SCHEMA_PATH)) {
    console.error("supabase/schema.sql not found");
    process.exit(1);
  }

  const declared = parseSchema(fs.readFileSync(SCHEMA_PATH, "utf8"));
  const findings = [];

  if (!hasCredentials()) {
    // Skipped rather than failed: a fork without project credentials should not
    // be blocked by a check that needs to talk to a database.
    console.log("schema drift check SKIPPED: no Supabase project credentials configured.");
    console.log("  set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to run it.");
    return;
  }

  fetchInventory()
    .then((rows) => {
      const liveColumns = new Map();
      const liveTables = new Set();
      const policies = [];

      for (const row of rows) {
        if (row.kind === "column") {
          if (!liveColumns.has(row.tbl)) liveColumns.set(row.tbl, new Set());
          liveColumns.get(row.tbl).add(row.detail);
        } else if (row.kind === "table") {
          liveTables.add(row.tbl);
        } else if (row.kind === "policy") {
          policies.push(row);
        }
      }

      // Ignore tables created purely to run checks against the database.
      const isTransient = (t) => t.startsWith("zz_") || t.startsWith("ci_");

      for (const [table, columns] of declared) {
        if (!liveTables.has(table)) continue;
        const live = liveColumns.get(table) || new Set();
        for (const col of columns) {
          if (!live.has(col)) findings.push(`phantom-column\t${table}\t${col}`);
        }
      }

      for (const table of liveTables) {
        if (isTransient(table)) continue;
        if (!declared.has(table)) {
          findings.push(`missing-table\t${table}\t`);
          continue;
        }
        const declaredCols = declared.get(table);
        const liveCols = liveColumns.get(table) || new Set();
        for (const col of liveCols) {
          if (!declaredCols.has(col)) findings.push(`missing-column\t${table}\t${col}`);
        }
      }

      for (const policy of policies) {
        if (isTransient(policy.tbl)) continue;
        const live = liveColumns.get(policy.tbl);
        if (!live) continue;
        const missing = [...referencedColumns(policy.detail)].filter((c) => !live.has(c));
        if (missing.length > 0) {
          findings.push(`bad-policy\t${policy.tbl}\t${missing.join(",")} :: ${policy.detail.slice(0, 120)}`);
        }
      }

      // Normalise whitespace *within* each field only. Collapsing the whole
      // string also collapsed the tab separators, so findings lost their columns.
      const key = (f) =>
        f
          .split("\t")
          .slice(0, 3)
          .map((part) => part.replace(/\s+/g, " ").trim())
          .join("\t");
      const unique = [...new Set(findings.map(key))].sort();

      if (WRITE_BASELINE) {
        fs.writeFileSync(
          BASELINE_PATH,
          JSON.stringify({ generated: new Date().toISOString(), findings: unique }, null, 2) + "\n",
        );
        console.log(`baseline written: ${unique.length} known finding(s)`);
        return;
      }

      let baseline = [];
      if (!NO_BASELINE && fs.existsSync(BASELINE_PATH)) {
        baseline = JSON.parse(fs.readFileSync(BASELINE_PATH, "utf8")).findings || [];
      }
      const known = new Set(baseline.map(key));
      const fresh = unique.filter((f) => !known.has(f));

      const counts = {};
      for (const f of unique) {
        const k = f.split("\t")[0];
        counts[k] = (counts[k] || 0) + 1;
      }
      console.log("schema drift check");
      console.log(`  tables live      : ${liveTables.size}`);
      console.log(`  tables declared  : ${declared.size}`);
      console.log(`  known drift      : ${baseline.length ? unique.length - fresh.length : 0}`);
      console.log(`  NEW drift        : ${fresh.length}`);
      for (const [k, n] of Object.entries(counts).sort()) {
        console.log(`    ${k.padEnd(16)} ${n}`);
      }

      if (fresh.length === 0) {
        console.log("\nPASS no new drift since the baseline.");
        if (unique.length > 0) {
          console.log(
            `NOTE ${unique.length} pre-existing finding(s) are baselined and still need fixing.` +
              (NO_BASELINE ? "" : " Re-run with --no-baseline to see them."),
          );
        }
        return;
      }

      console.error(`\nFAIL ${fresh.length} new drift finding(s):`);
      for (const f of fresh.slice(0, 40)) console.error("  " + f.split("\t").join("  "));
      if (fresh.length > 40) console.error(`  ... and ${fresh.length - 40} more`);
      console.error(
        "\nIf these are known and accepted, refresh the baseline:" +
          "\n  node scripts/check-schema-drift.mjs --write-baseline",
      );
      process.exitCode = 1;
    })
    .catch((err) => {
      console.error(`schema drift check failed to run: ${err.message}`);
      process.exitCode = 1;
    });
}

main();