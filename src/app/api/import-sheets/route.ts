import { NextRequest } from "next/server";
import { apiError, apiSuccess, handleApiError, requireUserWithSchool, withSecurity } from "@/lib/api-utils";
import { parseDelimitedText } from "@/lib/import/students";

async function handlePost(request: NextRequest) {
  try {
    const auth = await requireUserWithSchool(request);
    if (!auth.ok) return auth.response;

    const { url } = await request.json();
    if (typeof url !== "string" || !url.trim()) {
      return apiError("Google Sheets URL is required", 400);
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url.trim());
    } catch {
      return apiError("That does not look like a valid URL", 400);
    }

    if (!parsedUrl.hostname.endsWith("google.com") || !parsedUrl.pathname.startsWith("/spreadsheets")) {
      return apiError("Please paste a Google Sheets URL (docs.google.com/spreadsheets/...)", 400);
    }

    const sheetId = parsedUrl.pathname.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)?.[1];
    if (!sheetId) {
      return apiError("Could not find the spreadsheet ID in that URL", 400);
    }

    const gid = parsedUrl.searchParams.get("gid") || "0";
    const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;

    const response = await fetch(csvUrl, { cache: "no-store" });
    if (!response.ok) {
      return apiError("Could not fetch the sheet. Make sure it is shared as 'Anyone with the link can view'.", 400);
    }

    const text = await response.text();
    const rows = parseDelimitedText(text);

    if (rows.length === 0) {
      return apiError("No data rows found in that sheet. Make sure the first row has column headers.", 400);
    }

    return apiSuccess({ rows });
  } catch (error) {
    return handleApiError(error);
  }
}

export const POST = withSecurity(handlePost, {
  rateLimit: { limit: 15, windowMs: 60000 },
});
