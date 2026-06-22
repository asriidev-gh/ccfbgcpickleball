import { useQuery } from "@tanstack/react-query";

import { fetchSavedQuickGames } from "@/lib/quick-game-persistence-client";

export function savedQuickGamesQueryKey() {
  return ["saved-quick-games"] as const;
}

export function useSavedQuickGames(enabled = true) {
  return useQuery({
    queryKey: savedQuickGamesQueryKey(),
    queryFn: fetchSavedQuickGames,
    enabled,
    staleTime: 30_000,
  });
}
