"use client";

type Props = {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
};

function visiblePages(currentPage: number, totalPages: number) {
  const start = Math.max(1, Math.min(currentPage - 2, totalPages - 4));
  const end = Math.min(totalPages, Math.max(5, currentPage + 2));
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

export default function AdminPagination({ currentPage, totalPages, onPageChange }: Props) {
  if (totalPages <= 1) return null;
  return (
    <nav className="admin-pagination" aria-label="목록 페이지">
      <button type="button" disabled={currentPage === 1} onClick={() => onPageChange(currentPage - 1)}>
        이전
      </button>
      <div className="admin-pagination-pages">
        {visiblePages(currentPage, totalPages).map((page) => (
          <button
            type="button"
            className={page === currentPage ? "is-active" : ""}
            aria-current={page === currentPage ? "page" : undefined}
            aria-label={`${page}페이지`}
            onClick={() => onPageChange(page)}
            key={page}
          >
            {page}
          </button>
        ))}
      </div>
      <span className="admin-pagination-mobile" aria-live="polite">
        {currentPage} / {totalPages}
      </span>
      <button type="button" disabled={currentPage === totalPages} onClick={() => onPageChange(currentPage + 1)}>
        다음
      </button>
    </nav>
  );
}
