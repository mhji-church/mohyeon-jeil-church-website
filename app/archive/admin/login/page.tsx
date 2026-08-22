import Link from "next/link";
import { redirect } from "next/navigation";
import { getArchiveAdminSession } from "@/app/archive-credential-auth";
import ArchiveAdminLoginForm from "./ArchiveAdminLoginForm";

export const dynamic = "force-dynamic";
export default async function ArchiveAdminLoginPage({ searchParams }: { searchParams: Promise<{ return_to?: string }> }) {
  if (await getArchiveAdminSession()) redirect("/archive/admin");
  const requested = (await searchParams).return_to;
  const returnTo = requested?.startsWith("/archive/admin") && !requested.startsWith("//") ? requested : "/archive/admin";
  return <main className="archive-admin-auth"><section><Link href="/archive" className="archive-admin-login-brand"><img src="/archive/brand/mohyeon-logo-light.png" alt="모현제일교회" /><span>예배 아카이브</span></Link><small>ARCHIVE ADMINISTRATION</small><h1>아카이브 관리자 로그인</h1><p>교회 홈페이지 관리자와 별도로 발급된 아카이브 관리자 계정으로 로그인해 주세요.</p><ArchiveAdminLoginForm returnTo={returnTo} /><Link href="/archive">예배 아카이브로 돌아가기</Link></section></main>;
}
