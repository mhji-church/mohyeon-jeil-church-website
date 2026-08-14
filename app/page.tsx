"use client";

import { type CSSProperties, useEffect, useState } from "react";
import KakaoChurchMap from "./components/KakaoChurchMap";

const heroTitle = ["말씀으로 바로 서고", "사랑으로 함께하는 교회"];
const heroEyebrow = "MOHYEON JEIL CHURCH";

const heroSlides = [
  {
    image: "/assets/hero-drone-4k.webp",
    mobilePosition: "46% 50%",
    alt: "봄의 모현제일교회 드론 전경",
    position: "center 50%",
  },
  {
    image: "/assets/hero-sign-4k.webp",
    mobilePosition: "left 48%",
    alt: "모현제일교회 외벽 표지",
    position: "left 48%",
  },
  {
    image: "/assets/hero-worship-4k.webp",
    mobilePosition: "center 52%",
    alt: "모현제일교회 예배 모습",
    position: "center 54%",
  },
  {
    image: "/assets/hero-flowers-4k.webp",
    mobilePosition: "center 42%",
    alt: "꽃밭 너머로 보이는 모현제일교회",
    position: "center 57%",
  },
  {
    image: "/assets/hero-winter-4k.webp",
    mobilePosition: "center 52%",
    alt: "겨울 들녘과 모현제일교회 드론 전경",
    position: "center 52%",
  },
];

const quickLinks = [
  { number: "01", label: "주일예배", href: "/worship" },
  { number: "02", label: "설교영상", href: "/sermons" },
  { number: "03", label: "주보", href: "/bulletin" },
  { number: "04", label: "교회소식", href: "/news" },
  { number: "05", label: "성도사업장", href: "/business" },
  { number: "06", label: "갤러리", href: "/gallery" },
];

type HomeSermon = {
  videoId: string;
  title: string;
  type: string;
  detail: string;
  date: string;
  href: string;
  image: string;
};

const initialSermons: HomeSermon[] = [
  {
    videoId: "waDExWNnhTs",
    title: "아프다고 말해도 괜찮아요",
    type: "주일예배",
    detail: "고린도후서 1장 8~9절 · 이광현 담임목사",
    date: "2026.07.26",
    href: "https://youtu.be/waDExWNnhTs",
    image: "/assets/sermon-main.jpg",
  },
  {
    videoId: "R92WDQa-eb8",
    title: "무덤에서 집으로",
    type: "주일예배",
    detail: "마가복음 5장 15~20절 · 이광현 담임목사",
    date: "2026.07.19",
    href: "https://youtu.be/R92WDQa-eb8",
    image: "/assets/sermon-second.jpg",
  },
  {
    videoId: "S27TvW1d_Kg",
    title: "그가 누구이기에",
    type: "주일예배",
    detail: "누가복음 8장 22~25절 · 이광현 담임목사",
    date: "2026.07.12",
    href: "https://youtu.be/S27TvW1d_Kg",
    image: "/assets/sermon-third.jpg",
  },
];

type HomeNewsItem = {
  id?: string;
  date: string;
  title: string;
  excerpt: string;
};

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isAndroidDevice() {
  return /android/i.test(navigator.userAgent);
}

function isChromeAndroid() {
  const userAgent = navigator.userAgent;
  return /android/i.test(userAgent) &&
    /chrome\//i.test(userAgent) &&
    !/(; wv\)|\bwv\b|naver|kakaotalk|samsungbrowser|firefox|edga|opr\/)/i.test(userAgent);
}

function isIOSDevice() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function titleClassName(title: string, baseClass: string, longAt: number) {
  return `${baseClass}${Array.from(title).length >= longAt ? " is-long" : ""}`;
}

const initialNewsItems: HomeNewsItem[] = [
  {
    date: "2026.06.07",
    title: "2026년 6월 7일 교회소식",
    excerpt: "월삭감사예배와 성찬예식, 이번 주 공동체 일정을 안내합니다.",
  },
  {
    date: "2026.05.31",
    title: "2026년 5월 31일 교회소식",
    excerpt: "교회학교와 기관별 모임, 한 주간의 주요 소식을 전합니다.",
  },
  {
    date: "2026.05.24",
    title: "2026년 5월 24일 교회소식",
    excerpt: "예배와 교육, 지역을 섬기는 공동체 일정을 안내합니다.",
  },
];

function newsHref(date: string) {
  return `/news?date=${encodeURIComponent(date)}#news-${date.replaceAll(".", "-")}`;
}

