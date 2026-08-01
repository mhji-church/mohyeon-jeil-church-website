"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import ZoomableImage from "../../components/ZoomableImage";

type Props = {
  title: string;
  date: string;
  category: string;
  content: string;
  images: string[];
};

export default function GalleryViewer({
  title,
  date,
  category,
  content,
  images,
}: Props) {
  const [activeImage, setActiveImage] = useState(0);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (!images.length) return;
      if (event.key === "ArrowLeft") {
        setActiveImage((current) => (current - 1 + images.length) % images.length);
      }
      if (event.key === "ArrowRight") {
        setActiveImage((current) => (current + 1) % images.length);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [images.length]);

  if (!images.length) {
    return (
      <section className="content-section gallery-member-album">
        <div className="page-width gallery-member-empty">등록된 사진이 없습니다.</div>
      </section>
    );
  }

  return (
    <section className="content-section gallery-member-album">
      <div className="page-width gallery-view-width">
        <article className="gallery-member-panel" id="gallery-viewer">
          <header>
            <div>
              <p>{date} · {category || "CHURCH LIFE"}</p>
              <h2>{title}</h2>
            </div>
            <span>{activeImage + 1} / {images.length}</span>
          </header>

          <div className="gallery-stage">
            <button
              type="button"
              onClick={() =>
                setActiveImage((activeImage - 1 + images.length) % images.length)
              }
              aria-label="이전 사진"
            >
              ←
            </button>
            <ZoomableImage
              key={images[activeImage]}
              src={images[activeImage]}
              alt={`${title} 사진 ${activeImage + 1}`}
              onSwipe={(direction) =>
                setActiveImage((current) =>
                  direction === "next"
                    ? (current + 1) % images.length
                    : (current - 1 + images.length) % images.length,
                )
              }
            />
            <button
              type="button"
              onClick={() => setActiveImage((activeImage + 1) % images.length)}
              aria-label="다음 사진"
            >
              →
            </button>
          </div>

          <div className="gallery-modal-bottom">
            <p>{content}</p>
            <div className="gallery-thumbnails">
              {images.map((image, index) => (
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
          </div>
        </article>
        <Link className="gallery-back-link" href="/gallery">← 갤러리 목록으로</Link>
      </div>
    </section>
  );
}
