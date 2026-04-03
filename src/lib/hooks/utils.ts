// Shared utilities used by all domain hooks
export const DEMO_SCHOOL_ID = '00000000-0000-0000-0000-000000000001'

export function getQuerySchoolId(schoolId: string | undefined, isDemo: boolean): string | undefined {
  if (!schoolId) return undefined
  if (isDemo && schoolId === 'demo-school') return DEMO_SCHOOL_ID
  return schoolId
}

export async function withTimeout<T>(promise: PromiseLike<T>, ms: number, fallback: T): Promise<T> {
  try {
    return await Promise.race([
      Promise.resolve(promise),
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(`Query timed out after ${ms}ms`)), ms)
      )
    ])
  } catch (e) {
    if (e instanceof Error && e.message.startsWith('Query timed out')) {
      console.warn('[hooks] Timeout — returning fallback:', e.message)
      return fallback
    }
    // Re-throw real errors so hooks can surface them to the user
    throw e
  }
}
