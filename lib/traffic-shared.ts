// Client-safe traffic types and helpers (no DB/mongoose imports).

export const VISITOR_ID_PATTERN = /^[A-Za-z0-9-]{8,64}$/;

/** Hours ahead of UTC for the club's day boundaries (Philippines). */
export const TRAFFIC_UTC_OFFSET_HOURS = 8;

export type TrafficRange = {
  uniqueVisitors: number;
  pageViews: number;
};

export type TrafficVisitor = {
  visitorId: string;
  ip: string;
  /** "City, Region, Country" as far as the host reports it; empty when unknown. */
  location: string;
  device: string;
  pageViews: number;
  pagesVisited: number;
  lastPath: string;
  lastSeenAt: string;
};

export type TrafficInsights = {
  recentVisitors: TrafficVisitor[];
  generatedAt: string;
  today: TrafficRange;
  last7Days: TrafficRange;
  last30Days: TrafficRange;
  daily: { day: string; label: string; uniqueVisitors: number; pageViews: number }[];
  topPages: { path: string; uniqueVisitors: number; pageViews: number }[];
};

/** Collapses per-game ids so every session's page counts toward one route. */
export function normalizeTrackedPath(rawPath: string): string | null {
  const path = rawPath.split(/[?#]/)[0]?.trim() ?? "";
  if (!path.startsWith("/") || path.length > 200) return null;
  if (path.startsWith("/api") || path.startsWith("/_next") || path.startsWith("/insights")) {
    return null;
  }
  const trimmed = path.length > 1 ? path.replace(/\/+$/, "") : path;
  return trimmed.replace(/^\/(games|leaderboard|register|play)\/[^/]+/, "/$1/[id]");
}
