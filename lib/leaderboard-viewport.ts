export type LeaderboardPageLayout = "stacked" | "split";
export type LeaderboardViewMode = "cards" | "table";

/** Matches Tailwind `xl` — same breakpoint as side-by-side grid in leaderboard-page-content */
export const LEADERBOARD_DESKTOP_MEDIA = "(min-width: 1280px)";

export function isLeaderboardDesktopViewport(): boolean {
  if (typeof window === "undefined") return true;
  return window.matchMedia(LEADERBOARD_DESKTOP_MEDIA).matches;
}

export function defaultLeaderboardLayout(): LeaderboardPageLayout {
  return isLeaderboardDesktopViewport() ? "split" : "stacked";
}

export function defaultLeaderboardView(): LeaderboardViewMode {
  return isLeaderboardDesktopViewport() ? "table" : "cards";
}
