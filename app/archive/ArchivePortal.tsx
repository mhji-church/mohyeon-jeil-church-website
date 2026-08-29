"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatArchiveDuration, type ArchiveAccessLevel, type ArchiveVideo } from "@/lib/archive-shared";
import { ArchiveIcon, ArchiveShell, type ArchiveNavKey } from "./ArchiveShell";

export type ArchiveSection = "all" | "sunday" | "other" | "attendance";
type AccessState = { authenticated: boolean; level: ArchiveAccessLevel; member?: { name: string } };
const meta = {
  all: ["예배 아카이브", "모현제일교회의 예배와 공동체 기록을 한곳에서 만나보세요."],
  sunday: ["주일예배", "주일 1부와 주일 2부 예배 실황을 모았습니다."],
  other: ["기타예배", "수요예배와 특별예배의 은혜를 다시 만납니다."],
  attendance: ["출석 기록", "승인된 교인만 열람할 수 있는 공동체 기록입니다."],
} satisfies Record<ArchiveSection, [string, string]>;

function sectionFromPath(path: string | null): ArchiveSection { if (path?.endsWith("/sunday")) return "sunday"; if (path?.endsWith("/other")) return "other"; if (path?.endsWith("/attendance")) return "attendance"; return "all"; }
function formatDate(value: string) { return value.replaceAll("-", "."); }
function canPlay(level: ArchiveAccessLevel, type: ArchiveVideo["type"]) { return level === "full" || (level === "worship" && type === "worship"); }
function publicSongs(video: ArchiveVideo) { return video.analysis?.songs.filter((song) => song.category !== "offertory" && song.title.trim()) ?? []; }
function sermonTitleStyle(title: string) {
  const length = [...title].length;
  if (length >= 34) return { fontSize: "12px", letterSpacing: "-0.075em" };
  if (length >= 28) return { fontSize: "13px", letterSpacing: "-0.06em" };
  if (length >= 22) return { fontSize: "14px", letterSpacing: "-0.045em" };
  if (length >= 17) return { fontSize: "15px", letterSpacing: "-0.025em" };
  return { fontSize: "16px", letterSpacing: "normal" };
}

