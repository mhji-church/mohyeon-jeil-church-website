import { env } from "cloudflare:workers";
import { getAdminSession } from "../../credential-auth";
import { getMemberSession } from "../../member-auth";
import { getUploadedMediaAccess } from "../../../lib/content";
import { getExternalObject } from "../../../lib/external-r2";

export async function GET(request: Request) {
  const key = new URL(request.url).searchParams.get("key");
  const external = new URL(request.url).searchParams.get("store") === "external";
  if (
    !key ||
    (external
      ? !/^(gallery|bulletins|businesses|content\/[a-z-]+)\//.test(key)
      : !key.startsWith("uploads/"))
  ) {
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
  let body: BodyInit | null;
  if (external) {
    const response = await getExternalObject(key);
    if (!response.ok || !response.body) return new Response("Not found", { status: 404 });
    body = response.body;
    for (const name of ["content-type", "content-length", "etag", "last-modified"]) {
      const value = response.headers.get(name);
      if (value) headers.set(name, value);
    }
  } else {
    const bucket = (env as unknown as { BUCKET?: R2Bucket }).BUCKET;
    const object = await bucket?.get(key);
    if (!object) return new Response("Not found", { status: 404 });
    object.writeHttpMetadata(headers);
    headers.set("etag", object.httpEtag);
    body = object.body;
  }
  headers.set(
    "cache-control",
    access === "public"
      ? "public, max-age=300"
      : "private, no-store",
  );
  return new Response(body, { headers });
}
