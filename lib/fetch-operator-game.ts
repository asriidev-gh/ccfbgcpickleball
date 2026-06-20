import type { QueryClient } from "@tanstack/react-query";

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

  void queryClient.prefetchQuery({
    queryKey: operatorShellQueryKey(gameId),
    queryFn: () => fetchOperatorShell(gameId),
    staleTime: Number.POSITIVE_INFINITY,
  });
  void queryClient.prefetchQuery({
    queryKey: operatorQueueQueryKey(gameId),
    queryFn: () => fetchOperatorQueue(gameId),
    staleTime: 30_000,
  });
}

export async function fetchOperatorGame(gameId: string, scope: OperatorGameScope) {
  const response = await fetch(`/api/games/${gameId}?scope=${scope}`);
  const data = await response.json();
  if (!response.ok) throw new Error(data.message);
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
