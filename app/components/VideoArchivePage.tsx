"use client";

import { useEffect, useMemo, useState } from "react";
import { SiteFooter, SiteHeader } from "./SiteChrome";

export type ArchiveVideo = {
  videoId: string;
  title: string;
  date: string;
  category: string;
  detail?: string;
};

type VideoArchivePageProps = {
  eyebrow: string;
  title: string;
  description: string;
  videos: ArchiveVideo[];
  playlistUrl: string;
  counterpartLabel: string;
  counterpartHref: string;
};

const PAGE_SIZE = 8;

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
  description,
  videos,
  playlistUrl,
  counterpartLabel,
  counterpartHref,
}: VideoArchivePageProps) {
  const [page, setPage] = useState(1);
  const [playing, setPlaying] = useState<ArchiveVideo | null>(null);
  const totalPages = Math.max(1, Math.ceil(videos.length / PAGE_SIZE));
  const pageVideos = useMemo(
    () => videos.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [page, videos],
  );

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [page]);

  useEffect(() => {
    document.body.style.overflow = playing ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [playing]);

  return (
    <main>
      <SiteHeader />

      <section className="subpage-hero">
        <div className="subpage-hero-bg" aria-hidden="true">
          <img src="/assets/hero-worship.webp" alt="" />
        </div>
        <div className="page-width subpage-hero-inner">
          <p>{eyebrow}</p>
          <h1>{title}</h1>
          <span>{description}</span>
        </div>
      </section>

      <section className="archive-section">
        <div className="page-width">
          <div className="archive-heading">
            <div>
              <p>{eyebrow}</p>
              <h2>{title} 영상</h2>
            </div>
            <div className="archive-heading-side">
              <span>총 {videos.length}개의 영상</span>
              <a href={counterpartHref}>
                {counterpartLabel} 보기 <ArrowIcon />
              </a>
            </div>
          </div>

          <div className="archive-grid">
            {pageVideos.map((video, index) => (
              <article className="archive-card" key={video.videoId}>
                <button
                  className="archive-thumbnail"
                  type="button"
                  onClick={() => setPlaying(video)}
                  aria-label={`${video.title} 사이트에서 재생`}
                >
                  <img
                    src={`https://i.ytimg.com/vi/${video.videoId}/maxresdefault.jpg`}
                    alt={`${video.title} 유튜브 썸네일`}
                    onError={(event) => {
                      event.currentTarget.src = `https://i.ytimg.com/vi/${video.videoId}/hqdefault.jpg`;
                    }}
                  />
                  <span className="archive-number">
                    {String((page - 1) * PAGE_SIZE + index + 1).padStart(2, "0")}
                  </span>
                  <PlayIcon />
                </button>
                <div className="archive-card-copy">
                  <div className="archive-meta">
                    <span>{video.category}</span>
                    <time>{video.date}</time>
                  </div>
                  <h3>{video.title}</h3>
                  {video.detail && <p>{video.detail}</p>}
                  <a
                    href={`https://www.youtube.com/watch?v=${video.videoId}`}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`${video.title} 유튜브에서 보기`}
                  >
                    유튜브에서 보기 <ArrowIcon diagonal />
                  </a>
                </div>
              </article>
            ))}
          </div>

          <div className="archive-pagination" aria-label="영상 목록 페이지">
            <button
              type="button"
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              disabled={page === 1}
              aria-label="이전 페이지"
            >
              <ArrowIcon />
            </button>
            {Array.from({ length: totalPages }, (_, index) => index + 1).map((number) => (
              <button
                className={number === page ? "is-active" : ""}
                type="button"
                key={number}
                onClick={() => setPage(number)}
                aria-current={number === page ? "page" : undefined}
              >
                {String(number).padStart(2, "0")}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
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

      <SiteFooter />

      {playing && (
        <div className="video-modal" role="dialog" aria-modal="true" aria-label={`${playing.title} 영상`}>
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
                title={playing.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            </div>
            <div className="video-modal-copy">
              <span>{playing.date}</span>
              <strong>{playing.title}</strong>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
