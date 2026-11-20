import { requireAdminApi } from "../../../../admin-auth";
import { getYouTubeSyncStatus, syncYouTubePlaylist, YouTubeSyncBusyError } from "../../../../../lib/youtube";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store, max-age=0" };

export async function GET() {
  if (!(await requireAdminApi())?.canManageArchive) return Response.json({ error: "접근 권한이 없습니다." }, { status: 403, headers });
  try { return Response.json({ updatedAt: (await getYouTubeSyncStatus())?.updated_at ?? null }, { headers }); }
  catch { return Response.json({ error: "마지막 동기화 시각을 불러오지 못했습니다." }, { status: 503, headers }); }
}

export async function POST(request: Request) {
  if (!(await requireAdminApi())?.canManageArchive) return Response.json({ error: "접근 권한이 없습니다." }, { status: 403, headers });
  if (request.headers.get("origin") !== new URL(request.url).origin || request.headers.get("sec-fetch-site") === "cross-site") return Response.json({ error: "요청 경로를 확인해 주세요." }, { status: 403, headers });
  try {
    const videos = await syncYouTubePlaylist("sermons");
    return Response.json({ count: videos.length, updatedAt: new Date().toISOString() }, { headers });
  } catch (error) {
    if (error instanceof YouTubeSyncBusyError) return Response.json({ error: "새로고침이 진행 중이거나 방금 완료됐습니다. 잠시 후 다시 확인해 주세요." }, { status: 429, headers: { ...headers, "Retry-After": String(error.retryAfter) } });
    return Response.json({ error: "유튜브 목록을 완전히 가져오지 못했습니다. 기존 목록은 유지됩니다. 잠시 후 다시 시도해 주세요." }, { status: 502, headers });
  }
}
