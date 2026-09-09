"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ZoomableImage from "../components/ZoomableImage";

type DownloadNotice = {
  kind: "success" | "error";
  message: string;
};

function filenameFromDisposition(header: string | null) {
  const encoded = header?.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  if (encoded) {
    try {
      return decodeURIComponent(encoded);
    } catch {
      // Fall through to the ASCII filename.
    }
  }
  return header?.match(/filename="([^"]+)"/i)?.[1] ?? "gallery-photo";
}

export type GalleryModalAlbum = {
  id: string;
  title: string;
  date: string;
  category: string;
  content: string;
  images: string[];
};

export default function GalleryViewer({
  album,
  onClose,
}: {
  album: GalleryModalAlbum;
  onClose: () => void;
}) {
  const [activeImage, setActiveImage] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const [downloadNotice, setDownloadNotice] = useState<DownloadNotice | null>(null);
  const [photoFocus, setPhotoFocus] = useState(false);
  const thumbnailsRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const fullscreenButtonRef = useRef<HTMLButtonElement>(null);
  const savedReaderScroll = useRef(0);
  const photoFocusRef = useRef(false);
  const suppressFullscreenChange = useRef(false);
  const focusRestoreTimer = useRef<number | null>(null);

  const moveImage = useCallback((amount: number) => {
    if (!album.images.length) return;
    setDownloadNotice(null);
    setActiveImage((current) =>
      (current + amount + album.images.length) % album.images.length,
    );
  }, [album.images.length]);

  const finishPhotoFocus = useCallback((navigateBack: boolean) => {
    if (!photoFocusRef.current) return;
    photoFocusRef.current = false;
    setPhotoFocus(false);
    const restoreView = () => window.requestAnimationFrame(() => {
      if (contentRef.current) contentRef.current.scrollTop = savedReaderScroll.current;
      fullscreenButtonRef.current?.focus({ preventScroll: true });
    });
    if (navigateBack && window.history.state?.mhjiGalleryPhotoFocus) {
      const restoreAfterHistory = () => {
        window.removeEventListener("popstate", restoreAfterHistory);
        if (focusRestoreTimer.current) window.clearTimeout(focusRestoreTimer.current);
        focusRestoreTimer.current = null;
        restoreView();
      };
      window.addEventListener("popstate", restoreAfterHistory, { once: true });
      window.history.back();
      focusRestoreTimer.current = window.setTimeout(restoreAfterHistory, 300);
      return;
    }
    restoreView();
  }, []);

  const exitPhotoFocus = useCallback(async (navigateBack: boolean) => {
    const fullscreen = document.fullscreenElement;
    if (fullscreen) {
      suppressFullscreenChange.current = true;
      try {
        await document.exitFullscreen();
      } catch {
        suppressFullscreenChange.current = false;
      }
    } else {
      suppressFullscreenChange.current = false;
    }
    finishPhotoFocus(navigateBack);
  }, [finishPhotoFocus]);

  const togglePhotoFocus = useCallback(async () => {
    if (photoFocusRef.current) {
      await exitPhotoFocus(true);
      return;
    }
    const stage = stageRef.current;
    if (!stage || !window.matchMedia("(max-width: 760px)").matches) return;
    savedReaderScroll.current = contentRef.current?.scrollTop ?? 0;
    window.history.pushState({ ...window.history.state, mhjiGalleryPhotoFocus: true }, "", window.location.href);
    photoFocusRef.current = true;
    setPhotoFocus(true);
    try {
      await stage.requestFullscreen?.({ navigationUI: "hide" });
    } catch {
      // Keep the CSS photo-focus fallback active when native fullscreen is unavailable.
    }
  }, [exitPhotoFocus]);

  const registerFullscreenButton = useCallback((button: HTMLButtonElement | null) => {
    fullscreenButtonRef.current = button;
  }, []);

  useEffect(() => {
    const fullscreenStage = stageRef.current;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (photoFocusRef.current) {
          event.preventDefault();
          void exitPhotoFocus(true);
        } else {
          onClose();
        }
      }
      if (event.key === "ArrowLeft") moveImage(-1);
      if (event.key === "ArrowRight") moveImage(1);
    };
    const handlePopState = (event: PopStateEvent) => {
      if (photoFocusRef.current && !event.state?.mhjiGalleryPhotoFocus) void exitPhotoFocus(false);
    };
    const handleFullscreenChange = () => {
      if (document.fullscreenElement || !photoFocusRef.current) return;
      if (suppressFullscreenChange.current) {
        suppressFullscreenChange.current = false;
        return;
      }
      if (window.history.state?.mhjiGalleryPhotoFocus) {
        const nextState = { ...window.history.state };
        delete nextState.mhjiGalleryPhotoFocus;
        window.history.replaceState(nextState, "", window.location.href);
      }
      finishPhotoFocus(false);
    };
    document.body.classList.add("modal-open");
    window.addEventListener("keydown", handleKey);
    window.addEventListener("popstate", handlePopState);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.body.classList.remove("modal-open");
      window.removeEventListener("keydown", handleKey);
      window.removeEventListener("popstate", handlePopState);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      if (focusRestoreTimer.current) window.clearTimeout(focusRestoreTimer.current);
      if (document.fullscreenElement === fullscreenStage) void document.exitFullscreen().catch(() => undefined);
    };
  }, [exitPhotoFocus, finishPhotoFocus, moveImage, onClose]);

  useEffect(() => {
    closeButtonRef.current?.focus();
  }, []);

  useEffect(() => {
    const activeThumbnail = thumbnailsRef.current?.querySelector<HTMLElement>(
      `[data-thumbnail-index="${activeImage}"]`,
    );
    const strip = thumbnailsRef.current;
    if (activeThumbnail && strip) {
      const itemRect = activeThumbnail.getBoundingClientRect();
      const stripRect = strip.getBoundingClientRect();
      // Scroll only the thumbnail strip, never the modal's reading position.
      strip.scrollBy({
        left: itemRect.left - stripRect.left - (strip.clientWidth - itemRect.width) / 2,
        behavior: "smooth",
      });
    }
  }, [activeImage]);

  const scrollThumbnails = (direction: number) => {
    const thumbnails = thumbnailsRef.current;
    if (!thumbnails) return;
    thumbnails.scrollBy({
      left: direction * Math.max(280, thumbnails.clientWidth * 0.75),
      behavior: "smooth",
    });
  };

  const downloadUrl = `/api/gallery/download?post_id=${encodeURIComponent(album.id)}&image=${activeImage}`;

  const downloadCurrentImage = async () => {
    if (downloading) return;
    const requestedIndex = activeImage;
    const anchor = document.createElement("a");
    if (!("download" in anchor)) {
      setDownloadNotice({
        kind: "error",
        message: "이 브라우저에서는 직접 저장할 수 없습니다. 원본 사진을 열어 길게 눌러 저장해 주세요.",
      });
      return;
    }

    setDownloading(true);
    setDownloadNotice(null);
    try {
      const response = await fetch(downloadUrl, {
        cache: "no-store",
        credentials: "same-origin",
      });
      if (!response.ok) throw new Error("download unavailable");
      const blobUrl = URL.createObjectURL(await response.blob());
      anchor.href = blobUrl;
      anchor.download = filenameFromDisposition(response.headers.get("content-disposition"));
      anchor.hidden = true;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1_000);
      setDownloadNotice({
        kind: "success",
        message: `${requestedIndex + 1}번 사진 저장을 시작했습니다.`,
      });
    } catch {
      setDownloadNotice({
        kind: "error",
        message: "사진을 바로 저장하지 못했습니다. 원본 사진을 열어 저장해 주세요.",
      });
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div
      className={`focus-modal gallery-viewer${photoFocus ? " is-photo-focus" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-label={`${album.title} 사진 보기`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <article className="gallery-viewer-panel">
        <header>
          <div>
            <p>{album.date} · {album.category || "CHURCH LIFE"}</p>
            <h2>{album.title}</h2>
          </div>
          <span>{album.images.length ? activeImage + 1 : 0} / {album.images.length}</span>
          <button
            className="focus-modal-close"
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="갤러리 닫기"
          >
            ×
          </button>
        </header>
        <div className="gallery-viewer-content" ref={contentRef}>
        {album.images.length ? (
          <>
            <div className="gallery-stage" ref={stageRef}>
              {photoFocus ? <span className="gallery-photo-focus-count" aria-live="polite">{activeImage + 1} / {album.images.length}</span> : null}
              {album.images.length > 1 ? (
                <button type="button" onClick={() => moveImage(-1)} aria-label="이전 사진">
                  ←
                </button>
              ) : null}
              <ZoomableImage
                key={album.images[activeImage]}
                src={album.images[activeImage]}
                alt={`${album.title} 사진 ${activeImage + 1}`}
                className="gallery-zoomable"
                mobileScroll
                mobileIntrinsicSize
                photoFocusActive={photoFocus}
                onPhotoFocusButton={registerFullscreenButton}
                onPhotoFocusToggle={() => void togglePhotoFocus()}
                onSwipe={(direction) => moveImage(direction === "next" ? 1 : -1)}
              />
              {album.images.length > 1 ? (
                <button type="button" onClick={() => moveImage(1)} aria-label="다음 사진">
                  →
                </button>
              ) : null}
            </div>

            <footer className="gallery-modal-bottom">
              <div className="gallery-detail-copy">
                <p>{album.content || "작성된 본문이 없습니다."}</p>
                <div className="gallery-download-actions">
                  <button
                    className="gallery-download-button"
                    type="button"
                    onClick={downloadCurrentImage}
                    disabled={downloading}
                  >
                    {downloading ? "저장 준비 중…" : "사진 저장"}
                  </button>
                    <p
                      className={`gallery-download-notice${downloadNotice ? ` is-${downloadNotice.kind}` : ""}`}
                      role="status"
                      aria-live="polite"
                    >
                      {downloadNotice?.message}
                      {downloadNotice?.kind === "error" ? (
                        <a href={`${downloadUrl}&view=1`} target="_blank" rel="noopener noreferrer">
                          원본 사진 열기
                        </a>
                      ) : null}
                    </p>
                </div>
              </div>
              {album.images.length > 1 ? (
              <div className="gallery-thumbnail-picker">
                {album.images.length > 4 && (
                  <button
                    type="button"
                    onClick={() => scrollThumbnails(-1)}
                    aria-label="이전 썸네일 보기"
                  >
                    ←
                  </button>
                )}
                <div className="gallery-thumbnails" aria-label="사진 선택" ref={thumbnailsRef}>
                  {album.images.map((image, index) => (
                    <button
                      type="button"
                      className={index === activeImage ? "is-active" : ""}
                      onClick={() => {
                        setDownloadNotice(null);
                        setActiveImage(index);
                      }}
                      key={image}
                      data-thumbnail-index={index}
                      aria-label={`${index + 1}번 사진 보기`}
                    >
                      <img src={image} alt="" loading="lazy" decoding="async" />
                    </button>
                  ))}
                </div>
                {album.images.length > 4 && (
                  <button
                    type="button"
                    onClick={() => scrollThumbnails(1)}
                    aria-label="다음 썸네일 보기"
                  >
                    →
                  </button>
                )}
              </div>
              ) : null}
            </footer>
          </>
        ) : (
          <div className="gallery-viewer-empty">등록된 사진이 없습니다.</div>
        )}
        </div>
      </article>
    </div>
  );
}
