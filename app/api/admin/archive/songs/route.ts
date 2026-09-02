import { requireArchiveAdminApi } from "@/app/archive-admin-auth";
import { apiError } from "@/lib/api-response";
import { getArchiveSongConflicts, resolveArchiveSongConflict, searchArchiveSongs, updateArchiveSong } from "@/lib/archive-songs";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  if (!(await requireArchiveAdminApi())) return Response.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
  const params = new URL(request.url).searchParams;
  const [songs, conflicts] = await Promise.all([
    searchArchiveSongs(params.get("q") ?? "", Number(params.get("limit") || 50)),
    getArchiveSongConflicts(),
  ]);
  return Response.json({ songs, conflicts }, { headers: { "Cache-Control": "no-store" } });
}
export async function PATCH(request: Request) {
  if (!(await requireArchiveAdminApi())) return Response.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
  const body = await request.json().catch(() => null) as { action?: string; id?: string; displayTitle?: string; baseTitle?: string; aliases?: string[] } | null;
  if (body?.action === "resolve-conflict" && body.id) {
    try { await resolveArchiveSongConflict(body.id); return Response.json({ ok: true }); }
    catch (error) { return apiError("archive.songs.conflict", error, "충돌 기록을 처리하지 못했습니다.", 400); }
  }
  if (!body?.id || !body.displayTitle?.trim() || !body.baseTitle?.trim()) return Response.json({ error: "찬양 제목을 확인해 주세요." }, { status: 400 });
  try { await updateArchiveSong({ id: body.id, displayTitle: body.displayTitle, baseTitle: body.baseTitle, aliases: Array.isArray(body.aliases) ? body.aliases : [] }); return Response.json({ ok: true }); }
  catch (error) { return apiError("archive.songs.update", error, "찬양을 수정하지 못했습니다.", 400); }
}
