"use client";

import { useCallback, useEffect, useState, type RefObject } from "react";

type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void>;
};

function getFullscreenElement() {
  const doc = document as Document & { webkitFullscreenElement?: Element | null };
  return doc.fullscreenElement ?? doc.webkitFullscreenElement ?? null;
}

async function requestFullscreen(element: HTMLElement) {
  const el = element as FullscreenElement;
  if (el.requestFullscreen) {
    await el.requestFullscreen();
    return;
  }
  if (el.webkitRequestFullscreen) {
    await el.webkitRequestFullscreen();
  }
}

async function exitFullscreen() {
  const doc = document as Document & { webkitExitFullscreen?: () => Promise<void> };
  if (doc.exitFullscreen) {
    await doc.exitFullscreen();
    return;
  }
  if (doc.webkitExitFullscreen) {
    await doc.webkitExitFullscreen();
  }
}

export function usePanelFullscreen(containerRef: RefObject<HTMLElement | null>) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [supportsFullscreen, setSupportsFullscreen] = useState(false);

  useEffect(() => {
    setSupportsFullscreen(
      document.fullscreenEnabled ||
        (document as Document & { webkitFullscreenEnabled?: boolean }).webkitFullscreenEnabled ===
          true,
    );
  }, []);

  useEffect(() => {
    const sync = () => {
      const el = containerRef.current;
      setIsFullscreen(Boolean(el && getFullscreenElement() === el));
    };

    sync();
    document.addEventListener("fullscreenchange", sync);
    document.addEventListener("webkitfullscreenchange", sync as EventListener);
    return () => {
      document.removeEventListener("fullscreenchange", sync);
      document.removeEventListener("webkitfullscreenchange", sync as EventListener);
    };
  }, [containerRef]);

  const toggleFullscreen = useCallback(async () => {
    const el = containerRef.current;
    if (!el || !supportsFullscreen) return;

    try {
      if (getFullscreenElement() === el) {
        await exitFullscreen();
      } else {
        await requestFullscreen(el);
      }
    } catch {
      // Browser may block fullscreen without a direct user gesture.
    }
  }, [containerRef, supportsFullscreen]);

  return { isFullscreen, toggleFullscreen, supportsFullscreen };
}
