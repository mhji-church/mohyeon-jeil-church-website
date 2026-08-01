import { getAdminSession } from "../../credential-auth";
import { getMemberSession } from "../../member-auth";
import { getUploadedMediaAccess } from "../../../lib/content";
import { getExternalObject } from "../../../lib/external-r2";

export async function GET(request: Request) {
  const key = new URL(request.url).searchParams.get("key");
  const external = new URL(request.url).searchParams.get("store") === "external";
  if (!key || !external || !/^(gallery|bulletins|businesses|content\/[a-z-]+)\//.test(key)) {
    return new Response("Not found", { status: 404 });
  }
  const access = await getUploadedMediaAccess(key);
  if (access !== "public") {
    const [member, admin] = await Promise.all([
      getMemberSession(),
      getAdminSession(),
    ]);
    if (!member && !admin) return new Response("Not found", { status: 404 });
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
