/** Shared React Query cache defaults for owner hub pages (dashboard, my-club, users, etc.). */
export const OWNER_HUB_STALE_TIME_MS = 10 * 60_000;

export const ownerHubQueryOptions = {
  staleTime: OWNER_HUB_STALE_TIME_MS,
  gcTime: 30 * 60_000,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
} as const;
