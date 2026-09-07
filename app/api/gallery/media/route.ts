import { getAdminSessionFromToken } from "../../../credential-auth";
import { getMemberSessionFromToken } from "../../../member-auth";
import { getContentPost, uploadedObjectKey } from "../../../../lib/content";
import { getExternalObject } from "../../../../lib/external-r2";
import { apiError } from "../../../../lib/api-response";

function cookieValue(cookieHeader: string | null, name: string) {
  if (!cookieHeader) return null;
  for (const item of cookieHeader.split(";")) {
    const separator = item.indexOf("=");
    if (separator < 0 || item.slice(0, separator).trim() !== name) continue;
    return item.slice(separator + 1).trim();
  }
  return null;
}

function isLocalAsset(source: string) {
  return (
    source.startsWith("/assets/") &&
    !source.includes("..") &&
    /^\/assets\/[a-zA-Z0-9%_./-]+$/.test(source)
  );
}

function localAssetUrl(source: string, requestUrl: string) {
  const requestedUrl = new URL(requestUrl);
  const isLocalDevelopment =
    (requestedUrl.hostname === "localhost" || requestedUrl.hostname === "127.0.0.1") &&
    (requestedUrl.protocol === "http:" || requestedUrl.protocol === "https:");
  return new URL(source, isLocalDevelopment ? requestedUrl.origin : "https://mhji.kr");
}

async function getGalleryMedia(requestUrl: string, cookieHeader: string | null) {
  const [member, admin] = await Promise.all([
    getMemberSessionFromToken(cookieValue(cookieHeader, "mhji_member_session")),
    getAdminSessionFromToken(cookieValue(cookieHeader, "mhji_admin_session")),
  ]);
  if (member?.status !== "approved" && !admin) return new Response("Not found", { status: 404 });

  const url = new URL(requestUrl);
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
    if (key.store === "external" && key.key.startsWith("gallery/")) {
      const response = await getExternalObject(key.key);
      if (!response.ok || !response.body) return new Response("Not found", { status: 404 });
      const headers = new Headers();
      for (const name of ["content-type", "content-length", "etag", "last-modified"]) {
        const value = response.headers.get(name);
        if (value) headers.set(name, value);
      }
      headers.set("cache-control", "private, max-age=300");
      return new Response(response.body, { headers });
    }
    return new Response("Not found", { status: 404 });
  }

  if (!isLocalAsset(source)) {
    return new Response("Not found", { status: 404 });
  }
  const response = await fetch(localAssetUrl(source, requestUrl), { cache: "no-store" });
  if (!response.ok || !response.body) return new Response("Not found", { status: 404 });
  const headers = new Headers();
  for (const name of ["content-type", "content-length", "etag", "last-modified"]) {
    const value = response.headers.get(name);
    if (value) headers.set(name, value);
  }
  headers.set("cache-control", "private, max-age=300");
  return new Response(response.body, { headers });
}

export async function serveGalleryMedia(requestUrl: string, cookieHeader: string | null) {
  try {
    return await getGalleryMedia(requestUrl, cookieHeader);
  } catch (error) {
    return apiError("gallery.media.read", error, "갤러리 이미지를 불러오지 못했습니다.", 503);
  }
}

export async function GET(request: Request) {
  return serveGalleryMedia(request.url, request.headers.get("cookie"));
}
