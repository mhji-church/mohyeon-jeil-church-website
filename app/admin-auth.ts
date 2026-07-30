import { redirect } from "next/navigation";
import { getAdminSession } from "./credential-auth";

export async function requireAdminPage() {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  return {
    user: {
      displayName: "홈페이지 관리자",
      email: session.username,
      fullName: "홈페이지 관리자",
    },
    authorized: true,
  };
}

export async function requireAdminApi() {
  const session = await getAdminSession();
  if (!session) return null;
  return {
    displayName: "홈페이지 관리자",
    email: session.username,
    fullName: "홈페이지 관리자",
  };
}
