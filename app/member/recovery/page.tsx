import Link from "next/link";
import RecoveryForm from "./RecoveryForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "비밀번호 재설정 | 모현제일교회", robots: { index: false, follow: false } };

export default function MemberRecoveryPage() {
  return (
    <main className="member-auth-shell member-login-shell">
      <section className="member-auth-intro">
        <span>ACCOUNT HELP</span><h1>비밀번호 재설정</h1>
        <p>가입한 이름과 생년월일을 입력한 뒤 새 비밀번호를 설정해 주세요.</p>
      </section>
      <section className="member-auth-card member-login-card">
        <header><div><span>RESET PASSWORD</span><h2>비밀번호 재설정</h2></div></header>
        <RecoveryForm />
        <p className="member-auth-switch"><Link href="/member/login">로그인으로 돌아가기</Link></p>
      </section>
    </main>
  );
}