const worshipTimes = [
  { name: "주일 1부 예배", time: "오전 9시", place: "본당" },
  { name: "주일 2부 예배", time: "오전 11시", place: "본당" },
  { name: "수요예배", time: "오후 8시", place: "본당" },
  { name: "영아유치부", time: "오전 11시", place: "영아유치부실" },
];

function ArrowIcon({ diagonal = false }: { diagonal?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {diagonal ? (
        <path d="M7 17 17 7M8 7h9v9" />
      ) : (
        <path d="M4 12h15M14 7l5 5-5 5" />
      )}
    </svg>
  );
}

function PlayIcon() {
  return (
    <span className="play-icon" aria-hidden="true">
      <i />
    </span>
  );
}

function SermonImage({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <img
      src={failed ? "/assets/hero-worship.webp" : src}
      alt={alt}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}

function SermonPlayer({
  sermon,
  featured = false,
  onPlay,
  isPlaying,
}: {
  sermon: HomeSermon;
  featured?: boolean;
  onPlay: () => void;
  isPlaying: boolean;
}) {
  const className = featured ? "featured-sermon-media" : "sermon-card-media";

  if (isPlaying) {
    return (
      <div className={`${className} is-playing`}>
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${sermon.videoId}?autoplay=1&rel=0&controls=1&fs=1&playsinline=1&hl=ko`}
          title={`${sermon.title} 설교 영상`}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      </div>
    );
  }

  return (
    <button
      className={className}
      type="button"
      onClick={onPlay}
      aria-label={`${sermon.title} 설교 영상 이 페이지에서 재생`}
    >
      <SermonImage src={sermon.image} alt={`${sermon.title} 설교 썸네일`} />
      {featured && <span className="new-label">NEW</span>}
      <PlayIcon />
    </button>
  );
}

function HomeFloatingActions() {
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installPanelOpen, setInstallPanelOpen] = useState(false);
  const [installHelp, setInstallHelp] = useState("");
  const [openInChrome, setOpenInChrome] = useState(false);
  const [installed, setInstalled] = useState(() =>
    typeof window !== "undefined" &&
    (window.matchMedia("(display-mode: standalone)").matches ||
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone)),
  );

  useEffect(() => {
    const onScroll = () => setShowScrollTop(window.scrollY > 520);
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setInstallPrompt(null);
      setInstallPanelOpen(false);
      setInstallHelp("");
    };

    onScroll();
    const initializeInstallUi = window.setTimeout(() => {
      setOpenInChrome(isAndroidDevice() && !isChromeAndroid());
      const installRequest = new URL(window.location.href);
      if (installRequest.searchParams.get("install") === "1") {
        setInstallPanelOpen(true);
        installRequest.searchParams.delete("install");
        window.history.replaceState({}, "", `${installRequest.pathname}${installRequest.search}${installRequest.hash}`);
      }
    }, 0);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }

    return () => {
      window.clearTimeout(initializeInstallUi);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const addToHome = async () => {
    setInstallHelp("");

    if (openInChrome) {
      const installUrl = new URL(window.location.href);
      installUrl.searchParams.set("install", "1");
      installUrl.hash = "";
      const chromeTarget = installUrl.toString().replace(/^https?:\/\//, "");
      const fallbackUrl = encodeURIComponent(installUrl.toString());
      window.location.href = `intent://${chromeTarget}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${fallbackUrl};end`;
      return;
    }

    if (installPrompt) {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === "accepted") setInstalled(true);
      setInstallPrompt(null);
      if (choice.outcome === "dismissed") {
        setInstallHelp("설치가 취소되었습니다. 다시 설치하려면 페이지를 새로고침해 주세요.");
      }
      return;
    }

    setInstallHelp(
      isIOSDevice()
        ? "iPhone·iPad에서는 자동 설치가 지원되지 않습니다. Safari의 공유 버튼을 누른 뒤 ‘홈 화면에 추가’를 선택해 주세요."
        : "Chrome에서 설치 준비 중입니다. 잠시 후 홈 화면 추가 버튼을 다시 눌러 주세요.",
    );
  };

  const closeInstallPanel = () => {
    setInstallPanelOpen(false);
    setInstallHelp("");
  };

  return (
    <div className="home-floating-actions">
      {showScrollTop && (
        <button
          className="home-scroll-top"
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          aria-label="페이지 최상단으로 이동"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M5 14.5 12 7l7 7.5M12 7v12" />
          </svg>
          <span>TOP</span>
        </button>
      )}
      {!installed && (
        <button
          className="home-install-trigger"
          type="button"
          onClick={() => setInstallPanelOpen((open) => !open)}
          aria-label="홈 화면 추가 안내 열기"
          aria-expanded={installPanelOpen}
          aria-controls="home-install-panel"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="m4 11 8-7 8 7v8a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1Z" />
            <path d="M18 3v5M15.5 5.5h5" />
          </svg>
        </button>
      )}
      {!installed && installPanelOpen && (
        <div className="home-install-panel" id="home-install-panel" role="dialog" aria-label="홈 화면 추가">
          <button
            className="home-install-close"
            type="button"
            onClick={closeInstallPanel}
            aria-label="홈 화면 추가 안내 닫기"
          >
            ×
          </button>
          <div className="home-install-panel-heading">
            <span className="home-install-panel-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="m4 11 8-7 8 7v8a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1Z" />
              </svg>
            </span>
            <div>
              <strong>홈 화면 추가</strong>
              <small>모현제일교회</small>
            </div>
          </div>
          <p>홈 화면에서 모현제일교회를 앱처럼 바로 이용하세요.</p>
          <button className="home-install-button" type="button" onClick={addToHome}>
            {openInChrome ? "Chrome에서 설치" : "홈 화면 추가"}
          </button>
          {installHelp && <p className="home-install-help" role="status">{installHelp}</p>}
        </div>
      )}
    </div>
  );
}

