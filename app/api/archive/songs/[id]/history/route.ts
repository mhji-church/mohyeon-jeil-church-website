import { requireArchiveSongApi } from "@/lib/archive-access";
import { parseSongStatsOptions } from "@/lib/archive-song-request";
import { getArchiveSongHistory } from "@/lib/archive-songs";
import { apiError } from "@/lib/api-response";

export const dynamic = "force-dynamic";
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await requireArchiveSongApi())) return Response.json({ error: "찬양 통계 열람 권한이 필요합니다." }, { status: 403, headers: { "Cache-Control": "no-store" } });
  try { const { id } = await context.params; return Response.json({ history: await getArchiveSongHistory(id, parseSongStatsOptions(new URL(request.url).searchParams)) }, { headers: { "Cache-Control": "private, no-store" } }); }
  catch (error) { return apiError("archive.songs.history", error, "사용 이력을 불러오지 못했습니다.", 400); }
}
