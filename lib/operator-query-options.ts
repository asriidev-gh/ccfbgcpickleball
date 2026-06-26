/** React Query defaults for the operator game dashboard. */
export const OPERATOR_QUEUE_STALE_TIME_MS = 30_000;

export const operatorShellQueryOptions = {
  staleTime: Number.POSITIVE_INFINITY,
  gcTime: 30 * 60_000,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
} as const;

export const operatorQueueQueryOptions = {
  staleTime: OPERATOR_QUEUE_STALE_TIME_MS,
  gcTime: 10 * 60_000,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
} as const;

export const operatorDetailsQueryOptions = {
  staleTime: OPERATOR_QUEUE_STALE_TIME_MS,
  gcTime: 10 * 60_000,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
} as const;

export const operatorMatchHistoryQueryOptions = {
  staleTime: OPERATOR_QUEUE_STALE_TIME_MS,
  gcTime: 10 * 60_000,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
} as const;
