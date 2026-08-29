import { requireArchiveAdminApi } from "@/app/archive-admin-auth";
import { deleteArchiveVideo } from "@/lib/archive";
import { recordArchiveAudit } from "@/lib/archive-audit";
import { deleteArchiveVideoSongLinks } from "@/lib/archive-songs";

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const admin = await requireArchiveAdminApi();
  if (!admin) return Response.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
  const { id } = await context.params;
  await deleteArchiveVideoSongLinks(id);
  await deleteArchiveVideo(id);
  await recordArchiveAudit({ actor: admin.email, action: "video.delete", targetType: "archive_video", targetId: id, summary: "아카이브 영상 삭제" });
  return Response.json({ ok: true });
}
