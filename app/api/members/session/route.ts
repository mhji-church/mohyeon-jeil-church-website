import { NextResponse } from "next/server";
import {
  authenticateMember,
  clearMemberLoginFailures,
  createMemberLoginRateKey,
  getMemberLoginRetryAfter,
  recordMemberLogin,
  recordMemberLoginFailure,
} from "../../../../lib/members";
import {
  clearMemberSessionCookie,
  createMemberSessionCookie,
} from "../../../member-auth";

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => null)) as {
    username?: unknown;
    password?: unknown;
  } | null;
  const username = typeof payload?.username === "string" ? payload.username : "";
  const password = typeof payload?.password === "string" ? payload.password : "";
  try {
    const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0] ?? "";
    const ipAddress =
      request.headers.get("x-nf-client-connection-ip") ??
      request.headers.get("cf-connecting-ip") ??
      forwardedFor.trim() ??
      "unknown";
    const rateKey = await createMemberLoginRateKey(username, ipAddress);
    const retryAfter = await getMemberLoginRetryAfter(rateKey);
    if (retryAfter > 0) {
      return Response.json(
        { error: "로그인 시도가 많습니다. 잠시 후 다시 시도해 주세요." },
        { status: 429, headers: { "retry-after": String(retryAfter) } },
      );
    }
    const result = await authenticateMember(username, password);
    if (!result) {
      const blockedFor = await recordMemberLoginFailure(rateKey);
      return Response.json(
        { error: "로그인 정보를 확인하거나 관리자 승인 여부를 확인해 주세요." },
        {
          status: blockedFor > 0 ? 429 : 401,
          headers: blockedFor > 0 ? { "retry-after": String(blockedFor) } : undefined,
        },
      );
    }
    if (result.member.status !== "approved") {
      return Response.json(
        { error: "로그인 정보를 확인하거나 관리자 승인 여부를 확인해 주세요." },
        { status: 401 },
      );
    }
    await clearMemberLoginFailures(rateKey);
    await createMemberSessionCookie(result.member.id);
    await recordMemberLogin(result.member.id);
    return Response.json({
      ok: true,
      forcePasswordChange: result.member.forcePasswordChange,
    });
  } catch {
    return Response.json(
      { error: "로그인 시스템에 일시적인 문제가 있습니다. 잠시 후 다시 시도해 주세요." },
      { status: 503 },
    );
  }
}

export async function GET(request: Request) {
  await clearMemberSessionCookie();
  const requested = new URL(request.url).searchParams.get("return_to");
  const returnTo =
    requested?.startsWith("/") && !requested.startsWith("//") ? requested : "/";
  return NextResponse.redirect(new URL(returnTo, request.url));
}
