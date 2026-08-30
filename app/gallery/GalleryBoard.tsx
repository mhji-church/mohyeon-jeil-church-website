"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { GalleryListItem } from "../../lib/content";
import GalleryViewer, { type GalleryModalAlbum } from "./GalleryViewer";
import AccessibleDialog from "../components/AccessibleDialog";

const GALLERY_PAGE_SIZE = 6;

function getPageNumbers(currentPage: number, totalPages: number) {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const start = Math.max(1, Math.min(currentPage - 2, totalPages - 4));
  return Array.from({ length: 5 }, (_, index) => start + index);
}

export default function GalleryBoard({
  albums,
  memberAccess,
  modalAlbums,
  initialAlbumId,
  initialApprovalRequired,
}: {
  albums: GalleryListItem[];
  memberAccess: "guest" | "pending" | "approved";
  modalAlbums: GalleryModalAlbum[];
  initialAlbumId: string;
  initialApprovalRequired: boolean;
}) {
  const boardRef = useRef<HTMLElement>(null);
  const previousPageRef = useRef(1);
  const [page, setPage] = useState(1);
  const [viewer, setViewer] = useState<GalleryModalAlbum | null>(
    modalAlbums.find((item) => item.id === initialAlbumId) ?? null,
  );
  const [approvalOpen, setApprovalOpen] = useState(
    memberAccess === "pending" && (initialApprovalRequired || Boolean(initialAlbumId)),
  );
  const isMember = memberAccess === "approved";
  const totalPages = Math.max(1, Math.ceil(albums.length / GALLERY_PAGE_SIZE));
  const pageAlbums = useMemo(
    () => albums.slice((page - 1) * GALLERY_PAGE_SIZE, page * GALLERY_PAGE_SIZE),
    [albums, page],
  );
  const pageNumbers = useMemo(
    () => getPageNumbers(page, totalPages),
    [page, totalPages],
  );

  useEffect(() => {
    if (previousPageRef.current === page) return;
    previousPageRef.current = page;
    const board = boardRef.current;
    if (!board) return;

    const headerOffset = window.matchMedia("(max-width: 720px)").matches ? 68 : 88;
    const targetTop = board.getBoundingClientRect().top + window.scrollY - headerOffset;
    window.scrollTo({ top: Math.max(0, targetTop), behavior: "smooth" });
  }, [page]);

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
    <section className="content-section gallery-board" ref={boardRef}>
      <div className="page-width">
        <header className="content-list-heading">
          <div>
            <p>CHURCH ALBUM</p>
            <h2>교회 앨범</h2>
            {!isMember ? (
              <span className="gallery-login-notice">
                {memberAccess === "pending"
                  ? "회원가입 신청이 완료됐습니다. 갤러리는 관리자 승인 후 볼 수 있습니다."
                  : "로그인 후 앨범을 보실 수 있습니다."}
              </span>
            ) : null}
          </div>
          <span>총 {albums.length}건</span>
        </header>

        <div className="gallery-album-grid" data-count={pageAlbums.length}>
          {pageAlbums.map((album) => {
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
                <div className="gallery-album-meta">
                  <span>{album.category || "CHURCH LIFE"}</span>
                  <time>{album.date}</time>
                </div>
                <div className="gallery-album-title-row">
                  <h3>{album.title}</h3>
                  <i aria-hidden="true">→</i>
                </div>
                <p>{album.excerpt}</p>
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
            ) : memberAccess === "pending" ? (
              <button
                className="gallery-album-card"
                type="button"
                onClick={() => setApprovalOpen(true)}
                key={album.id}
                aria-label={`${album.title} 앨범 승인 안내 보기`}
              >
                {cardContent}
              </button>
            ) : (
              <Link
                className="gallery-album-card"
                href={`/member/login?return_to=${encodeURIComponent(`/gallery?album=${album.id}`)}`}
                key={album.id}
                aria-label={`${album.title} 앨범을 보기 위해 로그인`}
              >
                {cardContent}
              </Link>
            );
          })}
        </div>

        {totalPages > 1 ? (
          <nav className="gallery-pagination" aria-label="갤러리 페이지">
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={page === 1}
              aria-label="이전 페이지"
            >
              ←
            </button>
            {pageNumbers.map((number) =>
              number === page ? (
                <strong aria-current="page" key={number}>{number}</strong>
              ) : (
                <button type="button" onClick={() => setPage(number)} key={number}>
                  {number}
                </button>
              ),
            )}
            <button
              type="button"
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              disabled={page === totalPages}
              aria-label="다음 페이지"
            >
              →
            </button>
          </nav>
        ) : null}
      </div>

      {viewer ? (
        <GalleryViewer key={viewer.id} album={viewer} onClose={closeViewer} />
      ) : null}
      <AccessibleDialog
        open={approvalOpen}
        onClose={() => setApprovalOpen(false)}
        labelledBy="gallery-approval-title"
        describedBy="gallery-approval-description"
        className="member-guide-dialog gallery-approval-dialog"
      >
        <button
          className="member-dialog-close"
          type="button"
          onClick={() => setApprovalOpen(false)}
          aria-label="승인 안내 닫기"
        >
          ×
        </button>
        <span>MEMBER APPROVAL</span>
        <h2 id="gallery-approval-title">관리자 승인 후 볼 수 있습니다</h2>
        <p id="gallery-approval-description">
          회원가입 신청은 정상적으로 접수됐습니다. 관리자가 교인 확인을 마치면 갤러리와 회원 전용 콘텐츠를 이용할 수 있습니다.
        </p>
        <button data-dialog-autofocus type="button" onClick={() => setApprovalOpen(false)}>
          확인
        </button>
      </AccessibleDialog>
    </section>
  );
}
