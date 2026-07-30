import { env } from "cloudflare:workers";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getMember } from "../lib/members";

const COOKIE_NAME = "mhji_member_session";
const SESSION_SECONDS = 14 * 24 * 60 * 60;

type MemberEnvironment = {
  MEMBER_SESSION_SECRET?: string;
};

function sessionSecret() {
  const runtime = env as unknown as MemberEnvironment;
  return (
    runtime.MEMBER_SESSION_SECRET ??
    (process.env.NODE_ENV === "development" ? "local-member-session-secret" : "")
  );
}

export async function createMemberSessionCookie(memberId: string) {
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
  const payload = `${memberId}.${expiresAt}`;
  const signature = await sign(payload);
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, `${payload}.${signature}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV !== "development",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_SECONDS,
  });
}

export async function clearMemberSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV !== "development",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export async function getMemberSession() {
  const secret = sessionSecret();
  if (!secret) return null;
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [memberId, expiresAtValue, suppliedSignature] = parts;
  const payload = `${memberId}.${expiresAtValue}`;
  const expectedSignature = await sign(payload);
  if (!constantTimeEqual(suppliedSignature, expectedSignature)) return null;
  const expiresAt = Number(expiresAtValue);
  if (!Number.isFinite(expiresAt) || expiresAt <= Math.floor(Date.now() / 1000)) {
    return null;
  }
  const member = await getMember(memberId);
  if (!member || member.status !== "approved") return null;
  return member;
}

export async function requireMemberPage(returnTo = "/member") {
  const member = await getMemberSession();
  if (!member) redirect(`/member/login?return_to=${encodeURIComponent(returnTo)}`);
  if (member.forcePasswordChange) redirect("/member/password");
  return member;
}

async function sign(value: string) {
  const secret = sessionSecret();
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

function constantTimeEqual(left: string, right: string) {
  const a = new TextEncoder().encode(left);
  const b = new TextEncoder().encode(right);
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
