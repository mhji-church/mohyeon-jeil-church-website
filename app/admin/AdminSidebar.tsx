"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

export type AdminSection = "home" | "bulletin" | "news" | "gallery" | "business" | "members" | "activity";

type Props = {
  active: AdminSection;
  userName: string;
  userEmail: string;
  signOutPath: string;
  initialPendingMemberCount: number | null;
};

const menuItems: Array<{ key: AdminSection; label: string; href: string }> = [
  { key: "home", label: "관리자 홈", href: "/admin" },
  { key: "bulletin", label: "주보 관리", href: "/admin/content?section=bulletin" },
  { key: "news", label: "교회소식 관리", href: "/admin/content?section=news" },
  { key: "gallery", label: "갤러리 관리", href: "/admin/content?section=gallery" },
  { key: "business", label: "성도사업장 관리", href: "/admin/content?section=business" },
  { key: "members", label: "회원 관리", href: "/admin/members" },
  { key: "activity", label: "활동 기록", href: "/admin/activity" },
];

export default function AdminSidebar({
  active,
  userName,
  userEmail,
  signOutPath,
  initialPendingMemberCount,
}: Props) {
  const [pendingMemberCount, setPendingMemberCount] = useState(initialPendingMemberCount);
  const refreshPendingCount = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/members?summary=pending", { cache: "no-store" });
      const data = (await response.json().catch(() => ({}))) as { pendingCount?: number };
      if (response.ok && typeof data.pendingCount === "number") setPendingMemberCount(data.pendingCount);
    } catch {
      // Retain the last confirmed count when a background refresh fails.
    }
  }, []);

  useEffect(() => {
    const initialRefresh = window.setTimeout(() => void refreshPendingCount(), 0);
    const interval = window.setInterval(() => void refreshPendingCount(), 60_000);
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void refreshPendingCount();
    };
    window.addEventListener("focus", refreshPendingCount);
    window.addEventListener("admin-members-updated", refreshPendingCount);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.clearTimeout(initialRefresh);
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshPendingCount);
      window.removeEventListener("admin-members-updated", refreshPendingCount);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [refreshPendingCount]);

  return (
    <aside className="admin-sidebar">
      <Link className="admin-brand" href="/admin" aria-label="관리자 홈">
        <img src="/assets/logo-horizontal.png" alt="모현제일교회" />
        <span>WEBSITE ADMIN</span>
      </Link>
      <nav aria-label="관리 메뉴">
        {menuItems.map((item, index) => (
          <Link className={active === item.key ? "is-active" : ""} href={item.href} key={item.key}>
            <i>{String(index + 1).padStart(2, "0")}</i>
            <span>{item.label}</span>
            {item.key === "members" && pendingMemberCount !== null && pendingMemberCount > 0 && (
              <b aria-label={`승인 대기 회원 ${pendingMemberCount}명`}>승인 {pendingMemberCount}</b>
            )}
          </Link>
        ))}
      </nav>
      <div className="admin-account">
        <span>{userName}</span>
        <small>{userEmail}</small>
        <Link className="admin-public-site-link" href="/" target="_blank" rel="noopener noreferrer">
          <span>홈페이지로 돌아가기</span><b aria-hidden="true">↗</b>
        </Link>
        <a href={signOutPath}>로그아웃</a>
      </div>
    </aside>
  );
}
