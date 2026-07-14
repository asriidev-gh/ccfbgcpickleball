"use client";

import type { QueryClient } from "@tanstack/react-query";
import { useLayoutEffect, useState } from "react";

import { hydrateLeaderboardSessionCache } from "@/lib/leaderboard-session-cache";
import { isQuickGame } from "@/lib/local-game-id";

/**
 * Synchronously hydrate leaderboard recap from sessionStorage before paint
 * so returning to the page can show the last snapshot while a quiet refetch runs.
 */
export function useHydrateLeaderboardSessionCache(
  queryClient: QueryClient,
  gameId: string,
  isSpectatorView: boolean,
) {
  const [hydratedKey, setHydratedKey] = useState<string | null>(null);
  const cacheKey = `${gameId}:${isSpectatorView ? "spectator" : "operator"}`;

  useLayoutEffect(() => {
    if (!gameId || isQuickGame(gameId)) {
      setHydratedKey(cacheKey);
      return;
    }
    hydrateLeaderboardSessionCache(queryClient, gameId, isSpectatorView);
    setHydratedKey(cacheKey);
  }, [cacheKey, gameId, isSpectatorView, queryClient]);

  return hydratedKey === cacheKey;
}
