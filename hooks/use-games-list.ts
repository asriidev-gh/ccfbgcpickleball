"use client";

import { useQuery } from "@tanstack/react-query";

export type GamesListPayload = {
  games: Array<{
    _id: string;
    title: string;
    gameId: string;
    openPlayType: string;
    courtCount: number;
    expectedPlayers: number;
    strictPlayerCount?: boolean;
    allowQrRegistration?: boolean;
    status: "draft" | "active" | "ended";
    openPlayDate?: string | null;
    openPlayTimeRange?: string | null;
    updatedAt?: string;
    createdAt?: string;
  }>;
  hasDemoOpenPlay?: boolean;
  userType?: string;
};

async function fetchGamesList() {
  const response = await fetch("/api/games");
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.message);
  return payload as GamesListPayload;
}

/** Load the signed-in owner's game list once; refetch manually (e.g. tab change or after mutations). */
export function useGamesList() {
  return useQuery({
    queryKey: ["games"],
    queryFn: fetchGamesList,
    refetchOnWindowFocus: false,
  });
}
