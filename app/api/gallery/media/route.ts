import { getAdminSession } from "../../../credential-auth";
import { getMemberSession } from "../../../member-auth";
import { getContentPost, uploadedObjectKey } from "../../../../lib/content";
import { getExternalObject } from "../../../../lib/external-r2";

export async function GET(request: Request) {
  const [member, admin] = await Promise.all([
    getMemberSession(),
    getAdminSession(),
  ]);
  if (!member && !admin) return new Response("Not found", { status: 404 });

  const url = new URL(request.url);
  const postId = url.searchParams.get("post_id") ?? "";
  const imageIndex = Number(url.searchParams.get("image"));
  if (!postId || !Number.isInteger(imageIndex) || imageIndex < 0) {
    return new Response("Not found", { status: 404 });
  }

  const post = await getContentPost(postId);
  if (!post || post.type !== "gallery" || post.status !== "published") {
    return new Response("Not found", { status: 404 });
  }
  const source = post.images[imageIndex];
  if (!source) return new Response("Not found", { status: 404 });

  const key = uploadedObjectKey(source);
  if (key) {
    if (key.store === "external") {
      const response = await getExternalObject(key.key);
      if (!response.ok || !response.body) return new Response("Not found", { status: 404 });
      const headers = new Headers();
      for (const name of ["content-type", "content-length", "etag", "last-modified"]) {
        const value = response.headers.get(name);
        if (value) headers.set(name, value);
      }
      headers.set("cache-control", "private, no-store");
      return new Response(response.body, { headers });
    }
    return new Response("Not found", { status: 404 });
  }

  if (!source.startsWith("/assets/")) {
    return new Response("Not found", { status: 404 });
  }
  return Response.redirect(new URL(source, request.url), 307);
}
