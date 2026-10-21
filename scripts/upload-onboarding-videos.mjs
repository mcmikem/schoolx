#!/usr/bin/env node
/**
 * Upload the teacher onboarding clips to the public `app-videos` Supabase
 * bucket and print the public URLs.
 *
 *   node scripts/upload-onboarding-videos.mjs [--dry]
 *
 * Source files (compressed web versions + posters) live in the video template:
 *   .agents/skills/video-shotcraft/template/out/web-ob-*.{mp4,jpg}
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '..');
const SRC_DIR = path.join(REPO, '.agents/skills/video-shotcraft/template/out');
const BUCKET = 'app-videos';
const PREFIX = 'onboarding';
const DRY = process.argv.includes('--dry');

// --- env ---
const env = {};
for (const file of ['.env.local', '.env']) {
  const p = path.join(REPO, file);
  if (!fs.existsSync(p)) continue;
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const v = m[2].trim().replace(/^["']|["']$/g, '');
    if (v) env[m[1]] = v;
  }
}
const url = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const FILES = [
  { src: 'web-ob-1-attendance.mp4', dest: 'teacher-attendance.mp4', type: 'video/mp4' },
  { src: 'web-ob-2-marks.mp4', dest: 'teacher-marks.mp4', type: 'video/mp4' },
  { src: 'web-ob-3-comments.mp4', dest: 'teacher-report-comments.mp4', type: 'video/mp4' },
  { src: 'web-ob-4-tests.mp4', dest: 'teacher-class-tests.mp4', type: 'video/mp4' },
  { src: 'web-ob-1-attendance.jpg', dest: 'teacher-attendance.jpg', type: 'image/jpeg' },
  { src: 'web-ob-2-marks.jpg', dest: 'teacher-marks.jpg', type: 'image/jpeg' },
  { src: 'web-ob-3-comments.jpg', dest: 'teacher-report-comments.jpg', type: 'image/jpeg' },
  { src: 'web-ob-4-tests.jpg', dest: 'teacher-class-tests.jpg', type: 'image/jpeg' },
];

const supabase = createClient(url, key, { auth: { persistSession: false } });

// 1. bucket
const { data: buckets } = await supabase.storage.listBuckets();
if (!buckets?.some((b) => b.name === BUCKET)) {
  if (DRY) console.log(`[dry] would create bucket ${BUCKET}`);
  else {
    const { error } = await supabase.storage.createBucket(BUCKET, {
      public: true,
      fileSizeLimit: 25 * 1024 * 1024,
      allowedMimeTypes: ['video/mp4', 'image/jpeg', 'image/png'],
    });
    if (error) { console.error('createBucket failed:', error.message); process.exit(1); }
    console.log(`created bucket ${BUCKET}`);
  }
} else {
  console.log(`bucket ${BUCKET} exists`);
}

// 2. upload
const urls = {};
for (const f of FILES) {
  const abs = path.join(SRC_DIR, f.src);
  if (!fs.existsSync(abs)) { console.error(`missing source: ${abs}`); process.exit(1); }
  const body = fs.readFileSync(abs);
  const target = `${PREFIX}/${f.dest}`;
  if (DRY) { console.log(`[dry] would upload ${target} (${(body.length / 1024 / 1024).toFixed(2)} MB)`); }
  else {
    const { error } = await supabase.storage.from(BUCKET).upload(target, body, {
      contentType: f.type,
      upsert: true,
      cacheControl: '31536000',
    });
    if (error) { console.error(`upload failed for ${target}:`, error.message); process.exit(1); }
    console.log(`uploaded ${target} (${(body.length / 1024 / 1024).toFixed(2)} MB)`);
  }
  urls[f.dest] = `${url}/storage/v1/object/public/${BUCKET}/${target}`;
}

// 3. print manifest for the app config
console.log('\n--- public urls ---');
for (const [k, v] of Object.entries(urls)) console.log(`${k}\t${v}`);
