import type { Metadata } from "next";
import ContentPage from "../components/ContentPage";
import { listPublicContentPostPage } from "../../lib/content";
import NewsAccordionController from "./MobileNewsCollapse";
import PublicPagination from "../components/PublicPagination";

export const metadata: Metadata = {
  title: "교회소식 | 모현제일교회",
  description: "모현제일교회의 예배, 모임과 섬김 소식을 전합니다.",
};

export const dynamic = "force-dynamic";

type NewsPageProps = {
  searchParams: Promise<{ date?: string | string[]; page?: string | string[] }>;
};

function newsAnchor(date: string) {
  return `news-${date.replaceAll(".", "-")}`;
}

export default async function NewsPage({ searchParams }: NewsPageProps) {
  const params = await searchParams;
  const requestedDate = params.date;
  const selectedDate =
    typeof requestedDate === "string" && /^\d{4}\.\d{2}\.\d{2}$/.test(requestedDate)
      ? requestedDate
      : null;
  const page = await listPublicContentPostPage({
    type: "news",
    page: typeof params.page === "string" ? params.page : undefined,
    targetDate: selectedDate,
  });
  const news = page.posts;
  const selectedId = selectedDate && news.some((post) => post.date === selectedDate)
    ? newsAnchor(selectedDate)
    : undefined;
  return (
    <ContentPage
      eyebrow="CHURCH NEWS"
      title="교회소식"
      description="예배와 교제, 지역을 섬기는 공동체의 소식을 전합니다."
      current="교회소식"
      heroImage="/assets/hero-church-news.webp"
    >
      <section className="content-section" id="news-list-start">
        <div className="page-width">
          <header className="content-list-heading">
            <div>
              <p>LATEST NEWS</p>
              <h2>새로운 소식</h2>
            </div>
            <span>총 {page.totalCount}건</span>
          </header>
          <div className="church-news-list">
            {news.map((post, index) => {
              let items: string[][] = [];
              try {
                items = JSON.parse(post.content) as string[][];
              } catch {
                items = [["안내", post.content]];
              }
              return (
              <details
                className="church-news-card"
                id={newsAnchor(post.date)}
                key={post.id}
                open={selectedId ? post.date === selectedDate : index === 0}
              >
                <summary>
                  <span className="church-news-number">{String((page.currentPage - 1) * 10 + index + 1).padStart(2, "0")}</span>
                  <div className="church-news-title">
                    <time>{post.date}</time>
                    <h3>{post.title}</h3>
                  </div>
                  <i className="church-news-toggle" aria-hidden="true">+</i>
                </summary>
                <ol className="church-news-body">
                  {items.map(([title, text], itemIndex) => (
                    <li key={`${title}-${itemIndex}`}>
                      <div>
                        <strong>{title}</strong>
                        <p>{text}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </details>
              );
            })}
            {news.length === 0 && (
              <div className="church-news-empty">
                <strong>등록된 교회소식이 없습니다.</strong>
                <p>새로운 소식이 등록되면 이곳에서 확인할 수 있습니다.</p>
              </div>
            )}
          </div>
          <NewsAccordionController enabled={!selectedId} />
          <PublicPagination
            currentPage={page.currentPage}
            totalPages={page.totalPages}
            listStartId="news-list-start"
            targetId={selectedId}
            clearDateOnPageChange
          />
        </div>
      </section>
    </ContentPage>
  );
}
