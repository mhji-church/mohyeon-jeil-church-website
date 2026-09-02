import { requireArchiveAdminApi } from "@/app/archive-admin-auth";
import { recordArchiveAudit } from "@/lib/archive-audit";
import { apiError } from "@/lib/api-response";
import { mergeArchiveSongs } from "@/lib/archive-songs";

export async function POST(request: Request) {
  const admin = await requireArchiveAdminApi();
  if (!admin) return Response.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
  const body = await request.json().catch(() => null) as { targetId?: string; sourceId?: string; confirmed?: boolean } | null;
  if (!body?.confirmed) return Response.json({ error: "영향받는 기록을 확인한 뒤 병합을 승인해 주세요." }, { status: 400 });
  try { await mergeArchiveSongs(String(body.targetId ?? ""), String(body.sourceId ?? "")); await recordArchiveAudit({ actor: admin.email, action: "song.merge", targetType: "archive_song", targetId: String(body.targetId ?? ""), summary: "찬양곡 중복 병합", details: { sourceId: String(body.sourceId ?? "") } }); return Response.json({ ok: true }); }
  catch (error) { return apiError("archive.songs.merge", error, "찬양을 병합하지 못했습니다.", 400); }
}
