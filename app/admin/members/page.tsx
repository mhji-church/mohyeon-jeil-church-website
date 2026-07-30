import { requireAdminPage } from "../../admin-auth";
import AdminMembers from "./AdminMembers";

export const dynamic = "force-dynamic";

export default async function AdminMembersPage() {
  const { user } = await requireAdminPage();
  return (
    <AdminMembers
      userName={user.fullName ?? "홈페이지 관리자"}
      userEmail={user.email}
      signOutPath="/api/admin/session?return_to=/"
    />
  );
}
