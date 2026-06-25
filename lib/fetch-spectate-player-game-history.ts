import type { QueryClient } from "@tanstack/react-query";

import type { SpectatePlayerGameHistory } from "@/lib/spectate-player-game-history-shared";
import { spectatorNavQueryOptions } from "@/lib/spectator-query-options";

export function spectatePlayerGameHistoryQueryKey(gameId: string, playerId: string) {
  return ["spectate-player-game-history", gameId, playerId] as const;
}

export async function fetchSpectatePlayerGameHistory(gameId: string, playerId: string) {
  const response = await fetch(
    `/api/games/${gameId}/spectate/player/game-history?playerId=${encodeURIComponent(playerId)}`,
  );
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.message ?? "Failed to load game history.");
  }
  return payload as SpectatePlayerGameHistory;
}

export function prefetchSpectatePlayerGameHistory(
  queryClient: QueryClient,
  gameId: string,
  playerId: string,
) {
  if (!gameId || !playerId) return;

  void queryClient.prefetchQuery({
    queryKey: spectatePlayerGameHistoryQueryKey(gameId, playerId),
    queryFn: () => fetchSpectatePlayerGameHistory(gameId, playerId),
    ...spectatorNavQueryOptions,
  });
}
