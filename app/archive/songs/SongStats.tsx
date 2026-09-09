"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ArchiveVideo } from "@/lib/archive-shared";
import { ArchiveIcon, ArchiveShell } from "../ArchiveShell";
import ArchiveVideoViewer, { type ArchivePlayingVideo } from "../ArchiveVideoViewer";

type Ranking = { rank: number; id: string; displayTitle: string; baseTitle: string; aliases: string[]; totalCount: number; sunday1Count: number; sunday2Count: number; wednesdayCount: number; lastUsed: string };
type StaleSong = { id: string; displayTitle: string; totalCount: number; lastUsed: string; daysSince: number };
type Stats = { summary: { worshipCount: number; songCount: number; usageCount: number; topSong: string }; rankings: Ranking[]; stale: StaleSong[] };
type History = { videoId: string; date: string; serviceType: string; videoTitle: string; order: number };
type FilterSnapshot = { service: string; period: string; year: string; start: string; end: string; limit: string; query: string; appliedQuery: string; staleOrder: string };
type ModalHistoryState = { archiveSongHistoryId?: unknown; archiveSongVideoId?: unknown; archiveSongFilters?: unknown; archiveSongPageScrollY?: unknown };

function modalState() { return (window.history.state ?? {}) as ModalHistoryState; }

