"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

export type AdminSection = "home" | "bulletin" | "news" | "gallery" | "business" | "members" | "activity" | "archive";

type Props = {
  active: AdminSection;
  userName: string;
  userEmail: string;
  signOutPath: string;
  initialPendingMemberCount: number | null;
  canManageWebsite: boolean;
  canManageArchive: boolean;
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
  canManageWebsite,
  canManageArchive,
}: Props) {
  const [pendingMemberCount, setPendingMemberCount] = useState(initialPendingMemberCount);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const activeLabel = active === "archive"
    ? "아카이브 관리"
    : menuItems.find((item) => item.key === active)?.label ?? "관리자";

  const closeMobileMenu = useCallback(() => setMobileMenuOpen(false), []);
  const refreshPendingCount = useCallback(async () => {
    if (!canManageWebsite) return;
    try {
      const response = await fetch("/api/admin/members?summary=pending", { cache: "no-store" });
      const data = (await response.json().catch(() => ({}))) as { pendingCount?: number };
      if (response.ok && typeof data.pendingCount === "number") setPendingMemberCount(data.pendingCount);
    } catch {
      // Retain the last confirmed count when a background refresh fails.
    }
  }, [canManageWebsite]);

  useEffect(() => {
    if (!canManageWebsite) return;
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
  }, [canManageWebsite, refreshPendingCount]);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 760px)");
    const update = () => {
      setIsMobile(query.matches);
      if (!query.matches) setMobileMenuOpen(false);
    };
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const firstLink = sidebarRef.current?.querySelector<HTMLElement>("nav a");
    firstLink?.focus();
    const handleMenuKeys = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileMenuOpen(false);
        window.setTimeout(() => menuButtonRef.current?.focus(), 0);
        return;
      }
      if (event.key !== "Tab") return;
      const items = [...(sidebarRef.current?.querySelectorAll<HTMLElement>("a[href], button:not(:disabled)") ?? [])];
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", handleMenuKeys);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleMenuKeys);
    };
  }, [mobileMenuOpen]);

  return (
    <>
    <header className="admin-mobile-bar">
      <Link href="/admin" aria-label="관리자 홈" onClick={closeMobileMenu}>
        <img src="/assets/logo-horizontal.png" alt="모현제일교회" />
        <span>관리자</span>
      </Link>
      <strong>{activeLabel}</strong>
      <button
        ref={menuButtonRef}
        type="button"
        aria-expanded={mobileMenuOpen}
        aria-controls="admin-mobile-navigation"
        aria-label={mobileMenuOpen ? "관리 메뉴 닫기" : "관리 메뉴 열기"}
        onClick={() => setMobileMenuOpen((open) => !open)}
      >
        <i aria-hidden="true" />
        <i aria-hidden="true" />
        <i aria-hidden="true" />
      </button>
    </header>
    <button
      className={`admin-mobile-menu-backdrop${mobileMenuOpen ? " is-open" : ""}`}
      type="button"
      tabIndex={mobileMenuOpen ? 0 : -1}
      aria-label="관리 메뉴 닫기"
      onClick={() => {
        closeMobileMenu();
        window.setTimeout(() => menuButtonRef.current?.focus(), 0);
      }}
    />
    <aside
      className={`admin-sidebar${mobileMenuOpen ? " is-mobile-open" : ""}`}
      id="admin-mobile-navigation"
      ref={sidebarRef}
      aria-hidden={isMobile && !mobileMenuOpen ? true : undefined}
      inert={isMobile && !mobileMenuOpen ? true : undefined}
    >
      <Link className="admin-brand" href="/admin" aria-label="관리자 홈">
        <img src="/assets/logo-horizontal.png" alt="모현제일교회" />
        <span>WEBSITE ADMIN</span>
      </Link>
      <nav aria-label="관리 메뉴">
        {canManageWebsite && menuItems.map((item, index) => (
          <Link className={active === item.key ? "is-active" : ""} href={item.href} key={item.key} onClick={closeMobileMenu}>
            <i>{String(index + 1).padStart(2, "0")}</i>
            <span>{item.label}</span>
            {item.key === "members" && pendingMemberCount !== null && pendingMemberCount > 0 && (
              <b aria-label={`승인 대기 회원 ${pendingMemberCount}명`}>승인 {pendingMemberCount}</b>
            )}
          </Link>
        ))}
        {canManageArchive && (
          // A full document navigation is required between the website and archive app shells.
          // eslint-disable-next-line @next/next/no-html-link-for-pages
          <a
            className={active === "archive" ? "is-active" : ""}
            href="/archive/admin"
            onClick={closeMobileMenu}
          >
            <i>{String(canManageWebsite ? menuItems.length + 1 : 1).padStart(2, "0")}</i>
            <span>아카이브 관리</span>
          </a>
        )}
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
    </>
  );
}
