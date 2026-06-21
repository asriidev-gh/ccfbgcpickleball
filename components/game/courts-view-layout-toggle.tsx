"use client";

import { Grid2x2, Grid3x3, LayoutList } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  COURTS_VIEW_DESKTOP_MEDIA,
  isCourtsViewDesktopViewport,
} from "@/lib/courts-view-viewport";
import { cn } from "@/lib/utils";

export type CourtsViewLayout = "list" | "tiles-2" | "tiles-3";

export const COURTS_VIEW_LAYOUT_STORAGE_KEY = "ccf-courts-view-layout";
export const COURTS_VIEW_LAYOUT_BY_SESSION_STORAGE_KEY = "ccf-courts-view-layout-by-session";

export function defaultCourtsViewLayout(): CourtsViewLayout {
  return "list";
}

function parseCourtsViewLayout(value: unknown): CourtsViewLayout | null {
  if (value === "list" || value === "tiles-2" || value === "tiles-3") return value;
  return null;
}

function loadCourtsViewLayoutMap(): Record<string, CourtsViewLayout> {
  if (typeof window === "undefined") return {};

  try {
    const raw = localStorage.getItem(COURTS_VIEW_LAYOUT_BY_SESSION_STORAGE_KEY);
    if (!raw) return {};

    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};

    const map: Record<string, CourtsViewLayout> = {};
    for (const [gameId, layout] of Object.entries(parsed)) {
      const parsedLayout = parseCourtsViewLayout(layout);
      if (parsedLayout) map[gameId] = parsedLayout;
    }
    return map;
  } catch {
    return {};
  }
}

export function loadCourtsViewLayout(): CourtsViewLayout {
  if (typeof window === "undefined") return defaultCourtsViewLayout();
  if (!isCourtsViewDesktopViewport()) return defaultCourtsViewLayout();

  const stored = localStorage.getItem(COURTS_VIEW_LAYOUT_STORAGE_KEY);
  return parseCourtsViewLayout(stored) ?? defaultCourtsViewLayout();
}

export function loadCourtsViewLayoutForSession(gameId: string): CourtsViewLayout {
  if (typeof window === "undefined") return defaultCourtsViewLayout();
  if (!isCourtsViewDesktopViewport()) return defaultCourtsViewLayout();

  const sessionLayout = loadCourtsViewLayoutMap()[gameId];
  if (sessionLayout) return sessionLayout;

  return loadCourtsViewLayout();
}

export function saveCourtsViewLayout(layout: CourtsViewLayout) {
  localStorage.setItem(COURTS_VIEW_LAYOUT_STORAGE_KEY, layout);
}

export function saveCourtsViewLayoutForSession(gameId: string, layout: CourtsViewLayout) {
  const map = loadCourtsViewLayoutMap();
  map[gameId] = layout;
  localStorage.setItem(COURTS_VIEW_LAYOUT_BY_SESSION_STORAGE_KEY, JSON.stringify(map));
}

export function useCourtsViewSessionLayout(gameId: string) {
  const [layout, setLayout] = useState<CourtsViewLayout>(defaultCourtsViewLayout);
  const [ready, setReady] = useState(false);
  const [isDesktopViewport, setIsDesktopViewport] = useState<boolean | null>(null);

  useEffect(() => {
    setLayout(loadCourtsViewLayoutForSession(gameId));
    setReady(true);
  }, [gameId]);

  useEffect(() => {
    const media = window.matchMedia(COURTS_VIEW_DESKTOP_MEDIA);
    const syncViewport = () => setIsDesktopViewport(media.matches);
    syncViewport();
    media.addEventListener("change", syncViewport);
    return () => media.removeEventListener("change", syncViewport);
  }, []);

  const displayLayout = ready && isDesktopViewport === true ? layout : "list";

  const setSessionLayout = useCallback(
    (nextLayout: CourtsViewLayout) => {
      setLayout(nextLayout);
      saveCourtsViewLayoutForSession(gameId, nextLayout);
    },
    [gameId],
  );

  return {
    layout: displayLayout,
    setLayout: setSessionLayout,
    ready,
    isDesktopViewport,
  };
}

type CourtsViewLayoutToggleProps = {
  value: CourtsViewLayout;
  onChange: (layout: CourtsViewLayout) => void;
  className?: string;
};

export function CourtsViewLayoutToggle({
  value,
  onChange,
  className,
}: CourtsViewLayoutToggleProps) {
  return (
    <div
      className={cn(
        "courts-view-layout-toggle inline-flex h-7 items-stretch rounded-lg border border-border bg-muted/40 p-0.5",
        className,
      )}
      role="group"
      aria-label="Courts layout"
    >
      <Button
        type="button"
        variant={value === "list" ? "default" : "ghost"}
        className="courts-view-layout-toggle-btn h-full min-h-0 gap-1 px-2 sm:px-2.5 text-[0.8rem]"
        onClick={() => onChange("list")}
        aria-pressed={value === "list"}
      >
        <LayoutList className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span className="hidden sm:inline">List</span>
      </Button>
      <Button
        type="button"
        variant={value === "tiles-2" ? "default" : "ghost"}
        className="courts-view-layout-toggle-btn h-full min-h-0 gap-1 px-2 sm:px-2.5 text-[0.8rem]"
        onClick={() => onChange("tiles-2")}
        aria-pressed={value === "tiles-2"}
      >
        <Grid2x2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span className="hidden sm:inline">2×2</span>
      </Button>
      <Button
        type="button"
        variant={value === "tiles-3" ? "default" : "ghost"}
        className="courts-view-layout-toggle-btn h-full min-h-0 gap-1 px-2 sm:px-2.5 text-[0.8rem]"
        onClick={() => onChange("tiles-3")}
        aria-pressed={value === "tiles-3"}
      >
        <Grid3x3 className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span className="hidden sm:inline">3×3</span>
      </Button>
    </div>
  );
}

export function courtsViewLayoutGridClassName(layout: CourtsViewLayout): string {
  const base = "court-grid grid gap-3";

  switch (layout) {
    case "list":
      return cn(base, "court-grid--list grid-cols-1");
    case "tiles-2":
      return cn(base, "court-grid--tiles court-grid--tiles-2");
    case "tiles-3":
      return cn(base, "court-grid--tiles court-grid--tiles-3");
  }
}
