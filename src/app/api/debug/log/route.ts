import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();

    await fetch(
      "http://127.0.0.1:7705/ingest/3abb6116-9e7c-43c2-8376-b2438c7d299e",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Debug-Session-Id": "9e14f3",
        },
        body: JSON.stringify(payload),
      },
    ).catch(() => {});

    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}

