import type { QueryClient } from "@tanstack/react-query";

import type { SpectateDetailsPayload, SpectateLivePayload } from "@/lib/spectate-payload";

export type SpectateScope = "live" | "details";

export function spectatorLiveQueryKey(gameId: string) {
  return ["game", gameId, "spectator", "live"] as const;
}

export function spectatorDetailsQueryKey(gameId: string) {
  return ["game", gameId, "spectator", "details"] as const;
}

export async function fetchSpectateGame(gameId: string, scope: SpectateScope) {
  const response = await fetch(`/api/games/${gameId}/spectate?scope=${scope}`);
  const data = await response.json();
  if (!response.ok) throw new Error(data.message ?? "Failed to load game.");
  return data as SpectateLivePayload | SpectateDetailsPayload;
}

/** Fetch the latest spectator queue/courts before opening the live view. */
export async function refreshSpectatorLive(queryClient: QueryClient, gameId: string) {
  return queryClient.fetchQuery({
    queryKey: spectatorLiveQueryKey(gameId),
    queryFn: () => fetchSpectateGame(gameId, "live") as Promise<SpectateLivePayload>,
    staleTime: 0,
  });
}
