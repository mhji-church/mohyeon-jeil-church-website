import { ingestAnonymousEvents } from "@/lib/analytics-ingest";
import { isLikelyAutomation } from "@/lib/analytics-model";
import { ANALYTICS_COOKIE, analyticsCookieOptions, isAdministratorRequest, sameOriginPost, visitorCookie, visitorKeyFromRequest, visitorKeyFromToken } from "@/lib/analytics-identity";
import { getContext } from "@netlify/functions";
import { NextResponse } from "next/server";

function trustedCountry() {
  try {
    const code = getContext().geo?.country?.code?.toUpperCase() ?? "";
    return /^[A-Z]{2}$/.test(code) ? code : "ZZ";
  } catch { return "ZZ"; }
}

export async function POST(request: Request) {
  const headers = { "Cache-Control": "private, no-store, max-age=0" };
  if (!sameOriginPost(request) || request.headers.get("content-type")?.split(";")[0] !== "application/json") return Response.json({ error: "요청을 확인할 수 없습니다." }, { status: 403, headers });
  if (Number(request.headers.get("content-length") ?? 0) > 8192) return Response.json({ error: "요청이 너무 큽니다." }, { status: 413, headers });
  const userAgent = request.headers.get("user-agent") ?? "";
  if (isLikelyAutomation(userAgent) || await isAdministratorRequest(request)) return new Response(null, { status: 204, headers });
  let visitorKey = await visitorKeyFromRequest(request);
  let newCookie: string | null = null;
  if (!visitorKey) {
    newCookie = await visitorCookie();
    visitorKey = newCookie ? await visitorKeyFromToken(newCookie) : null;
  }
  if (!visitorKey) return Response.json({ error: "접속 통계를 기록할 수 없습니다." }, { status: 503, headers });
  const text = await request.text();
  if (text.length > 8192) return Response.json({ error: "요청이 너무 큽니다." }, { status: 413, headers });
  let body: unknown;
  try { body = JSON.parse(text); } catch { return Response.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400, headers }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return Response.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400, headers });
  try {
    // Only the trusted Netlify function context is used; IP and client country
    // headers are never stored or trusted.
    const result = await ingestAnonymousEvents(visitorKey, body, userAgent, trustedCountry());
    if (!result.accepted) return Response.json({ error: "이벤트 형식이 올바르지 않습니다." }, { status: 400, headers });
    const response = NextResponse.json({ ok: true, stored: result.stored }, { headers });
    if (newCookie) response.cookies.set(ANALYTICS_COOKIE, newCookie, analyticsCookieOptions());
    return response;
  } catch (error) {
    if (error instanceof Error && error.message === "rate-limit") return Response.json({ error: "잠시 후 다시 시도해 주세요." }, { status: 429, headers });
    return Response.json({ error: "접속 통계를 기록하지 못했습니다." }, { status: 503, headers });
  }
}
