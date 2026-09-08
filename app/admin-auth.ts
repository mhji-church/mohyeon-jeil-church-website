import { redirect } from "next/navigation";
import { getAdminSession } from "./credential-auth";

export async function requireAdminPage() {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  if (!session.canManageWebsite) redirect("/archive/admin");
  return {
    user: {
      displayName: "홈페이지 관리자",
      email: session.username,
      fullName: "홈페이지 관리자",
    },
    canManageArchive: session.canManageArchive,
    authorized: true,
  };
}

export async function requireAdminPortalPage() {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  return {
    user: {
      displayName: session.canManageWebsite
        ? "홈페이지 관리자"
        : "예배 아카이브 관리자",
      email: session.username,
      fullName: session.canManageWebsite
        ? "홈페이지 관리자"
        : "예배 아카이브 관리자",
    },
    canManageWebsite: session.canManageWebsite,
    canManageArchive: session.canManageArchive,
    authorized: true,
  };
}

export async function requireAdminApi() {
  const session = await getAdminSession();
  if (!session?.canManageWebsite) return null;
  return {
    displayName: "홈페이지 관리자",
    email: session.username,
    fullName: "홈페이지 관리자",
    canManageArchive: session.canManageArchive,
  };
}
