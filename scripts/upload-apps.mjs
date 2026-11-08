#!/usr/bin/env node
/**
 * Upload the native app binaries to the public `app-videos` Supabase bucket
 * (under `apps/`) and print the public download URLs.
 *
 *   node scripts/upload-apps.mjs [--dry]
 *
 * Sources (if present):
 *   android/app/build/outputs/apk/release/app-release.apk
 *   ios/build/SkoolMateOS.ipa        (from the ios-app GitHub Actions build)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '..');
const BUCKET = 'app-videos';
const DRY = process.argv.includes('--dry');

const env = {};
for (const file of ['.env.local', '.env']) {
  const p = path.join(REPO, file);
  if (!fs.existsSync(p)) continue;
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
}

const s = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const items = [
  {
    local: path.join(REPO, 'android/app/build/outputs/apk/release/app-release.apk'),
    dest: 'apps/skoolmate-android.apk',
    contentType: 'application/octet-stream',
  },
  {
    local: path.join(REPO, 'ios/build/SkoolMateOS.ipa'),
    dest: 'apps/skoolmate-ios.ipa',
    contentType: 'application/octet-stream',
  },
];

let uploaded = 0;
for (const item of items) {
  if (!fs.existsSync(item.local)) {
    console.log(`skip ${path.relative(REPO, item.local)} (not built yet)`);
    continue;
  }
  const url = `${env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${item.dest}`;
  if (DRY) {
    console.log(`dry ${item.dest} -> ${url}`);
    continue;
  }
  const { error } = await s.storage
    .from(BUCKET)
    .upload(item.dest, fs.readFileSync(item.local), { contentType: item.contentType, upsert: true });
  if (error) throw error;
  uploaded++;
  console.log(`${path.basename(item.local)}\t${url}`);
}
if (uploaded === 0 && !DRY) {
  console.error('nothing uploaded — build the APK (and IPA) first');
  process.exit(1);
}
