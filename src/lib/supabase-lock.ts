import { getErrorMessage } from "@/lib/validation";

const LOCK_BROKEN_MESSAGE =
  "Lock broken by another request with the 'steal' option.";

function getErrorDetails(error: unknown): string {
  if (typeof error !== "object" || error === null) return "";

  const details = (error as { details?: unknown }).details;
  if (typeof details === "string") return details;

  return "";
}

export function isSupabaseLockAbortError(error: unknown): boolean {
  const message = getErrorMessage(error, "");
  const details = getErrorDetails(error);
  const name =
    error instanceof Error
      ? error.name
      : typeof error === "object" && error !== null
        ? String((error as { name?: unknown }).name || "")
        : "";

  // Matches: "Lock broken by another request with the 'steal' option."
  if (message.includes(LOCK_BROKEN_MESSAGE) || details.includes(LOCK_BROKEN_MESSAGE)) {
    return true;
  }

  // Any AbortError that is lock-related (name === 'AbortError' + steal/lock keywords)
  if (name === "AbortError" || name.includes("AbortError")) {
    const combined = `${message} ${details}`.toLowerCase();
    if (
      combined.includes("lock") ||
      combined.includes("steal") ||
      combined.includes("request was aborted") ||
      combined === " " // bare AbortError with no message — also from lock contention
    ) {
      return true;
    }
  }

  return false;
}

export async function withSupabaseLockRetry<T>(
  operation: () => Promise<T>,
  options?: {
    retries?: number;
    baseDelayMs?: number;
  },
): Promise<T> {
  const retries = options?.retries ?? 2;
  const baseDelayMs = options?.baseDelayMs ?? 250;

  let attempt = 0;

  while (true) {
    try {
      return await operation();
    } catch (error) {
      if (!isSupabaseLockAbortError(error) || attempt >= retries) {
        throw error;
      }

      attempt += 1;
      await new Promise((resolve) =>
        setTimeout(resolve, baseDelayMs * attempt),
      );
    }
  }
}