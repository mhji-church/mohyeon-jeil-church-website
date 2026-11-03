import { NextResponse } from "next/server";
import {
  authenticateMember,
  clearMemberLoginFailures,
  createMemberLoginRateKeys,
  resolveMemberLoginCandidates,
  getMemberLoginRetryAfter,
  recordMemberLogin,
  recordMemberLoginFailure,
} from "../../../../lib/members";
import {
  clearMemberSessionCookie,
  createMemberSessionCookie,
} from "../../../member-auth";
import { recordLoginAudit } from "../../../../lib/login-audit";
import { logServerError } from "../../../../lib/api-response";
import { loginWaitMessage } from "../../../../lib/member-login-feedback";

function loginLimitedResponse(retryAfter: number) {
  return Response.json(
    { error: loginWaitMessage(retryAfter) },
    { status: 429, headers: { "retry-after": String(retryAfter), "Cache-Control": "private, no-store" } },
  );
}

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
    const candidates = await resolveMemberLoginCandidates(username);
    const rateKeys = await createMemberLoginRateKeys(username, ipAddress, candidates);
    const retryAfter = Math.max(...await Promise.all(rateKeys.map(key => getMemberLoginRetryAfter(key))));
    if (retryAfter > 0) {
      return loginLimitedResponse(retryAfter);
    }
    const result = await authenticateMember(username, password, candidates);
    if (!result || result.member.status === "suspended") {
      const blockedFor = Math.max(...await Promise.all(rateKeys.map(key => recordMemberLoginFailure(key))));
      if (blockedFor > 0) return loginLimitedResponse(blockedFor);
      return Response.json(
        { error: "로그인 정보를 확인하거나 관리자에게 문의해 주세요." },
        { status: 401 },
      );
    }
    // Clear only the authenticated identity, not unrelated homonyms' records.
    const successfulKey = await createMemberLoginRateKeys(username, ipAddress, [{ username: result.member.username, representativeId: result.member.id }]);
    await clearMemberLoginFailures(successfulKey[0]);
    await createMemberSessionCookie(result.member.id);
    await recordMemberLogin(result.member.id);
    try {
      await recordLoginAudit(request, "member", result.member.id);
    } catch (error) {
      // Preserve successful login if the audit store is temporarily unavailable.
      logServerError("member.login_audit", error);
    }
    return Response.json({
      ok: true,
      forcePasswordChange: result.member.forcePasswordChange,
      approvalPending: result.member.status === "pending",
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
