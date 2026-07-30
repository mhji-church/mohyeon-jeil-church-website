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
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <div>
                    <time>{post.date}</time>
                    <h3>{post.title}</h3>
                  </div>
                  <i aria-hidden="true">+</i>
                </summary>
                <ol>
                  {items.map(([title, text], itemIndex) => (
                    <li key={`${title}-${itemIndex}`}>
                      <strong>{title}</strong>
                      <p>{text}</p>
                    </li>
                  ))}
                </ol>
              </details>
              );
            })}
          </div>
        </div>
      </section>
    </ContentPage>
  );
}
