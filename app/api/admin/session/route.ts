import { NextResponse } from "next/server";
import {
  clearAdminSessionCookie,
  createAdminSessionCookie,
  verifyAdminCredentials,
} from "../../../credential-auth";

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => null)) as {
    username?: unknown;
    password?: unknown;
  } | null;
  const username = typeof payload?.username === "string" ? payload.username : "";
  const password = typeof payload?.password === "string" ? payload.password : "";

  if (!(await verifyAdminCredentials(username, password))) {
    return Response.json(
      { error: "아이디 또는 비밀번호가 올바르지 않습니다." },
      { status: 401 },
    );
  }

  await createAdminSessionCookie(username.trim());
  return Response.json({ ok: true });
}

export async function GET(request: Request) {
  await clearAdminSessionCookie();
  const requested = new URL(request.url).searchParams.get("return_to");
  const returnTo =
    requested?.startsWith("/") && !requested.startsWith("//") ? requested : "/";
  return NextResponse.redirect(new URL(returnTo, request.url));
}
