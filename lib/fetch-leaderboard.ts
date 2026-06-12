import type { QueryClient } from "@tanstack/react-query";

import type { GameLeaderboardRecapRow } from "@/lib/game-leaderboard-recap";
import type { SessionInsight } from "@/lib/session-insights";

export type LeaderboardRecapPayload = {
  rows: GameLeaderboardRecapRow[];
  insights: SessionInsight[];
};

export function leaderboardRecapQueryKey(gameId: string, isSpectatorView: boolean) {
  return ["game", gameId, "leaderboard", isSpectatorView ? "spectator" : "operator"] as const;
}

export async function fetchLeaderboardRecap(gameId: string, isSpectatorView: boolean) {
  const from = isSpectatorView ? "?from=spectator" : "";
  const response = await fetch(`/api/games/${gameId}/leaderboard${from}`);
  const data = await response.json();
  if (!response.ok) throw new Error(data.message ?? "Failed to load leaderboard.");
  return data as LeaderboardRecapPayload;
}

export function prefetchLeaderboardRecap(
  queryClient: QueryClient,
  gameId: string,
  isSpectatorView: boolean,
) {
  if (!gameId) return;

  void queryClient.prefetchQuery({
    queryKey: leaderboardRecapQueryKey(gameId, isSpectatorView),
    queryFn: () => fetchLeaderboardRecap(gameId, isSpectatorView),
    staleTime: 30_000,
  });
}
