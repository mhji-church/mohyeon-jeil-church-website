"use client";

import { useEffect, useRef, useState } from "react";

const CHURCH = {
  name: "모현제일교회",
  address: "경기도 용인시 처인구 모현읍 백옥대로 2318-22",
  latitude: 37.329084758692,
  longitude: 127.24614700064,
} as const;

const KAKAO_MAP_LINK = `https://map.kakao.com/link/map/${encodeURIComponent(CHURCH.name)},${CHURCH.latitude},${CHURCH.longitude}`;
const KAKAO_ROUTE_LINK = `https://map.kakao.com/link/to/${encodeURIComponent(CHURCH.name)},${CHURCH.latitude},${CHURCH.longitude}`;
// Kakao's JavaScript key is a browser-visible identifier protected by the
// registered localhost/mhji.kr domains. Keep this fallback for Netlify builds
// while allowing local or future hosting environments to override it.
const PUBLIC_KAKAO_MAP_JAVASCRIPT_KEY = "664a0b3b20cab4b918b59a334ad4d881";

type KakaoMapInstance = {
  addControl(control: unknown, position: unknown): void;
  relayout(): void;
  setCenter(position: unknown): void;
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
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
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
    };
  }, [appKey]);

  return (
    <div className="kakao-map-shell">
      <div
        className="kakao-map-canvas"
        ref={containerRef}
        role="application"
        aria-label={`${CHURCH.name} 주변 카카오 지도. 마우스나 손가락으로 확대, 축소, 이동할 수 있습니다.`}
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
        <a href={KAKAO_ROUTE_LINK} target="_blank" rel="noreferrer">
          길찾기
        </a>
      </div>

      <p className="kakao-map-mobile-hint" aria-hidden="true">
        두 손가락으로 확대·축소할 수 있습니다
      </p>
    </div>
  );
}
