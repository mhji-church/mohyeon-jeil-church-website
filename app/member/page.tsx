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

        <MemberProfileForm member={member} />
      </main>
  );
}
