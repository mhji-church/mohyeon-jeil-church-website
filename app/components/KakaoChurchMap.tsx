"use client";

import { useEffect, useRef, useState } from "react";

const CHURCH = {
  name: "모현제일교회",
  address: "경기도 용인시 처인구 모현읍 백옥대로 2318-22",
  latitude: 37.329084758692,
  longitude: 127.24614700064,
} as const;

const KAKAO_MAP_LINK = `https://map.kakao.com/link/map/${encodeURIComponent(CHURCH.name)},${CHURCH.latitude},${CHURCH.longitude}`;
const MAP_SCROLL_IDLE_MS = 650;
const MAP_INTERACTION_TIMEOUT_MS = 5000;
const MAP_TOUCH_INTERACTION_TIMEOUT_MS = 10000;
// Kakao's JavaScript key is a browser-visible identifier protected by the
// registered localhost/mhji.kr domains. Keep this fallback for Netlify builds
// while allowing local or future hosting environments to override it.
const PUBLIC_KAKAO_MAP_JAVASCRIPT_KEY = "664a0b3b20cab4b918b59a334ad4d881";

type KakaoMapInstance = {
  addControl(control: unknown, position: unknown): void;
  relayout(): void;
  setCenter(position: unknown): void;
  setDraggable(draggable: boolean): void;
  setZoomable(zoomable: boolean): void;
};

type KakaoMapsApi = {
  load(callback: () => void): void;
  LatLng: new (latitude: number, longitude: number) => unknown;
  Map: new (
    container: HTMLElement,
    options: { center: unknown; level: number },
  ) => KakaoMapInstance;
  CustomOverlay: new (options: {
    map: KakaoMapInstance;
    position: unknown;
    content: HTMLElement;
    xAnchor: number;
    yAnchor: number;
    zIndex: number;
  }) => unknown;
  ZoomControl: new () => unknown;
  ControlPosition: { RIGHT: unknown };
  services?: {
    Places: new () => {
      keywordSearch(
        query: string,
        callback: (results: KakaoPlace[], status: string) => void,
        options?: { location?: unknown; radius?: number },
      ): void;
    };
    Status: { OK: string };
  };
};

type KakaoPlace = {
  place_name: string;
  address_name: string;
  road_address_name: string;
  x: string;
  y: string;
};

declare global {
  interface Window {
    kakao?: { maps: KakaoMapsApi };
  }
}

let mapsPromise: Promise<KakaoMapsApi> | null = null;

