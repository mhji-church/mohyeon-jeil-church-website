import type { Metadata } from "next";
import ContentPage from "../components/ContentPage";
import { listContentPosts } from "../../lib/content";

export const metadata: Metadata = {
  title: "성도사업장 | 모현제일교회",
  description: "모현제일교회 성도사업장 소개 페이지입니다.",
};

type BusinessDetails = {
  owner: string;
  address: string;
  phone: string;
  website: string;
};

const BUSINESS_PAGE_SIZE = 6;

type BusinessPageProps = {
  searchParams: Promise<{ page?: string | string[] }>;
};

function getPageNumbers(currentPage: number, totalPages: number) {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const start = Math.max(1, Math.min(currentPage - 2, totalPages - 4));
  return Array.from({ length: 5 }, (_, index) => start + index);
}

function businessPageHref(page: number) {
  return page <= 1 ? "/business" : `/business?page=${page}`;
}

function parseBusinessDetails(content: string): BusinessDetails {
  try {
    const parsed = JSON.parse(content) as Partial<BusinessDetails>;
    return {
      owner: typeof parsed.owner === "string" ? parsed.owner : "",
      address: typeof parsed.address === "string" ? parsed.address : "",
      phone: typeof parsed.phone === "string" ? parsed.phone : "",
      website: typeof parsed.website === "string" ? parsed.website : "",
    };
  } catch {
    return { owner: "", address: "", phone: "", website: "" };
  }
}

export default async function BusinessPage({ searchParams }: BusinessPageProps) {
  const businesses = await listContentPosts({ type: "business" });
  const requestedPage = Number.parseInt(String((await searchParams).page ?? "1"), 10);
  const totalPages = Math.max(1, Math.ceil(businesses.length / BUSINESS_PAGE_SIZE));
  const currentPage = Math.min(
    totalPages,
    Math.max(1, Number.isFinite(requestedPage) ? requestedPage : 1),
  );
  const pageBusinesses = businesses.slice(
    (currentPage - 1) * BUSINESS_PAGE_SIZE,
    currentPage * BUSINESS_PAGE_SIZE,
  );
  const pageNumbers = getPageNumbers(currentPage, totalPages);

  return (
    <ContentPage
      eyebrow="MEMBER BUSINESS DIRECTORY"
      title="성도사업장"
      description="믿음 안에서 서로를 응원하고 지역과 함께하는 사업장을 소개합니다."
      current="성도사업장"
      heroImage="/assets/hero-flowers-4k.webp"
    >
      <section className="content-section">
        <div className="page-width">
          <div className="business-directory-heading">
            <div>
              <span>MEMBER BUSINESS DIRECTORY</span>
              <h2>우리 교회 성도사업장을 소개합니다.</h2>
              <p>믿음 안에서 서로 응원하며 함께 성장하는 사업장을 만나보세요.</p>
            </div>
          </div>
          {businesses.length === 0 ? (
            <div className="sample-notice business-empty-notice">
              <span>MEMBER BUSINESS DIRECTORY</span>
              <div>
                <h2>현재 등록된 성도사업장이 없습니다.</h2>
                <p>사업장 정보가 등록되면 이곳에 표시됩니다.</p>
              </div>
            </div>
          ) : (
            <div className="business-grid">
              {pageBusinesses.map((business) => {
                const details = parseBusinessDetails(business.content);
                const websiteInput = details.website.trim();
                const website = websiteInput && !/^https?:\/\/?$/i.test(websiteInput)
                  ? /^https?:\/\//i.test(websiteInput)
                    ? websiteInput
                    : `https://${websiteInput}`
                  : "";
                return (
                  <article
                    className={`business-card${
                      business.title === "보림종합공사"
                        ? " business-card--bottom-focus"
                        : ""
                    }`}
                    key={business.id}
                  >
                    <div className="business-image">
                      <img
                        src={business.images[0]}
                        alt={`${business.title} 대표 이미지`}
                      />
                    </div>
                    <div className="business-copy">
                      <div>
                        <span>{business.category || "성도사업장"}</span>
                      </div>
                      {details.owner && (
                        <strong className="business-owner">{details.owner}</strong>
                      )}
                      <h3>{business.title}</h3>
                      <p>{business.excerpt}</p>
                      {(details.address || details.phone) && (
                        <dl>
                          {details.address && (
                            <div><dt>주소</dt><dd>{details.address}</dd></div>
                          )}
                          {details.phone && (
                            <div><dt>연락처</dt><dd>{details.phone}</dd></div>
                          )}
                        </dl>
                      )}
                      {website && (
                        <a
                          className="business-link"
                          href={website}
                          target="_blank"
                          rel="noreferrer"
                        >
                          홈페이지·SNS 보기 ↗
                        </a>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
          {totalPages > 1 ? (
            <nav className="business-pagination" aria-label="성도사업장 페이지">
              {currentPage > 1 ? (
                <a href={businessPageHref(currentPage - 1)} aria-label="이전 페이지">←</a>
              ) : (
                <span aria-disabled="true">←</span>
              )}
              {pageNumbers.map((number) =>
                number === currentPage ? (
                  <strong aria-current="page" key={number}>{number}</strong>
                ) : (
                  <a href={businessPageHref(number)} key={number}>{number}</a>
                ),
              )}
              {currentPage < totalPages ? (
                <a href={businessPageHref(currentPage + 1)} aria-label="다음 페이지">→</a>
              ) : (
                <span aria-disabled="true">→</span>
              )}
            </nav>
          ) : null}
        </div>
      </section>
    </ContentPage>
  );
}
