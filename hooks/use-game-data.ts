"use client";

import { useQuery } from "@tanstack/react-query";

export function useGameData(gameId: string) {
  return useQuery({
    queryKey: ["game", gameId],
    queryFn: async () => {
      const response = await fetch(`/api/games/${gameId}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      return data;
    },
    enabled: Boolean(gameId),
    refetchInterval: 4000,
  });
}
