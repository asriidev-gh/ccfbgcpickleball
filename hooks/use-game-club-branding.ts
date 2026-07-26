"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import type { ClubBranding } from "@/lib/club-branding";
import {
  getGameIdFromGamesPath,
  getQuickPlayGameIdFromPath,
  isGameDashboardPath,
  isSpectatorPath,
} from "@/lib/app-shell";
import { getLeaderboardGameIdFromPath } from "@/lib/leaderboard-navigation";
import { isQuickGame } from "@/lib/local-game-id";
import { fetchOperatorShell, operatorShellQueryKey } from "@/lib/fetch-operator-game";
import { fetchSpectateGame, spectatorLiveQueryKey } from "@/lib/fetch-spectate-game";
import type { SpectateLivePayload } from "@/lib/spectate-payload";

export function useGameClubBranding(pathname: string, fromParam: string | null) {
  // Keep SSR and the first client render identical (APP_NAME). Club branding can
  // appear from a hydrated React Query cache / sessionStorage and would otherwise
  // mismatch the server HTML.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const leaderboardGameId = getLeaderboardGameIdFromPath(pathname);
  const gameId =
    getGameIdFromGamesPath(pathname) ??
    getQuickPlayGameIdFromPath(pathname) ??
    leaderboardGameId;
  const isSpectator = isSpectatorPath(pathname, fromParam);
  const isGamePath =
    isGameDashboardPath(pathname) || (isSpectator && Boolean(leaderboardGameId));
  const isQuickGameSession = Boolean(gameId && isQuickGame(gameId));

  const operatorQuery = useQuery({
    queryKey: operatorShellQueryKey(gameId ?? ""),
    queryFn: () => fetchOperatorShell(gameId!),
    enabled: mounted && Boolean(gameId) && isGamePath && !isSpectator && !isQuickGameSession,
    staleTime: Number.POSITIVE_INFINITY,
  });

  const spectatorQuery = useQuery({
    queryKey: spectatorLiveQueryKey(gameId ?? ""),
    queryFn: () => fetchSpectateGame(gameId!, "live") as Promise<SpectateLivePayload>,
    enabled: mounted && Boolean(gameId) && isSpectator,
    staleTime: 30_000,
  });

  if (!mounted || !isGamePath || !gameId) {
    return null;
  }

  const branding = isSpectator
    ? spectatorQuery.data?.clubBranding
    : operatorQuery.data?.clubBranding;

  return branding ?? null;
}

export type { ClubBranding };
