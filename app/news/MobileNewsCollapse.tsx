"use client";

import { useEffect } from "react";

export default function NewsAccordionController({ enabled }: { enabled: boolean }) {
  useEffect(() => {
    const cards = Array.from(
      document.querySelectorAll<HTMLDetailsElement>(
        ".church-news-list .church-news-card",
      ),
    );

    if (enabled && window.matchMedia("(max-width: 760px)").matches) {
      const firstOpenCard = cards.find((card) => card.open);
      if (firstOpenCard) firstOpenCard.open = false;
    }

    const keepSingleCardOpen = (event: Event) => {
      const current = event.currentTarget as HTMLDetailsElement;
      if (!current.open) return;
      cards.forEach((card) => {
        if (card !== current) card.open = false;
      });
    };

    cards.forEach((card) => card.addEventListener("toggle", keepSingleCardOpen));
    return () => {
      cards.forEach((card) => card.removeEventListener("toggle", keepSingleCardOpen));
    };
  }, [enabled]);

  return null;
}
