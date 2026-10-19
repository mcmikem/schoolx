/**
 * Check the app against the database it actually talks to.
 *
 * supabase/schema.sql is the source of truth in the repository, but it is not
 * the same thing as what the migrations applied to the database, and the app
 * can also be ahead of both. Every fault found this way was invisible in the
 * source:
 *
 *   - the calendar selected events.audience, which has never existed
 *   - the discipline register selected exams(title); the column is exams.name
 *   - the attendance report sent 686 ids in one .in() list and PostgREST
 *     rejected the 26KB query string
 *   - subject allocations wrote a school_id the table does not have, so
 *     allocating a subject to a teacher silently did nothing
 *   - a subscription upgrade wrote an audit_log column that does not exist
 *
 * Reads are replayed, which is exact. Writes cannot be replayed safely -- they
 * would put junk into a real school's data -- so the columns written are
 * compared against the table instead. The schema comes from PostgREST's own
 * OpenAPI description, which is the database as it is, not as the file says.
 *
 * Usage:  node scripts/check/schema-drift.mjs
 * Needs .env.local with the Supabase URL and service role key.
 * Exits non-zero when anything does not match, so it can run in CI.
 */
import { execSync } from "child_process";
import { readFileSync } from "fs";

const REPO = process.cwd();
const auth = (extra = {}) => ({
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  ...extra,
});

const env = {};
for (const line of readFileSync(`${REPO}/.env.local`, "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const SUPA = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPA || !KEY) {
  console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  process.exit(2);
}

const files = execSync(`find ${REPO}/src -name '*.ts' -o -name '*.tsx' | grep -v __tests__`, {
  encoding: "utf8",
})
  .split("\n")
  .filter(Boolean);

/* ------------------------------------------------------------------ reads -- */

const pairs = new Map(); // "table|select" -> [files]
for (const f of files) {
  const text = readFileSync(f, "utf8");
  const re = /\.from\(\s*["'`](\w+)["'`]\s*\)[\s\S]{0,400}?\.select\(\s*["'`]([^"'`]+)["'`]/g;
  for (const m of text.matchAll(re)) {
    const key = `${m[1]}|${m[2]}`;
    if (!pairs.has(key)) pairs.set(key, new Set());
    pairs.get(key).add(f.replace(REPO + "/", ""));
  }
}

/**
 * postgrest-js tidies the select string before it goes on the wire: runs of
 * whitespace collapse to one space, and a space before "(" is dropped. Replaying
 * the raw source text instead reports every multi-line select and every
 * "students!inner (...)" as PGRST100, and those are all fine in the app.
 */
const normalise = (s) => s.replace(/\s+/g, " ").replace(/\s+\(/g, "(").trim();

console.log(`replaying ${pairs.size} distinct table/select pairs against the live database\n`);

const readFailures = [];
let readOk = 0;

for (const [key, where] of pairs) {
  const [table, select] = key.split("|");
  const url = `${SUPA}/rest/v1/${table}?select=${encodeURIComponent(normalise(select))}&limit=1`;
  let status = 0;
  let body = "";
  try {
    const res = await fetch(url, { headers: auth() });
    status = res.status;
    body = (await res.text()).slice(0, 220);
  } catch (e) {
    status = 0;
    body = String(e).slice(0, 120);
  }
  if (status >= 400) {
    readFailures.push({ table, select, status, body, files: [...where].slice(0, 2) });
  } else {
    readOk++;
  }
}

console.log(`ok        : ${readOk}`);
console.log(`rejected  : ${readFailures.length}\n`);

const byColumn = new Map();
for (const f of readFailures) {
  const m = f.body.match(/column ([\w.]+) does not exist/);
  const key = m ? m[1] : `${f.table} (${f.status})`;
  if (!byColumn.has(key)) byColumn.set(key, []);
  byColumn.get(key).push(f);
}

for (const [column, list] of byColumn) {
  console.log(`  ${column}`);
  for (const f of list) {
    console.log(`     ${f.table}: select(${f.select.slice(0, 66)})`);
    console.log(`       in ${f.files.join(", ")}`);
  }
}

/* ----------------------------------------------------------------- writes -- */

const spec = await (
  await fetch(`${SUPA}/rest/v1/`, {
    headers: auth({ Accept: "application/openapi+json" }),
  })
).json();

const columns = new Map();
for (const [table, def] of Object.entries(spec.definitions || {})) {
  const props = Object.keys(def.properties || {});
  if (props.length) columns.set(table, new Set(props));
}
console.log(`live schema: ${columns.size} tables\n`);

/** Top-level keys of an object literal whose "{" is at `start`. */
function topLevelKeys(text, start) {
  const keys = [];
  let depth = 0;
  let current = "";
  let quote = null;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (quote) {
      if (ch === quote && text[i - 1] !== "\\") quote = null;
      current += ch;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      quote = ch;
      current += ch;
      continue;
    }
    if (ch === "{" || ch === "[" || ch === "(") {
      depth++;
      if (depth === 1) {
        current = "";
        continue;
      }
    }
    if (ch === "}" || ch === "]" || ch === ")") {
      depth--;
      if (depth === 0) {
        keys.push(current);
        return keys;
      }
    }
    if (ch === "," && depth === 1) {
      keys.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  return keys;
}

const writeProblems = [];
let writeChecked = 0;

for (const f of files) {
  const text = readFileSync(f, "utf8");
  const rel = f.replace(REPO + "/", "");

  const fromRe = /\.from\(\s*["'`](\w+)["'`]\s*\)/g;
  for (const fm of text.matchAll(fromRe)) {
    const table = fm[1];
    const live = columns.get(table);
    if (!live) continue;

    const after = text.slice(fm.index + fm[0].length);

    // This builder's own write: the first .insert/.update/.upsert, with no
    // other .from() in between.
    const stop = after.search(/\.from\(/);
    const limit = stop === -1 ? after.length : stop;
    const opMatch = /\.(insert|update|upsert)\s*\(/.exec(after.slice(0, limit));
    if (!opMatch) continue;
    const op = opMatch[1];
    const afterOp = after.slice(opMatch.index + opMatch[0].length);

    // Only a literal payload can be checked. When the payload is a variable
    // the next brace belongs to something else -- .upsert(rows, { onConflict })
    // was being read as if onConflict were a column.
    const lead = afterOp.match(/^\s*/)[0].length;
    if (afterOp[lead] !== "{") continue;

    for (const raw of topLevelKeys(afterOp, lead)) {
      const key = raw
        .trim()
        .split(":")[0]
        .trim()
        .replace(/^["']|["']$/g, "");
      if (!/^[a-z_][a-z0-9_]*$/i.test(key)) continue;
      writeChecked++;
      if (!live.has(key)) writeProblems.push({ table, key, rel, op });
    }
  }
}

console.log(`write columns checked: ${writeChecked}`);
console.log(`not in the live table: ${writeProblems.length}\n`);

const byTable = new Map();
for (const p of writeProblems) {
  if (!byTable.has(p.table)) byTable.set(p.table, new Map());
  const m = byTable.get(p.table);
  if (!m.has(p.key)) m.set(p.key, new Set());
  m.get(p.key).add(p.rel);
}

for (const [table, cols] of byTable) {
  console.log(`  ${table}`);
  for (const [key, where] of cols) {
    console.log(`     .${key}   (${[...where][0]})`);
  }
}

const bad = readFailures.length + writeProblems.length;
if (bad) {
  console.log(`\n${bad} problem(s) found.`);
  process.exit(1);
}
console.log("\nno drift.");