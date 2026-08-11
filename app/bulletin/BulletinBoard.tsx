"use client";

import { useCallback, useEffect, useState } from "react";
import ZoomableImage from "../components/ZoomableImage";
import type { ContentPost } from "../../lib/content";

export default function BulletinBoard({ bulletins }: { bulletins: ContentPost[] }) {
  const [viewer, setViewer] = useState<ContentPost | null>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [direction, setDirection] = useState<"next" | "prev">("next");
  const latest = bulletins[0];
  const archive = bulletins.slice(1);

  const movePage = useCallback((amount: number) => {
    if (!viewer) return;
    const next = Math.max(0, Math.min(pageIndex + amount, viewer.images.length - 1));
    if (next === pageIndex) return;
    setDirection(amount > 0 ? "next" : "prev");
    setPageIndex(next);
  }, [pageIndex, viewer]);

  useEffect(() => {
    if (!viewer) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setViewer(null);
      if (event.key === "ArrowLeft") movePage(-1);
      if (event.key === "ArrowRight") movePage(1);
    };
    document.body.classList.add("modal-open");
    window.addEventListener("keydown", handleKey);
    return () => {
      document.body.classList.remove("modal-open");
      window.removeEventListener("keydown", handleKey);
    };
  }, [viewer, movePage]);

  const openViewer = (bulletin: ContentPost, page = 0) => {
    setPageIndex(page);
    setDirection("next");
    setViewer(bulletin);
  };

  return (
    <section className="content-section">
      <div className="page-width">
        <header className="content-list-heading">
          <div>
            <p>BULLETIN</p>
            <h2>주보 보기</h2>
          </div>
          <span>총 {bulletins.length}건</span>
        </header>

        {latest ? (
          <>
            <article className="bulletin-latest">
              <button
                className="bulletin-latest-cover"
                type="button"
                onClick={() => openViewer(latest)}
                aria-label={`${latest.title} 크게 보기`}
              >
                <img
                  src={latest.images[0]}
                  alt={`${latest.title} 첫 번째 면`}
                  loading="eager"
                  fetchPriority="high"
                  decoding="async"
                />
                <span className="bulletin-new-label">NEW</span>
                <span className="bulletin-cover-action">클릭하여 크게 보기</span>
              </button>
              <div className="bulletin-latest-copy">
                <div>
                  <span>LATEST BULLETIN</span>
                  <time>{latest.date}</time>
                </div>
                <h3>{latest.title}</h3>
                <p>이번 주 예배 순서와 교회 소식을 확인하세요.</p>
                <div className="bulletin-latest-actions">
                  <button type="button" onClick={() => openViewer(latest)}>
                    주보 크게 보기 <span aria-hidden="true">↗</span>
                  </button>
                  <span>마우스 휠과 손가락으로 확대할 수 있습니다.</span>
                </div>
              </div>
            </article>

            <section className="bulletin-archive" aria-labelledby="bulletin-archive-title">
              <header>
                <div>
                  <p>PAST BULLETINS</p>
                  <h3 id="bulletin-archive-title">지난 주보</h3>
                </div>
                <span>{archive.length}건</span>
              </header>
              <div className="bulletin-list">
                {archive.map((bulletin, index) => (
                  <button
                    className="bulletin-list-row"
                    type="button"
                    onClick={() => openViewer(bulletin)}
                    key={bulletin.id}
                    aria-label={`${bulletin.title} 보기`}
                  >
                    <span className="bulletin-list-number">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <time>{bulletin.date}</time>
                    <strong>{bulletin.title}</strong>
                    <span className="bulletin-list-arrow" aria-hidden="true">→</span>
                  </button>
                ))}
              </div>
            </section>
          </>
        ) : (
          <div className="bulletin-empty">
            <strong>등록된 주보가 없습니다.</strong>
            <p>새 주보가 등록되면 이곳에서 확인할 수 있습니다.</p>
          </div>
        )}
      </div>

      {viewer && (
        <div
          className="focus-modal bulletin-viewer"
          role="dialog"
          aria-modal="true"
          aria-label={`${viewer.title} 확대 보기`}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setViewer(null);
          }}
        >
          <button
            className="focus-modal-close"
            type="button"
            onClick={() => setViewer(null)}
            aria-label="주보 닫기"
          >
            ×
          </button>
          <div className="bulletin-viewer-panel">
            <header>
              <div>
                <p>{viewer.date}</p>
                <h2>{viewer.title}</h2>
              </div>
              <span>{pageIndex + 1} / {viewer.images.length}면</span>
            </header>
            <div className="bulletin-spread-wrap">
              <button
                className="spread-arrow"
                type="button"
                onClick={() => movePage(-1)}
                disabled={pageIndex === 0}
                aria-label="이전 면"
              >
                ←
              </button>
              <div className={`bulletin-spread turn-${direction}`} key={pageIndex}>
                <ZoomableImage
                  src={viewer.images[pageIndex]}
                  alt={`${viewer.title} ${pageIndex + 1}면`}
                  className="bulletin-zoom-image"
                  onSwipe={(swipeDirection) =>
                    movePage(swipeDirection === "next" ? 1 : -1)
                  }
                />
              </div>
              <button
                className="spread-arrow"
                type="button"
                onClick={() => movePage(1)}
                disabled={pageIndex + 1 >= viewer.images.length}
                aria-label="다음 면"
              >
                →
              </button>
            </div>
            <footer>
              <span>마우스 휠 또는 두 손가락으로 확대·축소할 수 있습니다.</span>
              <div className="spread-dots" aria-label="주보 면 이동">
                {viewer.images.map((_, index) => (
                  <button
                    type="button"
                    className={pageIndex === index ? "is-active" : ""}
                    onClick={() => {
                      setDirection(index > pageIndex ? "next" : "prev");
                      setPageIndex(index);
                    }}
                    key={index}
                    aria-label={`${index + 1}면 보기`}
                  />
                ))}
              </div>
            </footer>
          </div>
        </div>
      )}
    </section>
  );
}
