import { cookies } from "next/headers";

const COOKIE_NAME = "mhji_archive_admin_session";
const SESSION_SECONDS = 8 * 60 * 60;
type ArchiveAdminSession = { username: string; expiresAt: number };

function config() {
  return {
    username: process.env.ARCHIVE_ADMIN_USERNAME ?? "archive-admin",
    password: process.env.ARCHIVE_ADMIN_PASSWORD ?? (process.env.NODE_ENV === "development" ? "0691" : ""),
    secret: process.env.ARCHIVE_ADMIN_SESSION_SECRET ?? (process.env.NODE_ENV === "development" ? "local-archive-preview-session-secret" : ""),
  };
}

function bytes(value: string) { return new TextEncoder().encode(value); }
function equal(a: Uint8Array, b: Uint8Array) { const length = Math.max(a.length, b.length); let mismatch = a.length ^ b.length; for (let i = 0; i < length; i += 1) mismatch |= (a[i] ?? 0) ^ (b[i] ?? 0); return mismatch === 0; }
async function digest(value: string) { return new Uint8Array(await crypto.subtle.digest("SHA-256", bytes(value))); }
function base64Url(value: Uint8Array) { let binary = ""; for (const byte of value) binary += String.fromCharCode(byte); return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, ""); }
async function sign(value: string) { const key = await crypto.subtle.importKey("raw", bytes(config().secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]); return base64Url(new Uint8Array(await crypto.subtle.sign("HMAC", key, bytes(value)))); }

export async function verifyArchiveAdminCredentials(username: string, password: string) {
  const expected = config();
  if (!expected.password || !expected.secret) return false;
  return equal(await digest(username.trim()), await digest(expected.username)) && equal(await digest(password), await digest(expected.password));
}

export async function createArchiveAdminSessionCookie(username: string) {
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
  const payload = `${encodeURIComponent(username)}.${expiresAt}`;
  (await cookies()).set(COOKIE_NAME, `${payload}.${await sign(payload)}`, { httpOnly: true, secure: process.env.NODE_ENV !== "development", sameSite: "strict", path: "/", maxAge: SESSION_SECONDS });
}

export async function clearArchiveAdminSessionCookie() {
  (await cookies()).set(COOKIE_NAME, "", { httpOnly: true, secure: process.env.NODE_ENV !== "development", sameSite: "strict", path: "/", maxAge: 0 });
}

export async function getArchiveAdminSession(): Promise<ArchiveAdminSession | null> {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token || !config().secret) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [encoded, expiry, supplied] = parts;
  const payload = `${encoded}.${expiry}`;
  if (!equal(bytes(supplied), bytes(await sign(payload)))) return null;
  const expiresAt = Number(expiry);
  if (!Number.isFinite(expiresAt) || expiresAt <= Math.floor(Date.now() / 1000)) return null;
  let username = "";
  try { username = decodeURIComponent(encoded); } catch { return null; }
  return username === config().username ? { username, expiresAt } : null;
}
