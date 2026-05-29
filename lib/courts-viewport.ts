import type { CourtsViewLayout } from "@/components/game/courts-view-toggle";
import { loadCourtsView } from "@/components/game/courts-view-toggle";

/** iPad Pro landscape and similar tablets (e.g. 1366×1024) use rows-only courts layout */
export const COURTS_DESKTOP_MEDIA = "(min-width: 1367px)";

export function isCourtsDesktopViewport(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia(COURTS_DESKTOP_MEDIA).matches;
}

export function defaultCourtsView(): CourtsViewLayout {
  return isCourtsDesktopViewport() ? loadCourtsView() : "list";
}
