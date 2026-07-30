import Link from "next/link";
import type { GalleryListItem } from "../../lib/content";

export default function GalleryBoard({
  albums,
  isMember,
}: {
  albums: GalleryListItem[];
  isMember: boolean;
}) {
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
          {albums.map((album, index) => (
            <Link
              className="gallery-album-card"
              href={`/gallery/${encodeURIComponent(album.id)}#gallery-viewer`}
              key={album.id}
              aria-label={`${album.title} 앨범 열기`}
            >
              <div className="gallery-album-cover">
                {album.coverImage ? <img src={album.coverImage} alt="" /> : null}
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
            </Link>
          ))}
        </div>

        <nav className="gallery-pagination" aria-label="갤러리 페이지">
          <button type="button" disabled aria-label="이전 페이지">←</button>
          <strong aria-current="page">1</strong>
          <button type="button" disabled aria-label="다음 페이지">→</button>
        </nav>
      </div>
    </section>
  );
}
