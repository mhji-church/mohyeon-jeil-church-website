import { getAdminSessionFromToken } from "@/app/credential-auth";

export const ANALYTICS_COOKIE = "mhji_analytics_visitor";
const COOKIE_AGE_SECONDS = 400 * 24 * 60 * 60;

function secret() {
  return process.env.ADMIN_SESSION_SECRET?.trim() ?? (process.env.NODE_ENV === "development" ? "local-preview-session-secret" : "");
}

async function hmac(value: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret()), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signed = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return Buffer.from(signed).toString("base64url");
}

export function cookieValue(request: Request, name: string) {
  for (const segment of (request.headers.get("cookie") ?? "").split(";")) {
    const [key, ...value] = segment.trim().split("=");
    if (key === name) return value.join("=");
  }
  return "";
}

export async function isAdministratorRequest(request: Request) {
  return Boolean(await getAdminSessionFromToken(cookieValue(request, "mhji_admin_session")));
}

export function sameOriginPost(request: Request) {
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  return Boolean(origin) && origin === new URL(request.url).origin && (!fetchSite || fetchSite === "same-origin");
}

export async function visitorCookie() {
  if (!secret()) return null;
  const id = crypto.randomUUID();
  return `${id}.${await hmac(`analytics-cookie:v1:${id}`)}`;
}

export async function visitorKeyFromToken(value: string) {
  if (!secret()) return null;
  const [id, signature, extra] = value.split(".");
  if (extra || !/^[0-9a-f]{8}-[0-9a-f-]{27,40}$/i.test(id ?? "") || !signature) return null;
  const expected = await hmac(`analytics-cookie:v1:${id}`);
  const left = new TextEncoder().encode(signature);
  const right = new TextEncoder().encode(expected);
  let mismatch = left.length ^ right.length;
  for (let i = 0; i < Math.max(left.length, right.length); i += 1) mismatch |= (left[i] ?? 0) ^ (right[i] ?? 0);
  return mismatch === 0 ? hmac(`analytics-visitor-key:v1:${id}`) : null;
}

export async function visitorKeyFromRequest(request: Request) {
  return visitorKeyFromToken(cookieValue(request, ANALYTICS_COOKIE));
}

export function analyticsCookieOptions(maxAge = COOKIE_AGE_SECONDS) {
  return { httpOnly: true, secure: process.env.NODE_ENV !== "development", sameSite: "lax" as const, path: "/", maxAge };
}
