import { redirect } from "next/navigation";
import Link from "next/link";
import { getAdminSession } from "../../credential-auth";
import AdminLoginForm from "./AdminLoginForm";

export const dynamic = "force-dynamic";

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ return_to?: string }>;
}) {
  const requested = (await searchParams)?.return_to;
  const returnTo =
    requested?.startsWith("/") && !requested.startsWith("//") &&
    (requested.startsWith("/admin") || requested.startsWith("/archive/admin"))
      ? requested
      : "/admin";
  const session = await getAdminSession();
  if (session) {
    if (returnTo.startsWith("/archive/admin") && session.canManageArchive) {
      redirect(returnTo);
    }
    redirect(session.canManageWebsite ? "/admin" : "/archive/admin");
  }

  return (
    <main className="admin-auth-page">
      <section>
        <Link className="admin-login-brand" href="/" aria-label="홈페이지로 돌아가기">
          <img src="/assets/logo-horizontal.png" alt="모현제일교회" />
        </Link>
        <span>ADMINISTRATION</span>
        <h1>관리자 로그인</h1>
        <p>아이디와 비밀번호를 입력해 주세요.</p>
        <AdminLoginForm returnTo={returnTo} />
        <Link className="admin-login-home" href="/">홈페이지로 돌아가기</Link>
      </section>
    </main>
  );
}
