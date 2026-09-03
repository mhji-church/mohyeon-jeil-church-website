import { type NextRequest, NextResponse } from "next/server";

const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "img-src 'self' data: blob: https://i.ytimg.com https://img.youtube.com https://*.daumcdn.net https://*.kakao.com",
  "media-src 'self' blob:",
  "font-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' 'unsafe-inline' https://dapi.kakao.com https://t1.daumcdn.net https://www.youtube.com https://www.youtube-nocookie.com",
  "frame-src https://www.youtube.com https://www.youtube-nocookie.com",
  "connect-src 'self' https://dapi.kakao.com https://*.daumcdn.net https://*.kakao.com https://www.googleapis.com https://www.youtube.com",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
].join("; ");

const securityHeaders = {
  "Content-Security-Policy-Report-Only": contentSecurityPolicy,
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "X-Content-Type-Options": "nosniff",
};

const publicShortCachePaths = new Set(["/", "/sermons", "/bulletin", "/news"]);
const publicLongCachePaths = new Set(["/about", "/worship"]);
const privatePathRoots = ["/api", "/admin", "/member", "/archive", "/gallery"];

function isPathOrChild(pathname: string, root: string) {
  return pathname === root || pathname.startsWith(`${root}/`);
}

function setPublicCdnCache(headers: Headers, seconds: number, staleSeconds?: number) {
  headers.set("Cache-Control", "public, max-age=0, must-revalidate");
  headers.set(
    "Netlify-CDN-Cache-Control",
    [
      "public",
      `s-maxage=${seconds}`,
      staleSeconds === undefined ? null : `stale-while-revalidate=${staleSeconds}`,
    ].filter(Boolean).join(", "),
  );
}

export function proxy(request: NextRequest) {
  const response = NextResponse.next();
  const { pathname } = request.nextUrl;

  for (const [name, value] of Object.entries(securityHeaders)) {
    response.headers.set(name, value);
  }

  if (publicShortCachePaths.has(pathname)) {
    setPublicCdnCache(response.headers, 60, 300);
  } else if (publicLongCachePaths.has(pathname)) {
    setPublicCdnCache(response.headers, 3600);
  } else if (privatePathRoots.some((root) => isPathOrChild(pathname, root))) {
    response.headers.set("Cache-Control", "private, no-store, max-age=0");
    response.headers.set("Netlify-CDN-Cache-Control", "private, no-store");
  }

  return response;
}

