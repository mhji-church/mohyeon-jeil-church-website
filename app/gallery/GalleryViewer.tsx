"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ZoomableImage from "../components/ZoomableImage";

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
  const thumbnailsRef = useRef<HTMLDivElement>(null);

  const moveImage = useCallback((amount: number) => {
    if (!album.images.length) return;
    setActiveImage((current) =>
      (current + amount + album.images.length) % album.images.length,
    );
  }, [album.images.length]);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft") moveImage(-1);
      if (event.key === "ArrowRight") moveImage(1);
    };
    document.body.classList.add("modal-open");
    window.addEventListener("keydown", handleKey);
    return () => {
      document.body.classList.remove("modal-open");
      window.removeEventListener("keydown", handleKey);
    };
  }, [moveImage, onClose]);

  useEffect(() => {
    const activeThumbnail = thumbnailsRef.current?.querySelector<HTMLElement>(
      `[data-thumbnail-index="${activeImage}"]`,
    );
    activeThumbnail?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center",
    });
  }, [activeImage]);

  const scrollThumbnails = (direction: number) => {
    const thumbnails = thumbnailsRef.current;
    if (!thumbnails) return;
    thumbnails.scrollBy({
      left: direction * Math.max(280, thumbnails.clientWidth * 0.75),
      behavior: "smooth",
    });
  };

  return (
    <div
      className="focus-modal gallery-viewer"
      role="dialog"
      aria-modal="true"
      aria-label={`${album.title} 사진 보기`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <button
        className="focus-modal-close"
        type="button"
        onClick={onClose}
        aria-label="갤러리 닫기"
      >
        ×
      </button>

      <article className="gallery-viewer-panel">
        <header>
          <div>
            <p>{album.date} · {album.category || "CHURCH LIFE"}</p>
            <h2>{album.title}</h2>
          </div>
          <span>{album.images.length ? activeImage + 1 : 0} / {album.images.length}</span>
        </header>

        {album.images.length ? (
          <>
            <div className="gallery-stage">
              <button type="button" onClick={() => moveImage(-1)} aria-label="이전 사진">
                ←
              </button>
              <ZoomableImage
                key={album.images[activeImage]}
                src={album.images[activeImage]}
                alt={`${album.title} 사진 ${activeImage + 1}`}
                className="gallery-zoomable"
                onSwipe={(direction) => moveImage(direction === "next" ? 1 : -1)}
              />
              <button type="button" onClick={() => moveImage(1)} aria-label="다음 사진">
                →
              </button>
            </div>

            <footer className="gallery-modal-bottom">
              <p>{album.content}</p>
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
                      onClick={() => setActiveImage(index)}
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
            </footer>
          </>
        ) : (
          <div className="gallery-viewer-empty">등록된 사진이 없습니다.</div>
        )}
      </article>
    </div>
  );
}
