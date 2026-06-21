"use client";

import { Image, ImageOff } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  COURTS_VIEW_DESKTOP_MEDIA,
  isCourtsViewDesktopViewport,
} from "@/lib/courts-view-viewport";
import { cn } from "@/lib/utils";
import type { CourtsViewLayout } from "@/components/game/courts-view-layout-toggle";

export const COURTS_VIEW_PHOTOS_STORAGE_KEY = "ccf-courts-view-photos";
export const COURTS_VIEW_PHOTOS_BY_SESSION_STORAGE_KEY = "ccf-courts-view-photos-by-session";

export function defaultCourtsViewShowPhotos(): boolean {
  return true;
}

function parseCourtsViewShowPhotos(value: unknown): boolean | null {
  if (value === true || value === "true") return true;
  if (value === false || value === "false") return false;
  return null;
}

function loadCourtsViewPhotosMap(): Record<string, boolean> {
  if (typeof window === "undefined") return {};

  try {
    const raw = localStorage.getItem(COURTS_VIEW_PHOTOS_BY_SESSION_STORAGE_KEY);
    if (!raw) return {};

    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};

    const map: Record<string, boolean> = {};
    for (const [gameId, showPhotos] of Object.entries(parsed)) {
      const parsedShowPhotos = parseCourtsViewShowPhotos(showPhotos);
      if (parsedShowPhotos != null) map[gameId] = parsedShowPhotos;
    }
    return map;
  } catch {
    return {};
  }
}

export function loadCourtsViewShowPhotos(): boolean {
  if (typeof window === "undefined") return defaultCourtsViewShowPhotos();
  if (!isCourtsViewDesktopViewport()) return true;

  const stored = localStorage.getItem(COURTS_VIEW_PHOTOS_STORAGE_KEY);
  return parseCourtsViewShowPhotos(stored) ?? defaultCourtsViewShowPhotos();
}

export function loadCourtsViewShowPhotosForSession(gameId: string): boolean {
  if (typeof window === "undefined") return defaultCourtsViewShowPhotos();
  if (!isCourtsViewDesktopViewport()) return true;

  const sessionValue = loadCourtsViewPhotosMap()[gameId];
  if (sessionValue != null) return sessionValue;

  return loadCourtsViewShowPhotos();
}

export function saveCourtsViewShowPhotos(showPhotos: boolean) {
  localStorage.setItem(COURTS_VIEW_PHOTOS_STORAGE_KEY, showPhotos ? "true" : "false");
}

export function saveCourtsViewShowPhotosForSession(gameId: string, showPhotos: boolean) {
  const map = loadCourtsViewPhotosMap();
  map[gameId] = showPhotos;
  localStorage.setItem(COURTS_VIEW_PHOTOS_BY_SESSION_STORAGE_KEY, JSON.stringify(map));
}

export function useCourtsViewSessionPhotos(gameId: string) {
  const [showPhotos, setShowPhotos] = useState(defaultCourtsViewShowPhotos);
  const [ready, setReady] = useState(false);
  const [isDesktopViewport, setIsDesktopViewport] = useState<boolean | null>(null);

  useEffect(() => {
    setShowPhotos(loadCourtsViewShowPhotosForSession(gameId));
    setReady(true);
  }, [gameId]);

  useEffect(() => {
    const media = window.matchMedia(COURTS_VIEW_DESKTOP_MEDIA);
    const syncViewport = () => setIsDesktopViewport(media.matches);
    syncViewport();
    media.addEventListener("change", syncViewport);
    return () => media.removeEventListener("change", syncViewport);
  }, []);

  const displayShowPhotos = ready && isDesktopViewport === true ? showPhotos : true;

  const setSessionShowPhotos = useCallback(
    (nextShowPhotos: boolean) => {
      setShowPhotos(nextShowPhotos);
      saveCourtsViewShowPhotosForSession(gameId, nextShowPhotos);
    },
    [gameId],
  );

  return {
    showPhotos: displayShowPhotos,
    setShowPhotos: setSessionShowPhotos,
    ready,
    isDesktopViewport,
  };
}

/** List always shows photos; 3×3 hides them; 2×2 follows the saved toggle. */
export function resolveCourtsViewShowPlayerPhotos(
  layout: CourtsViewLayout,
  showPhotosPreference: boolean,
): boolean {
  if (layout === "tiles-3") return false;
  if (layout === "list") return true;
  return showPhotosPreference;
}

/** Photos toggle is only relevant in the 2×2 grid layout. */
export function courtsViewShowsPhotosToggle(layout: CourtsViewLayout): boolean {
  return layout === "tiles-2";
}

export function courtsViewPhotosGridClassName(showPhotos: boolean): string {
  return showPhotos ? "court-grid--show-photos" : "court-grid--hide-photos";
}

type CourtsViewPhotosToggleProps = {
  value: boolean;
  onChange: (showPhotos: boolean) => void;
  className?: string;
};

export function CourtsViewPhotosToggle({
  value,
  onChange,
  className,
}: CourtsViewPhotosToggleProps) {
  return (
    <div
      className={cn(
        "courts-view-photos-toggle inline-flex h-7 items-stretch rounded-lg border border-border bg-muted/40 p-0.5",
        className,
      )}
    >
      <Button
        type="button"
        variant={value ? "default" : "ghost"}
        className="courts-view-photos-toggle-btn h-full min-h-0 gap-1 px-2 sm:px-2.5 text-[0.8rem]"
        onClick={() => onChange(true)}
        aria-pressed={value}
      >
        <Image className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span className="hidden sm:inline">Photos</span>
      </Button>
      <Button
        type="button"
        variant={!value ? "default" : "ghost"}
        className="courts-view-photos-toggle-btn h-full min-h-0 gap-1 px-2 sm:px-2.5 text-[0.8rem]"
        onClick={() => onChange(false)}
        aria-pressed={!value}
      >
        <ImageOff className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span className="hidden sm:inline">Hide</span>
      </Button>
    </div>
  );
}
