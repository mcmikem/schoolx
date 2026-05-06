#!/usr/bin/env node
import { createClient } from "@supabase/supabase-js";

function parseArgs(argv) {
  const args = {
    apply: false,
    schoolId: null,
    role: "school_admin",
    limit: 0,
  };

  for (const token of argv) {
    if (token === "--apply") args.apply = true;
    else if (token.startsWith("--school-id=")) args.schoolId = token.split("=")[1] || null;
    else if (token.startsWith("--role=")) args.role = token.split("=")[1] || "school_admin";
    else if (token.startsWith("--limit=")) args.limit = Number(token.split("=")[1] || "0") || 0;
  }

  return args;
}

function normalizePhone(raw) {
  if (!raw || typeof raw !== "string") return null;
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;

  if (digits.startsWith("256") && digits.length >= 10) return digits;
  if (digits.startsWith("0") && digits.length >= 10) return `256${digits.slice(1)}`;
  if (digits.length === 9) return `256${digits}`;
  if (digits.length >= 10 && digits.length <= 15) return digits;
  return null;
}

function deriveName(user) {
  const fullName = user?.user_metadata?.full_name;
  if (typeof fullName === "string" && fullName.trim().length >= 2) {
    return fullName.trim();
  }

  const email = user?.email;
  if (typeof email === "string" && email.includes("@")) {
    const local = email.split("@")[0];
    const cleaned = local.replace(/[._-]+/g, " ").trim();
    if (cleaned.length >= 2) return cleaned;
  }

  return "SkoolMate User";
}

const ALLOWED_ROLES = new Set([
  "super_admin",
  "school_admin",
  "headmaster",
  "dean_of_studies",
  "bursar",
  "teacher",
  "secretary",
  "dorm_master",
  "parent",
  "student",
  "admin",
]);

function sanitizeRole(role, fallback) {
  if (typeof role === "string" && ALLOWED_ROLES.has(role)) return role;
  if (typeof fallback === "string" && ALLOWED_ROLES.has(fallback)) return fallback;
  return "school_admin";
}

async function listAllAuthUsers(supabase) {
  const users = [];
  let page = 1;
  const perPage = 200;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage,
    });

    if (error) throw error;

    const batch = data?.users || [];
    if (batch.length === 0) break;

    users.push(...batch);

    if (batch.length < perPage) break;
    page += 1;
  }

  return users;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error("Missing env vars: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log("Scanning auth users and profile rows...");
  const authUsers = await listAllAuthUsers(supabase);

  const authIds = authUsers.map((u) => u.id);
  let existingAuthIdSet = new Set();

  if (authIds.length > 0) {
    const { data: existingRows, error: existingError } = await supabase
      .from("users")
      .select("auth_id")
      .in("auth_id", authIds);

    if (existingError) throw existingError;

    existingAuthIdSet = new Set((existingRows || []).map((r) => r.auth_id).filter(Boolean));
  }

  const missing = authUsers.filter((u) => !existingAuthIdSet.has(u.id));
  const scopedMissing = opts.limit > 0 ? missing.slice(0, opts.limit) : missing;

  console.log(`Total auth users: ${authUsers.length}`);
  console.log(`Missing profile rows: ${missing.length}`);

  if (scopedMissing.length === 0) {
    console.log("No missing profile rows found.");
    return;
  }

  const preview = [];
  const inserts = [];

  for (const authUser of scopedMissing) {
    const metadataPhone = normalizePhone(authUser?.user_metadata?.phone || null);
    const emailLocal = typeof authUser.email === "string" ? authUser.email.split("@")[0] : null;
    const emailPhone = normalizePhone(emailLocal);
    const phone = metadataPhone || emailPhone;

    const metadataRole = authUser?.user_metadata?.role;
    const role = sanitizeRole(metadataRole, opts.role);

    const metadataSchoolId = authUser?.user_metadata?.school_id;
    const schoolId = typeof metadataSchoolId === "string" && metadataSchoolId.length > 0
      ? metadataSchoolId
      : opts.schoolId;

    const fullName = deriveName(authUser);

    const row = {
      auth_id: authUser.id,
      school_id: schoolId || null,
      full_name: fullName,
      phone,
      email: authUser.email || null,
      role,
      is_active: true,
    };

    const reason = !phone
      ? "Skipped (no phone in metadata/email)"
      : !row.school_id && row.role !== "super_admin"
        ? "School ID missing (pass --school-id=...)"
        : "Ready";

    preview.push({
      auth_id: row.auth_id,
      email: row.email,
      role: row.role,
      school_id: row.school_id,
      phone: row.phone,
      status: reason,
    });

    if (reason === "Ready") {
      inserts.push(row);
    }
  }

  console.table(preview.slice(0, 50));
  if (preview.length > 50) {
    console.log(`...and ${preview.length - 50} more rows`);
  }

  console.log(`Creatable rows: ${inserts.length}`);
  if (!opts.apply) {
    console.log("Dry run only. Re-run with --apply to create profile rows.");
    return;
  }

  if (inserts.length === 0) {
    console.log("Nothing to insert.");
    return;
  }

  const failures = [];
  let inserted = 0;

  for (const row of inserts) {
    const { error } = await supabase.from("users").insert(row);
    if (error) {
      failures.push({ auth_id: row.auth_id, error: error.message });
    } else {
      inserted += 1;
    }
  }

  console.log(`Inserted profile rows: ${inserted}`);
  console.log(`Failed inserts: ${failures.length}`);
  if (failures.length > 0) {
    console.table(failures.slice(0, 50));
  }
}

main().catch((error) => {
  console.error("Repair script failed:", error?.message || error);
  process.exit(1);
});
