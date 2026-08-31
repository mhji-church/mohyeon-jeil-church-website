import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getMemberSession } from "@/app/member-auth";
import { getArchiveWorshipViewer } from "@/lib/archive-access";
import BackButton from "./BackButton";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "예배 아카이브 열람 권한 | 모현제일교회",
  robots: { index: false, follow: false },
};

export default async function ArchiveAccessRequiredPage() {
  if (await getArchiveWorshipViewer()) redirect("/archive");

  const member = await getMemberSession();
  if (!member) redirect(`/member/login?return_to=${encodeURIComponent("/archive")}`);
  if (member.forcePasswordChange) redirect("/member/password");

  return (
    <main className="archive-access-required">
      <section role="status" aria-labelledby="archive-access-required-title">
        <h1 id="archive-access-required-title">예배 아카이브 열람 권한이 필요합니다.</h1>
        <p>예배 아카이브는 별도 권한이 부여된 회원만 이용할 수 있습니다.</p>
        <BackButton />
      </section>
    </main>
  );
}
