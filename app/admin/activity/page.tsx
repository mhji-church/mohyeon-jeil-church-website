import { requireAdminPage } from "../../admin-auth";
import { countPendingMembers } from "../../../lib/members";
import UnifiedActivityAdmin from "./UnifiedActivityAdmin";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ActivityPage() {
  const { user, canManageArchive, canViewAnalytics } = await requireAdminPage();
  if (!canManageArchive) redirect("/admin");
  const initialPendingMemberCount = await countPendingMembers().catch(() => null);
  return (
    <UnifiedActivityAdmin
      userName={user.fullName ?? "홈페이지 관리자"}
      userEmail={user.email}
      signOutPath="/api/admin/session?return_to=/"
      initialPendingMemberCount={initialPendingMemberCount}
      canManageArchive={canManageArchive}
      canViewAnalytics={canViewAnalytics}
    />
  );
}
