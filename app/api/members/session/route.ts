import { NextResponse } from "next/server";
import {
  authenticateMember,
  recordMemberLogin,
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
    const result = await authenticateMember(username, password);
    if (!result) {
      return Response.json(
        { error: "아이디 또는 비밀번호가 올바르지 않습니다." },
        { status: 401 },
      );
    }
    if (result.member.status === "pending") {
      return Response.json(
        { error: "관리자 승인 대기 중인 계정입니다." },
        { status: 403 },
      );
    }
    if (result.member.status === "suspended") {
      return Response.json(
        { error: "이용이 중지된 계정입니다. 교회 관리자에게 문의해 주세요." },
        { status: 403 },
      );
    }
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
