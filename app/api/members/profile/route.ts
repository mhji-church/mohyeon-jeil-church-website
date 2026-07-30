import {
  authenticateMember,
  changeMemberPassword,
  updateMemberProfile,
} from "../../../../lib/members";
import { getMemberSession } from "../../../member-auth";

export async function GET() {
  const member = await getMemberSession();
  if (!member) {
    return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  return Response.json({
    member: {
      username: member.username,
      name: member.name,
      phone: member.phone,
      birthDate: member.birthDate,
      position: member.position,
      createdAt: member.createdAt,
    },
  });
}

export async function PATCH(request: Request) {
  const member = await getMemberSession();
  if (!member) {
    return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const payload = (await request.json().catch(() => null)) as {
    action?: unknown;
    name?: unknown;
    phone?: unknown;
    birthDate?: unknown;
    position?: unknown;
    currentPassword?: unknown;
    password?: unknown;
  } | null;

  try {
    if (payload?.action === "profile") {
      await updateMemberProfile(member.id, {
        name: typeof payload.name === "string" ? payload.name : "",
        phone: typeof payload.phone === "string" ? payload.phone : "",
        birthDate: typeof payload.birthDate === "string" ? payload.birthDate : "",
        position: typeof payload.position === "string" ? payload.position : "",
      });
      return Response.json({ ok: true });
    }

    if (payload?.action === "password") {
      const currentPassword =
        typeof payload.currentPassword === "string" ? payload.currentPassword : "";
      const password = typeof payload.password === "string" ? payload.password : "";
      const authenticated = await authenticateMember(member.username, currentPassword);
      if (!authenticated || authenticated.member.id !== member.id) {
        return Response.json(
          { error: "현재 비밀번호가 올바르지 않습니다." },
          { status: 400 },
        );
      }
      await changeMemberPassword(member.id, password);
      return Response.json({ ok: true });
    }

    return Response.json({ error: "요청 내용을 확인해 주세요." }, { status: 400 });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "회원 정보를 변경하지 못했습니다." },
      { status: 400 },
    );
  }
}