function loadKakaoMaps(appKey: string) {
  if (window.kakao?.maps) {
    return new Promise<KakaoMapsApi>((resolve) => {
      window.kakao?.maps.load(() => resolve(window.kakao!.maps));
    });
  }

  if (mapsPromise) return mapsPromise;

  mapsPromise = new Promise<KakaoMapsApi>((resolve, reject) => {
    const scriptId = "kakao-map-sdk";
    const existingScript = document.getElementById(scriptId) as HTMLScriptElement | null;
    const script = existingScript ?? document.createElement("script");

    const handleLoad = () => {
      if (!window.kakao?.maps) {
        reject(new Error("카카오 지도 SDK를 불러오지 못했습니다."));
        return;
      }
      window.kakao.maps.load(() => resolve(window.kakao!.maps));
    };

    script.addEventListener("load", handleLoad, { once: true });
    script.addEventListener(
      "error",
      () => reject(new Error("카카오 지도 SDK 연결에 실패했습니다.")),
      { once: true },
    );

    if (!existingScript) {
      script.id = scriptId;
      script.async = true;
      script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(appKey)}&autoload=false&libraries=services`;
      document.head.appendChild(script);
    }
  });

  return mapsPromise;
}

function createChurchMarker() {
  const marker = document.createElement("a");
  marker.className = "kakao-church-marker";
  marker.href = KAKAO_MAP_LINK;
  marker.target = "_blank";
  marker.rel = "noreferrer";
  marker.setAttribute("aria-label", "카카오맵에서 모현제일교회 위치 보기");

  const logoWrap = document.createElement("span");
  logoWrap.className = "kakao-church-marker-logo";
  const symbolCrop = document.createElement("span");
  symbolCrop.className = "kakao-church-marker-symbol";
  symbolCrop.setAttribute("aria-hidden", "true");
  logoWrap.appendChild(symbolCrop);

  marker.appendChild(logoWrap);
  return marker;
}

function findChurchPosition(maps: KakaoMapsApi) {
  const fallback = new maps.LatLng(CHURCH.latitude, CHURCH.longitude);
  const services = maps.services;
  if (!services) return Promise.resolve(fallback);

  const places = new services.Places();

  return new Promise<unknown>((resolve) => {
    places.keywordSearch(
      CHURCH.name,
      (results, status) => {
        if (status !== services.Status.OK || results.length === 0) {
          resolve(fallback);
          return;
        }

        const church =
          results.find(
            (place) =>
              place.road_address_name.includes("백옥대로 2318-22") ||
              place.address_name.includes("갈담리 291"),
          ) ?? results.find((place) => place.place_name === CHURCH.name) ?? results[0];
        resolve(new maps.LatLng(Number(church.y), Number(church.x)));
      },
      { location: fallback, radius: 3000 },
    );
  });
}

export default function KakaoChurchMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const interactionControlRef = useRef<(enabled: boolean) => void>(() => {});
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [isMapInteractive, setIsMapInteractive] = useState(false);
  const appKey =
    process.env.NEXT_PUBLIC_KAKAO_MAP_JAVASCRIPT_KEY?.trim() ||
    PUBLIC_KAKAO_MAP_JAVASCRIPT_KEY;

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !appKey) {
      setStatus("error");
      return;
    }

    let cancelled = false;
    let removeResizeListener = () => {};
    let removeInteractionListeners = () => {};

    loadKakaoMaps(appKey)
      .then(async (maps) => {
        if (cancelled || !containerRef.current) return;

        const position = await findChurchPosition(maps);
        if (cancelled || !containerRef.current) return;
        const map = new maps.Map(containerRef.current, {
          center: position,
          level: 5,
        });
        const zoomControl = new maps.ZoomControl();
        map.addControl(zoomControl, maps.ControlPosition.RIGHT);
        new maps.CustomOverlay({
          map,
          position,
          content: createChurchMarker(),
          xAnchor: 0.5,
          yAnchor: 1,
          zIndex: 10,
        });

        const mapContainer = containerRef.current;
        let pointerInside = false;
        let interactionActive = true;
        let lastPageWheelAt = performance.now();
        let interactionTimer: number | undefined;

        const clearInteractionTimer = () => {
          if (interactionTimer !== undefined) {
            window.clearTimeout(interactionTimer);
            interactionTimer = undefined;
          }
        };
        const setMapInteraction = (enabled: boolean) => {
          if (interactionActive === enabled) return;
          interactionActive = enabled;
          map.setZoomable(enabled);
          map.setDraggable(enabled);
          mapContainer.dataset.interactive = String(enabled);
          setIsMapInteractive(enabled);
        };
        const scheduleInteractionTimeout = (delay = MAP_INTERACTION_TIMEOUT_MS) => {
          clearInteractionTimer();
          interactionTimer = window.setTimeout(() => {
            setMapInteraction(false);
          }, delay);
        };
        interactionControlRef.current = (enabled) => {
          clearInteractionTimer();
          setMapInteraction(enabled);
          if (enabled) scheduleInteractionTimeout(MAP_TOUCH_INTERACTION_TIMEOUT_MS);
        };
        const activateDesktopMap = () => {
          if (!pointerInside) return;
          if (performance.now() - lastPageWheelAt < MAP_SCROLL_IDLE_MS) return;
          setMapInteraction(true);
          scheduleInteractionTimeout();
        };
        const handleWindowWheel = (event: WheelEvent) => {
          const wheelInsideMap = event.target instanceof Node && mapContainer.contains(event.target);
          if (wheelInsideMap && interactionActive) {
            scheduleInteractionTimeout();
            return;
          }

          lastPageWheelAt = performance.now();
          if (interactionActive) setMapInteraction(false);
        };
        const handlePointerEnter = (event: PointerEvent) => {
          if (event.pointerType === "touch") return;
          pointerInside = true;
          activateDesktopMap();
        };
        const handlePointerMove = (event: PointerEvent) => {
          if (event.pointerType === "touch") return;
          pointerInside = true;
          activateDesktopMap();
        };
        const handlePointerLeave = (event: PointerEvent) => {
          if (event.pointerType === "touch") return;
          pointerInside = false;
          clearInteractionTimer();
          setMapInteraction(false);
        };
        const handleTouchStart = (event: TouchEvent) => {
          if (event.touches.length < 2) {
            if (interactionActive) {
              scheduleInteractionTimeout(MAP_TOUCH_INTERACTION_TIMEOUT_MS);
            }
            return;
          }
          setMapInteraction(true);
          scheduleInteractionTimeout(MAP_TOUCH_INTERACTION_TIMEOUT_MS);
        };
        const handleTouchMove = () => {
          if (interactionActive) {
            scheduleInteractionTimeout(MAP_TOUCH_INTERACTION_TIMEOUT_MS);
          }
        };
        const handleTouchEnd = () => {
          if (interactionActive) {
            scheduleInteractionTimeout(MAP_TOUCH_INTERACTION_TIMEOUT_MS);
          }
        };

        setMapInteraction(false);
        window.addEventListener("wheel", handleWindowWheel, { capture: true, passive: true });
        mapContainer.addEventListener("pointerenter", handlePointerEnter);
        mapContainer.addEventListener("pointermove", handlePointerMove);
        mapContainer.addEventListener("pointerleave", handlePointerLeave);
        mapContainer.addEventListener("touchstart", handleTouchStart, {
          capture: true,
          passive: true,
        });
        mapContainer.addEventListener("touchmove", handleTouchMove, { capture: true });
        mapContainer.addEventListener("touchend", handleTouchEnd, { capture: true });
        mapContainer.addEventListener("touchcancel", handleTouchEnd, { capture: true });
        removeInteractionListeners = () => {
          clearInteractionTimer();
          window.removeEventListener("wheel", handleWindowWheel, { capture: true });
          mapContainer.removeEventListener("pointerenter", handlePointerEnter);
          mapContainer.removeEventListener("pointermove", handlePointerMove);
          mapContainer.removeEventListener("pointerleave", handlePointerLeave);
          mapContainer.removeEventListener("touchstart", handleTouchStart, { capture: true });
          mapContainer.removeEventListener("touchmove", handleTouchMove, { capture: true });
          mapContainer.removeEventListener("touchend", handleTouchEnd, { capture: true });
          mapContainer.removeEventListener("touchcancel", handleTouchEnd, { capture: true });
        };

        const handleResize = () => {
          map.relayout();
          map.setCenter(position);
        };
        window.addEventListener("resize", handleResize);
        removeResizeListener = () => window.removeEventListener("resize", handleResize);
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });

    return () => {
      cancelled = true;
      removeResizeListener();
      removeInteractionListeners();
      interactionControlRef.current = () => {};
    };
  }, [appKey]);

  return (
    <div className="kakao-map-shell">
      <div
        className="kakao-map-canvas"
        ref={containerRef}
        role="region"
        aria-describedby="kakao-map-interaction-hint"
        aria-label={`${CHURCH.name} 주변 카카오 지도`}
      />

      {status !== "ready" && (
        <div className={`kakao-map-status${status === "error" ? " is-error" : ""}`}>
          <img src="/assets/church-map.png" alt="모현제일교회 위치 지도" />
          <p>{status === "error" ? "지도를 불러오지 못했습니다." : "지도를 불러오는 중입니다."}</p>
        </div>
      )}

      <div className="kakao-map-actions" aria-label="지도 바로가기">
        <a href={KAKAO_MAP_LINK} target="_blank" rel="noreferrer">
          큰 지도 보기
        </a>
      </div>

      <p
        id="kakao-map-interaction-hint"
        className={`kakao-map-interaction-hint${isMapInteractive ? " is-active" : ""}`}
      >
        <span className="kakao-map-desktop-hint">
          {isMapInteractive
            ? "지도 조작 중 · 바깥으로 이동하면 페이지 스크롤"
            : "페이지 스크롤 우선 · 마우스를 움직이면 지도 조작"}
        </span>
      </p>

      {status === "ready" && (
        <button
          className={`kakao-map-touch-toggle${isMapInteractive ? " is-active" : ""}`}
          type="button"
          aria-pressed={isMapInteractive}
          aria-label={
            isMapInteractive
              ? "지도 조작을 끝내고 페이지 스크롤로 돌아가기"
              : "지도를 활성화하고 한 손가락으로 위치 움직이기"
          }
          onClick={() => interactionControlRef.current(!isMapInteractive)}
        >
          <strong>{isMapInteractive ? "페이지 스크롤로 돌아가기" : "지도 움직이기"}</strong>
          <span>{isMapInteractive ? "누르면 지도 조작 해제" : "누른 뒤 한 손가락으로 이동"}</span>
        </button>
      )}
    </div>
  );
}
