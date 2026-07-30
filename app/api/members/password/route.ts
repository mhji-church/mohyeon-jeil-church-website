import { changeMemberPassword } from "../../../../lib/members";
import { getMemberSession } from "../../../member-auth";

export async function POST(request: Request) {
  const member = await getMemberSession();
  if (!member) {
    return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  const payload = (await request.json().catch(() => null)) as {
    password?: unknown;
  } | null;
  const password = typeof payload?.password === "string" ? payload.password : "";
  try {
    await changeMemberPassword(member.id, password);
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "비밀번호를 변경하지 못했습니다." },
      { status: 400 },
    );
  }
}
