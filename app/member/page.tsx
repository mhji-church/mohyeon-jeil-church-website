import { requireMemberPage } from "../member-auth";
import MemberProfileForm from "./MemberProfileForm";

export const dynamic = "force-dynamic";

export default async function MemberPage() {
  const member = await requireMemberPage("/member");

  return (
      <main className="member-profile-page">
        <header className="member-profile-heading">
          <span>MY ACCOUNT</span>
          <h1>내 정보 관리</h1>
          <p>
            등록된 개인정보를 확인하고 변경할 수 있습니다.
            수정한 이름과 직분은 로그인 메뉴에도 바로 반영됩니다.
          </p>
        </header>

        {member.status === "pending" && (
          <div className="member-approval-notice" role="status">
            <strong>회원가입 신청이 접수됐습니다.</strong>
            <span>로그인은 가능하며, 갤러리와 예배 아카이브는 관리자 승인 후 볼 수 있습니다.</span>
          </div>
        )}

        <MemberProfileForm member={member} />
      </main>
  );
}
