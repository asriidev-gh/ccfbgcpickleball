/** Shared React Query defaults for public spectator views. */
export const SPECTATOR_LIVE_STALE_TIME_MS = 30_000;
export const SPECTATOR_NAV_STALE_TIME_MS = 10 * 60_000;

export const spectatorLiveQueryOptions = {
  staleTime: SPECTATOR_LIVE_STALE_TIME_MS,
  gcTime: 5 * 60_000,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
  refetchIntervalInBackground: false,
} as const;

export const spectatorMatchHistoryQueryOptions = {
  staleTime: SPECTATOR_LIVE_STALE_TIME_MS,
  gcTime: 5 * 60_000,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
  refetchIntervalInBackground: false,
} as const;

export const spectatorRecapQueryOptions = {
  staleTime: SPECTATOR_LIVE_STALE_TIME_MS,
  gcTime: 5 * 60_000,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
  refetchIntervalInBackground: false,
} as const;

export const spectatorDetailsQueryOptions = {
  staleTime: SPECTATOR_LIVE_STALE_TIME_MS,
  gcTime: 5 * 60_000,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
  refetchIntervalInBackground: false,
} as const;

export const spectatorEndorsementQueryOptions = {
  staleTime: 60_000,
  gcTime: 5 * 60_000,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
  refetchIntervalInBackground: false,
} as const;

/** Club profile, community posts, player menu — changes infrequently during open play. */
export const spectatorNavQueryOptions = {
  staleTime: SPECTATOR_NAV_STALE_TIME_MS,
  gcTime: 30 * 60_000,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
} as const;

export const spectatorLeaderboardQueryOptions = {
  staleTime: 5 * 60_000,
  gcTime: 30 * 60_000,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
} as const;