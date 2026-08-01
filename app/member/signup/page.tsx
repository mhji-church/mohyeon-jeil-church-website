import Link from "next/link";
import SignupForm from "./SignupForm";

export const dynamic = "force-dynamic";

export default function MemberSignupPage() {
  return (
    <>
      <main className="member-auth-shell">
        <section className="member-auth-intro">
          <span>MEMBER REGISTRATION</span>
          <h1>교인 회원가입</h1>
          <p>
            모현제일교회 성도를 위한 회원가입 페이지입니다.
            가입 신청 후 관리자 승인이 완료되면 로그인할 수 있습니다.
          </p>
          <ol>
            <li><b>01</b><span>가입 정보 입력</span></li>
            <li><b>02</b><span>관리자 확인 및 승인</span></li>
            <li><b>03</b><span>교인 계정 이용</span></li>
          </ol>
        </section>
        <section className="member-auth-card">
          <header>
            <img src="/assets/logo-horizontal.png" alt="모현제일교회" />
            <div>
              <span>JOIN US</span>
              <h2>가입 정보를 입력해 주세요</h2>
            </div>
          </header>
          <SignupForm />
          <p className="member-auth-switch">
            이미 계정이 있으신가요? <Link href="/member/login">교인 로그인</Link>
          </p>
        </section>
      </main>
    </>
  );
}
