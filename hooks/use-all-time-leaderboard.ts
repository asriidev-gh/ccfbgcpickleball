"use client";

import { useQuery } from "@tanstack/react-query";

import type { AllTimeLeaderboardPayload } from "@/lib/all-time-leaderboard";
import type { PublicAllTimeLeaderboardPayload } from "@/lib/public-all-time-leaderboard";
import { ownerHubQueryOptions } from "@/lib/owner-hub-query-options";
import { DEFAULT_SPORT, type Sport } from "@/lib/sports";

export const allTimeLeaderboardQueryKey = (sport: Sport = DEFAULT_SPORT) =>
  ["all-time-leaderboard", sport] as const;
export const publicAllTimeLeaderboardQueryKey = (sport: Sport = DEFAULT_SPORT) =>
  ["all-time-leaderboard", "public", sport] as const;

async function fetchStandings(url: string) {
  const response = await fetch(url);
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(payload?.message ?? "Failed to load the all-time leaderboard.");
  }
  return await response.json();
}

export async function fetchAllTimeLeaderboard(
  sport: Sport = DEFAULT_SPORT,
): Promise<AllTimeLeaderboardPayload> {
  return (await fetchStandings(`/api/leaderboard/all-time?sport=${sport}`)) as AllTimeLeaderboardPayload;
}

export async function fetchPublicAllTimeLeaderboard(
  sport: Sport = DEFAULT_SPORT,
): Promise<PublicAllTimeLeaderboardPayload> {
  return (await fetchStandings(`/api/standings?sport=${sport}`)) as PublicAllTimeLeaderboardPayload;
}

/** Owner view: standings across the signed-in account's own sessions of one sport. */
export function useAllTimeLeaderboard(sport: Sport = DEFAULT_SPORT) {
  return useQuery({
    queryKey: allTimeLeaderboardQueryKey(sport),
    queryFn: () => fetchAllTimeLeaderboard(sport),
    ...ownerHubQueryOptions,
  });
}

/** Public view: club-wide standings for one sport, no sign-in required. */
export function usePublicAllTimeLeaderboard(sport: Sport = DEFAULT_SPORT) {
  return useQuery({
    queryKey: publicAllTimeLeaderboardQueryKey(sport),
    queryFn: () => fetchPublicAllTimeLeaderboard(sport),
    ...ownerHubQueryOptions,
  });
}
