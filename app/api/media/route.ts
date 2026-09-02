import { getAdminSessionFromToken } from "../../credential-auth";
import { getMemberSessionFromToken } from "../../member-auth";
import { getUploadedMediaAccess } from "../../../lib/content";
import { getExternalObject } from "../../../lib/external-r2";
import { apiError } from "../../../lib/api-response";

function cookieValue(cookieHeader: string | null, name: string) {
  if (!cookieHeader) return null;
  for (const item of cookieHeader.split(";")) {
    const separator = item.indexOf("=");
    if (separator < 0 || item.slice(0, separator).trim() !== name) continue;
    return item.slice(separator + 1).trim();
  }
  return null;
}

async function serveExternalMediaUnsafe(
  key: string | null,
  cookieHeader: string | null,
) {
  if (!key || !/^(gallery|bulletins|businesses|content\/[a-z-]+)\//.test(key)) {
    return new Response("Not found", { status: 404 });
  }
  const access = await getUploadedMediaAccess(key);
  if (access !== "public") {
    const [member, admin] = await Promise.all([
      getMemberSessionFromToken(cookieValue(cookieHeader, "mhji_member_session")),
      getAdminSessionFromToken(cookieValue(cookieHeader, "mhji_admin_session")),
    ]);
    if (member?.status !== "approved" && !admin) return new Response("Not found", { status: 404 });
  }
  const headers = new Headers();
  const response = await getExternalObject(key);
  if (!response.ok || !response.body) return new Response("Not found", { status: 404 });
  const body: BodyInit = response.body;
  for (const name of ["content-type", "content-length", "etag", "last-modified"]) {
    const value = response.headers.get(name);
    if (value) headers.set(name, value);
  }
  headers.set(
    "cache-control",
    access === "public"
      ? "public, max-age=86400, immutable"
      : "private, no-store",
  );
  if (access === "public") {
    headers.set(
      "netlify-cdn-cache-control",
      "public, durable, s-maxage=31536000, immutable",
    );
  }
  return new Response(body, { headers });
}

export async function serveExternalMedia(
  key: string | null,
  cookieHeader: string | null,
) {
  try {
    return await serveExternalMediaUnsafe(key, cookieHeader);
  } catch (error) {
    return apiError("media.read", error, "이미지를 불러오지 못했습니다.", 503);
  }
}

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const external = searchParams.get("store") === "external";
  if (!external) return new Response("Not found", { status: 404 });
  return serveExternalMedia(
    searchParams.get("path") ?? searchParams.get("key"),
    request.headers.get("cookie"),
  );
}
