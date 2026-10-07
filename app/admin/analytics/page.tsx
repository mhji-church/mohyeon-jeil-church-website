import { notFound, redirect } from "next/navigation";
import { canViewAnalyticsForAdmin, getAdminSession } from "@/app/credential-auth";
import { countPendingMembers } from "@/lib/members";
import AdminSidebar from "../AdminSidebar";
import AnalyticsDashboard from "./AnalyticsDashboard";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage({ searchParams }: { searchParams?: Promise<{ period?: string }> }) {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  if (!canViewAnalyticsForAdmin(session)) notFound();
  const pendingCount = await countPendingMembers().catch(() => null);
  return <main className="admin-shell admin-members-shell">
    <AdminSidebar active="analytics" userName="홈페이지 관리자" userEmail={session.username} signOutPath="/api/admin/session?return_to=/" initialPendingMemberCount={pendingCount} canManageWebsite canManageArchive={session.canManageArchive} canViewAnalytics />
    <AnalyticsDashboard initialPeriod={(await searchParams)?.period === "today" ? "today" : "month"} />
  </main>;
}
