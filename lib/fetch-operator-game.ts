import type { QueryClient } from "@tanstack/react-query";

import { sanitizeErrorMessage } from "@/lib/infrastructure-error";
import { isQuickGame } from "@/lib/local-game-id";
import { seedLocalGameOperatorCache } from "@/lib/operator-game-cache";
import {
  operatorDetailsQueryOptions,
  operatorQueueQueryOptions,
  operatorShellQueryOptions,
} from "@/lib/operator-query-options";
import type {
  OperatorDetailsPayload,
  OperatorQueuePayload,
  OperatorShellPayload,
} from "@/lib/operator-payload";

export type OperatorGameScope = "shell" | "queue" | "live" | "details" | "full";

export function operatorShellQueryKey(gameId: string) {
  return ["game", gameId, "operator", "shell"] as const;
}

export function operatorQueueQueryKey(gameId: string) {
  return ["game", gameId, "operator", "queue"] as const;
}

export function operatorDetailsQueryKey(gameId: string) {
  return ["game", gameId, "operator", "details"] as const;
}

/** Warm shell + queue cache before navigating to the operator dashboard. */
export function prefetchOperatorDashboard(queryClient: QueryClient, gameId: string) {
  if (!gameId) return;

  if (isQuickGame(gameId)) {
    seedLocalGameOperatorCache(queryClient, gameId);
    return;
  }

  void queryClient.prefetchQuery({
    queryKey: operatorShellQueryKey(gameId),
    queryFn: () => fetchOperatorShell(gameId),
    ...operatorShellQueryOptions,
  });
  void queryClient.prefetchQuery({
    queryKey: operatorQueueQueryKey(gameId),
    queryFn: () => fetchOperatorQueue(gameId),
    ...operatorQueueQueryOptions,
  });
}

export async function fetchOperatorGame(gameId: string, scope: OperatorGameScope) {
  const response = await fetch(`/api/games/${gameId}?scope=${scope}`);
  const data = await response.json();
  if (!response.ok) {
    throw new Error(sanitizeErrorMessage(data.message, "Failed to load game."));
  }
  return data;
}

export async function fetchOperatorShell(gameId: string) {
  return (await fetchOperatorGame(gameId, "shell")) as OperatorShellPayload;
}

export async function fetchOperatorQueue(gameId: string) {
  return (await fetchOperatorGame(gameId, "queue")) as OperatorQueuePayload;
}

export async function fetchOperatorDetails(gameId: string) {
  return (await fetchOperatorGame(gameId, "details")) as OperatorDetailsPayload;
}

export async function refetchOperatorQueueData(
  queryClient: QueryClient,
  gameId: string,
) {
  await queryClient.refetchQueries({ queryKey: operatorQueueQueryKey(gameId) });
}
