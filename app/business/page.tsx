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

export default async function BusinessPage() {
  const businesses = await listContentPosts({ type: "business" });

  return (
    <ContentPage
      eyebrow="CHURCH DIRECTORY"
      title="성도사업장"
      description="믿음 안에서 서로를 응원하고 지역과 함께하는 사업장을 소개합니다."
      current="성도사업장"
      heroImage="/assets/hero-flowers.webp"
    >
      <section className="content-section">
        <div className="page-width">
          <div className="business-directory-heading">
            <div>
              <span>MEMBER BUSINESS DIRECTORY</span>
              <h2>성도님의 사업장을 소개해 주세요.</h2>
              <p>승인된 교인 회원은 온라인으로 사업장 등록을 신청할 수 있습니다.</p>
            </div>
            <a href="/business/apply">사업장 등록 신청 <b aria-hidden="true">→</b></a>
          </div>
          {businesses.length === 0 ? (
            <div className="sample-notice business-empty-notice">
              <span>CHURCH DIRECTORY</span>
              <div>
                <h2>현재 등록된 성도사업장이 없습니다.</h2>
                <p>사업장 정보가 등록되면 이곳에 표시됩니다.</p>
              </div>
            </div>
          ) : (
            <div className="business-grid">
              {businesses.map((business) => {
                const details = parseBusinessDetails(business.content);
                const website = details.website
                  ? /^https?:\/\//i.test(details.website)
                    ? details.website
                    : `https://${details.website}`
                  : "";
                return (
                  <article className="business-card" key={business.id}>
                    <div className="business-image">
                      <img src={business.images[0]} alt={`${business.title} 대표 이미지`} />
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
          <a className="business-directory-mobile-apply" href="/business/apply">
            사업장 등록 신청 <b aria-hidden="true">→</b>
          </a>
        </div>
      </section>
    </ContentPage>
  );
}
