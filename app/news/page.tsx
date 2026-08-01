import type { Metadata } from "next";
import ContentPage from "../components/ContentPage";
import { listContentPosts } from "../../lib/content";

export const metadata: Metadata = {
  title: "교회소식 | 모현제일교회",
  description: "모현제일교회의 예배, 모임과 섬김 소식을 전합니다.",
};

export const dynamic = "force-dynamic";

export default async function NewsPage() {
  const news = await listContentPosts({ type: "news" });
  return (
    <ContentPage
      eyebrow="CHURCH NEWS"
      title="교회소식"
      description="예배와 교제, 지역을 섬기는 공동체의 소식을 전합니다."
      current="교회소식"
      heroImage="/assets/hero-sign.webp"
    >
      <section className="content-section">
        <div className="page-width">
          <header className="content-list-heading">
            <div>
              <p>LATEST NEWS</p>
              <h2>새로운 소식</h2>
            </div>
            <span>총 {news.length}건</span>
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
              <details className="church-news-card" key={post.id} open={index === 0}>
                <summary>
                  <span className="church-news-number">{String(index + 1).padStart(2, "0")}</span>
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
        </div>
      </section>
    </ContentPage>
  );
}
