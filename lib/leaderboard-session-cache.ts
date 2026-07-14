import type { QueryClient } from "@tanstack/react-query";

import type { LeaderboardRecapPayload } from "@/lib/fetch-leaderboard";
import { leaderboardRecapQueryKey } from "@/lib/fetch-leaderboard";

const PREFIX = "ccf-leaderboard-recap-cache:";
/** Drop cached snapshots older than this (sessionStorage survives tab restores). */
const MAX_AGE_MS = 30 * 60_000;

type TimedRecap = {
  savedAt: number;
  isSpectatorView: boolean;
  payload: LeaderboardRecapPayload;
};

function storageKey(gameId: string, isSpectatorView: boolean) {
  return `${PREFIX}${isSpectatorView ? "spectator" : "operator"}:${gameId}`;
}

function isLeaderboardRecapPayload(value: unknown): value is LeaderboardRecapPayload {
  if (!value || typeof value !== "object") return false;
  const payload = value as LeaderboardRecapPayload;
  return Array.isArray(payload.rows) && Array.isArray(payload.insights);
}

function readTimedRecap(gameId: string, isSpectatorView: boolean): TimedRecap | null {
  if (typeof window === "undefined" || !gameId) return null;
  try {
    const raw = sessionStorage.getItem(storageKey(gameId, isSpectatorView));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<TimedRecap>;
    if (
      typeof parsed.savedAt !== "number" ||
      typeof parsed.isSpectatorView !== "boolean" ||
      !isLeaderboardRecapPayload(parsed.payload)
    ) {
      sessionStorage.removeItem(storageKey(gameId, isSpectatorView));
      return null;
    }
    if (Date.now() - parsed.savedAt > MAX_AGE_MS) {
      sessionStorage.removeItem(storageKey(gameId, isSpectatorView));
      return null;
    }
    return {
      savedAt: parsed.savedAt,
      isSpectatorView: parsed.isSpectatorView,
      payload: parsed.payload,
    };
  } catch {
    return null;
  }
}

export function readLeaderboardSessionCache(
  gameId: string,
  isSpectatorView: boolean,
): LeaderboardRecapPayload | null {
  return readTimedRecap(gameId, isSpectatorView)?.payload ?? null;
}

export function writeLeaderboardSessionCache(
  gameId: string,
  isSpectatorView: boolean,
  payload: LeaderboardRecapPayload,
) {
  if (typeof window === "undefined" || !gameId) return;
  try {
    const entry: TimedRecap = {
      savedAt: Date.now(),
      isSpectatorView,
      payload,
    };
    sessionStorage.setItem(storageKey(gameId, isSpectatorView), JSON.stringify(entry));
  } catch {
    // Quota or private mode — ignore.
  }
}

/** Seed React Query from sessionStorage so navigation can paint before the network returns. */
export function hydrateLeaderboardSessionCache(
  queryClient: QueryClient,
  gameId: string,
  isSpectatorView: boolean,
): boolean {
  if (!gameId) return false;
  const key = leaderboardRecapQueryKey(gameId, isSpectatorView);
  if (queryClient.getQueryData(key)) return false;

  const cached = readLeaderboardSessionCache(gameId, isSpectatorView);
  if (!cached) return false;

  // Mark as stale so React Query refetches quietly while still showing this snapshot.
  queryClient.setQueryData(key, cached, { updatedAt: 0 });
  return true;
}

export function persistLeaderboardSessionCacheFromClient(
  queryClient: QueryClient,
  gameId: string,
  isSpectatorView: boolean,
) {
  if (!gameId) return;
  const payload = queryClient.getQueryData<LeaderboardRecapPayload>(
    leaderboardRecapQueryKey(gameId, isSpectatorView),
  );
  if (payload) writeLeaderboardSessionCache(gameId, isSpectatorView, payload);
}
