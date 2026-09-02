import { requireArchiveSongApi } from "@/lib/archive-access";
import { parseSongStatsOptions } from "@/lib/archive-song-request";
import { getArchiveSongStats } from "@/lib/archive-songs";
import { apiError } from "@/lib/api-response";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  if (!(await requireArchiveSongApi())) return Response.json({ error: "찬양 통계 열람 권한이 필요합니다." }, { status: 403, headers: { "Cache-Control": "no-store" } });
  try { return Response.json(await getArchiveSongStats(parseSongStatsOptions(new URL(request.url).searchParams)), { headers: { "Cache-Control": "private, no-store" } }); }
  catch (error) { return apiError("archive.songs.stats", error, "찬양 통계를 불러오지 못했습니다.", 400); }
}
