import type { QueryClient } from "@tanstack/react-query";

import type { SpectatePlayerFeatures } from "@/lib/spectate-player-features-shared";
import { spectatorNavQueryOptions } from "@/lib/spectator-query-options";

export function spectatePlayerFeaturesQueryKey(gameId: string, playerId: string) {
  return ["spectate-player-features", gameId, playerId] as const;
}

export async function fetchSpectatePlayerFeatures(gameId: string, playerId: string) {
  const response = await fetch(
    `/api/games/${gameId}/spectate/player/features?playerId=${encodeURIComponent(playerId)}`,
  );
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.message ?? "Failed to load player menu.");
  }
  return payload as SpectatePlayerFeatures;
}

export function prefetchSpectatePlayerFeatures(
  queryClient: QueryClient,
  gameId: string,
  playerId: string,
) {
  if (!gameId || !playerId) return;

  void queryClient.prefetchQuery({
    queryKey: spectatePlayerFeaturesQueryKey(gameId, playerId),
    queryFn: () => fetchSpectatePlayerFeatures(gameId, playerId),
    ...spectatorNavQueryOptions,
  });
}
