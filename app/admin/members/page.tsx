import { requireAdminPage } from "../../admin-auth";
import { countPendingMembers } from "../../../lib/members";
import AdminMembers from "./AdminMembers";

export const dynamic = "force-dynamic";

export default async function AdminMembersPage() {
  const { user } = await requireAdminPage();
  const initialPendingMemberCount = await countPendingMembers().catch(() => null);
  return (
    <AdminMembers
      userName={user.fullName ?? "홈페이지 관리자"}
      userEmail={user.email}
      signOutPath="/api/admin/session?return_to=/"
      initialPendingMemberCount={initialPendingMemberCount}
    />
  );
}
