import { cookies } from "next/headers";
import { getMemberLoginRetryAfter, memberAttemptRateKey, recordMemberLoginFailure } from "./members";

export const RECOVERY_COOKIE = "mhji_member_recovery";
export const RECOVERY_COOKIE_PATH = "/api/members/recovery";
export const recoveryHeaders = { "Cache-Control": "private, no-store" };

export async function recoveryInput(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin || request.headers.get("sec-fetch-site") === "cross-site") return { denied: Response.json({ error: "요청 경로를 확인해 주세요." }, { status: 403, headers: recoveryHeaders }) };
  if (!request.headers.get("content-type")?.startsWith("application/json")) return { denied: new Response(null, { status: 415, headers: recoveryHeaders }) };
  const reader = request.body?.getReader();
  const decoder = new TextDecoder();
  let text = "";
  let bytes = 0;
  if (reader) while (true) {
    const part = await reader.read();
    if (part.done) break;
    bytes += part.value.byteLength;
    if (bytes > 1024) { await reader.cancel(); return { denied: new Response(null, { status: 413, headers: recoveryHeaders }) }; }
    text += decoder.decode(part.value, { stream: true });
  }
  text += decoder.decode();
  try {
    const data: unknown = JSON.parse(text);
    if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("invalid");
    return { data: data as Record<string, unknown> };
  } catch { return { denied: Response.json({ error: "입력 형식을 확인해 주세요." }, { status: 400, headers: recoveryHeaders }) }; }
}

export async function recoveryRateLimit(request: Request, step: "start" | "complete") {
  const forwarded = process.env.NODE_ENV === "development" ? request.headers.get("x-forwarded-for")?.split(",")[0] : null;
  const ip = request.headers.get("x-nf-client-connection-ip") || forwarded || "unknown";
  const key = await memberAttemptRateKey(`member-recovery-${step}`, ip);
  const remaining = await getMemberLoginRetryAfter(key) || await recordMemberLoginFailure(key);
  return remaining ? Response.json({ error: "요청이 많습니다. 잠시 후 다시 시도해 주세요." }, { status: 429, headers: { ...recoveryHeaders, "Retry-After": String(remaining) } }) : null;
}

export async function setRecoveryCookie(token: string, seconds: number) {
  (await cookies()).set(RECOVERY_COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV !== "development", sameSite: "strict", path: RECOVERY_COOKIE_PATH, maxAge: seconds });
}
