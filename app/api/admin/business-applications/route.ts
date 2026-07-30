import {
  completeBusinessApplication,
  deleteBusinessApplication,
  listBusinessApplications,
  updateBusinessApplication,
  type BusinessApplicationStatus,
} from "../../../../lib/business-applications";
import { requireAdminApi } from "../../../admin-auth";

async function authorize() {
  const user = await requireAdminApi();
  if (!user) {
    return Response.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
  }
  return null;
}

export async function GET() {
  const denied = await authorize();
  if (denied) return denied;
  return Response.json({ applications: await listBusinessApplications() });
}

export async function PATCH(request: Request) {
  const denied = await authorize();
  if (denied) return denied;
  const payload = (await request.json().catch(() => null)) as {
    id?: unknown;
    status?: unknown;
    adminNote?: unknown;
  } | null;
  const id = typeof payload?.id === "string" ? payload.id : "";
  const status =
    payload?.status === "pending" ||
    payload?.status === "reviewed" ||
    payload?.status === "completed"
      ? (payload.status as BusinessApplicationStatus)
      : null;
  if (!id || !status) {
    return Response.json({ error: "신청 상태를 확인해 주세요." }, { status: 400 });
  }
  const adminNote =
    typeof payload?.adminNote === "string" ? payload.adminNote : "";
  try {
    if (status === "completed") {
      await completeBusinessApplication(id, adminNote);
      return Response.json({ ok: true, createdDraft: true });
    }
    await updateBusinessApplication(id, status, adminNote);
    return Response.json({ ok: true, createdDraft: false });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "신청 상태를 변경하지 못했습니다.",
      },
      { status: 400 },
    );
  }
}

export async function DELETE(request: Request) {
  const denied = await authorize();
  if (denied) return denied;
  const id = new URL(request.url).searchParams.get("id");
  if (!id) {
    return Response.json({ error: "신청 정보를 확인해 주세요." }, { status: 400 });
  }
  await deleteBusinessApplication(id);
  return Response.json({ ok: true });
}
