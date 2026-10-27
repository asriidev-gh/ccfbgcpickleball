"use client";

import { useQuery } from "@tanstack/react-query";

import type { AllTimeLeaderboardPayload } from "@/lib/all-time-leaderboard";
import type { PublicAllTimeLeaderboardPayload } from "@/lib/public-all-time-leaderboard";
import { ownerHubQueryOptions } from "@/lib/owner-hub-query-options";

export const allTimeLeaderboardQueryKey = ["all-time-leaderboard"] as const;
export const publicAllTimeLeaderboardQueryKey = ["all-time-leaderboard", "public"] as const;

async function fetchStandings(url: string) {
  const response = await fetch(url);
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(payload?.message ?? "Failed to load the all-time leaderboard.");
  }
  return await response.json();
}

export async function fetchAllTimeLeaderboard(): Promise<AllTimeLeaderboardPayload> {
  return (await fetchStandings("/api/leaderboard/all-time")) as AllTimeLeaderboardPayload;
}

export async function fetchPublicAllTimeLeaderboard(): Promise<PublicAllTimeLeaderboardPayload> {
  return (await fetchStandings("/api/standings")) as PublicAllTimeLeaderboardPayload;
}

/** Owner view: standings across the signed-in account's own sessions. */
export function useAllTimeLeaderboard() {
  return useQuery({
    queryKey: allTimeLeaderboardQueryKey,
    queryFn: fetchAllTimeLeaderboard,
    ...ownerHubQueryOptions,
  });
}

/** Public view: club-wide standings, no sign-in required. */
export function usePublicAllTimeLeaderboard() {
  return useQuery({
    queryKey: publicAllTimeLeaderboardQueryKey,
    queryFn: fetchPublicAllTimeLeaderboard,
    ...ownerHubQueryOptions,
  });
}
