import { NextResponse } from "next/server";
import {
  clearAdminSessionCookie,
  createAdminSessionCookie,
  verifyAdminCredentials,
} from "../../../credential-auth";
import {
  clearArchiveAdminSessionCookie,
  isArchiveManagementUsername,
  verifyArchiveAdminCredentials,
} from "../../../archive-credential-auth";

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => null)) as {
    username?: unknown;
    password?: unknown;
    returnTo?: unknown;
  } | null;
  const username = typeof payload?.username === "string" ? payload.username : "";
  const password = typeof payload?.password === "string" ? payload.password : "";

  const websiteCredentialsValid = await verifyAdminCredentials(username, password);
  const archiveCredentialsValid =
    !websiteCredentialsValid &&
    isArchiveManagementUsername(username) &&
    (await verifyArchiveAdminCredentials(username, password));

  if (!websiteCredentialsValid && !archiveCredentialsValid) {
    return Response.json(
      { error: "아이디 또는 비밀번호가 올바르지 않습니다." },
      { status: 401 },
    );
  }

  const scope = websiteCredentialsValid ? "website" : "archive";
  await createAdminSessionCookie(username.trim(), scope);
  await clearArchiveAdminSessionCookie();
  return Response.json({
    ok: true,
    returnTo: "/admin",
  });
}

export async function GET(request: Request) {
  await Promise.all([
    clearAdminSessionCookie(),
    clearArchiveAdminSessionCookie(),
  ]);
  const requested = new URL(request.url).searchParams.get("return_to");
  const returnTo =
    requested?.startsWith("/") && !requested.startsWith("//") ? requested : "/";
  return NextResponse.redirect(new URL(returnTo, request.url));
}
