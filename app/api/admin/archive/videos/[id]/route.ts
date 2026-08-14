import { requireAdminApi } from "@/app/admin-auth";
import { deleteArchiveVideo } from "@/lib/archive";

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await requireAdminApi())) return Response.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
  const { id } = await context.params;
  await deleteArchiveVideo(id);
  return Response.json({ ok: true });
}
