"use client";

import { useQuery } from "@tanstack/react-query";

import { ownerHubQueryOptions } from "@/lib/owner-hub-query-options";

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
    registrationMode?: "self" | "owner";
    status: "draft" | "active" | "ended";
    openPlayDate?: string | null;
    openPlayTimeRange?: string | null;
    updatedAt?: string;
    createdAt?: string;
  }>;
  hasDemoOpenPlay?: boolean;
  canCreateDemoOpenPlay?: boolean;
  userType?: string;
};

async function fetchGamesList() {
  const response = await fetch("/api/games");
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.message);
  return payload as GamesListPayload;
}

/** Load the signed-in owner's game list once; refetch manually (e.g. after mutations). */
export function useGamesList() {
  return useQuery({
    queryKey: ["games"],
    queryFn: fetchGamesList,
    refetchOnWindowFocus: false,
    ...ownerHubQueryOptions,
    retry: (failureCount, error) => {
      if (error instanceof Error && /unauthorized/i.test(error.message)) {
        return false;
      }
      return failureCount < 2;
    },
    retryDelay: (attempt) => Math.min(1_000 * (attempt + 1), 3_000),
  });
}
