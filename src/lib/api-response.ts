export async function parseApiResponse(response: Response): Promise<Record<string, unknown>> {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    try {
      return (await response.json()) as Record<string, unknown>;
    } catch {
      return {
        success: false,
        error: response.ok
          ? "Unexpected response from server"
          : "Server returned invalid JSON",
      };
    }
  }

  const text = await response.text().catch(() => "");
  const trimmed = text.trim();
  const isHtml = /^<!doctype html|^<html/i.test(trimmed);
  const fallbackMessage = response.ok
    ? "Unexpected response from server"
    : "Server returned an unexpected error page";

  return {
    success: false,
    error: isHtml ? fallbackMessage : trimmed.slice(0, 180) || fallbackMessage,
  };
}

export async function readApiErrorMessage(response: Response): Promise<string> {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    try {
      const body = (await response.json()) as Record<string, unknown>;
      if (typeof body.error === "string" && body.error.trim()) {
        return body.error.trim();
      }
      if (typeof body.message === "string" && body.message.trim()) {
        return body.message.trim();
      }
    } catch {
      return response.ok
        ? "Unexpected response from server"
        : "Server returned invalid JSON";
    }
  }

  const text = await response.text().catch(() => "");
  const trimmed = text.trim();
  const isHtml = /^<!doctype html|^<html/i.test(trimmed);
  const fallbackMessage = response.ok
    ? "Unexpected response from server"
    : "Server returned an unexpected error page";

  return isHtml ? fallbackMessage : trimmed.slice(0, 180) || fallbackMessage;
}