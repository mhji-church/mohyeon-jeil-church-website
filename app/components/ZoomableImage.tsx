"use client";

import { useEffect, useRef, useState } from "react";

type Transform = {
  scale: number;
  x: number;
  y: number;
};

type Point = {
  x: number;
  y: number;
};

const MIN_SCALE = 1;
const MAX_SCALE = 5;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function distance(first: Point, second: Point) {
  return Math.hypot(second.x - first.x, second.y - first.y);
}

function center(first: Point, second: Point) {
  return {
    x: (first.x + second.x) / 2,
    y: (first.y + second.y) / 2,
  };
}

export default function ZoomableImage({
  src,
  alt,
  className = "",
  onSwipe,
}: {
  src: string;
  alt: string;
  className?: string;
  onSwipe?: (direction: "next" | "prev") => void;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, Point>());
  const lastPoint = useRef<Point | null>(null);
  const pinchDistance = useRef<number | null>(null);
  const pinchCenter = useRef<Point | null>(null);
  const swipeStart = useRef<Point | null>(null);
  const transformRef = useRef<Transform>({ scale: 1, x: 0, y: 0 });
  const [transform, setTransform] = useState<Transform>({ scale: 1, x: 0, y: 0 });

  const commit = (next: Transform) => {
    const scale = clamp(next.scale, MIN_SCALE, MAX_SCALE);
    const viewport = viewportRef.current;
    const maxX = viewport ? ((scale - 1) * viewport.clientWidth) / 2 : 0;
    const maxY = viewport ? ((scale - 1) * viewport.clientHeight) / 2 : 0;
    const value = {
      scale,
      x: scale === 1 ? 0 : clamp(next.x, -maxX, maxX),
      y: scale === 1 ? 0 : clamp(next.y, -maxY, maxY),
    };
    transformRef.current = value;
    setTransform(value);
  };

  const setScale = (nextScale: number, anchor?: Point) => {
    const current = transformRef.current;
    const scale = clamp(nextScale, MIN_SCALE, MAX_SCALE);
    if (!anchor) {
      commit({ ...current, scale });
      return;
    }
    const ratio = scale / current.scale;
    commit({
      scale,
      x: anchor.x - ratio * (anchor.x - current.x),
      y: anchor.y - ratio * (anchor.y - current.y),
    });
  };

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      event.stopPropagation();
      const rect = viewport.getBoundingClientRect();
      const anchor = {
        x: event.clientX - rect.left - rect.width / 2,
        y: event.clientY - rect.top - rect.height / 2,
      };
      const factor = event.deltaY < 0 ? 1.16 : 1 / 1.16;
      setScale(transformRef.current.scale * factor, anchor);
    };
    const blockTouchScroll = (event: TouchEvent) => {
      if (event.touches.length > 0) event.preventDefault();
    };

    viewport.addEventListener("wheel", handleWheel, { passive: false });
    viewport.addEventListener("touchmove", blockTouchScroll, { passive: false });
    return () => {
      viewport.removeEventListener("wheel", handleWheel);
      viewport.removeEventListener("touchmove", blockTouchScroll);
    };
  });

  return (
    <div className={`zoomable-image ${className}`.trim()}>
      <div
        className={`zoomable-image-viewport${transform.scale > 1 ? " is-zoomed" : ""}`}
        ref={viewportRef}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          const point = { x: event.clientX, y: event.clientY };
          pointers.current.set(event.pointerId, point);
          lastPoint.current = point;
          if (pointers.current.size === 1) swipeStart.current = point;
          if (pointers.current.size === 2) {
            const [first, second] = [...pointers.current.values()];
            pinchDistance.current = distance(first, second);
            pinchCenter.current = center(first, second);
            swipeStart.current = null;
          }
        }}
        onPointerMove={(event) => {
          if (!pointers.current.has(event.pointerId)) return;
          const point = { x: event.clientX, y: event.clientY };
          pointers.current.set(event.pointerId, point);

          if (pointers.current.size >= 2) {
            const [first, second] = [...pointers.current.values()];
            const nextDistance = distance(first, second);
            const nextCenter = center(first, second);
            const previousDistance = pinchDistance.current;
            const previousCenter = pinchCenter.current;
            if (previousDistance && previousCenter) {
              const current = transformRef.current;
              commit({
                scale: current.scale * (nextDistance / previousDistance),
                x: current.x + nextCenter.x - previousCenter.x,
                y: current.y + nextCenter.y - previousCenter.y,
              });
            }
            pinchDistance.current = nextDistance;
            pinchCenter.current = nextCenter;
            return;
          }

          if (transformRef.current.scale > 1 && lastPoint.current) {
            const current = transformRef.current;
            commit({
              ...current,
              x: current.x + point.x - lastPoint.current.x,
              y: current.y + point.y - lastPoint.current.y,
            });
          }
          lastPoint.current = point;
        }}
        onPointerUp={(event) => {
          const endPoint = pointers.current.get(event.pointerId);
          if (
            transformRef.current.scale === 1 &&
            swipeStart.current &&
            endPoint &&
            onSwipe
          ) {
            const deltaX = endPoint.x - swipeStart.current.x;
            const deltaY = endPoint.y - swipeStart.current.y;
            if (Math.abs(deltaX) >= 55 && Math.abs(deltaX) > Math.abs(deltaY)) {
              onSwipe(deltaX < 0 ? "next" : "prev");
            }
          }
          pointers.current.delete(event.pointerId);
          const remaining = [...pointers.current.values()];
          lastPoint.current = remaining[0] ?? null;
          pinchDistance.current = null;
          pinchCenter.current = null;
          swipeStart.current = null;
        }}
        onPointerCancel={(event) => {
          pointers.current.delete(event.pointerId);
          lastPoint.current = null;
          pinchDistance.current = null;
          pinchCenter.current = null;
          swipeStart.current = null;
        }}
        onDoubleClick={() => {
          if (transformRef.current.scale > 1) {
            commit({ scale: 1, x: 0, y: 0 });
          } else {
            setScale(2);
          }
        }}
      >
        <img
          src={src}
          alt={alt}
          decoding="async"
          draggable={false}
          style={{
            transform: `translate3d(${transform.x}px, ${transform.y}px, 0) scale(${transform.scale})`,
          }}
        />
      </div>

      <div className="zoom-controls" aria-label="이미지 확대 및 축소">
        <button
          type="button"
          onClick={() => setScale(transformRef.current.scale / 1.25)}
          disabled={transform.scale <= MIN_SCALE}
          aria-label="축소"
        >
          −
        </button>
        <output aria-live="polite">{Math.round(transform.scale * 100)}%</output>
        <button
          type="button"
          onClick={() => setScale(transformRef.current.scale * 1.25)}
          disabled={transform.scale >= MAX_SCALE}
          aria-label="확대"
        >
          +
        </button>
        <button
          className="zoom-reset"
          type="button"
          onClick={() => commit({ scale: 1, x: 0, y: 0 })}
          disabled={transform.scale === 1}
        >
          원래 크기
        </button>
      </div>
    </div>
  );
}
