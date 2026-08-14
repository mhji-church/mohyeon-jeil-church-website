"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { formatArchiveDuration, type ArchiveAccessLevel, type ArchiveVideo } from "@/lib/archive-shared";

type Section = "all" | "sunday" | "other" | "attendance";
type AccessState = { authenticated: boolean; level: ArchiveAccessLevel; member?: { name: string } };

const sectionMeta: Record<Section, { label: string; type?: "worship" | "attendance"; group?: "sunday" | "other" }> = {
  all: { label: "전체" },
  sunday: { label: "주일예배", type: "worship", group: "sunday" },
  other: { label: "기타예배", type: "worship", group: "other" },
  attendance: { label: "출석 기록", type: "attendance" },
};

function canPlay(level: ArchiveAccessLevel, type: ArchiveVideo["type"]) {
  return level === "full" || (level === "worship" && type === "worship");
}

function formatDate(value: string) {
  const [year, month, day] = value.split("-");
  return year && month && day ? `${year}.${month}.${day}` : value;
}

export default function ArchivePortal() {
  const [section, setSection] = useState<Section>("all");
  const [videos, setVideos] = useState<ArchiveVideo[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [year, setYear] = useState("");
  const [month, setMonth] = useState("");
  const [sort, setSort] = useState<"newest" | "oldest">("newest");
  const [loading, setLoading] = useState(true);
  const [access, setAccess] = useState<AccessState>({ authenticated: false, level: "none" });
  const [playing, setPlaying] = useState<{ video: ArchiveVideo; embedUrl: string } | null>(null);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    fetch("/api/archive/access", { cache: "no-store" })
      .then((response) => response.json())
      .then((data: AccessState) => setAccess(data))
      .catch(() => undefined);
  }, []);

  const loadVideos = useCallback(async () => {
    setLoading(true);
    const meta = sectionMeta[section];
    const params = new URLSearchParams({ page: String(page), pageSize: "8", sort });
    if (meta.type) params.set("type", meta.type);
    if (meta.group) params.set("group", meta.group);
    if (search.trim()) params.set("q", search.trim());
    if (year) params.set("year", year);
    if (month) params.set("month", month);
    try {
      const response = await fetch(`/api/archive/videos?${params}`, { cache: "no-store" });
      const data = await response.json() as { videos?: ArchiveVideo[]; total?: number; error?: string };
      if (!response.ok) throw new Error(data.error);
      setVideos(data.videos ?? []);
      setTotal(data.total ?? 0);
    } catch {
      setVideos([]);
      setTotal(0);
      setNotice("예배 기록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setLoading(false);
    }
  }, [month, page, search, section, sort, year]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadVideos(), 220);
    return () => window.clearTimeout(timer);
  }, [loadVideos]);

  useEffect(() => setPage(1), [month, search, section, sort, year]);
  useEffect(() => {
    document.body.style.overflow = playing ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [playing]);

  const years = useMemo(() => {
    const current = new Date().getFullYear();
    return Array.from({ length: 10 }, (_, index) => String(current - index));
  }, []);
  const totalPages = Math.max(1, Math.ceil(total / 8));

  async function play(video: ArchiveVideo) {
    setNotice("");
    if (!access.authenticated) {
      window.location.href = `/member/login?return_to=${encodeURIComponent("/archive")}`;
      return;
    }
    if (!canPlay(access.level, video.type)) {
      setNotice(video.type === "attendance" ? "출석 기록 열람 권한이 필요합니다. 교회 관리자에게 문의해 주세요." : "예배 영상 열람 권한이 필요합니다. 교회 관리자에게 문의해 주세요.");
      return;
    }
    const response = await fetch(`/api/archive/videos/${encodeURIComponent(video.id)}/playback`, { cache: "no-store" });
    const data = await response.json() as { embedUrl?: string; note?: string; error?: string };
    if (!response.ok || !data.embedUrl) {
      setNotice(data.error ?? "재생 정보를 불러오지 못했습니다.");
      return;
    }
    setPlaying({ video: { ...video, note: data.note ?? "" }, embedUrl: data.embedUrl });
  }

  return (
    <main className="member-archive-page">
      <section className="member-archive-hero">
        <div className="page-width">
          <p>MEMBERS WORSHIP ARCHIVE</p>
          <h1>예배 아카이브</h1>
          <span>예배 현장 녹화본과 출석 교인 현황이 담겨 있는 교회 영상 기록·관리 플랫폼입니다.</span>
        </div>
      </section>

      <section className="member-archive-content page-width">
        <nav className="member-archive-tabs" aria-label="아카이브 분류">
          {(Object.keys(sectionMeta) as Section[]).map((key) => (
            <button className={section === key ? "is-active" : ""} type="button" onClick={() => setSection(key)} key={key}>
              {sectionMeta[key].label}
            </button>
          ))}
        </nav>

        <div className="member-archive-tools">
          <label className="member-archive-search">
            <span className="sr-only">예배 기록 검색</span>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="예배 종류, 날짜 등을 검색하세요" />
          </label>
          <select aria-label="연도" value={year} onChange={(event) => setYear(event.target.value)}>
            <option value="">전체 연도</option>
            {years.map((value) => <option value={value} key={value}>{value}년</option>)}
          </select>
          <select aria-label="월" value={month} onChange={(event) => setMonth(event.target.value)}>
            <option value="">전체 월</option>
            {Array.from({ length: 12 }, (_, index) => String(index + 1)).map((value) => <option value={value} key={value}>{value}월</option>)}
          </select>
          <div className="member-archive-sort" aria-label="정렬">
            <button className={sort === "newest" ? "is-active" : ""} type="button" onClick={() => setSort("newest")}>최신순</button>
            <button className={sort === "oldest" ? "is-active" : ""} type="button" onClick={() => setSort("oldest")}>오래된순</button>
          </div>
        </div>

        <header className="member-archive-list-heading">
          <div><h2>{sectionMeta[section].label} 목록</h2><span>총 {total}개</span></div>
          <p>{access.authenticated ? `${access.member?.name ?? "회원"}님 · ${access.level === "full" ? "전체 기록" : access.level === "worship" ? "예배 영상" : "열람 권한 없음"}` : "로그인 후 부여된 등급에 따라 영상을 시청할 수 있습니다."}</p>
        </header>
        {notice && <div className="member-archive-notice" role="status">{notice}</div>}

        {loading ? (
          <div className="member-archive-empty">예배 기록을 불러오고 있습니다.</div>
        ) : videos.length === 0 ? (
          <div className="member-archive-empty">검색 조건에 맞는 예배 기록이 없습니다.</div>
        ) : (
          <div className="member-archive-grid">
            {videos.map((video) => {
              const allowed = canPlay(access.level, video.type);
              return (
                <article className="member-archive-card" key={video.id}>
                  <button className="member-archive-thumb" type="button" onClick={() => void play(video)} aria-label={`${video.title} ${allowed ? "재생" : "로그인 또는 권한 확인"}`}>
                    <img src={`/api/archive/videos/${encodeURIComponent(video.id)}/thumbnail`} alt="" loading="lazy" />
                    {!allowed && <span className="member-archive-lock"><b aria-hidden="true">⌑</b>{access.authenticated ? "열람 권한 필요" : "로그인 후 시청"}</span>}
                    {video.durationSeconds != null && <time>{formatArchiveDuration(video.durationSeconds)}</time>}
                  </button>
                  <div className="member-archive-card-copy">
                    <p><time>{formatDate(video.date)}</time><span>{video.serviceType}</span></p>
                    <h3>{video.title}</h3>
                    <small>{video.preacher || "모현제일교회"}</small>
                    <button type="button" onClick={() => void play(video)}>{allowed ? "영상 보기" : access.authenticated ? "권한 확인" : "로그인 후 시청"}</button>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        <div className="member-archive-pagination" aria-label="페이지 이동">
          <span>{total ? `${(page - 1) * 8 + 1}–${Math.min(page * 8, total)} / 총 ${total}개` : "총 0개"}</span>
          <div>
            <button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>이전</button>
            <b>{page} / {totalPages}</b>
            <button type="button" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)}>다음</button>
          </div>
        </div>
      </section>

      {playing && (
        <div className="member-archive-modal" role="dialog" aria-modal="true" aria-label={playing.video.title}>
          <button className="member-archive-modal-backdrop" type="button" onClick={() => setPlaying(null)} aria-label="영상 닫기" />
          <section>
            <header><div><span>{playing.video.serviceType}</span><h2>{playing.video.title}</h2></div><button type="button" onClick={() => setPlaying(null)} aria-label="닫기">×</button></header>
            <div className="member-archive-player"><iframe src={playing.embedUrl} title={playing.video.title} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen /></div>
            <dl><div><dt>예배 날짜</dt><dd>{formatDate(playing.video.date)}</dd></div><div><dt>예배 종류</dt><dd>{playing.video.serviceType}</dd></div>{playing.video.type === "worship" && <><div><dt>설교자</dt><dd>{playing.video.preacher || "모현제일교회"}</dd></div><div><dt>영상 길이</dt><dd>{formatArchiveDuration(playing.video.durationSeconds)}</dd></div></>}<div><dt>비고</dt><dd>{playing.video.note || "—"}</dd></div></dl>
          </section>
        </div>
      )}
    </main>
  );
}
