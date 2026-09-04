"use client";

import "./archive-original.css";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useRef, useState, type MouseEvent, type ReactNode } from "react";

export type ArchiveTheme = "system" | "light" | "dark";
export type ArchiveNavKey = "home" | "sunday" | "other" | "songs" | "attendance" | "videos" | "members" | "activity" | "settings";
type IconName = "home" | "video" | "calendar" | "music" | "clipboard" | "sun" | "moon" | "monitor" | "check" | "user" | "external" | "logout" | "activity" | "settings" | "search" | "play" | "lock";

const iconPaths: Record<IconName, ReactNode> = {
  home: <><path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M9 20v-6h6v6"/></>,
  video: <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m10 9 5 3-5 3Z"/></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></>,
  music: <><path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/></>,
  clipboard: <><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V2h6v2M9 10h6M9 14h6M9 18h4"/></>,
  sun: <><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.66 6.34l1.41-1.41"/></>,
  moon: <path d="M20 15.2A8.5 8.5 0 1 1 8.8 4 7 7 0 0 0 20 15.2Z"/>,
  monitor: <><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></>,
  check: <path d="m5 12 4 4L19 6"/>,
  user: <><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>,
  external: <><path d="M14 3h7v7M10 14 21 3"/><path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5"/></>,
  logout: <><path d="M10 17l5-5-5-5"/><path d="M15 12H3"/><path d="M15 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4"/></>,
  activity: <path d="M3 12h4l2-8 4 16 2-8h6"/>,
  settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21h-4v-.09A1.7 1.7 0 0 0 8.6 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H3v-4h.09A1.7 1.7 0 0 0 4.6 8.6a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3h4v.09A1.7 1.7 0 0 0 15.4 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.12.37.34.7.6 1 .3.28.68.42 1.1.4h.09v4h-.09c-.42-.02-.8.12-1.1.4-.26.3-.48.63-.6 1Z"/></>,
  search: <><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></>,
  play: <path d="m8 5 11 7-11 7Z"/>,
  lock: <><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></>,
};

export function ArchiveIcon({ name, size = 20, className }: { name: IconName; size?: number; className?: string }) {
  return <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{iconPaths[name]}</svg>;
}

const publicNav = [
  ["home", "홈", "/archive", "home"], ["sunday", "주일예배", "/archive/sunday", "video"],
  ["other", "기타예배", "/archive/other", "calendar"], ["songs", "찬양 통계", "/archive/songs", "music"], ["attendance", "출석 기록", "/archive/attendance", "clipboard"],
] as const;
const adminNav = [
  ["videos", "영상 관리", "/archive/admin", "video"], ["members", "회원 관리", "/archive/admin?tab=access", "user"],
  ["songs", "찬양곡 관리", "/archive/admin/songs", "music"], ["activity", "활동 기록", "/archive/admin/activity", "activity"], ["settings", "설정", "/archive/admin?tab=settings", "settings"],
] as const;

function ArchiveBrand({ admin = false, onClick }: { admin?: boolean; onClick?: (event: MouseEvent<HTMLAnchorElement>) => void }) {
  return <Link href={admin ? "/archive/admin" : "/archive"} className="official-brand has-structure-line" aria-label="모현제일교회 예배 아카이브 홈" onClick={onClick}>
    <span className="brand-logo-wrap">
      <img className="brand-logo brand-logo-light" src="/archive/brand/mohyeon-logo-light.png" alt="모현제일교회" width="461" height="91" />
      <img className="brand-logo brand-logo-dark" src="/archive/brand/mohyeon-logo-dark.png" alt="" aria-hidden="true" width="461" height="91" />
    </span><span className="brand-divider" aria-hidden="true" /><span className="brand-service"><span className="brand-service-desktop">예배 아카이브</span><span className="brand-service-mobile">모현제일교회 예배 아카이브</span>{admin && <small>ADMIN</small>}</span>
  </Link>;
}

function ThemePicker() {
  const [preference, setPreference] = useState<ArchiveTheme>("system");
  const [resolved, setResolved] = useState<"light" | "dark">("light");
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const menuId = useId();
  useEffect(() => { const saved = localStorage.getItem("mhji-archive-theme") as ArchiveTheme | null; if (!["system", "light", "dark"].includes(saved ?? "")) return; const timer = setTimeout(() => setPreference(saved!), 0); return () => clearTimeout(timer); }, []);
  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: dark)");
    const apply = () => { const next = preference === "system" ? (media.matches ? "dark" : "light") : preference; setResolved(next); document.querySelectorAll<HTMLElement>(".archive-original-root").forEach((element) => { element.dataset.theme = next; }); localStorage.setItem("mhji-archive-theme", preference); };
    apply(); media.addEventListener("change", apply); return () => media.removeEventListener("change", apply);
  }, [preference]);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", outside); document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, [open]);
  const choices: Array<{ value: ArchiveTheme; label: string; description: string; icon: IconName }> = [
    { value: "system", label: "시스템 설정", description: "기기의 화면 설정을 따릅니다.", icon: "monitor" },
    { value: "light", label: "라이트 모드", description: "밝은 화면을 사용합니다.", icon: "sun" },
    { value: "dark", label: "다크 모드", description: "어두운 화면을 사용합니다.", icon: "moon" },
  ];
  const current = choices.find((choice) => choice.value === preference) ?? choices[0];
  return <div className="theme-control" ref={root}><button type="button" className="theme-trigger icon-button" aria-label={`테마 선택: ${current.label}`} aria-haspopup="menu" aria-expanded={open} aria-controls={menuId} onClick={() => setOpen((value) => !value)}><ArchiveIcon name={resolved === "dark" ? "moon" : "sun"} size={18} /><span className="theme-trigger-label">{current.label}</span></button>{open && <div className="theme-menu" id={menuId} role="menu" aria-label="화면 테마">{choices.map((choice) => <button key={choice.value} type="button" role="menuitemradio" aria-checked={preference === choice.value} className={`theme-menu-item${preference === choice.value ? " is-selected" : ""}`} onClick={() => { setPreference(choice.value); setOpen(false); }}><ArchiveIcon name={choice.icon} size={18} /><span><strong>{choice.label}</strong><small>{choice.description}</small></span>{preference === choice.value && <ArchiveIcon name="check" size={17} className="theme-menu-check" />}</button>)}</div>}</div>;
}

