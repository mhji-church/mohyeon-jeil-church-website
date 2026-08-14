import { getMemberSessionFromToken } from "../app/member-auth";
import { canPlayArchiveVideo, getArchiveAccess, getArchiveVideo, getSafeArchiveThumbnailUrl } from "./archive";

const PLACEHOLDER = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900"><rect width="1600" height="900" fill="#2e2d33"/><path d="M800 278a126 126 0 0 0-126 126v54h-38v220h328V458h-38v-54a126 126 0 0 0-126-126Zm0 56a70 70 0 0 1 70 70v54H730v-54a70 70 0 0 1 70-70Z" fill="#f2dacb" opacity=".88"/><text x="800" y="748" text-anchor="middle" fill="#f8f3ef" font-family="sans-serif" font-size="52">승인된 회원에게 제공되는 기록입니다</text></svg>`;
const NEUTRAL_PLACEHOLDER = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900"><rect width="1600" height="900" fill="#eee7e2"/><rect x="540" y="286" width="520" height="328" rx="28" fill="#fbf8f5" stroke="#d2a28d" stroke-width="8"/><path d="m690 520 116-112 92 85 58-53 104 106" fill="none" stroke="#a57162" stroke-width="22" stroke-linecap="round" stroke-linejoin="round"/><circle cx="936" cy="382" r="38" fill="#ddb39b"/><text x="800" y="710" text-anchor="middle" fill="#716b68" font-family="sans-serif" font-size="48">썸네일 준비 중</text></svg>`;

function cookieValue(cookieHeader: string | null, name: string) {
  if (!cookieHeader) return null;
  for (const item of cookieHeader.split(";")) {
    const separator = item.indexOf("=");
    if (separator < 0 || item.slice(0, separator).trim() !== name) continue;
    return item.slice(separator + 1).trim();
  }
  return null;
}

function placeholder(cacheControl = "private, no-store", body = PLACEHOLDER) {
  return new Response(body, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": cacheControl,
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function serveArchiveThumbnail(id: string, cookieHeader: string | null) {
  const video = await getArchiveVideo(id);
  if (!video) return new Response(null, { status: 404 });
  const member = await getMemberSessionFromToken(cookieValue(cookieHeader, "mhji_member_session"));
  const level = member ? await getArchiveAccess(member.id) : "none";
  if (video.type === "attendance" && !canPlayArchiveVideo(level, video.type)) return placeholder();

  const source = getSafeArchiveThumbnailUrl(video.thumbnailUrl, video.youtubeId);
  try {
    const response = await fetch(source, { signal: AbortSignal.timeout(8000) });
    if (!response.ok || !response.body) throw new Error("thumbnail unavailable");
    return new Response(response.body, {
      headers: {
        "Content-Type": response.headers.get("content-type") || "image/jpeg",
        "Cache-Control": member ? "private, max-age=300" : "public, max-age=300",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return placeholder(member ? "private, max-age=300" : "public, max-age=300", NEUTRAL_PLACEHOLDER);
  }
}