export default function SongStats({ viewerName, viewerKind }: { viewerName: string; viewerKind: "admin" | "member" }) {
  const yearNow = new Date().getFullYear();
  const searchParams = useSearchParams();
  const [service, setService] = useState(() => searchParams.get("service") ?? "all");
  const [period, setPeriod] = useState(() => searchParams.get("period") ?? "all");
  const [year, setYear] = useState(() => searchParams.get("year") ?? String(yearNow));
  const [start, setStart] = useState(() => searchParams.get("start") ?? "");
  const [end, setEnd] = useState(() => searchParams.get("end") ?? "");
  const [limit, setLimit] = useState(() => searchParams.get("limit") ?? "50");
  const [query, setQuery] = useState(() => searchParams.get("query") ?? "");
  const [appliedQuery, setAppliedQuery] = useState(() => searchParams.get("q") ?? "");
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Ranking | null>(null);
  const [history, setHistory] = useState<History[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [playing, setPlaying] = useState<ArchivePlayingVideo | null>(null);
  const [openingVideoId, setOpeningVideoId] = useState("");
  const [videoError, setVideoError] = useState("");
  const [staleOrder, setStaleOrder] = useState(() => searchParams.get("staleOrder") ?? "oldest");
  const historyCloseButton = useRef<HTMLButtonElement>(null);
  const historyLaunchButton = useRef<HTMLElement | null>(null);
  const videoLaunchButton = useRef<HTMLElement | null>(null);
  const playingRef = useRef<ArchivePlayingVideo | null>(null);
  const songCache = useRef(new Map<string, Ranking>());
  const videoCache = useRef(new Map<string, ArchivePlayingVideo>());

  const params = useMemo(() => { const requestPeriod = period === "current" ? "year" : period; const value = new URLSearchParams({ service, period: requestPeriod, limit }); if (requestPeriod === "year") value.set("year", period === "current" ? String(yearNow) : year); if (period === "custom") { if (start) value.set("start", start); if (end) value.set("end", end); } if (appliedQuery) value.set("q", appliedQuery); return value; }, [appliedQuery, end, limit, period, service, start, year, yearNow]);
  const periodLabel = period === "all" ? "전체 기간" : period === "current" ? `${yearNow}년(올해)` : period === "year" ? `${year}년` : period === "last12" ? "최근 12개월" : `${start || "시작일"} ~ ${end || "종료일"}`;
  const staleSongs = useMemo(() => stats ? [...stats.stale].sort((a, b) => staleOrder === "oldest" ? b.daysSince - a.daysSince : a.daysSince - b.daysSince) : [], [staleOrder, stats]);
  const load = useCallback(async () => { setLoading(true); setError(""); try { const response = await fetch(`/api/archive/songs/stats?${params}`, { cache: "no-store" }); const data = await response.json(); if (!response.ok) throw new Error(data.error); setStats(data); for (const song of data.rankings ?? []) songCache.current.set(song.id, song); } catch (caught) { setError(caught instanceof Error ? caught.message : "찬양 통계를 불러오지 못했습니다."); } finally { setLoading(false); } }, [params]);
  const restorePageState = useCallback((state: ModalHistoryState) => {
    if (state.archiveSongFilters && typeof state.archiveSongFilters === "object") {
      const snapshot = state.archiveSongFilters as Partial<FilterSnapshot>;
      if (typeof snapshot.service === "string") setService(snapshot.service);
      if (typeof snapshot.period === "string") setPeriod(snapshot.period);
      if (typeof snapshot.year === "string") setYear(snapshot.year);
      if (typeof snapshot.start === "string") setStart(snapshot.start);
      if (typeof snapshot.end === "string") setEnd(snapshot.end);
      if (typeof snapshot.limit === "string") setLimit(snapshot.limit);
      if (typeof snapshot.query === "string") setQuery(snapshot.query);
      if (typeof snapshot.appliedQuery === "string") setAppliedQuery(snapshot.appliedQuery);
      if (typeof snapshot.staleOrder === "string") setStaleOrder(snapshot.staleOrder);
    }
    if (typeof state.archiveSongPageScrollY === "number") {
      window.requestAnimationFrame(() => window.scrollTo(0, state.archiveSongPageScrollY as number));
    }
  }, []);

  useEffect(() => { const timer = setTimeout(() => void load(), 180); return () => clearTimeout(timer); }, [load]);
  useEffect(() => { playingRef.current = playing; }, [playing]);
  useEffect(() => { const timer = window.setTimeout(() => restorePageState(modalState()), 0); return () => window.clearTimeout(timer); }, [restorePageState]);
  useEffect(() => {
    const onPopState = (event: PopStateEvent) => {
      const state = (event.state ?? {}) as ModalHistoryState;
      restorePageState(state);
      const songId = typeof state.archiveSongHistoryId === "string" ? state.archiveSongHistoryId : "";
      const videoId = typeof state.archiveSongVideoId === "string" ? state.archiveSongVideoId : "";
      if (!songId) {
        setPlaying(null);
        setSelected(null);
        return;
      }
      const cachedSong = songCache.current.get(songId);
      if (cachedSong) setSelected(cachedSong);
      setPlaying(videoId ? videoCache.current.get(videoId) ?? null : null);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [restorePageState]);
  useEffect(() => {
    if (!selected) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusTimer = window.setTimeout(() => historyCloseButton.current?.focus(), 0);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || playingRef.current) return;
      event.preventDefault();
      const state = modalState();
      if (state.archiveSongHistoryId === selected.id && !state.archiveSongVideoId) window.history.back();
      else setSelected(null);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      window.setTimeout(() => historyLaunchButton.current?.focus(), 0);
    };
  }, [selected]);

  async function openHistory(song: Ranking, target: HTMLElement) {
    historyLaunchButton.current = target;
    songCache.current.set(song.id, song);
    setSelected(song);
    setHistory([]);
    setHistoryLoading(true);
    setVideoError("");
    const filterSnapshot: FilterSnapshot = { service, period, year, start, end, limit, query, appliedQuery, staleOrder };
    const preservedUrl = new URL(window.location.href);
    for (const [key, value] of Object.entries({ service, period, year, start, end, limit, query, q: appliedQuery, staleOrder })) {
      if (value) preservedUrl.searchParams.set(key, value);
      else preservedUrl.searchParams.delete(key);
    }
    const preservedPath = `${preservedUrl.pathname}${preservedUrl.search}`;
    window.history.replaceState({ ...modalState(), archiveSongFilters: filterSnapshot, archiveSongPageScrollY: window.scrollY }, "", preservedPath);
    preservedUrl.searchParams.set("songHistory", song.id);
    window.history.pushState({ ...modalState(), archiveSongHistoryId: song.id }, "", `${preservedUrl.pathname}${preservedUrl.search}`);
    try {
      const response = await fetch(`/api/archive/songs/${encodeURIComponent(song.id)}/history?${params}`, { cache: "no-store" });
      const data = await response.json();
      setHistory(response.ok ? data.history ?? [] : []);
    } finally {
      setHistoryLoading(false);
    }
  }

  function closeHistory() {
    const state = modalState();
    if (selected && state.archiveSongHistoryId === selected.id && !state.archiveSongVideoId) window.history.back();
    else setSelected(null);
  }

  async function openVideo(item: History, target: HTMLElement) {
    videoLaunchButton.current = target;
    setOpeningVideoId(item.videoId);
    setVideoError("");
    try {
      const response = await fetch(`/api/archive/videos/${encodeURIComponent(item.videoId)}/playback`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok || !data.embedUrl) throw new Error(data.error || "영상 재생 정보를 불러오지 못했습니다.");
      const fallback: ArchiveVideo = { id: item.videoId, type: "worship", date: item.date, serviceType: item.serviceType, title: item.videoTitle, preacher: "", durationSeconds: null, note: data.note ?? "", createdAt: "", updatedAt: "", analysis: null };
      const next: ArchivePlayingVideo = { video: data.video ?? fallback, embedUrl: data.embedUrl };
      videoCache.current.set(item.videoId, next);
      const viewerUrl = new URL(window.location.href);
      viewerUrl.searchParams.set("video", item.videoId);
      window.history.pushState({ ...modalState(), archiveSongHistoryId: selected?.id, archiveSongVideoId: item.videoId }, "", `${viewerUrl.pathname}${viewerUrl.search}`);
      setPlaying(next);
    } catch (caught) {
      setVideoError(caught instanceof Error ? caught.message : "영상 재생 정보를 불러오지 못했습니다.");
    } finally {
      setOpeningVideoId("");
    }
  }

  function closeVideo() {
    const state = modalState();
    if (playing && state.archiveSongVideoId === playing.video.id) window.history.back();
    else setPlaying(null);
  }

  return <ArchiveShell active="songs" account={<Link aria-label={`${viewerName} 계정 메뉴`} className="header-action-link user-link" href={viewerKind === "admin" ? "/archive/admin" : "/member"}><ArchiveIcon name="user" size={17} /><span>{viewerName}</span></Link>}>
    <section className="song-stats-page">
      <header className="list-page-head"><span className="song-stats-eyebrow">WORSHIP SONGS</span><h1>찬양 통계</h1><p>예배별 찬양 사용 기록과 다시 부를 찬양을 확인합니다.</p></header>
      <div className="song-stats-filters">
        <label><span>예배 종류</span><select value={service} onChange={(event) => setService(event.target.value)}><option value="all">전체 예배</option><option value="sunday1">주일 1부 예배</option><option value="sunday2">주일 2부 예배</option><option value="wednesday">수요예배</option></select></label>
        <label><span>기간</span><select value={period} onChange={(event) => setPeriod(event.target.value)}><option value="all">전체 기간</option><option value="current">올해</option><option value="last12">최근 12개월</option><option value="year">연도 선택</option><option value="custom">사용자 지정</option></select></label>
        {period === "year" && <label><span>연도</span><select value={year} onChange={(event) => setYear(event.target.value)}>{Array.from({ length: 10 }, (_, index) => yearNow - index).map((value) => <option key={value}>{value}</option>)}</select></label>}
        {period === "custom" && <><label><span>시작일</span><input type="date" value={start} onChange={(event) => setStart(event.target.value)} /></label><label><span>종료일</span><input type="date" value={end} onChange={(event) => setEnd(event.target.value)} /></label></>}
        <label><span>표시 개수</span><select value={limit} onChange={(event) => setLimit(event.target.value)}><option value="10">상위 10곡</option><option value="20">상위 20곡</option><option value="50">상위 50곡</option><option value="100">상위 100곡</option><option value="all">전체</option></select></label>
        <label className="song-stats-search"><span>찬양 검색</span><input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); setAppliedQuery(query.trim()); } }} placeholder="대표 제목·별칭 검색" /></label>
        <button className="song-search-button" type="button" onClick={() => setAppliedQuery(query.trim())}>검색</button>
        <a className="song-export-button" href={`/api/archive/songs/export?${params}`}>Excel 다운로드</a>
      </div>
      {error && <div className="archive-notice">{error}</div>}
      {stats && <><div className="song-summary-grid"><article><span>대상 예배</span><strong>{stats.summary.worshipCount}</strong></article><article><span>등록 찬양</span><strong>{stats.summary.songCount}</strong></article><article><span>사용 횟수</span><strong>{stats.summary.usageCount}</strong></article><article><span>조회 기간</span><strong className="period-value">{periodLabel}</strong></article><article className="wide"><span>가장 많이 부른 찬양</span><strong>{stats.summary.topSong}</strong></article></div>
        <section className="song-ranking-card"><h2>찬양 순위</h2><div className="song-table-wrap"><table><thead><tr><th>순위</th><th>찬양 제목</th><th>전체</th><th>주일 1부</th><th>주일 2부</th><th>수요예배</th><th>최근 사용일</th></tr></thead><tbody>{stats.rankings.map((song) => <tr key={song.id}><td>{song.rank}</td><td><button type="button" onClick={(event) => void openHistory(song, event.currentTarget)}>{song.displayTitle}</button></td><td>{song.totalCount}</td><td>{song.sunday1Count}</td><td>{song.sunday2Count}</td><td>{song.wednesdayCount}</td><td>{song.lastUsed || "-"}</td></tr>)}</tbody></table>{!loading && !stats.rankings.length && <div className="archive-empty">조건에 맞는 찬양 기록이 없습니다.</div>}</div></section>
        <section className="song-ranking-card stale"><div className="song-ranking-title"><h2>오랫동안 부르지 않은 찬양</h2><select aria-label="오래된 찬양 정렬" value={staleOrder} onChange={(event) => setStaleOrder(event.target.value)}><option value="oldest">오래된 순</option><option value="recent">최근 순</option></select></div><div className="song-table-wrap"><table><thead><tr><th>찬양 제목</th><th>전체 사용</th><th>마지막 사용일</th><th>경과 일수</th></tr></thead><tbody>{staleSongs.map((song) => <tr key={song.id}><td>{song.displayTitle}</td><td>{song.totalCount}</td><td>{song.lastUsed}</td><td>{song.daysSince}일</td></tr>)}</tbody></table></div></section></>}
      {loading && <div className="archive-empty">찬양 통계를 불러오고 있습니다.</div>}
    </section>
    {selected && <div className="song-history-backdrop" role="dialog" aria-modal={playing ? undefined : true} aria-hidden={playing ? true : undefined} inert={playing ? true : undefined} aria-label={`${selected.displayTitle} 사용 이력`} onMouseDown={(event) => event.target === event.currentTarget && closeHistory()}><section className="song-history-modal"><header><div><small>찬양 사용 이력</small><h2>{selected.displayTitle}</h2></div><button ref={historyCloseButton} type="button" onClick={closeHistory} aria-label="닫기">×</button></header>{videoError && <div className="archive-notice" role="alert">{videoError}</div>}<div className="song-history-list">{history.map((item) => <article key={`${item.videoId}-${item.order}`}><time>{item.date}</time><div><strong>{item.serviceType}</strong><span>{item.videoTitle}</span></div><b>{item.order}번째 찬양</b><button className="song-history-video-button" type="button" disabled={openingVideoId === item.videoId} onClick={(event) => void openVideo(item, event.currentTarget)}>{openingVideoId === item.videoId ? "여는 중…" : "영상 보기"}</button></article>)}{historyLoading ? <p role="status">사용 이력을 불러오고 있습니다.</p> : !history.length && <p>선택한 조건의 사용 이력이 없습니다.</p>}</div></section></div>}
    {playing && <ArchiveVideoViewer playing={playing} onClose={closeVideo} returnFocusRef={videoLaunchButton} lockBodyScroll={false} layered />}
  </ArchiveShell>;
}
