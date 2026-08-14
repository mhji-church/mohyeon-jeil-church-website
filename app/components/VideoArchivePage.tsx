"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { YouTubePlaylistType } from "../../lib/youtube";

export type ArchiveVideo = {
  videoId: string;
  title: string;
  date: string;
  category: string;
  detail?: string;
  thumbnailUrl?: string;
};

type VideoArchivePageProps = {
  eyebrow: string;
  title: string;
  collectionTitle: string;
  description: string;
  videos: ArchiveVideo[];
  playlistUrl: string;
  counterpartLabel: string;
  counterpartHref: string;
  playlistType: YouTubePlaylistType;
};

const PAGE_SIZE = 8;

function getMobilePageNumbers(currentPage: number, totalPages: number) {
  if (totalPages <= 3) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const start = Math.max(1, Math.min(currentPage - 1, totalPages - 2));
  return [start, start + 1, start + 2];
}

function getDesktopPageNumbers(currentPage: number, totalPages: number) {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const start = Math.max(1, Math.min(currentPage - 2, totalPages - 4));
  return Array.from({ length: 5 }, (_, index) => start + index);
}

function getDisplayTitle(title: string, playlistType: YouTubePlaylistType) {
  if (playlistType !== "worship") return title;

  return title.replace(/모현제일교회/g, "").replace(/\s+/g, " ").trim();
}

function FittedArchiveTitle({ title }: { title: string }) {
  const titleRef = useRef<HTMLHeadingElement>(null);

  useLayoutEffect(() => {
    const heading = titleRef.current;
    if (!heading) return;

    let cancelled = false;
    const fitTitle = () => {
      heading.style.removeProperty("font-size");
      const minSize = 8.5;
      const maxSize = Number.parseFloat(window.getComputedStyle(heading).fontSize) || 15;
      heading.style.fontSize = `${maxSize}px`;
      if (heading.scrollWidth <= heading.clientWidth) return;

      let lower = minSize;
      let upper = maxSize;
      for (let index = 0; index < 8; index += 1) {
        const middle = (lower + upper) / 2;
        heading.style.fontSize = `${middle}px`;
        if (heading.scrollWidth <= heading.clientWidth) lower = middle;
        else upper = middle;
      }
      heading.style.fontSize = `${Math.floor(lower * 10) / 10}px`;
    };

    fitTitle();
    void document.fonts.ready.then(() => {
      if (!cancelled) fitTitle();
    });
    window.addEventListener("resize", fitTitle);

    return () => {
      cancelled = true;
      window.removeEventListener("resize", fitTitle);
    };
  }, [title]);

  return (
    <h3 ref={titleRef} title={title}>
      {title}
    </h3>
  );
}

function ArrowIcon({ diagonal = false }: { diagonal?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {diagonal ? <path d="M7 17 17 7M8 7h9v9" /> : <path d="M4 12h15M14 7l5 5-5 5" />}
    </svg>
  );
}

function PlayIcon() {
  return (
    <span className="archive-play" aria-hidden="true">
      <i />
    </span>
  );
}

