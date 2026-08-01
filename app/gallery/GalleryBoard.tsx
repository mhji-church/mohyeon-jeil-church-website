"use client";

import { useState } from "react";
import Link from "next/link";
import type { GalleryListItem } from "../../lib/content";
import GalleryViewer, { type GalleryModalAlbum } from "./GalleryViewer";

export default function GalleryBoard({
  albums,
  isMember,
  modalAlbums,
  initialAlbumId,
}: {
  albums: GalleryListItem[];
  isMember: boolean;
  modalAlbums: GalleryModalAlbum[];
  initialAlbumId: string;
}) {
  const [viewer, setViewer] = useState<GalleryModalAlbum | null>(
    modalAlbums.find((item) => item.id === initialAlbumId) ?? null,
  );

  const openViewer = (album: GalleryModalAlbum) => {
    setViewer(album);
    const url = new URL(window.location.href);
    url.searchParams.set("album", album.id);
    window.history.replaceState(null, "", url);
  };

  const closeViewer = () => {
    setViewer(null);
    const url = new URL(window.location.href);
    url.searchParams.delete("album");
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  };

  return (
    <section className="content-section gallery-board">
      <div className="page-width">
        <header className="content-list-heading">
          <div>
            <p>CHURCH ALBUM</p>
            <h2>교회 앨범</h2>
          </div>
          <span>총 {albums.length}건</span>
        </header>

        <div className="gallery-album-grid">
          {albums.map((album, index) => {
            const modalAlbum = modalAlbums.find((item) => item.id === album.id);
            const cardContent = (
              <>
              <div className="gallery-album-cover">
                {album.coverImage ? (
                  <img src={album.coverImage} alt="" loading="lazy" decoding="async" />
                ) : null}
                <span>{album.imageCount} PHOTOS</span>
              </div>
              <div className="gallery-album-copy">
                <div>
                  <time>{album.date}</time>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                </div>
                <h3>{album.title}</h3>
                <p>{album.excerpt}</p>
                <strong>
                  <span>{isMember ? "앨범 보기" : "교인 로그인 후 앨범 보기"}</span>
                  <i aria-hidden="true">→</i>
                </strong>
              </div>
              </>
            );

            return isMember && modalAlbum ? (
              <button
                className="gallery-album-card"
                type="button"
                onClick={() => openViewer(modalAlbum)}
                key={album.id}
                aria-label={`${album.title} 앨범 열기`}
              >
                {cardContent}
              </button>
            ) : (
              <Link
                className="gallery-album-card"
                href={`/member/login?returnTo=${encodeURIComponent(`/gallery?album=${album.id}`)}`}
                key={album.id}
                aria-label={`${album.title} 앨범을 보기 위해 로그인`}
              >
                {cardContent}
              </Link>
            );
          })}
        </div>

        <nav className="gallery-pagination" aria-label="갤러리 페이지">
          <button type="button" disabled aria-label="이전 페이지">←</button>
          <strong aria-current="page">1</strong>
          <button type="button" disabled aria-label="다음 페이지">→</button>
        </nav>
      </div>

      {viewer ? (
        <GalleryViewer key={viewer.id} album={viewer} onClose={closeViewer} />
      ) : null}
    </section>
  );
}
