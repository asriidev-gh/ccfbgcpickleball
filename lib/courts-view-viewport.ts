/** Matches Tailwind `sm` — courts view layout/photo toggles use this breakpoint. */
export const COURTS_VIEW_DESKTOP_MEDIA = "(min-width: 640px)";

export function isCourtsViewDesktopViewport(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia(COURTS_VIEW_DESKTOP_MEDIA).matches;
}
