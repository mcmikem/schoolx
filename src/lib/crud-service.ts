import { withTimeout } from "@/lib/hooks/utils";

export class CrudWriteError extends Error {
  code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = "CrudWriteError";
    this.code = code;
  }
}

type WriteResult = { error: { message?: string; code?: string } | null };
type AwaitableWriteResult = PromiseLike<WriteResult> | WriteResult;
type WriteResultWithData<T> = {
  data: T | null;
  error: { message?: string; code?: string } | null;
};
type AwaitableWriteResultWithData<T> =
  | PromiseLike<WriteResultWithData<T>>
  | WriteResultWithData<T>;

function normalizeError(err: unknown, fallback: string): CrudWriteError {
  if (err instanceof CrudWriteError) return err;
  if (err instanceof Error) {
    const code = (err as Error & { code?: string }).code;
    return new CrudWriteError(err.message || fallback, code);
  }
  return new CrudWriteError(fallback);
}

export async function createRecord(
  exec: () => AwaitableWriteResult,
  options?: { timeoutMs?: number; timeoutMessage?: string },
): Promise<void> {
  const timeoutMs = options?.timeoutMs ?? 8000;
  const timeoutMessage = options?.timeoutMessage ?? "Create request timed out";

  try {
    const result = await withTimeout<WriteResult>(
      Promise.resolve(exec()),
      timeoutMs,
      { error: { message: timeoutMessage, code: "TIMEOUT" } },
    );
    const error = result.error;
    if (error) {
      throw new CrudWriteError(error.message || "Create failed", error.code);
    }
  } catch (err) {
    throw normalizeError(err, "Create failed");
  }
}

export async function updateRecord(
  exec: () => AwaitableWriteResult,
  options?: { timeoutMs?: number; timeoutMessage?: string },
): Promise<void> {
  const timeoutMs = options?.timeoutMs ?? 8000;
  const timeoutMessage = options?.timeoutMessage ?? "Update request timed out";

  try {
    const result = await withTimeout<WriteResult>(
      Promise.resolve(exec()),
      timeoutMs,
      { error: { message: timeoutMessage, code: "TIMEOUT" } },
    );
    const error = result.error;
    if (error) {
      throw new CrudWriteError(error.message || "Update failed", error.code);
    }
  } catch (err) {
    throw normalizeError(err, "Update failed");
  }
}

export async function deleteRecord(
  exec: () => AwaitableWriteResult,
  options?: { timeoutMs?: number; timeoutMessage?: string },
): Promise<void> {
  const timeoutMs = options?.timeoutMs ?? 8000;
  const timeoutMessage = options?.timeoutMessage ?? "Delete request timed out";

  try {
    const result = await withTimeout<WriteResult>(
      Promise.resolve(exec()),
      timeoutMs,
      { error: { message: timeoutMessage, code: "TIMEOUT" } },
    );
    const error = result.error;
    if (error) {
      throw new CrudWriteError(error.message || "Delete failed", error.code);
    }
  } catch (err) {
    throw normalizeError(err, "Delete failed");
  }
}

export async function upsertRecord(
  exec: () => AwaitableWriteResult,
  options?: { timeoutMs?: number; timeoutMessage?: string },
): Promise<void> {
  const timeoutMs = options?.timeoutMs ?? 8000;
  const timeoutMessage = options?.timeoutMessage ?? "Upsert request timed out";

  try {
    const result = await withTimeout<WriteResult>(
      Promise.resolve(exec()),
      timeoutMs,
      { error: { message: timeoutMessage, code: "TIMEOUT" } },
    );
    const error = result.error;
    if (error) {
      throw new CrudWriteError(error.message || "Upsert failed", error.code);
    }
  } catch (err) {
    throw normalizeError(err, "Upsert failed");
  }
}

export async function createRecordReturning<T>(
  exec: () => AwaitableWriteResultWithData<T>,
  options?: { timeoutMs?: number; timeoutMessage?: string },
): Promise<T> {
  const timeoutMs = options?.timeoutMs ?? 8000;
  const timeoutMessage = options?.timeoutMessage ?? "Create request timed out";

  try {
    const result = await withTimeout<WriteResultWithData<T>>(
      Promise.resolve(exec()),
      timeoutMs,
      { data: null, error: { message: timeoutMessage, code: "TIMEOUT" } },
    );
    if (result.error) {
      throw new CrudWriteError(
        result.error.message || "Create failed",
        result.error.code,
      );
    }
    if (result.data === null) {
      throw new CrudWriteError("Create returned no data");
    }
    return result.data;
  } catch (err) {
    throw normalizeError(err, "Create failed");
  }
}

export async function upsertRecordReturning<T>(
  exec: () => AwaitableWriteResultWithData<T>,
  options?: { timeoutMs?: number; timeoutMessage?: string },
): Promise<T> {
  const timeoutMs = options?.timeoutMs ?? 8000;
  const timeoutMessage = options?.timeoutMessage ?? "Upsert request timed out";

  try {
    const result = await withTimeout<WriteResultWithData<T>>(
      Promise.resolve(exec()),
      timeoutMs,
      { data: null, error: { message: timeoutMessage, code: "TIMEOUT" } },
    );
    if (result.error) {
      throw new CrudWriteError(
        result.error.message || "Upsert failed",
        result.error.code,
      );
    }
    if (result.data === null) {
      throw new CrudWriteError("Upsert returned no data");
    }
    return result.data;
  } catch (err) {
    throw normalizeError(err, "Upsert failed");
  }
}