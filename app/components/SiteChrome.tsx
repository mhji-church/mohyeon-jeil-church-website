"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export type HeaderMember = {
  name: string;
  position: string;
};

const menuItems = [
  { label: "교회 소개", href: "/about" },
  {
    label: "예배와 말씀",
    href: "/worship",
    children: [
      { label: "주일예배", href: "/worship" },
      { label: "설교영상", href: "/sermons" },
    ],
  },
  { label: "주보", href: "/bulletin" },
  { label: "교회소식", href: "/news" },
  { label: "성도사업장", href: "/business" },
  { label: "갤러리", href: "/gallery" },
];

const worshipArchive = {
  label: "예배 아카이브",
  href: "/archive",
};

function ArrowIcon({ diagonal = false }: { diagonal?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {diagonal ? (
        <path d="M7 17 17 7M8 7h9v9" />
      ) : (
        <path d="M4 12h15M14 7l5 5-5 5" />
      )}
    </svg>
  );
}

export function SiteHeader({ onAuthenticationChange }: { onAuthenticationChange: (value: boolean) => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [worshipOpen, setWorshipOpen] = useState(false);
  const [memberMenuOpen, setMemberMenuOpen] = useState(false);
  const [member, setMember] = useState<HeaderMember | null>(null);

  useEffect(() => {
    let active = true;
    const loadMember = () => {
      fetch("/api/session", { cache: "no-store" })
        .then(async (response) => {
          if (response.ok) {
            return response.json() as Promise<{ authenticated: boolean; member?: HeaderMember | null }>;
          }
          if (response.status === 401) return { authenticated: false, member: null };
          throw new Error(`회원 정보 확인 실패: ${response.status}`);
        })
        .then((data: { authenticated: boolean; member?: HeaderMember | null }) => {
          if (active) {
            setMember(data.member ?? null);
            onAuthenticationChange(data.authenticated);
          }
        })
        // 네트워크 전환이나 페이지 이동 중 요청 실패는 이미 확인한 로그인
        // 상태를 비로그인으로 덮어쓰지 않는다. 401 응답일 때만 해제한다.
        .catch(() => undefined);
    };
    const requestIdle = window.requestIdleCallback;
    const scheduled = typeof requestIdle === "function"
      ? requestIdle(loadMember, { timeout: 800 })
      : window.setTimeout(loadMember, 120);
    window.addEventListener("member-profile-updated", loadMember);
    return () => {
      active = false;
      const cancelIdle = window.cancelIdleCallback;
      if (typeof cancelIdle === "function") {
        cancelIdle(scheduled);
      } else {
        window.clearTimeout(scheduled);
      }
      window.removeEventListener("member-profile-updated", loadMember);
    };
  }, [onAuthenticationChange]);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!memberMenuOpen) return;

    const closeMemberMenu = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Element && !target.closest("[data-member-menu]")) {
        setMemberMenuOpen(false);
      }
    };
    const closeMemberMenuWithEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMemberMenuOpen(false);
    };

    document.addEventListener("pointerdown", closeMemberMenu);
    document.addEventListener("keydown", closeMemberMenuWithEscape);
    return () => {
      document.removeEventListener("pointerdown", closeMemberMenu);
      document.removeEventListener("keydown", closeMemberMenuWithEscape);
    };
  }, [memberMenuOpen]);

  const closeMenu = () => {
    setMenuOpen(false);
    setWorshipOpen(false);
    setMemberMenuOpen(false);
  };

  const toggleMenu = () => {
    if (menuOpen) {
      closeMenu();
      return;
    }

    setWorshipOpen(false);
    setMenuOpen(true);
  };

  const memberLabel = member
    ? `${member.name} ${member.position || "성도"}`
    : "";

  return (
    <>
      <header className="site-header">
        <div className="header-inner">
          <Link className="brand" href="/" aria-label="모현제일교회 홈">
            <img src="/assets/logo-horizontal.png" alt="모현제일교회" />
          </Link>

          <nav className="desktop-nav" aria-label="주요 메뉴">
            {menuItems.map((item) => (
              <div className={`desktop-nav-item${item.children ? " has-submenu" : ""}`} key={item.label}>
                {item.children ? (
                  <a href={item.href}>{item.label}</a>
                ) : (
                  <Link href={item.href} prefetch={false}>{item.label}</Link>
                )}
                {item.children && (
                  <div className="desktop-submenu" aria-label={`${item.label} 하위 메뉴`}>
                    {item.children.map((child) => (
                      <a href={child.href} key={child.label}>
                        {child.label}
                        <ArrowIcon />
                      </a>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </nav>

          <div className="header-side">
            <div className="header-external-links">
              <a
                href="https://www.youtube.com/@%EB%AA%A8%ED%98%84%EC%A0%9C%EC%9D%BC%EA%B5%90%ED%9A%8C"
                target="_blank"
                rel="noreferrer"
              >
                YOUTUBE
              </a>
              <span aria-hidden="true">|</span>
              <a className="header-archive-link" href={worshipArchive.href}>
                {worshipArchive.label}
              </a>
              <span aria-hidden="true">|</span>
              {member ? (
                <span
                  className={`header-member-actions${memberMenuOpen ? " is-open" : ""}`}
                  data-member-menu
                  onMouseEnter={() => setMemberMenuOpen(true)}
                  onMouseLeave={() => setMemberMenuOpen(false)}
                  onFocus={() => setMemberMenuOpen(true)}
                  onBlur={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget)) {
                      setMemberMenuOpen(false);
                    }
                  }}
                >
                  <button
                    className="header-member-login is-member"
                    type="button"
                    aria-haspopup="menu"
                    aria-expanded={memberMenuOpen}
                    onClick={() => setMemberMenuOpen((value) => !value)}
                  >
                    {memberLabel}
                    <i aria-hidden="true" />
                  </button>
                  <span className="header-member-dropdown" role="menu" hidden={!memberMenuOpen}>
                    <a href="/member" role="menuitem">내 정보 관리</a>
                    <a href="/api/members/session?return_to=/" role="menuitem">로그아웃</a>
                  </span>
                </span>
              ) : (
                <Link className="header-member-login" href="/member/login" prefetch={false}>
                  교인 로그인
                </Link>
              )}
            </div>
            <button
              className={`menu-button${menuOpen ? " is-open" : ""}`}
              type="button"
              aria-label={menuOpen ? "메뉴 닫기" : "메뉴 열기"}
              aria-expanded={menuOpen}
              aria-controls="mobile-menu"
              onClick={toggleMenu}
            >
              <span />
              <span />
              <b>MENU</b>
            </button>
          </div>
        </div>
      </header>

      <div id="mobile-menu" className={`mobile-menu${menuOpen ? " is-open" : ""}`}>
        <nav aria-label="모바일 주요 메뉴">
          {menuItems.map((item, index) =>
            item.children ? (
              <div className={`mobile-nav-group${worshipOpen ? " is-open" : ""}`} key={item.label}>
                <button
                  type="button"
                  onClick={() => setWorshipOpen((value) => !value)}
                  aria-expanded={worshipOpen}
                  aria-controls="mobile-worship-submenu"
                >
                  <span>0{index + 1}</span>
                  <strong>{item.label}</strong>
                  <i aria-hidden="true">+</i>
                </button>
                <div
                  id="mobile-worship-submenu"
                  className="mobile-submenu"
                  hidden={!worshipOpen}
                >
                  {item.children.map((child) => (
                    <a href={child.href} key={child.label} onClick={closeMenu}>
                      {child.label}
                      <ArrowIcon />
                    </a>
                  ))}
                </div>
              </div>
            ) : (
              <Link key={item.label} href={item.href} prefetch={false} onClick={closeMenu}>
                <span>0{index + 1}</span>
                <strong>{item.label}</strong>
                <ArrowIcon />
              </Link>
            ),
          )}
        </nav>
        <div className="mobile-menu-bottom">
          <div className="mobile-menu-meta">
            <span>MOHYEON JEIL CHURCH</span>
            <strong>031-333-5420</strong>
          </div>
          <div className="mobile-member-links">
            {member ? (
              <div
                className={`mobile-member-menu${memberMenuOpen ? " is-open" : ""}`}
                data-member-menu
              >
                <button
                  className="mobile-member-login is-member"
                  type="button"
                  aria-haspopup="menu"
                  aria-expanded={memberMenuOpen}
                  onClick={() => setMemberMenuOpen((value) => !value)}
                >
                  {memberLabel}
                  <i aria-hidden="true" />
                </button>
                <div className="mobile-member-dropdown" role="menu" hidden={!memberMenuOpen}>
                  <a href="/member" role="menuitem" onClick={closeMenu}>내 정보 관리</a>
                  <a
                    href="/api/members/session?return_to=/"
                    role="menuitem"
                    onClick={closeMenu}
                  >
                    로그아웃
                  </a>
                </div>
              </div>
            ) : (
              <>
                <Link className="mobile-member-signup" href="/member/signup" prefetch={false} onClick={closeMenu}>
                  회원가입
                </Link>
                <Link className="mobile-member-login" href="/member/login" prefetch={false} onClick={closeMenu}>
                  로그인
                </Link>
              </>
            )}
          </div>
          <a className="mobile-archive-link" href={worshipArchive.href} onClick={closeMenu}>
            <span>{worshipArchive.label}</span>
          </a>
        </div>
      </div>
    </>
  );
}

export function SiteFooter() {
  return (
    <footer id="gallery">
      <div className="page-width footer-main">
        <div className="footer-brand">
          <img src="/assets/logo-horizontal.png" alt="모현제일교회" />
          <p>말씀 중심의 예배와 사랑의 섬김이 있는 교회</p>
        </div>
        <section className="footer-offering" aria-labelledby="offering-title">
          <span>ONLINE OFFERING</span>
          <h2 id="offering-title">온라인 헌금계좌</h2>
          <dl>
            <div>
              <dt>우체국</dt>
              <dd>102301-01-001455</dd>
            </div>
            <div>
              <dt>예금주</dt>
              <dd>
                <a
                  className="footer-admin-entry"
                  href="/admin/login"
                  aria-label="관리자 로그인"
                  title="관리자 로그인"
                >
                  모
                </a>
                현제일교회
              </dd>
            </div>
          </dl>
        </section>
      </div>
      <div className="page-width footer-bottom">
        <span className="footer-copyright">© 2026 모현제일교회. All rights reserved.</span>
        <span className="footer-denomination">대한예수교장로회 합동 교단</span>
      </div>
    </footer>
  );
}
