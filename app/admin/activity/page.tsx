import { requireAdminPage } from "../../admin-auth";
import { countPendingMembers } from "../../../lib/members";
import UnifiedActivityAdmin from "./UnifiedActivityAdmin";

export const dynamic = "force-dynamic";

export default async function ActivityPage() {
  const { user } = await requireAdminPage();
  const initialPendingMemberCount = await countPendingMembers().catch(() => null);
  return (
    <UnifiedActivityAdmin
      userName={user.fullName ?? "홈페이지 관리자"}
      userEmail={user.email}
      signOutPath="/api/admin/session?return_to=/"
      initialPendingMemberCount={initialPendingMemberCount}
    />
  );
}
