import { createHash, createHmac, timingSafeEqual } from "crypto";

export type SignedEntityType = "student" | "staff";

export interface SignedScanPayload {
  version: string;
  entityType: SignedEntityType;
  id: string;
  schoolId: string;
  issuedAt: string;
  nonce: string;
}

export interface ScanSignatureVerification {
  isSigned: boolean;
  signatureValid: boolean;
  payload?: SignedScanPayload;
  reasonCode?: string;
}

function parseKeyValuePayload(value: string): Record<string, string> {
  const map: Record<string, string> = {};
  const parts = value.split("|").map((part) => part.trim());

  for (const part of parts) {
    const colonIndex = part.indexOf(":");
    const equalIndex = part.indexOf("=");
    const idx = colonIndex > -1 ? colonIndex : equalIndex;
    if (idx <= 0) continue;

    const key = part.slice(0, idx).trim().toLowerCase();
    const val = part.slice(idx + 1).trim();
    if (key && val) map[key] = val;
  }

  return map;
}

function isLikelySignedPayload(payload: Record<string, string>): boolean {
  return Boolean(payload.sig || payload.signature || payload.v || payload.type || payload.school || payload.school_id);
}

function buildCanonicalMessage(payload: SignedScanPayload): string {
  return [
    payload.version,
    payload.entityType,
    payload.id,
    payload.schoolId,
    payload.issuedAt,
    payload.nonce,
  ].join("|");
}

function verifyHmacSha256Hex(message: string, signatureHex: string, secret: string): boolean {
  const expected = createHmac("sha256", secret).update(message).digest("hex");
  try {
    const actualBuffer = Buffer.from(signatureHex, "hex");
    const expectedBuffer = Buffer.from(expected, "hex");
    if (actualBuffer.length !== expectedBuffer.length) return false;
    return timingSafeEqual(actualBuffer, expectedBuffer);
  } catch {
    return false;
  }
}

export function shouldRequireScanSignature(): boolean {
  return String(process.env.SCAN_REQUIRE_SIGNATURE || "false").toLowerCase() === "true";
}

export function verifySignedScanPayload(
  rawValue: string,
  expectedType: SignedEntityType,
): ScanSignatureVerification {
  const value = (rawValue || "").trim();
  if (!value) return { isSigned: false, signatureValid: false, reasonCode: "SCAN_VALUE_EMPTY" };

  const payload = parseKeyValuePayload(value);
  if (!isLikelySignedPayload(payload)) {
    return { isSigned: false, signatureValid: false };
  }

  const signature = (payload.sig || payload.signature || "").toLowerCase();
  const version = payload.v || payload.version || "1";
  const entityType = (payload.type || payload.entity || "") as SignedEntityType;
  const id = payload.id || payload.student || payload.student_id || payload.staff || payload.staff_id || "";
  const schoolId = payload.school || payload.school_id || "";
  const issuedAt = payload.ts || payload.iat || payload.issued_at || "";
  const nonce = payload.nonce || "";

  if (!signature || !entityType || !id || !schoolId || !issuedAt || !nonce) {
    return { isSigned: true, signatureValid: false, reasonCode: "SIGNED_PAYLOAD_INCOMPLETE" };
  }

  if (entityType !== expectedType) {
    return { isSigned: true, signatureValid: false, reasonCode: "SIGNED_ENTITY_TYPE_MISMATCH" };
  }

  const secret = process.env.SCAN_QR_SIGNING_SECRET;
  if (!secret) {
    return { isSigned: true, signatureValid: false, reasonCode: "SIGNING_NOT_CONFIGURED" };
  }

  const normalized: SignedScanPayload = {
    version,
    entityType,
    id,
    schoolId,
    issuedAt,
    nonce,
  };

  const canonical = buildCanonicalMessage(normalized);
  const ok = verifyHmacSha256Hex(canonical, signature, secret);

  return {
    isSigned: true,
    signatureValid: ok,
    payload: normalized,
    reasonCode: ok ? undefined : "SIGNED_SIGNATURE_INVALID",
  };
}

export function hashScanValue(rawValue: string): string {
  return createHash("sha256").update(rawValue || "").digest("hex");
}
