import { requireArchiveWorshipApi } from "@/lib/archive-access";
import { parseSongStatsOptions } from "@/lib/archive-song-request";
import { getArchiveSongStats } from "@/lib/archive-songs";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  if (!(await requireArchiveWorshipApi())) return Response.json({ error: "예배 영상 열람 권한이 필요합니다." }, { status: 403, headers: { "Cache-Control": "no-store" } });
  try { return Response.json(await getArchiveSongStats(parseSongStatsOptions(new URL(request.url).searchParams)), { headers: { "Cache-Control": "private, no-store" } }); }
  catch (error) { return Response.json({ error: error instanceof Error ? error.message : "찬양 통계를 불러오지 못했습니다." }, { status: 400, headers: { "Cache-Control": "no-store" } }); }
}
