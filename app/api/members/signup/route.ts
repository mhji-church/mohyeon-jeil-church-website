import { createMember, type MemberSignupInput } from "../../../../lib/members";

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => null)) as
    | Partial<MemberSignupInput>
    | null;
  if (!payload) {
    return Response.json({ error: "가입 정보를 확인해 주세요." }, { status: 400 });
  }
  try {
    await createMember({
      username: typeof payload.username === "string" ? payload.username : "",
      password: typeof payload.password === "string" ? payload.password : "",
      name: typeof payload.name === "string" ? payload.name : "",
      phone: typeof payload.phone === "string" ? payload.phone : "",
      birthDate: typeof payload.birthDate === "string" ? payload.birthDate : "",
      position: typeof payload.position === "string" ? payload.position : "",
    });
    return Response.json({ ok: true }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error &&
      [
        "이미 사용 중인 아이디입니다.",
        "아이디는 영문 소문자와 숫자를 포함해 4~30자로 입력해 주세요.",
        "이름을 2~30자로 입력해 주세요.",
        "휴대전화 번호를 확인해 주세요.",
        "비밀번호는 6~72자로 입력해 주세요.",
        "생년월일을 확인해 주세요.",
      ].includes(error.message)
        ? error.message
        : "가입 신청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.";
    return Response.json(
      { error: message },
      { status: 400 },
    );
  }
}
