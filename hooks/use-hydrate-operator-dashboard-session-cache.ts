"use client";

import type { QueryClient } from "@tanstack/react-query";
import { useLayoutEffect, useState } from "react";

import { hydrateOperatorDashboardSessionCache } from "@/lib/operator-dashboard-session-cache";
import { isQuickGame } from "@/lib/local-game-id";

/**
 * Synchronously hydrate operator shell/queue from sessionStorage before paint
 * so a hard refresh can show the last known dashboard instead of a long spinner.
 */
export function useHydrateOperatorDashboardSessionCache(
  queryClient: QueryClient,
  gameId: string,
) {
  const [hydratedGameId, setHydratedGameId] = useState<string | null>(null);

  useLayoutEffect(() => {
    if (!gameId || isQuickGame(gameId)) {
      setHydratedGameId(gameId || null);
      return;
    }
    hydrateOperatorDashboardSessionCache(queryClient, gameId);
    setHydratedGameId(gameId);
  }, [gameId, queryClient]);

  return hydratedGameId === gameId;
}
