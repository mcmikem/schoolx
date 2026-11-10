#!/usr/bin/env node
/**
 * Stop a production web build from shipping a browser bundle without working
 * Supabase Auth configuration. Runtime Worker secrets cannot repair an absent
 * NEXT_PUBLIC value after Next.js has compiled the client bundle.
 */
import process from "node:process";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

function fail(message) {
  console.error(`[auth-build-config] ${message}`);
  process.exit(1);
}

if (!supabaseUrl) fail("NEXT_PUBLIC_SUPABASE_URL is required for a production browser build.");
if (!anonKey) fail("NEXT_PUBLIC_SUPABASE_ANON_KEY or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is required.");

let endpoint;
try {
  endpoint = new URL(supabaseUrl);
} catch {
  fail("NEXT_PUBLIC_SUPABASE_URL must be a valid absolute URL.");
}

if (endpoint.protocol !== "https:") fail("The production Supabase URL must use HTTPS.");

if (anonKey.startsWith("eyJ")) {
  try {
    const payloadPart = anonKey.split(".")[1];
    if (!payloadPart) throw new Error("JWT payload missing");
    const payload = JSON.parse(Buffer.from(payloadPart, "base64url").toString("utf8"));
    const expectedRef = endpoint.hostname.split(".")[0];
    if (payload.role !== "anon") fail("The browser Supabase key must use the anon role.");
    if (payload.ref && payload.ref !== expectedRef) {
      fail("The browser Supabase URL and anon key refer to different projects.");
    }
  } catch {
    fail("The browser Supabase anon key is malformed.");
  }
} else if (!anonKey.startsWith("sb_publishable_") || anonKey.length < 20) {
  fail("The browser Supabase key must be an anon JWT or publishable key.");
}

console.log("[auth-build-config] Browser Supabase Auth configuration is present and project-scoped.");