type ArchiveShellProps = {
  children: ReactNode;
  active: ArchiveNavKey;
  admin?: boolean;
  showSongs?: boolean;
  search?: ReactNode;
  account?: ReactNode;
  beforeAdminNavigate?: () => boolean;
  onAdminNavigate?: (key: ArchiveNavKey, href: string) => boolean;
};

export function ArchiveShell({ children, active, admin = false, showSongs = true, search, account, beforeAdminNavigate, onAdminNavigate }: ArchiveShellProps) {
  const nav = (admin ? adminNav : publicNav).filter(([key]) => admin || showSongs || key !== "songs");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentUrl = `${pathname}${searchParams.size ? `?${searchParams.toString()}` : ""}`;
  const [pendingHref, setPendingHref] = useState("");
  const [failedHref, setFailedHref] = useState("");
  const navigationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function clearNavigationTimer() {
    if (navigationTimer.current) clearTimeout(navigationTimer.current);
    navigationTimer.current = null;
  }

  function beginNavigation(href: string) {
    clearNavigationTimer();
    setFailedHref("");
    setPendingHref(href);
    router.push(href);
    navigationTimer.current = setTimeout(() => {
      setPendingHref("");
      setFailedHref(href);
    }, 8_000);
  }

  function handleAdminNavigation(event: MouseEvent<HTMLAnchorElement>, key: ArchiveNavKey, href: string) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    if (href === `${window.location.pathname}${window.location.search}`) return;
    if (beforeAdminNavigate && !beforeAdminNavigate()) return;
    if (onAdminNavigate?.(key, href)) {
      clearNavigationTimer();
      setPendingHref("");
      setFailedHref("");
      return;
    }
    beginNavigation(href);
  }

  useEffect(() => {
    if (!pendingHref || currentUrl !== pendingHref) return;
    const timer = setTimeout(() => {
      clearNavigationTimer();
      setPendingHref("");
    }, 0);
    return () => clearTimeout(timer);
  }, [currentUrl, pendingHref]);

  useEffect(() => () => clearNavigationTimer(), []);

  return <div className={`archive-original-root${admin ? " admin-cms" : ""}`} data-theme="light">
    <span className="brand-structure-line" aria-hidden="true" />
    <header className={admin ? "cms-header" : `site-header${search ? " has-home-search" : ""}`}><ArchiveBrand admin={admin} onClick={admin ? (event) => handleAdminNavigation(event, "videos", "/archive/admin") : undefined} />{search && <div className="header-home-search-wrap">{search}</div>}<div className={admin ? "cms-header-actions" : "header-actions"}><Link aria-label="교회 홈페이지로" className="header-action-link church-home-link" href="/"><span>교회 홈페이지로</span><ArchiveIcon name="external" size={16} /></Link>{!admin && <Link aria-label="아카이브 관리자" className="header-action-link archive-admin-entry" href="/archive/admin"><ArchiveIcon name="lock" size={16} /><span>관리자</span></Link>}{account}<ThemePicker /></div></header>
    <aside className={admin ? "cms-sidebar" : "archive-sidebar"} aria-label={admin ? "예배 아카이브 관리 메뉴" : "예배 아카이브 메뉴"}>{nav.map(([key, label, href, icon]) => <Link className={`${active === key ? "active" : ""}${pendingHref === href ? " is-pending" : ""}`} aria-current={active === key ? "page" : undefined} aria-busy={pendingHref === href || undefined} href={href} key={key} onClick={admin ? (event) => handleAdminNavigation(event, key, href) : undefined}><ArchiveIcon name={icon} size={20} /><span>{label}</span>{pendingHref === href && <span className="cms-nav-spinner" aria-label="이동 중" />}</Link>)}</aside>
    {admin && (pendingHref || failedHref) && <div className={`cms-navigation-feedback${failedHref ? " is-error" : ""}`} role={failedHref ? "alert" : "status"} aria-live="polite">{failedHref ? <><span>화면을 불러오지 못했습니다.</span><button type="button" onClick={() => beginNavigation(failedHref)}>다시 시도</button></> : <span>화면을 불러오는 중…</span>}</div>}
    {admin ? <main className="cms-content">{children}</main> : <main className="archive-main">{children}</main>}
    {!admin && <nav className={`mobile-bottom-nav${showSongs ? "" : " without-songs"}`} aria-label="모바일 예배 아카이브 메뉴">{nav.map(([key, label, href, icon]) => <Link className={active === key ? "active" : ""} href={href} key={key}><ArchiveIcon name={icon} size={22} /><span>{label}</span></Link>)}</nav>}
  </div>;
}
