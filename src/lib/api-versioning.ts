// ============================================================================
// 📦 API Versioning Utilities
// ============================================================================
// Ensures backward compatibility for API changes.
// All API routes should check the API version before processing requests.
// ============================================================================

export const CURRENT_API_VERSION = 2;

/**
 * Minimum API version required for the client to function.
 * Clients with versions below this will receive a 426 Upgrade Required response.
 */
export const MINIMUM_API_VERSION = 1;

/**
 * Extract API version from request headers.
 * Supports: X-API-Version header or Accept header with version.
 */
export function getApiVersion(request: Request): number | null {
  const apiVersionHeader = request.headers.get("x-api-version");
  if (apiVersionHeader) {
    const parsed = parseInt(apiVersionHeader, 10);
    if (!isNaN(parsed)) {
      return parsed;
    }
  }

  // Fallback: check Accept header for version
  const acceptHeader = request.headers.get("accept");
  if (acceptHeader) {
    const versionMatch = acceptHeader.match(/application\/json;version=(\d+)/);
    if (versionMatch) {
      return parseInt(versionMatch[1], 10);
    }
  }

  return null;
}

/**
 * Check if the client's API version is supported.
 * Returns null if version is valid, or an error response if not.
 */
export function validateApiVersion(
  request: Request,
): { valid: true; version: number } | { valid: false; response: Response } {
  const clientVersion = getApiVersion(request);

  // No version header - allow but warn (for backward compat)
  if (clientVersion === null) {
    return { valid: true, version: MINIMUM_API_VERSION };
  }

  // Below minimum version - client needs update
  if (clientVersion < MINIMUM_API_VERSION) {
    return {
      valid: false,
      response: new Response(
        JSON.stringify({
          error: "API version deprecated",
          message: `API version ${clientVersion} is no longer supported. Minimum required: ${MINIMUM_API_VERSION}. Please update the app.`,
          current_version: CURRENT_API_VERSION,
          minimum_version: MINIMUM_API_VERSION,
        }),
        {
          status: 426, // Upgrade Required
          headers: { "Content-Type": "application/json" },
        },
      ),
    };
  }

  return { valid: true, version: clientVersion };
}

/**
 * Middleware wrapper for API routes that adds version checking.
 * Usage:
 *   export async function POST(request: Request) {
 *     const versionCheck = validateApiVersion(request);
 *     if (!versionCheck.valid) return versionCheck.response;
 *     // ... process request
 *   }
 */
export function withApiVersion(handler: (request: Request, version: number) => Promise<Response>) {
  return async (request: Request): Promise<Response> => {
    const versionCheck = validateApiVersion(request);
    if (!versionCheck.valid) {
      return versionCheck.response;
    }
    return handler(request, versionCheck.version);
  };
}

/**
 * Get the current app version from environment or package.json.
 */
export function getAppVersion(): string {
  return process.env.NEXT_PUBLIC_APP_VERSION || process.env.npm_package_version || "1.0.0";
}
