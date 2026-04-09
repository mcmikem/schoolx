import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(404).end();

  try {
    const payload = req.body;

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

    return res.status(204).end();
  } catch {
    return res.status(400).json({ ok: false });
  }
}

