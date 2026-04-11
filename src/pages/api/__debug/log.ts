import type { NextApiRequest, NextApiResponse } from "next";

// Debug logging endpoint — only active in development.
// In production this is a no-op to avoid leaking session data to localhost.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(404).end();

  if (process.env.NODE_ENV !== "development") {
    return res.status(204).end();
  }

  try {
    const payload = req.body;
    // Development-only: log to server console instead of a hardcoded localhost port
    console.debug("[__debug/log]", JSON.stringify(payload));
    return res.status(204).end();
  } catch {
    return res.status(400).json({ ok: false });
  }
}
