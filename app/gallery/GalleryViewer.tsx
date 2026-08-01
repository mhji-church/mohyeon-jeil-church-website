"use client";

import { useCallback, useEffect, useState } from "react";
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
                onSwipe={(direction) => moveImage(direction === "next" ? 1 : -1)}
              />
              <button type="button" onClick={() => moveImage(1)} aria-label="다음 사진">
                →
              </button>
            </div>

            <footer className="gallery-modal-bottom">
              <p>{album.content}</p>
              <div className="gallery-thumbnails" aria-label="사진 선택">
                {album.images.map((image, index) => (
                  <button
                    type="button"
                    className={index === activeImage ? "is-active" : ""}
                    onClick={() => setActiveImage(index)}
                    key={image}
                    aria-label={`${index + 1}번 사진 보기`}
                  >
                    <img src={image} alt="" loading="lazy" decoding="async" />
                  </button>
                ))}
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