export default function Home() {
  const [activeSlide, setActiveSlide] = useState(0);
  const [sermons, setSermons] = useState(initialSermons);
  const [playingSermon, setPlayingSermon] = useState<string | null>(null);
  const [modalSermon, setModalSermon] = useState<HomeSermon | null>(null);
  const [newsItems, setNewsItems] = useState(initialNewsItems);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveSlide((current) => (current + 1) % heroSlides.length);
    }, 6500);
    return () => window.clearInterval(timer);
  }, [activeSlide]);

  useEffect(() => {
    fetch("/api/content?type=news&limit=3", { cache: "no-store" })
      .then((response) => response.json())
      .then((data: { posts?: HomeNewsItem[] }) => {
        if (data.posts?.length) setNewsItems(data.posts);
      })
      .catch(() => {
        // The initial content remains visible during a temporary network failure.
      });
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/youtube?type=sermons", { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("YouTube playlist request failed");
        return response.json();
      })
      .then(
        (data: {
          videos?: Array<{
            videoId: string;
            title: string;
            date: string;
            category: string;
            detail?: string;
            thumbnailUrl: string;
            href: string;
          }>;
        }) => {
          if (!data.videos?.length) return;
          setSermons(
            data.videos.slice(0, 3).map((video) => ({
              videoId: video.videoId,
              title: video.title,
              type: video.category,
              detail:
                video.detail ||
                initialSermons.find((sermon) => sermon.videoId === video.videoId)?.detail ||
                "",
              date: video.date,
              href: video.href,
              image: video.thumbnailUrl,
            })),
          );
        },
      )
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          // Keep the bundled sermons visible if YouTube is temporarily unavailable.
        }
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    document.body.style.overflow = modalSermon ? "hidden" : "";

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setModalSermon(null);
    };

    if (modalSermon) window.addEventListener("keydown", closeOnEscape);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [modalSermon]);

  const moveSlide = (direction: number) => {
    setActiveSlide(
      (current) => (current + direction + heroSlides.length) % heroSlides.length,
    );
  };

  return (
    <main>

      <section
        className="hero"
        id="top"
        aria-roledescription="carousel"
        aria-label="모현제일교회 주요 사진"
      >
        <div className="hero-slides">
          {heroSlides.map((slide, index) => (
            <figure
              className={`hero-slide${index === activeSlide ? " is-active" : ""}`}
              key={slide.image}
              aria-hidden={index !== activeSlide}
            >
              <picture>
                <img
                  src={slide.image}
                  alt={index === activeSlide ? slide.alt : ""}
                  loading={index <= 1 ? "eager" : "lazy"}
                  fetchPriority={index === 0 ? "high" : "auto"}
                  decoding="async"
                  style={{
                    objectPosition: slide.position,
                    "--hero-mobile-position": slide.mobilePosition,
                  } as CSSProperties}
                />
              </picture>
              <div className="hero-overlay" aria-hidden="true" />
            </figure>
          ))}
        </div>

        <div className="hero-frame" aria-hidden="true" />

        <div className="hero-content-wrap">
          <div className="hero-copy">
            <p className="hero-eyebrow">{heroEyebrow}</p>
            <h1>
              {heroTitle.map((line) => (
                <span key={line}>{line}</span>
              ))}
            </h1>
          </div>

          <div className="hero-controller">
            <div className="hero-counter">
              <strong>{String(activeSlide + 1).padStart(2, "0")}</strong>
              <span>/</span>
              <em>{String(heroSlides.length).padStart(2, "0")}</em>
            </div>
            <div className="hero-progress" aria-hidden="true">
              <span key={`progress-${activeSlide}`} />
            </div>
            <div className="hero-arrows">
              <button type="button" onClick={() => moveSlide(-1)} aria-label="이전 사진">
                <ArrowIcon />
              </button>
              <button type="button" onClick={() => moveSlide(1)} aria-label="다음 사진">
                <ArrowIcon />
              </button>
            </div>
          </div>
        </div>
      </section>

      <nav className="quick-menu" aria-label="바로가기">
        <div className="quick-menu-inner">
          {quickLinks.map((item) => (
            <a key={item.number} href={item.href}>
              <span>{item.number}</span>
              <strong>{item.label}</strong>
              <ArrowIcon diagonal />
            </a>
          ))}
        </div>
      </nav>

      <section className="sermon-section section" id="sermon">
        <div className="page-width">
          <div className="section-intro">
            <div>
              <p className="section-kicker">WEEKLY MESSAGE</p>
              <h2>금주의 말씀</h2>
            </div>
            <p>
              말씀은 우리의 일상을 새롭게 합니다.
              <br />
              최근 예배의 은혜를 다시 만나보세요.
            </p>
          </div>

          <article className="featured-sermon">
            <SermonPlayer
              sermon={sermons[0]}
              featured
              isPlaying={playingSermon === sermons[0].videoId}
              onPlay={() => setPlayingSermon(sermons[0].videoId)}
            />
            <div className="featured-sermon-copy">
              <div className="sermon-meta">
                <span>{sermons[0].type}</span>
                <time>{sermons[0].date}</time>
              </div>
              <h3 className={titleClassName(sermons[0].title, "sermon-title", 17)}>{sermons[0].title}</h3>
              <p>{sermons[0].detail}</p>
              <a
                className="sermon-play-link"
                href={sermons[0].href}
                target="_blank"
                rel="noreferrer"
              >
                유튜브에서 설교 영상 보기 <ArrowIcon />
              </a>
            </div>
          </article>

          <div className="sermon-strip">
            {sermons.slice(1).map((sermon, index) => (
              <article key={sermon.title} className="sermon-card">
                <SermonPlayer
                  sermon={sermon}
                  isPlaying={false}
                  onPlay={() => setModalSermon(sermon)}
                />
                <div className="sermon-card-copy">
                  <span>0{index + 2}</span>
                  <div>
                    <p>{sermon.type}</p>
                    <h3 className={titleClassName(sermon.title, "sermon-title", 13)}>{sermon.title}</h3>
                    <p className="sermon-card-detail">{sermon.detail}</p>
                    <time>{sermon.date}</time>
                  </div>
                  <a
                    className="sermon-youtube-link"
                    href={sermon.href}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`${sermon.title} 유튜브에서 보기`}
                  >
                    <ArrowIcon diagonal />
                  </a>
                </div>
              </article>
            ))}
            <a
              className="sermon-all"
              href="/sermons"
            >
              <span>ALL MESSAGE</span>
              <strong>
                설교영상{" "}
                <br />
                전체보기
              </strong>
              <ArrowIcon diagonal />
            </a>
          </div>
        </div>
      </section>

      <section className="identity-section" id="about">
        <div className="identity-line" aria-hidden="true">
          MOHYEON JEIL CHURCH · MOHYEON JEIL CHURCH ·
        </div>
        <div className="page-width identity-grid">
          <div className="identity-heading">
            <p className="section-kicker light">OUR COMMUNITY</p>
            <h2>
              함께 예배하고,
              <br />
              함께 자라며,
              <br />
              함께 섬깁니다.
            </h2>
          </div>
          <div className="identity-copy" id="community">
            <p>
              모현제일교회는 복음 안에서 서로를 세우고
              <br className="desktop-only" /> 지역과 이웃을 향해 사랑을 나누는 공동체입니다.
            </p>
            <ol>
              <li>
                <span>01</span>
                <div>
                  <small>WORSHIP</small>
                  <strong>말씀 중심의 예배</strong>
                </div>
              </li>
              <li>
                <span>02</span>
                <div>
                  <small>FELLOWSHIP</small>
                  <strong>사랑 안의 교제</strong>
                </div>
              </li>
              <li>
                <span>03</span>
                <div>
                  <small>SERVICE</small>
                  <strong>지역을 향한 섬김</strong>
                </div>
              </li>
            </ol>
          </div>
        </div>
      </section>

      <section className="news-section section" id="news">
        <div className="page-width">
          <div className="section-intro news-intro">
            <div>
              <p className="section-kicker">CHURCH NEWS</p>
              <h2>교회소식</h2>
            </div>
            <a className="text-link" href="/news">
              소식 전체보기 <ArrowIcon />
            </a>
          </div>

          <div className="news-grid">
            {newsItems.map((item, index) => (
              <a
                className={`news-item${index === 0 ? " is-new" : ""}`}
                href={newsHref(item.date)}
                key={item.id || item.date}
              >
                <div className="news-item-top">
                  <span>{index === 0 ? "NEW" : `0${index + 1}`}</span>
                  <time>{item.date}</time>
                </div>
                <h3>{item.title}</h3>
                <p>{item.excerpt}</p>
                <div className="news-item-link">
                  자세히 보기 <ArrowIcon diagonal />
                </div>
              </a>
            ))}
          </div>
        </div>
      </section>

      <section className="worship-section" id="worship">
        <div className="page-width worship-heading">
          <div>
            <p className="section-kicker light">WORSHIP GUIDE</p>
            <h2>예배 안내</h2>
          </div>
          <p>
            처음 오신 분도 편안하게 예배드릴 수 있도록
            <br />
            기쁨으로 안내해 드립니다.
          </p>
        </div>
        <div className="page-width worship-grid">
          {worshipTimes.map((worship, index) => (
            <div key={worship.name}>
              <span>0{index + 1}</span>
              <strong>{worship.name}</strong>
              <dl>
                <div>
                  <dt>TIME</dt>
                  <dd>{worship.time}</dd>
                </div>
                <div>
                  <dt>PLACE</dt>
                  <dd>{worship.place}</dd>
                </div>
              </dl>
            </div>
          ))}
        </div>
      </section>

      <section className="visit-section" id="visit">
        <div className="visit-map">
          <KakaoChurchMap />
        </div>
        <div className="visit-copy">
          <p className="section-kicker light">VISIT US</p>
          <h2>
            모현제일교회는
            <br />
            여러분을 환영합니다.
          </h2>
          <dl>
            <div>
              <dt>ADDRESS</dt>
              <dd>경기도 용인시 처인구 모현읍 백옥대로 2318-22</dd>
            </div>
            <div>
              <dt>TELEPHONE</dt>
              <dd>031-333-5420</dd>
            </div>
            <div>
              <dt>PASTOR</dt>
              <dd>담임목사 이광현</dd>
            </div>
          </dl>
          <div className="visit-links">
            <a
              className="visit-link"
              href="https://map.naver.com/p/search/%EB%AA%A8%ED%98%84%EC%A0%9C%EC%9D%BC%EA%B5%90%ED%9A%8C"
              target="_blank"
              rel="noreferrer"
            >
              네이버지도에서 보기 <ArrowIcon diagonal />
            </a>
            <a
              className="visit-link"
              href="https://map.kakao.com/link/search/%EB%AA%A8%ED%98%84%EC%A0%9C%EC%9D%BC%EA%B5%90%ED%9A%8C"
              target="_blank"
              rel="noreferrer"
            >
              카카오맵에서 길찾기 <ArrowIcon diagonal />
            </a>
            <a
              className="visit-link visit-link-video"
              href="https://www.youtube.com/shorts/ee2SpzejB6k?feature=share"
              target="_blank"
              rel="noreferrer"
            >
              오시는 길 영상으로 보기 <ArrowIcon diagonal />
            </a>
          </div>
        </div>
      </section>


      {modalSermon && (
        <div
          className="video-modal"
          role="dialog"
          aria-modal="true"
          aria-label={`${modalSermon.title} 설교 영상`}
        >
          <button
            className="video-modal-backdrop"
            type="button"
            onClick={() => setModalSermon(null)}
            aria-label="영상 닫기"
          />
          <div className="video-modal-panel">
            <button
              className="video-modal-close"
              type="button"
              onClick={() => setModalSermon(null)}
              autoFocus
            >
              닫기 <span aria-hidden="true">×</span>
            </button>
            <div className="video-modal-frame">
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${modalSermon.videoId}?autoplay=1&rel=0&controls=1&fs=1&playsinline=1&hl=ko`}
                title={`${modalSermon.title} 설교 영상`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            </div>
            <div className="video-modal-copy">
              <span>{modalSermon.date}</span>
              <strong>{modalSermon.title}</strong>
            </div>
          </div>
        </div>
      )}
      <HomeFloatingActions />
    </main>
  );
}
