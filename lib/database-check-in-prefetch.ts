import type { QueryClient } from "@tanstack/react-query";

import type { DatabaseCheckInPlayersPage } from "@/lib/operator-database-check-in-shared";

export const DATABASE_CHECK_IN_PAGE_SIZE = 10;

export function databaseCheckInQueryKey(gameId: string, page: number, search: string) {
  return ["database-check-in-players", gameId, page, search] as const;
}

export async function fetchDatabaseCheckInPlayers(gameId: string, page: number, search: string) {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(DATABASE_CHECK_IN_PAGE_SIZE),
  });
  if (search) params.set("q", search);

  const response = await fetch(`/api/games/${gameId}/database-check-in?${params.toString()}`);
  const payload = (await response.json()) as DatabaseCheckInPlayersPage & { message?: string };
  if (!response.ok) throw new Error(payload.message ?? "Failed to load players.");
  return payload;
}

/** Warm the first page so the check-in dialog opens with data already loaded. */
export function prefetchDatabaseCheckInPlayers(queryClient: QueryClient, gameId: string) {
  if (!gameId) return;
  void queryClient.prefetchQuery({
    queryKey: databaseCheckInQueryKey(gameId, 1, ""),
    queryFn: () => fetchDatabaseCheckInPlayers(gameId, 1, ""),
    staleTime: 30_000,
  });
}
