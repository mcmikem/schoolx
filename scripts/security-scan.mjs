#!/usr/bin/env node
import { execSync } from 'node:child_process';

const checks = [
  {
    name: 'Potentially real JWT-style secrets in env assignments',
    pattern: '(SUPABASE_SERVICE_ROLE_KEY|NEXT_PUBLIC_SUPABASE_ANON_KEY|STRIPE_SECRET_KEY|PAYPAL_CLIENT_SECRET)\\s*=\\s*eyJ[a-zA-Z0-9._-]{20,}',
  },
  {
    name: 'Private keys committed to repo',
    pattern: 'BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY',
  },
  {
    name: 'Live Stripe secret keys committed',
    pattern: 'sk_live_[0-9a-zA-Z]{16,}',
  },
];

const ignoredPathRegex = [
  /^docs\/PRODUCTION_READINESS_AUDIT_.*\.md$/,
  /^analytics\//,
  /^changelogs\//,
  /^node_modules\//,
  /^package-lock\.json$/,
];

function run(command) {
  return execSync(command, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function shouldIgnore(path) {
  return ignoredPathRegex.some((rx) => rx.test(path));
}

const offenders = [];

for (const check of checks) {
  let output = '';
  try {
    output = run(`rg -n --hidden --glob '!.git' "${check.pattern}" .`);
  } catch (err) {
    output = err?.stdout?.toString?.() || '';
  }

  if (!output) continue;

  for (const line of output.split('\n')) {
    if (!line) continue;
    const firstColon = line.indexOf(':');
    if (firstColon === -1) continue;
    const path = line.slice(0, firstColon).replace(/^\.\//, '');
    if (shouldIgnore(path)) continue;

    offenders.push({ check: check.name, line: `${path}:${line.slice(firstColon + 1)}` });
  }
}

if (offenders.length > 0) {
  console.error('❌ Security scan failed. Potential secrets found:');
  offenders.forEach((o) => console.error(`- [${o.check}] ${o.line}`));
  process.exit(1);
}

console.log('✅ Security scan passed. No high-risk secret patterns detected.');
