"use client";

import { type CSSProperties, useEffect, useRef, useState } from "react";
import AccessibleDialog from "./components/AccessibleDialog";
import KakaoChurchMap from "./components/KakaoChurchMap";
import { useSiteAuthentication } from "./components/SiteLayoutChrome";

const heroTitle = ["말씀으로 바로 서고", "사랑으로 함께하는 교회"];
const heroEyebrow = "MOHYEON JEIL CHURCH";

const heroSlides = [
  {
    image: "/assets/hero-drone-4k.webp",
    mobileImage: "/assets/hero-spring-mobile.webp",
    mobilePosition: "46% 50%",
    alt: "봄의 모현제일교회 드론 전경",
    position: "center 50%",
  },
  {
    image: "/assets/hero-sign-4k.webp",
    mobileImage: "/assets/hero-sign-mobile.webp",
    mobilePosition: "left 48%",
    alt: "모현제일교회 외벽 표지",
    position: "left 48%",
  },
  {
    image: "/assets/hero-worship-4k.webp",
    mobileImage: "/assets/hero-worship-mobile.webp",
    mobilePosition: "center 52%",
    alt: "모현제일교회 예배 모습",
    position: "center 54%",
  },
  {
    image: "/assets/hero-flowers-4k.webp",
    mobileImage: "/assets/hero-flowers-mobile.webp",
    mobilePosition: "center 42%",
    alt: "꽃밭 너머로 보이는 모현제일교회",
    position: "center 57%",
  },
  {
    image: "/assets/hero-winter-4k.webp",
    mobileImage: "/assets/hero-winter-mobile.webp",
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

type YouTubePlayer = {
  getCurrentTime: () => number;
  getDuration: () => number;
  getPlayerState: () => number;
  getVolume: () => number;
  isMuted: () => boolean;
  mute: () => void;
  pauseVideo: () => void;
  playVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  setVolume: (volume: number) => void;
  unMute: () => void;
};

type YouTubeNamespace = {
  Player: new (
    element: HTMLIFrameElement,
    options: {
      events: {
        onReady: (event: { target: YouTubePlayer }) => void;
        onStateChange?: (event: { data: number; target: YouTubePlayer }) => void;
      };
    },
  ) => YouTubePlayer;
};

type YouTubeWindow = Window & {
  YT?: YouTubeNamespace;
  onYouTubeIframeAPIReady?: () => void;
};

let youtubeApiPromise: Promise<YouTubeNamespace> | null = null;

function loadYouTubeIframeApi() {
  const youtubeWindow = window as YouTubeWindow;
  if (youtubeWindow.YT?.Player) return Promise.resolve(youtubeWindow.YT);
  if (youtubeApiPromise) return youtubeApiPromise;

  youtubeApiPromise = new Promise<YouTubeNamespace>((resolve) => {
    const previousReadyHandler = youtubeWindow.onYouTubeIframeAPIReady;
    youtubeWindow.onYouTubeIframeAPIReady = () => {
      previousReadyHandler?.();
      if (youtubeWindow.YT) resolve(youtubeWindow.YT);
    };

    if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      script.async = true;
      document.head.appendChild(script);
    }
  });

  return youtubeApiPromise;
}

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

function ResponsiveYouTubeEmbed({
  sermon,
  className,
}: {
  sermon: HomeSermon;
  className: string;
}) {
  const shellRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const playerRef = useRef<YouTubePlayer | null>(null);
  const [useCustomControls, setUseCustomControls] = useState(() =>
    typeof window !== "undefined" && window.matchMedia("(max-width: 720px)").matches,
  );
  const [mobileFrameLayout, setMobileFrameLayout] = useState<{
    width: number;
    height: number;
    scale: number;
  } | null>(null);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [hasEnded, setHasEnded] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(100);
  const [playerReady, setPlayerReady] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    const mediaQuery = window.matchMedia("(max-width: 720px)");
    const updatePlayerLayout = () => {
      const isMobile = mediaQuery.matches;
      setUseCustomControls(isMobile);
      if (isMobile && host) {
        const frameWidth = Math.max(480, host.clientWidth / 0.75);
        setMobileFrameLayout({
          width: frameWidth,
          height: frameWidth * (9 / 16),
          scale: Number((host.clientWidth / frameWidth).toFixed(4)),
        });
      } else {
        setMobileFrameLayout(null);
      }
    };

    updatePlayerLayout();
    const resizeObserver = new ResizeObserver(updatePlayerLayout);
    if (host) resizeObserver.observe(host);
    mediaQuery.addEventListener("change", updatePlayerLayout);
    window.addEventListener("orientationchange", updatePlayerLayout);

    return () => {
      resizeObserver.disconnect();
      mediaQuery.removeEventListener("change", updatePlayerLayout);
      window.removeEventListener("orientationchange", updatePlayerLayout);
    };
  }, []);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;

    let disposed = false;
    let progressTimer: number | undefined;

    loadYouTubeIframeApi().then((youtube) => {
      if (disposed || !frame.isConnected) return;

      new youtube.Player(frame, {
        events: {
          onReady: ({ target }) => {
            if (disposed) return;
            playerRef.current = target;
            setPlayerReady(true);

            const syncProgress = () => {
              const nextDuration = target.getDuration();
              const nextCurrentTime = target.getCurrentTime();
              if (Number.isFinite(nextDuration)) setDuration(nextDuration);
              if (Number.isFinite(nextCurrentTime)) setCurrentTime(nextCurrentTime);
              setIsPlaying(target.getPlayerState() === 1);
              setIsMuted(target.isMuted());
              setVolume(target.getVolume());
            };

            syncProgress();
            progressTimer = window.setInterval(syncProgress, 500);
          },
          onStateChange: ({ data }) => {
            setIsPlaying(data === 1);
            if (data === 0) setHasEnded(true);
            if (data === 1) setHasEnded(false);
          },
        },
      });
    });

    return () => {
      disposed = true;
      playerRef.current = null;
      if (progressTimer !== undefined) window.clearInterval(progressTimer);
    };
  }, []);

  const maxSeekTime = Math.max(duration, 1);
  const safeCurrentTime = Math.min(currentTime, maxSeekTime);
  const seekProgress = duration > 0 ? (safeCurrentTime / duration) * 100 : 0;
  const seekStyle = { "--seek-progress": `${seekProgress}%` } as CSSProperties;
  const seekTo = (value: string, allowSeekAhead: boolean) => {
    const nextTime = Number(value);
    if (!Number.isFinite(nextTime)) return;
    setCurrentTime(nextTime);
    playerRef.current?.seekTo(nextTime, allowSeekAhead);
  };
  const seekFromPointer = (
    event: React.PointerEvent<HTMLInputElement>,
    allowSeekAhead: boolean,
  ) => {
    if (!playerReady || duration <= 0) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const position = Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width));
    seekTo(String(position * duration), allowSeekAhead);
  };
  const startPointerControl = (
    event: React.PointerEvent<HTMLInputElement>,
    update: (event: React.PointerEvent<HTMLInputElement>) => void,
  ) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    update(event);
  };
  const updateVolume = (nextVolume: number) => {
    const safeVolume = Math.min(100, Math.max(0, nextVolume));
    setVolume(safeVolume);
    playerRef.current?.setVolume(safeVolume);
    if (safeVolume > 0) {
      playerRef.current?.unMute();
      setIsMuted(false);
    }
  };
  const volumeFromPointer = (event: React.PointerEvent<HTMLInputElement>) => {
    if (!playerReady) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const position = Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width));
    updateVolume(position * 100);
  };
  const togglePlayback = () => {
    if (isPlaying) {
      playerRef.current?.pauseVideo();
    } else {
      if (hasEnded) {
        playerRef.current?.seekTo(0, true);
        setCurrentTime(0);
        setHasEnded(false);
      }
      playerRef.current?.playVideo();
    }
    setIsPlaying((playing) => !playing);
  };
  const toggleMute = () => {
    if (isMuted || volume === 0) {
      const restoredVolume = volume > 0 ? volume : 60;
      playerRef.current?.unMute();
      playerRef.current?.setVolume(restoredVolume);
      setVolume(restoredVolume);
      setIsMuted(false);
    } else {
      playerRef.current?.mute();
      setIsMuted(true);
    }
  };
  const openFullscreen = () => {
    shellRef.current?.requestFullscreen?.();
  };

  const formatTime = (seconds: number) => {
    const safeSeconds = Math.max(0, Math.floor(seconds));
    const minutes = Math.floor(safeSeconds / 60);
    return `${minutes}:${String(safeSeconds % 60).padStart(2, "0")}`;
  };

  const frameStyle: CSSProperties | undefined = useCustomControls
    ? {
        pointerEvents: "auto",
        ...(mobileFrameLayout !== null
          ? {
              width: mobileFrameLayout.width,
              height: mobileFrameLayout.height,
              transform: `scale(${mobileFrameLayout.scale})`,
              transformOrigin: "top left",
            }
          : {}),
      }
    : undefined;

  return (
    <div ref={shellRef} className="youtube-inline-player-shell">
      <div
        ref={hostRef}
        className={`${className} is-playing${hasEnded ? " is-ended" : ""}`}
      >
        <iframe
          ref={frameRef}
          src={`https://www.youtube-nocookie.com/embed/${sermon.videoId}?autoplay=1&rel=0&controls=1&fs=1&playsinline=1&hl=ko&enablejsapi=1&iv_load_policy=3&disablekb=0`}
          title={`${sermon.title} 설교 영상`}
          style={frameStyle}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      </div>
      <div className={`mobile-youtube-controls${useCustomControls ? " is-enabled" : ""}`}>
        <button
          type="button"
          className="mobile-youtube-control-button"
          onClick={togglePlayback}
          disabled={!playerReady}
          aria-label={isPlaying ? "영상 일시정지" : "영상 재생"}
        >
          <span aria-hidden="true">{isPlaying ? "Ⅱ" : "▶"}</span>
        </button>
        <output aria-label="현재 재생 시간">{formatTime(safeCurrentTime)}</output>
        <label className="mobile-youtube-seek">
          <span className="sr-only">영상 재생 위치</span>
          <input
            type="range"
            min="0"
            max={maxSeekTime}
            step="1"
            value={safeCurrentTime}
            style={seekStyle}
            disabled={!playerReady || duration <= 0}
            onPointerDown={(event) =>
              startPointerControl(event, (pointerEvent) => seekFromPointer(pointerEvent, true))
            }
            onPointerMove={(event) => {
              if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                seekFromPointer(event, false);
              }
            }}
            onChange={(event) => seekTo(event.currentTarget.value, false)}
            onPointerUp={(event) => {
              seekFromPointer(event, true);
              event.currentTarget.releasePointerCapture(event.pointerId);
            }}
            onKeyUp={(event) => seekTo(event.currentTarget.value, true)}
            aria-label="영상 재생 위치 이동"
          />
        </label>
        <output aria-label="전체 영상 시간">{formatTime(duration)}</output>
        <button
          type="button"
          className="mobile-youtube-control-button is-sound"
          onClick={toggleMute}
          disabled={!playerReady}
          aria-label={isMuted || volume === 0 ? "영상 소리 켜기" : "영상 음소거"}
        >
          <span aria-hidden="true">{isMuted || volume === 0 ? "끔" : "소리"}</span>
        </button>
        <label className="mobile-youtube-volume">
          <span className="sr-only">영상 음량</span>
          <input
            type="range"
            min="0"
            max="100"
            step="1"
            value={isMuted ? 0 : volume}
            style={{ "--volume-progress": `${isMuted ? 0 : volume}%` } as CSSProperties}
            disabled={!playerReady}
            onPointerDown={(event) => startPointerControl(event, volumeFromPointer)}
            onPointerMove={(event) => {
              if (event.currentTarget.hasPointerCapture(event.pointerId)) volumeFromPointer(event);
            }}
            onPointerUp={(event) => {
              volumeFromPointer(event);
              event.currentTarget.releasePointerCapture(event.pointerId);
            }}
            onChange={(event) => updateVolume(Number(event.currentTarget.value))}
            aria-label="영상 음량 조절"
          />
        </label>
        <button
          type="button"
          className="mobile-youtube-control-button is-fullscreen"
          onClick={openFullscreen}
          disabled={!playerReady}
          aria-label="영상 전체화면"
        >
          <span aria-hidden="true">⛶</span>
        </button>
      </div>
    </div>
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
    return <ResponsiveYouTubeEmbed sermon={sermon} className={className} />;
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
  const authenticated = useSiteAuthentication();
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installPanelOpen, setInstallPanelOpen] = useState(false);
  const [installHelp, setInstallHelp] = useState("");
  const [openInChrome, setOpenInChrome] = useState(false);
  const [signupOpen, setSignupOpen] = useState(false);
  const [signupNoticeChecked, setSignupNoticeChecked] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
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
      navigator.serviceWorker.register("/sw.js").then((registration) => {
        if (registration.waiting && navigator.serviceWorker.controller) {
          setWaitingWorker(registration.waiting);
        }
        registration.addEventListener("updatefound", () => {
          const worker = registration.installing;
          worker?.addEventListener("statechange", () => {
            if (worker.state === "installed" && navigator.serviceWorker.controller) {
              setWaitingWorker(worker);
            }
          });
        });
      }).catch(() => undefined);
    }

    return () => {
      window.clearTimeout(initializeInstallUi);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 720px)");
    let timer = 0;
    const evaluate = () => {
      window.clearTimeout(timer);
      if (authenticated === null) {
        setSignupOpen(false);
        return;
      }
      timer = window.setTimeout(() => {
        setSignupNoticeChecked(true);
        if (authenticated || !mediaQuery.matches) {
          setSignupOpen(false);
          return;
        }
        const localDate = new Intl.DateTimeFormat("en-CA", {
          timeZone: "Asia/Seoul",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(new Date());
        let suppressed = false;
        try {
          suppressed =
            window.localStorage.getItem("mhji-member-signup-completed") === "1" ||
            window.localStorage.getItem("mhji-signup-notice-hide-date") === localDate ||
            window.sessionStorage.getItem("mhji-signup-notice-session-dismissed") === "1";
        } catch {
          // Storage can be unavailable in strict privacy modes; the notice still remains usable.
        }
        if (suppressed) return;
        setInstallPanelOpen(false);
        setSignupOpen(true);
      }, authenticated || !mediaQuery.matches ? 0 : 850);
    };
    evaluate();
    mediaQuery.addEventListener("change", evaluate);
    return () => {
      window.clearTimeout(timer);
      mediaQuery.removeEventListener("change", evaluate);
    };
  }, [authenticated]);

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

  const activateUpdate = () => {
    if (!waitingWorker) return;
    let reloading = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    });
    waitingWorker.postMessage({ type: "SKIP_WAITING" });
  };

  const closeSignupNotice = () => {
    try {
      window.sessionStorage.setItem("mhji-signup-notice-session-dismissed", "1");
    } catch {
      // Closing the notice must still work when browser storage is unavailable.
    }
    setSignupOpen(false);
  };

  const hideSignupNoticeToday = () => {
    const localDate = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    try {
      window.localStorage.setItem("mhji-signup-notice-hide-date", localDate);
      window.sessionStorage.setItem("mhji-signup-notice-session-dismissed", "1");
    } catch {
      // The current notice can still be closed even when persistence is unavailable.
    }
    setSignupOpen(false);
  };

  return (
    <div className="home-floating-actions">
      {waitingWorker && !signupOpen && !installPanelOpen && (
        <div className="home-update-notice" role="status">
          <span>새 버전이 있습니다</span>
          <button type="button" onClick={activateUpdate}>새로고침</button>
        </div>
      )}
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
      {!installed && signupNoticeChecked && !signupOpen && (
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
      {!installed && signupNoticeChecked && installPanelOpen && !signupOpen && (
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
      <AccessibleDialog
        open={signupOpen}
        onClose={closeSignupNotice}
        labelledBy="home-signup-title"
        describedBy="home-signup-description"
        className="home-signup-sheet"
      >
        <button
          className="home-signup-close"
          type="button"
          onClick={closeSignupNotice}
          aria-label="회원가입 안내 닫기"
        >
          ×
        </button>
        <h2 id="home-signup-title">교인 회원가입 안내</h2>
        <p id="home-signup-description">
          이름으로 간편하게 가입할 수 있습니다.
        </p>
        <div className="home-signup-actions">
          <a data-dialog-autofocus className="is-primary" href="/member/signup">
            회원가입 신청하기
          </a>
          <a className="is-secondary" href="/member/signup?guide=1">
            가입 방법 보기
          </a>
        </div>
        <a className="home-signup-login" href="/member/login">
          가입하셨나요? <strong>로그인</strong>
        </a>
        <button className="home-signup-today" type="button" onClick={hideSignupNoticeToday}>
          오늘 그만 보기
        </button>
      </AccessibleDialog>
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
                <source media="(max-width: 720px)" srcSet={slide.mobileImage} />
                <img
                  src={slide.image}
                  alt={index === activeSlide ? slide.alt : ""}
                  loading={index === 0 ? "eager" : "lazy"}
                  fetchPriority={index === 0 ? "high" : "auto"}
                  decoding="async"
                  sizes="100vw"
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
