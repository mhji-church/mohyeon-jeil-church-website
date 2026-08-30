import Link from "next/link";
import { redirect } from "next/navigation";
import { getMemberSession } from "../../member-auth";
import MemberLoginForm from "./MemberLoginForm";

export const dynamic = "force-dynamic";

export default async function MemberLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ return_to?: string }>;
}) {
  const params = await searchParams;
  const returnTo =
    params.return_to?.startsWith("/") && !params.return_to.startsWith("//")
      ? params.return_to
      : "/";
  if (await getMemberSession()) redirect(returnTo);

  return (
      <main className="member-auth-shell member-login-shell">
        <section className="member-auth-intro">
          <span>CHURCH MEMBER</span>
          <h1>교인 로그인</h1>
          <p>
            승인된 모현제일교회 교인 계정으로 로그인해 주세요.
            가입 승인 전에는 로그인할 수 없습니다.
          </p>
        </section>
        <section className="member-auth-card member-login-card">
          <header>
            <div>
              <span>WELCOME BACK</span>
              <h2>이름과 비밀번호를 입력해 주세요</h2>
            </div>
          </header>
          <MemberLoginForm returnTo={returnTo} />
          <p className="member-auth-switch">
            아직 계정이 없으신가요? <Link href="/member/signup">회원가입 신청</Link>
            <br />
            <Link href="/member/signup?guide=1">가입 방법 먼저 보기</Link>
          </p>
        </section>
      </main>
  );
}
