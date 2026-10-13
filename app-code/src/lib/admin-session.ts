export const ADMIN_SESSION_COOKIE = "bughub_admin_session";
export const ADMIN_SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;

export type AdminSession = {
  username: string;
  issuedAt: number;
  expiresAt: number;
};

// version 2：令牌里带上密码指纹（fp）。管理员改密码后指纹变化，旧会话立即失效。
type SessionPayload = {
  version: 2;
  username: string;
  issuedAt: number;
  expiresAt: number;
  nonce: string;
  fp: string;
};

const encoder = new TextEncoder();

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 1) binary += String.fromCharCode(bytes[index]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function textToBase64Url(value: string): string {
  return bytesToBase64Url(encoder.encode(value));
}

function base64UrlToBytes(value: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return null;
  try {
    const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
    const binary = atob(padded);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    return null;
  }
}

function base64UrlToText(value: string): string | null {
  const bytes = base64UrlToBytes(value);
  if (!bytes) return null;
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

/**
 * 用会话密钥对密码哈希做 HMAC，取前 22 个字符作为指纹。
 * 指纹不可逆，也不会把密码哈希本身写进 Cookie。
 */
export async function passwordFingerprint(passwordHash: string, secret: string): Promise<string> {
  const signature = await crypto.subtle.sign("HMAC", await hmacKey(secret), encoder.encode(`pw:${passwordHash}`));
  return bytesToBase64Url(new Uint8Array(signature)).slice(0, 22);
}

export async function createAdminSessionToken(
  username: string,
  secret: string,
  fingerprint: string,
  now = Date.now(),
): Promise<string> {
  const issuedAt = Math.floor(now / 1000);
  const payload: SessionPayload = {
    version: 2,
    username,
    issuedAt,
    expiresAt: issuedAt + ADMIN_SESSION_MAX_AGE_SECONDS,
    nonce: crypto.randomUUID(),
    fp: fingerprint,
  };
  const encodedPayload = textToBase64Url(JSON.stringify(payload));
  const signature = await crypto.subtle.sign("HMAC", await hmacKey(secret), encoder.encode(encodedPayload));
  return `${encodedPayload}.${bytesToBase64Url(new Uint8Array(signature))}`;
}

export async function verifyAdminSessionToken(
  token: string | undefined,
  secret: string,
  fingerprint: string,
  now = Date.now(),
): Promise<AdminSession | null> {
  if (!token || !secret || !fingerprint) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [encodedPayload, encodedSignature] = parts;
  const signature = base64UrlToBytes(encodedSignature);
  if (!signature) return null;

  try {
    const signatureCopy = new Uint8Array(signature.length);
    signatureCopy.set(signature);
    const valid = await crypto.subtle.verify(
      "HMAC",
      await hmacKey(secret),
      signatureCopy,
      encoder.encode(encodedPayload),
    );
    if (!valid) return null;
    const payloadText = base64UrlToText(encodedPayload);
    if (!payloadText) return null;
    const payload: unknown = JSON.parse(payloadText);
    if (!isSessionPayload(payload)) return null;
    if (payload.fp !== fingerprint) return null;

    const nowSeconds = Math.floor(now / 1000);
    if (payload.expiresAt <= nowSeconds || payload.issuedAt > nowSeconds + 300) return null;
    if (payload.expiresAt - payload.issuedAt !== ADMIN_SESSION_MAX_AGE_SECONDS) return null;
    return { username: payload.username, issuedAt: payload.issuedAt, expiresAt: payload.expiresAt };
  } catch {
    return null;
  }
}

function isSessionPayload(value: unknown): value is SessionPayload {
  if (!value || typeof value !== "object") return false;
  const payload = value as Record<string, unknown>;
  return payload.version === 2
    && typeof payload.username === "string"
    && payload.username.length > 0
    && payload.username.length <= 200
    && Number.isInteger(payload.issuedAt)
    && Number.isInteger(payload.expiresAt)
    && typeof payload.nonce === "string"
    && payload.nonce.length > 0
    && typeof payload.fp === "string"
    && payload.fp.length > 0;
}

export function adminSessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "strict" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ADMIN_SESSION_MAX_AGE_SECONDS,
  };
}
