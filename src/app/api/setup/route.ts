import { NextResponse } from "next/server";

/**
 * Database setup used to be exposed as an API route that executed privileged
 * DDL. Database changes now ship only as reviewed Supabase migrations. Keep a
 * non-enumerating response for old clients and ensure no environment flag can
 * make service-role DDL reachable over HTTP.
 */
export function POST() {
  return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
}
