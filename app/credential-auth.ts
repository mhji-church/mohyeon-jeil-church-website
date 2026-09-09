import { cookies } from "next/headers";
import { isArchiveManagementUsername } from "./archive-credential-auth";

const COOKIE_NAME = "mhji_admin_session";
const SESSION_SECONDS = 8 * 60 * 60;

type AdminEnvironment = {
  ADMIN_USERNAME?: string;
  ADMIN_PASSWORD?: string;
  ADMIN_SESSION_SECRET?: string;
};

type AdminSession = {
  username: string;
  expiresAt: number;
  canManageWebsite: boolean;
  canManageArchive: boolean;
};

export type AdminSessionScope = "website" | "archive";

function config() {
  const runtime = process.env as AdminEnvironment;
  return {
    username: runtime.ADMIN_USERNAME ?? "admin",
    password:
      runtime.ADMIN_PASSWORD ??
      (process.env.NODE_ENV === "development" ? "0691" : ""),
    sessionSecret:
      runtime.ADMIN_SESSION_SECRET ??
      (process.env.NODE_ENV === "development"
        ? "local-preview-session-secret"
        : ""),
  };
}

export async function verifyAdminCredentials(
  username: string,
  password: string,
): Promise<boolean> {
  const expected = config();
  if (!expected.password || !expected.sessionSecret) return false;
  const [submittedUser, expectedUser, submittedPassword, expectedPassword] =
    await Promise.all([
      digest(username.trim()),
      digest(expected.username),
      digest(password),
      digest(expected.password),
    ]);
  return (
    constantTimeEqual(submittedUser, expectedUser) &&
    constantTimeEqual(submittedPassword, expectedPassword)
  );
}

export async function createAdminSessionCookie(
  username: string,
  scope: AdminSessionScope = "website",
) {
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
  const payload = `${encodeURIComponent(username)}.${scope}.${expiresAt}`;
  const signature = await sign(payload);
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, `${payload}.${signature}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV !== "development",
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_SECONDS,
  });
}

export async function clearAdminSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV !== "development",
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });
}

export async function getAdminSession(): Promise<AdminSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  return getAdminSessionFromToken(token);
}

export async function getAdminSessionFromToken(
  token: string | null | undefined,
): Promise<AdminSession | null> {
  if (!token || !config().sessionSecret) return null;

  const parts = token.split(".");
  if (parts.length !== 3 && parts.length !== 4) return null;
  const isLegacyWebsiteSession = parts.length === 3;
  const [encodedUsername, scopeValue, expiresAtValue, suppliedSignature] =
    isLegacyWebsiteSession
      ? [parts[0], "website", parts[1], parts[2]]
      : parts;
  if (scopeValue !== "website" && scopeValue !== "archive") return null;
  const payload = isLegacyWebsiteSession
    ? `${encodedUsername}.${expiresAtValue}`
    : `${encodedUsername}.${scopeValue}.${expiresAtValue}`;
  const expectedSignature = await sign(payload);
  if (!constantTimeEqual(suppliedSignature, expectedSignature)) return null;

  const expiresAt = Number(expiresAtValue);
  if (!Number.isFinite(expiresAt) || expiresAt <= Math.floor(Date.now() / 1000)) {
    return null;
  }

  let username: string;
  try {
    username = decodeURIComponent(encodedUsername);
  } catch {
    return null;
  }
  const isWebsiteAdmin = username === config().username;
  const isArchiveAdmin = isArchiveManagementUsername(username);
  const canManageWebsite =
    (scopeValue === "website" && isWebsiteAdmin) ||
    (scopeValue === "archive" && isArchiveAdmin);
  const canManageArchive =
    isArchiveAdmin &&
    (scopeValue === "archive" || (scopeValue === "website" && isWebsiteAdmin));
  if (!canManageWebsite && !canManageArchive) return null;

  return { username, expiresAt, canManageWebsite, canManageArchive };
}

async function sign(value: string) {
  const secret = config().sessionSecret;
  if (!secret) return "";
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const bytes = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(value),
  );
  return toBase64Url(new Uint8Array(bytes));
}

async function digest(value: string) {
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return new Uint8Array(bytes);
}

function constantTimeEqual(
  left: string | Uint8Array,
  right: string | Uint8Array,
) {
  const a = typeof left === "string" ? new TextEncoder().encode(left) : left;
  const b = typeof right === "string" ? new TextEncoder().encode(right) : right;
  const length = Math.max(a.length, b.length);
  let mismatch = a.length ^ b.length;
  for (let index = 0; index < length; index += 1) {
    mismatch |= (a[index] ?? 0) ^ (b[index] ?? 0);
  }
  return mismatch === 0;
}

function toBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}
