import { createMember, type MemberSignupInput } from "../../../../lib/members";

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => null)) as
    | Partial<MemberSignupInput>
    | null;
  if (!payload) {
    return Response.json({ error: "가입 정보를 확인해 주세요." }, { status: 400 });
  }
  try {
    const member = await createMember({
      username: typeof payload.username === "string" ? payload.username : undefined,
      password: typeof payload.password === "string" ? payload.password : "",
      name: typeof payload.name === "string" ? payload.name : "",
      phone: typeof payload.phone === "string" ? payload.phone : "",
      birthDate: typeof payload.birthDate === "string" ? payload.birthDate : "",
      position: typeof payload.position === "string" ? payload.position : "",
    });
    return Response.json({ ok: true, username: member.username }, { status: 201 });
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
        "생년월일을 연도 4자리, 월 2자리, 일 2자리로 입력해 주세요.",
        "출생연도는 1900년 이후로 입력해 주세요.",
        "실제로 존재하는 생년월일을 입력해 주세요.",
        "미래 날짜는 생년월일로 입력할 수 없습니다.",
        "로그인 비밀번호는 숫자 6자리로 입력해 주세요.",
        "같은 숫자만 반복한 비밀번호는 사용할 수 없습니다.",
        "생년월일과 같은 비밀번호는 사용할 수 없습니다.",
        "휴대전화 번호 뒤 4자리가 들어간 비밀번호는 사용할 수 없습니다.",
        "로그인 이름을 만들지 못했습니다. 교회 관리자에게 문의해 주세요.",
      ].includes(error.message)
        ? error.message
        : "가입 신청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.";
    return Response.json(
      { error: message },
      { status: 400 },
    );
  }
}
