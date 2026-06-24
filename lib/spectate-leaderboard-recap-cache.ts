import type { GameLeaderboardRecapRow } from "@/lib/game-leaderboard-recap";
import type { SessionInsight } from "@/lib/session-insights";

/** Public spectator leaderboard — short TTL between match updates. */
const LEADERBOARD_RECAP_TTL_MS = 2 * 60_000;

type LeaderboardRecapPayload = {
  rows: GameLeaderboardRecapRow[];
  insights: SessionInsight[];
};

type CacheEntry<T> = { value: T; expiresAt: number };

const leaderboardRecapCache = new Map<string, CacheEntry<LeaderboardRecapPayload>>();

export function getCachedSpectatorLeaderboardRecap(gameId: string) {
  const entry = leaderboardRecapCache.get(gameId);
  if (!entry || entry.expiresAt < Date.now()) {
    leaderboardRecapCache.delete(gameId);
    return null;
  }
  return entry.value;
}

export function setCachedSpectatorLeaderboardRecap(gameId: string, payload: LeaderboardRecapPayload) {
  leaderboardRecapCache.set(gameId, {
    value: payload,
    expiresAt: Date.now() + LEADERBOARD_RECAP_TTL_MS,
  });
}
