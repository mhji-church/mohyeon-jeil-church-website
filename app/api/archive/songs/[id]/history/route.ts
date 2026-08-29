import { requireArchiveWorshipApi } from "@/lib/archive-access";
import { parseSongStatsOptions } from "@/lib/archive-song-request";
import { getArchiveSongHistory } from "@/lib/archive-songs";

export const dynamic = "force-dynamic";
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await requireArchiveWorshipApi())) return Response.json({ error: "예배 영상 열람 권한이 필요합니다." }, { status: 403, headers: { "Cache-Control": "no-store" } });
  try { const { id } = await context.params; return Response.json({ history: await getArchiveSongHistory(id, parseSongStatsOptions(new URL(request.url).searchParams)) }, { headers: { "Cache-Control": "private, no-store" } }); }
  catch (error) { return Response.json({ error: error instanceof Error ? error.message : "사용 이력을 불러오지 못했습니다." }, { status: 400 }); }
}
