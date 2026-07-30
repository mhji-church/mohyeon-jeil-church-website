import {
  deleteMember,
  listMembers,
  resetMemberPassword,
  updateMember,
  type MemberStatus,
} from "../../../../lib/members";
import { requireAdminApi } from "../../../admin-auth";

async function authorize() {
  const user = await requireAdminApi();
  if (!user) {
    return {
      denied: Response.json({ error: "관리자 권한이 필요합니다." }, { status: 403 }),
      user: null,
    };
  }
  return { denied: null, user };
}

export async function GET() {
  const { denied } = await authorize();
  if (denied) return denied;
  try {
    return Response.json({ members: await listMembers() });
  } catch {
    return Response.json(
      { error: "회원 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요." },
      { status: 503 },
    );
  }
}

export async function PATCH(request: Request) {
  const { denied, user } = await authorize();
  if (denied || !user) return denied;
  const payload = (await request.json().catch(() => null)) as {
    id?: unknown;
    action?: unknown;
    member?: {
      name?: unknown;
      phone?: unknown;
      birthDate?: unknown;
      position?: unknown;
      status?: unknown;
    };
  } | null;
  const id = typeof payload?.id === "string" ? payload.id : "";
  if (!id) {
    return Response.json({ error: "회원 정보를 확인해 주세요." }, { status: 400 });
  }
  try {
    if (payload?.action === "reset-password") {
      const temporaryPassword = await resetMemberPassword(id);
      return Response.json({ ok: true, temporaryPassword });
    }
    const allowedStatuses = new Set<MemberStatus>(["pending", "approved", "suspended"]);
    const requestedStatus =
      typeof payload?.member?.status === "string" &&
      allowedStatuses.has(payload.member.status as MemberStatus)
        ? (payload.member.status as MemberStatus)
        : undefined;
    await updateMember(
      id,
      {
        name:
          typeof payload?.member?.name === "string"
            ? payload.member.name
            : undefined,
        phone:
          typeof payload?.member?.phone === "string"
            ? payload.member.phone
            : undefined,
        birthDate:
          typeof payload?.member?.birthDate === "string"
            ? payload.member.birthDate
            : undefined,
        position:
          typeof payload?.member?.position === "string"
            ? payload.member.position
            : undefined,
        status: requestedStatus,
      },
      user.email,
    );
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "회원 정보를 수정하지 못했습니다." },
      { status: 400 },
    );
  }
}

export async function DELETE(request: Request) {
  const { denied } = await authorize();
  if (denied) return denied;
  const id = new URL(request.url).searchParams.get("id");
  if (!id) {
    return Response.json({ error: "회원 정보를 확인해 주세요." }, { status: 400 });
  }
  await deleteMember(id);
  return Response.json({ ok: true });
}
