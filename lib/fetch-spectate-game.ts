import type { QueryClient } from "@tanstack/react-query";

import { sanitizeErrorMessage } from "@/lib/infrastructure-error";
import {
  SPECTATOR_VIEW_UNAVAILABLE_MESSAGE,
  SpectatorViewUnavailableError,
} from "@/lib/spectator-availability-shared";
import type { SpectateDetailsPayload, SpectateLivePayload } from "@/lib/spectate-payload";

export { SpectatorViewUnavailableError, isSpectatorViewUnavailableError } from "@/lib/spectator-availability-shared";

export type SpectateScope = "live" | "details";

export function spectatorLiveQueryKey(gameId: string) {
  return ["game", gameId, "spectator", "live"] as const;
}

export function spectatorDetailsQueryKey(gameId: string) {
  return ["game", gameId, "spectator", "details"] as const;
}

export async function fetchSpectateGame(gameId: string, scope: "live"): Promise<SpectateLivePayload>;
export async function fetchSpectateGame(gameId: string, scope: "details"): Promise<SpectateDetailsPayload>;
export async function fetchSpectateGame(
  gameId: string,
  scope: SpectateScope,
): Promise<SpectateLivePayload | SpectateDetailsPayload> {
  const response = await fetch(`/api/games/${gameId}/spectate?scope=${scope}`);
  const data = await response.json();
  if (!response.ok) {
    if (response.status === 503) {
      throw new SpectatorViewUnavailableError(
        typeof data.message === "string" && data.message.trim()
          ? data.message
          : SPECTATOR_VIEW_UNAVAILABLE_MESSAGE,
      );
    }
    throw new Error(sanitizeErrorMessage(data.message, "Failed to load game."));
  }
  return data as SpectateLivePayload | SpectateDetailsPayload;
}

/** Fetch the latest spectator queue/courts before opening the live view. */
export async function refreshSpectatorLive(queryClient: QueryClient, gameId: string) {
  return queryClient.fetchQuery({
    queryKey: spectatorLiveQueryKey(gameId),
    queryFn: () => fetchSpectateGame(gameId, "live"),
    staleTime: 0,
  });
}
