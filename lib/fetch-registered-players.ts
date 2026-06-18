import type { QueryClient } from "@tanstack/react-query";

import type { OwnerSessionInsightFilter } from "@/lib/owner-session-insight-filter-shared";
import type { OwnerRegisteredPlayersPage } from "@/lib/owner-registered-players-shared";
import type { OwnerSessionFilterOption } from "@/lib/owner-session-filter-options-shared";

export function ownerSessionFilterOptionsQueryKey() {
  return ["owner-session-filter-options"] as const;
}

export function ownerRegisteredPlayersQueryKey(
  page: number,
  search: string,
  sessionGameId: string,
  insightFilter: string,
  attendedCcf: boolean,
  notAttendedCcf: boolean,
  withDgroup: boolean,
  noDgroupYet: boolean,
) {
  return [
    "owner-registered-players",
    page,
    search,
    sessionGameId,
    insightFilter,
    attendedCcf,
    notAttendedCcf,
    withDgroup,
    noDgroupYet,
  ] as const;
}

async function fetchOwnerSessionFilterOptions() {
  const response = await fetch("/api/owner/registered-players/session-options");
  const payload = (await response.json()) as {
    sessions: OwnerSessionFilterOption[];
    message?: string;
  };
  if (!response.ok) throw new Error(payload.message ?? "Failed to load sessions.");
  return payload;
}

async function fetchOwnerRegisteredPlayersPage(
  page: number,
  search: string,
  sessionGameId: string,
  insightFilter: string,
  attendedCcf: boolean,
  notAttendedCcf: boolean,
  withDgroup: boolean,
  noDgroupYet: boolean,
) {
  const params = new URLSearchParams({
    page: String(page),
  });
  if (search) params.set("q", search);
  if (sessionGameId) params.set("gameId", sessionGameId);
  if (insightFilter && sessionGameId) params.set("insight", insightFilter);
  if (attendedCcf) params.set("attendedCcf", "true");
  if (notAttendedCcf) params.set("notAttendedCcf", "true");
  if (withDgroup) params.set("withDgroup", "true");
  if (noDgroupYet) params.set("noDgroupYet", "true");

  const response = await fetch(`/api/owner/registered-players?${params.toString()}`);
  const payload = (await response.json()) as OwnerRegisteredPlayersPage & {
    count: number;
    message?: string;
  };
  if (!response.ok) throw new Error(payload.message ?? "Failed to load registered players.");
  return payload;
}

const warmedInsightKeys = new Set<string>();

/** Warm registered-players data before navigating from dashboard insight links. */
export function prefetchRegisteredPlayersInsight(
  queryClient: QueryClient,
  gameId: string,
  insight: OwnerSessionInsightFilter,
) {
  if (!gameId) return;

  const warmKey = `${gameId}:${insight}`;
  if (warmedInsightKeys.has(warmKey)) return;
  warmedInsightKeys.add(warmKey);

  void queryClient.prefetchQuery({
    queryKey: ownerSessionFilterOptionsQueryKey(),
    queryFn: fetchOwnerSessionFilterOptions,
    staleTime: 60_000,
  });

  void queryClient.prefetchQuery({
    queryKey: ownerRegisteredPlayersQueryKey(1, "", gameId, insight, false, false, false, false),
    queryFn: () => fetchOwnerRegisteredPlayersPage(1, "", gameId, insight, false, false, false, false),
    staleTime: 30_000,
  });
}

export { fetchOwnerRegisteredPlayersPage, fetchOwnerSessionFilterOptions };
