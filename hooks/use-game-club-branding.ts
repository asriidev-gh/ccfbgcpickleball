"use client";

import { useQuery } from "@tanstack/react-query";

import type { ClubBranding } from "@/lib/club-branding";
import {
  getGameIdFromGamesPath,
  getQuickPlayGameIdFromPath,
  isGameDashboardPath,
  isSpectatorPath,
} from "@/lib/app-shell";
import { isQuickGame } from "@/lib/local-game-id";
import { fetchOperatorShell, operatorShellQueryKey } from "@/lib/fetch-operator-game";
import { fetchSpectateGame, spectatorLiveQueryKey } from "@/lib/fetch-spectate-game";
import type { SpectateLivePayload } from "@/lib/spectate-payload";

export function useGameClubBranding(pathname: string, fromParam: string | null) {
  const gameId =
    getGameIdFromGamesPath(pathname) ?? getQuickPlayGameIdFromPath(pathname);
  const isGamePath = isGameDashboardPath(pathname);
  const isSpectator = isSpectatorPath(pathname, fromParam);
  const isQuickGameSession = Boolean(gameId && isQuickGame(gameId));

  const operatorQuery = useQuery({
    queryKey: operatorShellQueryKey(gameId ?? ""),
    queryFn: () => fetchOperatorShell(gameId!),
    enabled: Boolean(gameId) && isGamePath && !isSpectator && !isQuickGameSession,
    staleTime: Number.POSITIVE_INFINITY,
  });

  const spectatorQuery = useQuery({
    queryKey: spectatorLiveQueryKey(gameId ?? ""),
    queryFn: () => fetchSpectateGame(gameId!, "live") as Promise<SpectateLivePayload>,
    enabled: Boolean(gameId) && isSpectator,
    staleTime: 30_000,
  });

  if (!isGamePath || !gameId) {
    return null;
  }

  const branding = isSpectator
    ? spectatorQuery.data?.clubBranding
    : operatorQuery.data?.clubBranding;

  return branding ?? null;
}

export type { ClubBranding };
