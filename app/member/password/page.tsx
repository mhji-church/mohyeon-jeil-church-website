import { redirect } from "next/navigation";
import { SiteFooter, SiteHeader } from "../../components/SiteChrome";
import { getMemberSession } from "../../member-auth";
import PasswordChangeForm from "./PasswordChangeForm";

export const dynamic = "force-dynamic";

export default async function MemberPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ return_to?: string }>;
}) {
  const params = await searchParams;
  const returnTo =
    params.return_to?.startsWith("/") && !params.return_to.startsWith("//")
      ? params.return_to
      : "/";
  const member = await getMemberSession();
  if (!member) {
    redirect(`/member/login?return_to=${encodeURIComponent(returnTo)}`);
  }
  if (!member.forcePasswordChange) redirect(returnTo);
  return (
    <>
      <SiteHeader />
      <main className="member-auth-shell member-login-shell">
        <section className="member-auth-intro">
          <span>SECURITY CHECK</span>
          <h1>비밀번호 변경</h1>
          <p>
            임시 비밀번호로 로그인했습니다. 안전한 이용을 위해 새 비밀번호를
            설정해 주세요.
          </p>
        </section>
        <section className="member-auth-card member-login-card">
          <header>
            <img src="/assets/logo-horizontal.png" alt="모현제일교회" />
            <div>
              <span>NEW PASSWORD</span>
              <h2>{member.name} 성도님의 새 비밀번호</h2>
            </div>
          </header>
          <PasswordChangeForm returnTo={returnTo} />
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
