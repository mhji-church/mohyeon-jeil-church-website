import type { Metadata } from "next";
import ContentPage from "../components/ContentPage";

export const metadata: Metadata = {
  title: "교회 소개 | 모현제일교회",
  description: "말씀으로 바로 서고 사랑으로 지역을 섬기는 모현제일교회를 소개합니다.",
};

const values = [
  {
    number: "01",
    title: "말씀 중심의 예배",
    text: "하나님의 말씀을 삶의 중심에 두고 모든 세대가 함께 예배합니다.",
  },
  {
    number: "02",
    title: "믿음 안의 교제",
    text: "믿음 안에서 서로를 세우며 기쁨과 어려움을 함께 나눕니다.",
  },
  {
    number: "03",
    title: "지역을 향한 섬김",
    text: "주님의 사랑으로 이웃과 지역사회를 섬기는 일을 복음적 사명으로 여깁니다.",
  },
];

const worship = [
  ["주일 1부 예배", "오전 9시", "본당"],
  ["주일 2부 예배", "오전 11시", "본당"],
  ["수요예배", "오후 8시", "본당"],
  ["영아유치부예배", "오전 11시", "영아유치부실"],
];

export default function AboutPage() {
  return (
    <ContentPage
      eyebrow="ABOUT OUR CHURCH"
      title="교회 소개"
      description="말씀으로 바로 서고 사랑으로 지역을 섬기는 교회입니다."
      current="교회 소개"
      heroImage="/assets/hero-spring.webp"
    >
      <section className="content-section about-intro">
        <div className="page-width about-intro-grid">
          <div className="content-kicker">
            <span>MOHYEON JEIL CHURCH</span>
            <strong>
              <span>말씀 중심의 예배와</span>
              <span>사랑의 섬김이 있는 교회</span>
            </strong>
          </div>
          <div className="about-intro-copy">
            <p>
              모현제일교회는 대한예수교장로회 합동 교단에 소속된 건강한 교회입니다.
              말씀 중심의 예배를 드리고 믿음 안에서 교제하며 주님의 사랑으로
              지역사회를 섬기는 공동체를 세워가고 있습니다.
            </p>
            <dl>
              <div>
                <dt>담임목사</dt>
                <dd>이광현</dd>
              </div>
              <div>
                <dt>대표전화</dt>
                <dd>031-333-5420</dd>
              </div>
              <div>
                <dt>주소</dt>
                <dd>경기도 용인시 처인구 모현읍 백옥대로 2318-22</dd>
              </div>
            </dl>
          </div>
        </div>
      </section>

      <section className="content-section value-section">
        <div className="page-width">
          <header className="content-heading">
            <p>OUR CALLING</p>
            <h2>우리가 함께 세워가는 교회</h2>
          </header>
          <div className="value-grid">
            {values.map((value) => (
              <article className="value-card" key={value.number}>
                <span>{value.number}</span>
                <h3>{value.title}</h3>
                <p>{value.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="content-section worship-guide">
        <div className="page-width worship-guide-grid">
          <header className="content-heading">
            <p>WORSHIP GUIDE</p>
            <h2>예배시간 안내</h2>
            <span>하나님을 높이는 예배의 자리에 여러분을 초대합니다.</span>
          </header>
          <div className="worship-table">
            {worship.map(([name, time, place]) => (
              <div key={name}>
                <strong>{name}</strong>
                <span>{time}</span>
                <em>{place}</em>
              </div>
            ))}
          </div>
        </div>
      </section>
    </ContentPage>
  );
}
