import { requireAdminPage } from "../../admin-auth";
import type { ContentType } from "../../../lib/content";
import { countPendingMembers } from "../../../lib/members";
import AdminDashboard from "../AdminDashboard";

export const dynamic = "force-dynamic";

export default async function AdminContentPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const { user } = await requireAdminPage();
  const params = await searchParams;
  const value = (key: string) => Array.isArray(params?.[key]) ? params?.[key]?.[0] : params?.[key];
  const section = value("section");
  const initialType: ContentType = ["bulletin", "news", "gallery", "business"].includes(section ?? "") ? section as ContentType : "bulletin";
  const initialPendingMemberCount = await countPendingMembers().catch(() => null);
  return <AdminDashboard userName={user.fullName ?? "홈페이지 관리자"} userEmail={user.email} signOutPath="/api/admin/session?return_to=/" initialType={initialType} initialCreate={value("new") === "1"} initialEditId={value("edit") ?? null} initialPendingMemberCount={initialPendingMemberCount} />;
}
