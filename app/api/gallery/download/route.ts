import { getAdminSessionFromToken } from "../../../credential-auth";
import { getMemberSessionFromToken } from "../../../member-auth";
import { apiError } from "../../../../lib/api-response";
import { getContentPost, uploadedObjectKey } from "../../../../lib/content";
import { getExternalObject } from "../../../../lib/external-r2";

const privateHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  "Netlify-CDN-Cache-Control": "private, no-store",
};

const imageExtensions: Record<string, string> = {
  "image/avif": "avif",
  "image/gif": "gif",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

function notFound() {
  return new Response("Not found", { status: 404, headers: privateHeaders });
}

function cookieValue(cookieHeader: string | null, name: string) {
  if (!cookieHeader) return null;
  for (const item of cookieHeader.split(";")) {
    const separator = item.indexOf("=");
    if (separator < 0 || item.slice(0, separator).trim() !== name) continue;
    return item.slice(separator + 1).trim();
  }
  return null;
}

function safeFilenamePart(value: string, fallback: string) {
  return value
    .normalize("NFKC")
    .replace(/[<>:"/\\|?*\u0000-\u001f]+/g, "-")
    .replace(/\s+/g, " ")
    .replace(/^[. -]+|[. -]+$/g, "")
    .slice(0, 70) || fallback;
}

function encodedFilename(value: string) {
  return encodeURIComponent(value).replace(/['()]/g, (character) =>
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

function galleryFilename(date: string, title: string, imageIndex: number, extension: string) {
  const safeDate = safeFilenamePart(date.replace(/[./\\]+/g, "-"), "날짜미상");
  const safeTitle = safeFilenamePart(title, "갤러리");
  const order = String(imageIndex + 1).padStart(2, "0");
  return `${safeDate}_${safeTitle}_사진-${order}.${extension}`;
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

async function galleryDownload(request: Request) {
  const cookieHeader = request.headers.get("cookie");
  const [member, admin] = await Promise.all([
    getMemberSessionFromToken(cookieValue(cookieHeader, "mhji_member_session")),
    getAdminSessionFromToken(cookieValue(cookieHeader, "mhji_admin_session")),
  ]);
  if (member?.status !== "approved" && !admin) return notFound();

  const url = new URL(request.url);
  const postId = url.searchParams.get("post_id") ?? "";
  const imageIndex = Number(url.searchParams.get("image"));
  if (!postId || !Number.isInteger(imageIndex) || imageIndex < 0) return notFound();

  const post = await getContentPost(postId);
  if (!post || post.type !== "gallery" || post.status !== "published") return notFound();
  const source = post.images[imageIndex];
  if (!source) return notFound();

  const object = uploadedObjectKey(source);
  let imageResponse: Response;
  if (object?.store === "external" && object.key.startsWith("gallery/")) {
    imageResponse = await getExternalObject(object.key);
  } else if (isLocalAsset(source)) {
    imageResponse = await fetch(localAssetUrl(source, request.url), { cache: "no-store" });
  } else {
    return notFound();
  }
  if (!imageResponse.ok || !imageResponse.body) return notFound();

  const contentType = imageResponse.headers.get("content-type")?.split(";", 1)[0].toLowerCase() ?? "";
  const extension = imageExtensions[contentType];
  if (!extension) return notFound();

  const filename = galleryFilename(post.date, post.title, imageIndex, extension);
  const fallback = `gallery-${post.date.replace(/\D/g, "").slice(0, 8) || "photo"}-${String(imageIndex + 1).padStart(2, "0")}.${extension}`;
  const disposition = url.searchParams.get("view") === "1" ? "inline" : "attachment";
  const headers = new Headers(privateHeaders);
  headers.set("Content-Type", contentType);
  headers.set("Content-Disposition", `${disposition}; filename="${fallback}"; filename*=UTF-8''${encodedFilename(filename)}`);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Cross-Origin-Resource-Policy", "same-origin");
  for (const name of ["content-length", "etag", "last-modified"]) {
    const value = imageResponse.headers.get(name);
    if (value) headers.set(name, value);
  }
  return new Response(imageResponse.body, { headers });
}

export async function GET(request: Request) {
  try {
    return await galleryDownload(request);
  } catch (error) {
    return apiError("gallery.download.read", error, "사진을 저장하지 못했습니다.", 503);
  }
}
