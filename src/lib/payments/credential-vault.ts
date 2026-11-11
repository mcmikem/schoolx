import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";

function getEncryptionKey(): Buffer {
  const encoded = process.env.PAYMENT_CREDENTIALS_ENCRYPTION_KEY || "";
  const key = Buffer.from(encoded, "base64");
  if (key.length !== 32) {
    throw new Error("Payment credentials encryption is not configured.");
  }
  return key;
}

export function encryptProviderCredentials(value: Record<string, string>): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, getEncryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString("base64url")}.${tag.toString("base64url")}.${ciphertext.toString("base64url")}`;
}

export function decryptProviderCredentials<T extends Record<string, string>>(encoded: string): T {
  const [version, ivValue, tagValue, ciphertextValue] = encoded.split(".");
  if (version !== "v1" || !ivValue || !tagValue || !ciphertextValue) {
    throw new Error("Stored payment credentials cannot be read.");
  }
  const decipher = createDecipheriv(ALGORITHM, getEncryptionKey(), Buffer.from(ivValue, "base64url"));
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextValue, "base64url")),
    decipher.final(),
  ]).toString("utf8");
  return JSON.parse(plaintext) as T;
}

export function paymentCredentialsEncryptionReady(): boolean {
  try {
    getEncryptionKey();
    return true;
  } catch {
    return false;
  }
}
