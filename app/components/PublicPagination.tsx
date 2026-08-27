"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type Props = {
  currentPage: number;
  totalPages: number;
  listStartId: string;
  targetId?: string;
  clearDateOnPageChange?: boolean;
};

function visiblePages(currentPage: number, totalPages: number) {
  const start = Math.max(1, Math.min(currentPage - 2, totalPages - 4));
  const end = Math.min(totalPages, Math.max(5, currentPage + 2));
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

export default function PublicPagination({
  currentPage,
  totalPages,
  listStartId,
  targetId,
  clearDateOnPageChange = false,
}: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const navigated = useRef(false);

  useEffect(() => {
    const requestedPage = searchParams.get("page");
    if (requestedPage === String(currentPage)) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(currentPage));
    router.replace(`${pathname}?${params.toString()}${targetId ? `#${targetId}` : ""}`, { scroll: false });
  }, [currentPage, pathname, router, searchParams, targetId]);

  useEffect(() => {
    const id = targetId || (navigated.current ? listStartId : "");
    if (!id) return;
    requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ block: "start" }));
    navigated.current = false;
  }, [currentPage, listStartId, targetId]);

  if (totalPages <= 1) return null;

  const changePage = (page: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(page));
    if (clearDateOnPageChange) params.delete("date");
    navigated.current = true;
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  return (
    <nav className="public-pagination" aria-label="목록 페이지">
      <button type="button" disabled={currentPage === 1} onClick={() => changePage(currentPage - 1)}>이전</button>
      <div className="public-pagination-pages">
        {visiblePages(currentPage, totalPages).map((page) => (
          <button
            type="button"
            className={page === currentPage ? "is-active" : ""}
            aria-current={page === currentPage ? "page" : undefined}
            aria-label={`${page}페이지`}
            onClick={() => changePage(page)}
            key={page}
          >{page}</button>
        ))}
      </div>
      <span className="public-pagination-mobile" aria-live="polite">{currentPage} / {totalPages}</span>
      <button type="button" disabled={currentPage === totalPages} onClick={() => changePage(currentPage + 1)}>다음</button>
    </nav>
  );
}