export default function ArchivePortal() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const section = sectionFromPath(pathname);
  const [videos, setVideos] = useState<ArchiveVideo[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState(() => searchParams.get("q") ?? "");
  const [year, setYear] = useState("");
  const [month, setMonth] = useState("");
  const [service, setService] = useState("");
  const [preacher, setPreacher] = useState("");
  const [sort, setSort] = useState<"newest" | "oldest">("newest");
  const [recentCount, setRecentCount] = useState<4 | 8 | 12>(4);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [access, setAccess] = useState<AccessState>({ authenticated: false, level: "none" });
  const [playing, setPlaying] = useState<{ video: ArchiveVideo; embedUrl: string } | null>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const launchButton = useRef<HTMLElement | null>(null);
  const openedVideo = useRef("");

  useEffect(() => { fetch("/api/archive/access", { cache: "no-store" }).then((response) => response.json()).then(setAccess).catch(() => undefined); }, []);
  useEffect(() => { fetch("/api/archive/settings", { cache: "no-store" }).then((response) => response.json()).then((data) => { if ([4, 8, 12].includes(data.settings?.recentCount)) setRecentCount(data.settings.recentCount); if (data.settings?.defaultSort === "oldest") setSort("oldest"); }).catch(() => undefined); }, []);
  const load = useCallback(async () => {
    setLoading(true); setNotice("");
    const params = new URLSearchParams({ page: String(page), pageSize: section === "all" ? String(recentCount) : "8", sort });
    if (section === "attendance") params.set("type", "attendance");
    if (section === "sunday") { params.set("type", "worship"); params.set("group", "sunday"); }
    if (section === "other") { params.set("type", "worship"); params.set("group", "other"); }
    const query = [search.trim(), service, preacher].filter(Boolean).join(" ");
    if (query) params.set("q", query); if (year) params.set("year", year); if (month) params.set("month", month);
    try {
      const response = await fetch(`/api/archive/videos?${params}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error();
      setVideos(data.videos ?? []); setTotal(data.total ?? 0);
    } catch { setVideos([]); setTotal(0); setNotice("예배 기록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요."); }
    finally { setLoading(false); }
  }, [month, page, preacher, recentCount, search, section, service, sort, year]);
  useEffect(() => { const timer = setTimeout(() => void load(), 180); return () => clearTimeout(timer); }, [load]);
  useEffect(() => { const timer = setTimeout(() => setPage(1), 0); return () => clearTimeout(timer); }, [month, preacher, search, section, service, sort, year]);
  useEffect(() => {
    if (!playing) return;
    document.body.style.overflow = "hidden"; closeButton.current?.focus();
    const key = (event: KeyboardEvent) => { if (event.key === "Escape") setPlaying(null); };
    document.addEventListener("keydown", key);
    return () => { document.body.style.overflow = ""; document.removeEventListener("keydown", key); launchButton.current?.focus(); };
  }, [playing]);
  useEffect(() => {
    const requested = searchParams.get("video") ?? "";
    if (!requested || openedVideo.current === requested || !access.authenticated) return;
    const video = videos.find((item) => item.id === requested);
    if (!video || !canPlay(access.level, video.type)) return;
    openedVideo.current = requested;
    fetch(`/api/archive/videos/${encodeURIComponent(video.id)}/playback`, { cache: "no-store" }).then(async (response) => ({ response, data: await response.json() })).then(({ response, data }) => { if (response.ok && data.embedUrl) setPlaying({ video: { ...video, note: data.note ?? "" }, embedUrl: data.embedUrl }); }).catch(() => undefined);
  }, [access.authenticated, access.level, searchParams, videos]);

  const years = useMemo(() => { const now = new Date().getFullYear(); return Array.from({ length: 10 }, (_, index) => String(now - index)); }, []);
  const totalPages = Math.max(1, Math.ceil(total / 8));
  const featured = section === "all" ? videos[0] : null;
  const recent = section === "all" ? videos.slice(0, recentCount) : [];
  const active = (section === "all" ? "home" : section) as ArchiveNavKey;

  async function play(video: ArchiveVideo, target?: HTMLElement) {
    launchButton.current = target ?? null; setNotice("");
    if (!access.authenticated) { window.location.assign(`/member/login?return_to=${encodeURIComponent(pathname || "/archive")}`); return; }
    if (!canPlay(access.level, video.type)) { setNotice(video.type === "attendance" ? "출석 기록은 전체 열람 등급이 필요합니다." : "예배 영상 열람 권한이 필요합니다."); return; }
    const response = await fetch(`/api/archive/videos/${encodeURIComponent(video.id)}/playback`, { cache: "no-store" });
    const data = await response.json();
    if (!response.ok || !data.embedUrl) { setNotice(data.error ?? "재생 정보를 불러오지 못했습니다."); return; }
    setPlaying({ video: { ...video, note: data.note ?? "" }, embedUrl: data.embedUrl });
  }

  function renderCard(video: ArchiveVideo, featuredCard = false) {
    const allowed = canPlay(access.level, video.type);
    const secure = video.type === "attendance" && !allowed;
    const worshipObscured = !access.authenticated && video.type === "worship";
    const thumbnailSrc = `/api/archive/videos/${encodeURIComponent(video.id)}/thumbnail`;
    return <article key={video.id} className={`media-card${featuredCard ? " featured" : ""}`}>
      <button className={`media-thumb${secure ? " attendance-obscured" : ""}${worshipObscured ? " worship-obscured" : ""}`} onClick={(event) => void play(video, event.currentTarget)} type="button" aria-label={`${video.title} ${allowed ? "재생" : "로그인 후 시청"}`}>
        <img src={thumbnailSrc} alt="" width="1280" height="720" loading={featuredCard ? "eager" : "lazy"} onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = "/archive/images/attendance-private-placeholder.png"; }} />
        {worshipObscured && <span className="worship-privacy-mask" aria-hidden="true"><img src={thumbnailSrc} alt="" width="1280" height="720" /></span>}
        {!allowed && <span className="locked-overlay"><span className="archive-lock-icon"><ArchiveIcon name="lock" size={18} /></span><strong>{access.authenticated ? "열람 권한 필요" : "로그인 후 시청"}</strong></span>}
        {allowed && <span className="play-overlay"><span className="archive-play-icon"><ArchiveIcon name="play" size={22} /></span></span>}
        {video.durationSeconds != null && <span className="media-duration">{formatArchiveDuration(video.durationSeconds)}</span>}
      </button>
      {!featuredCard && <div className="media-meta"><span className="media-date">{formatDate(video.date)} · {video.serviceType}</span><h3>{video.title}</h3>{video.type !== "attendance" && <p>설교 · {video.preacher || "모현제일교회"}</p>}</div>}
    </article>;
  }

  const searchFields = <><ArchiveIcon name="search" size={21} className="archive-search-glyph" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="날짜, 예배 종류, 설교제목 검색" aria-label="예배 기록 검색" /></>;
  const searchBox = <label className="archive-search">{searchFields}</label>;
  const account = access.authenticated ? <Link aria-label={`${access.member?.name ?? "회원"} 회원 메뉴`} className="header-action-link user-link" href="/member"><ArchiveIcon name="user" size={17} /><span>{access.member?.name ?? "회원"}</span></Link> : <Link aria-label="회원 로그인" className="header-action-link login-link" href={`/member/login?return_to=${encodeURIComponent(pathname || "/archive")}`}><ArchiveIcon name="user" size={17} /><span>로그인</span></Link>;

  return <ArchiveShell active={active} search={section === "all" ? searchBox : undefined} account={account}>
    {section === "all" ? <>
      <label className="archive-search mobile-home-search">{searchFields}</label>
      <div className="category-chips" role="group" aria-label="예배 분류"><button className={!service ? "active" : ""} onClick={() => setService("")} type="button">전체</button><button className={service === "주일 1부" ? "active" : ""} onClick={() => setService("주일 1부")} type="button">주일 1부</button><button className={service === "주일 2부" ? "active" : ""} onClick={() => setService("주일 2부")} type="button">주일 2부</button><button className={service === "수요예배" ? "active" : ""} onClick={() => setService("수요예배")} type="button">기타예배</button></div>
      {notice && <div className="archive-notice" role="status">{notice}</div>}
      {loading ? <div className="archive-empty">기록을 불러오고 있습니다.</div> : featured ? <section className="featured-layout">{renderCard(featured, true)}<div className="featured-copy"><span>{formatDate(featured.date)} · {featured.serviceType}</span><h1>{featured.title}</h1><p>설교 · {featured.preacher || "모현제일교회"}&nbsp;&nbsp; | &nbsp;&nbsp;{formatArchiveDuration(featured.durationSeconds)}</p><p className="featured-note">하나님 앞에 드린 예배의 현장을 영상으로 기록했습니다.<br />승인된 회원은 현재 화면에서 바로 시청할 수 있습니다.</p><button className="featured-action" onClick={(event) => void play(featured, event.currentTarget)} type="button">{access.authenticated ? "영상 보기" : "로그인하고 영상 보기"}</button></div></section> : <div className="archive-empty">검색 조건에 맞는 예배 영상이 없습니다.</div>}
      <section className="recent-section"><div className="section-heading"><h2>최근 예배 영상</h2><Link href="/archive/sunday">전체 보기 ›</Link></div><div className="recent-grid">{recent.map((video) => renderCard(video))}</div></section>
      <Link className="attendance-cta" href="/archive/attendance"><span className="attendance-icon"><ArchiveIcon name="clipboard" size={25} /></span><span><strong>출석 기록</strong><small>예배 출석을 영상으로 기록하고 관리할 수 있습니다.</small></span><b>출석 기록 보기</b></Link>
    </> : <div className="list-page">
      <header className="list-page-head"><h1>{meta[section][0]}</h1><p>{meta[section][1]}</p></header>
      {notice && <div className="archive-notice" role="status">{notice}</div>}
      <div className="archive-filterbar">{searchBox}<select aria-label="연도" value={year} onChange={(event) => setYear(event.target.value)}><option value="">전체 연도</option>{years.map((value) => <option key={value} value={value}>{value}년</option>)}</select><select aria-label="월" value={month} onChange={(event) => setMonth(event.target.value)}><option value="">전체 월</option>{Array.from({ length: 12 }, (_, index) => index + 1).map((value) => <option key={value} value={value}>{value}월</option>)}</select><select aria-label="예배 종류" value={service} onChange={(event) => setService(event.target.value)}><option value="">전체 예배</option><option>주일 1부 예배</option><option>주일 2부 예배</option><option>수요예배</option><option>특별예배</option></select>{section !== "attendance" && <select aria-label="설교자" value={preacher} onChange={(event) => setPreacher(event.target.value)}><option value="">전체 설교자</option><option>담임목사</option><option>초청강사</option></select>}</div>
      <div className="list-toolbar"><div><h2>목록</h2><span>총 {total}개 · {page}/{totalPages}페이지</span></div><div className="sort-toggle"><button className={sort === "newest" ? "active" : ""} onClick={() => setSort("newest")} type="button">최신순</button><button className={sort === "oldest" ? "active" : ""} onClick={() => setSort("oldest")} type="button">오래된순</button></div></div>
      {loading ? <div className="archive-empty">기록을 불러오고 있습니다.</div> : videos.length ? <div className="recent-grid list-media-grid">{videos.map((video) => renderCard(video))}</div> : <div className="archive-empty">조건에 맞는 기록이 없습니다.</div>}
      {totalPages > 1 && <div className="pager"><span>{Math.min((page - 1) * 8 + 1, total)}-{Math.min(page * 8, total)} / {total}</span><div><button disabled={page === 1} onClick={() => setPage((value) => value - 1)} type="button">‹ 이전</button><button disabled={page === totalPages} onClick={() => setPage((value) => value + 1)} type="button">다음 ›</button></div></div>}
    </div>}
    {playing && <div className="viewer-backdrop" role="dialog" aria-modal="true" aria-labelledby="viewer-title" onMouseDown={(event) => event.target === event.currentTarget && setPlaying(null)}><div className="viewer-modal"><div className="viewer-head"><div><span>{formatDate(playing.video.date)} · {playing.video.serviceType}</span><h2 id="viewer-title">{playing.video.title}</h2></div><button ref={closeButton} onClick={() => setPlaying(null)} aria-label="닫기" type="button">×</button></div><div className="viewer-player"><iframe src={playing.embedUrl} title={playing.video.title} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen /></div><dl className="viewer-details"><div><dt>예배 날짜</dt><dd>{formatDate(playing.video.date)}</dd></div><div><dt>예배 종류</dt><dd>{playing.video.serviceType}</dd></div><div><dt>설교자</dt><dd>{playing.video.analysis?.sermon.preacher || playing.video.preacher || "모현제일교회"}</dd></div><div><dt>영상 길이</dt><dd>{formatArchiveDuration(playing.video.durationSeconds)}</dd></div><div><dt>비고</dt><dd>{playing.video.note || "기록 없음"}</dd></div></dl>{playing.video.analysis && <section className="viewer-analysis"><div><h3>찬양</h3>{publicSongs(playing.video).length ? <ol>{publicSongs(playing.video).map((song, index) => <li key={song.id}><b className="viewer-song-number">{index + 1}.</b><span>{song.title}</span></li>)}</ol> : <p>등록된 찬양 정보가 없습니다.</p>}</div><div><h3>말씀</h3><p><strong>설교 제목</strong><span className="viewer-sermon-title" style={sermonTitleStyle(playing.video.analysis.sermon.title || "등록된 정보 없음")}>{playing.video.analysis.sermon.title || "등록된 정보 없음"}</span></p><p><strong>본문</strong>{playing.video.analysis.sermon.biblePassage || "등록된 정보 없음"}</p></div><div><h3>대표기도</h3>{playing.video.analysis.representativePrayer.name ? <p className="viewer-prayer"><span>{playing.video.analysis.representativePrayer.name}</span>{playing.video.analysis.representativePrayer.role && <span>{playing.video.analysis.representativePrayer.role}</span>}</p> : <p className="viewer-prayer">등록된 정보 없음</p>}</div></section>}<p className="sharing-notice">유튜브 일부공개 영상은 주소가 외부에 공유되면 사이트 밖에서도 재생될 수 있습니다.</p></div></div>}
  </ArchiveShell>;
}
