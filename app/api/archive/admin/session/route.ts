import { NextResponse } from "next/server";
import { clearArchiveAdminSessionCookie, createArchiveAdminSessionCookie, verifyArchiveAdminCredentials } from "@/app/archive-credential-auth";

function safeReturn(value: string | null) { return value?.startsWith("/archive/admin") && !value.startsWith("//") ? value : "/archive/admin"; }
export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { username?: unknown; password?: unknown; returnTo?: unknown } | null;
  const username = typeof body?.username === "string" ? body.username : "";
  const password = typeof body?.password === "string" ? body.password : "";
  if (!(await verifyArchiveAdminCredentials(username, password))) return Response.json({ error: "아이디 또는 비밀번호가 올바르지 않습니다." }, { status: 401 });
  await createArchiveAdminSessionCookie(username.trim());
  return Response.json({ ok: true, returnTo: safeReturn(typeof body?.returnTo === "string" ? body.returnTo : null) });
}
export async function GET(request: Request) { await clearArchiveAdminSessionCookie(); return NextResponse.redirect(new URL("/archive", request.url)); }