export default function VideoArchivePage({
  eyebrow,
  title,
  collectionTitle,
  description,
  videos,
  playlistUrl,
  counterpartLabel,
  counterpartHref,
  playlistType,
}: VideoArchivePageProps) {
  const archiveSectionRef = useRef<HTMLElement>(null);
  const previousPageRef = useRef(1);
  const [page, setPage] = useState(1);
  const [playing, setPlaying] = useState<ArchiveVideo | null>(null);
  const [playlistVideos, setPlaylistVideos] = useState(videos);
  const totalPages = Math.max(1, Math.ceil(playlistVideos.length / PAGE_SIZE));
  const pageVideos = useMemo(
    () => playlistVideos.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [page, playlistVideos],
  );
  const mobilePageNumbers = useMemo(
    () => getMobilePageNumbers(page, totalPages),
    [page, totalPages],
  );
  const desktopPageNumbers = useMemo(
    () => getDesktopPageNumbers(page, totalPages),
    [page, totalPages],
  );

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/youtube?type=${playlistType}`, {
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) throw new Error("YouTube playlist request failed");
        return response.json();
      })
      .then((data: { videos?: ArchiveVideo[] }) => {
        if (!data.videos?.length) return;
        setPlaylistVideos(
          data.videos.map((video) => ({
            ...video,
            detail:
              video.detail || videos.find((fallback) => fallback.videoId === video.videoId)?.detail,
          })),
        );
        setPage(1);
      })
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          // Keep the bundled list visible if YouTube is temporarily unavailable.
        }
      });
    return () => controller.abort();
  }, [playlistType, videos]);

  useEffect(() => {
    if (previousPageRef.current === page) return;
    previousPageRef.current = page;
    const timer = window.setTimeout(() => {
      const archiveSection = archiveSectionRef.current;
      if (!archiveSection) return;

      const mobile = window.matchMedia("(max-width: 720px)").matches;
      const headerOffset = mobile ? 68 : 76;
      const contentRevealOffset = mobile ? 42 : 76;
      const sectionTop = archiveSection.getBoundingClientRect().top + window.scrollY;
      const targetTop = sectionTop - headerOffset + contentRevealOffset;

      window.scrollTo({ top: Math.max(0, targetTop), behavior: "smooth" });
    }, 80);

    return () => window.clearTimeout(timer);
  }, [page]);

  useEffect(() => {
    document.body.style.overflow = playing ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [playing]);

  function changePage(nextPage: number) {
    const normalizedPage = Math.min(totalPages, Math.max(1, nextPage));
    if (normalizedPage === page) return;

    setPage(normalizedPage);
  }

  return (
    <main>

      <section className="subpage-hero" data-page={title}>
        <div className="subpage-hero-bg" aria-hidden="true">
          <img className="subpage-hero-cover" src="/assets/hero-worship.webp" alt="" fetchPriority="high" decoding="async" />
          <img className="subpage-hero-focus" src="/assets/hero-worship.webp" alt="" decoding="async" />
        </div>
        <div className="page-width subpage-hero-inner">
          <p>{eyebrow}</p>
          <h1>{title}</h1>
          <span>{description}</span>
        </div>
      </section>

      <section className="archive-section" ref={archiveSectionRef}>
        <div className="page-width">
          <div className="archive-heading">
            <div>
              <p>{eyebrow}</p>
              <h2>{collectionTitle}</h2>
            </div>
            <div className="archive-heading-side">
              <span>총 {playlistVideos.length}개의 영상</span>
              <a href={counterpartHref}>
                {counterpartLabel} 보기 <ArrowIcon />
              </a>
            </div>
          </div>

          <div className="archive-grid">
            {pageVideos.map((video) => {
              const displayTitle = getDisplayTitle(video.title, playlistType);

              return (
                <article className="archive-card" key={video.videoId}>
                  <button
                    className="archive-thumbnail"
                    type="button"
                    onClick={() => setPlaying(video)}
                    aria-label={`${displayTitle} 사이트에서 재생`}
                  >
                    <img
                      src={video.thumbnailUrl || `https://i.ytimg.com/vi/${video.videoId}/maxresdefault.jpg`}
                      alt={`${displayTitle} 유튜브 썸네일`}
                      loading="lazy"
                      decoding="async"
                      onError={(event) => {
                        event.currentTarget.src = `https://i.ytimg.com/vi/${video.videoId}/hqdefault.jpg`;
                      }}
                    />
                    <PlayIcon />
                  </button>
                  <div className="archive-card-copy">
                    <div className="archive-meta">
                      <span>{video.category}</span>
                      <time>{video.date}</time>
                    </div>
                    <FittedArchiveTitle title={displayTitle} />
                    {video.detail && <p>{video.detail}</p>}
                    <a
                      href={`https://www.youtube.com/watch?v=${video.videoId}`}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`${displayTitle} 유튜브에서 보기`}
                    >
                      유튜브에서 보기 <ArrowIcon diagonal />
                    </a>
                  </div>
                </article>
              );
            })}
          </div>

          <div className="archive-pagination" aria-label="영상 목록 페이지">
            <button
              type="button"
              onClick={() => changePage(page - 1)}
              disabled={page === 1}
              aria-label="이전 페이지"
            >
              <ArrowIcon />
            </button>
            {Array.from({ length: totalPages }, (_, index) => index + 1).map((number) => (
              <button
                className={[
                  number === page ? "is-active" : "",
                  mobilePageNumbers.includes(number) ? "" : "is-mobile-hidden",
                  desktopPageNumbers.includes(number) ? "" : "is-desktop-hidden",
                ].filter(Boolean).join(" ")}
                type="button"
                key={number}
                onClick={() => changePage(number)}
                aria-current={number === page ? "page" : undefined}
                aria-label={`${number}페이지`}
              >
                {String(number).padStart(2, "0")}
              </button>
            ))}
            <button
              type="button"
              onClick={() => changePage(page + 1)}
              disabled={page === totalPages}
              aria-label="다음 페이지"
            >
              <ArrowIcon />
            </button>
          </div>

          <a className="playlist-link" href={playlistUrl} target="_blank" rel="noreferrer">
            <span>
              <small>YOUTUBE PLAYLIST</small>
              유튜브에서 전체 재생목록 보기
            </span>
            <ArrowIcon diagonal />
          </a>
        </div>
      </section>


      {playing && (
        <div className="video-modal" role="dialog" aria-modal="true" aria-label={`${getDisplayTitle(playing.title, playlistType)} 영상`}>
          <button
            className="video-modal-backdrop"
            type="button"
            onClick={() => setPlaying(null)}
            aria-label="영상 닫기"
          />
          <div className="video-modal-panel">
            <button className="video-modal-close" type="button" onClick={() => setPlaying(null)}>
              닫기 <span aria-hidden="true">×</span>
            </button>
            <div className="video-modal-frame">
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${playing.videoId}?autoplay=1&rel=0`}
                title={getDisplayTitle(playing.title, playlistType)}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            </div>
            <div className="video-modal-copy">
              <span>{playing.date}</span>
              <strong>{getDisplayTitle(playing.title, playlistType)}</strong>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
