import { NextResponse } from "next/server";
import { clearAdminSessionCookie } from "@/app/credential-auth";
import { clearArchiveAdminSessionCookie } from "@/app/archive-credential-auth";

export async function POST() {
  return Response.json(
    { error: "홈페이지 관리자 로그인을 이용해 주세요." },
    { status: 403 },
  );
}

export async function GET(request: Request) {
  await Promise.all([
    clearArchiveAdminSessionCookie(),
    clearAdminSessionCookie(),
  ]);
  return NextResponse.redirect(new URL("/archive", request.url));
}
