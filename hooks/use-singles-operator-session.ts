"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { useOperatorDashboardLease } from "@/hooks/use-operator-dashboard-lease";
import {
  fetchOperatorDetails,
  fetchOperatorQueue,
  fetchOperatorShell,
  operatorDetailsQueryKey,
  operatorQueueQueryKey,
  operatorShellQueryKey,
} from "@/lib/fetch-operator-game";
import { isQuickGame } from "@/lib/local-game-id";
import { mergeOperatorGamePayload } from "@/lib/operator-payload";
import type { OperatorFullPayload, OperatorShellPayload } from "@/lib/operator-payload";
import {
  operatorDetailsQueryOptions,
  operatorQueueQueryOptions,
  operatorShellQueryOptions,
} from "@/lib/operator-query-options";
import { useQuickGameSessionAfterMount } from "@/hooks/use-quick-game-session-after-mount";
import { useQuickGameSession } from "@/lib/quick-game-store";

function operatorPlaceholderShell(gameId: string): OperatorShellPayload {
  return {
    game: {
      title: "",
      openPlayType: "",
      courtCount: 0,
      gameId,
      status: "active",
    },
  };
}

export function useSinglesOperatorSession(gameId: string) {
  const isQuickGameSession = isQuickGame(gameId);
  const { mounted: quickMounted } = useQuickGameSessionAfterMount(isQuickGameSession ? gameId : "");
  const quickPayload = useQuickGameSession(isQuickGameSession ? gameId : "");

  const {
    leaseState: operatorLeaseState,
    hasDashboardLease,
  } = useOperatorDashboardLease(gameId, !isQuickGameSession);

  const operatorCanLoadData =
    !isQuickGameSession &&
    operatorLeaseState.status !== "blocked" &&
    operatorLeaseState.status !== "unauthorized";

  const operatorShellQuery = useQuery({
    queryKey: operatorShellQueryKey(gameId),
    queryFn: () => fetchOperatorShell(gameId),
    enabled: Boolean(gameId) && operatorCanLoadData,
    ...operatorShellQueryOptions,
  });

  const operatorQueueQuery = useQuery({
    queryKey: operatorQueueQueryKey(gameId),
    queryFn: () => fetchOperatorQueue(gameId),
    enabled: Boolean(gameId) && operatorCanLoadData,
    ...operatorQueueQueryOptions,
  });

  const operatorDetailsQuery = useQuery({
    queryKey: operatorDetailsQueryKey(gameId),
    queryFn: () => fetchOperatorDetails(gameId),
    enabled: Boolean(gameId) && operatorCanLoadData,
    ...operatorDetailsQueryOptions,
  });

  const payload = useMemo((): OperatorFullPayload | undefined => {
    if (isQuickGameSession) return quickPayload ?? undefined;
    const shell = operatorShellQuery.data ?? operatorPlaceholderShell(gameId);
    return mergeOperatorGamePayload(
      shell,
      operatorQueueQuery.data,
      operatorDetailsQuery.data,
    );
  }, [
    gameId,
    isQuickGameSession,
    operatorDetailsQuery.data,
    operatorQueueQuery.data,
    operatorShellQuery.data,
    quickPayload,
  ]);

  const isLoading = isQuickGameSession
    ? !quickMounted
    : operatorShellQuery.isPending || operatorQueueQuery.isPending;

  return {
    payload,
    isQuickGameSession,
    isLoading,
    operatorLeaseState,
    hasDashboardLease,
    operatorCanLoadData,
    operatorShellQuery,
    operatorQueueQuery,
    operatorDetailsQuery,
  };
}
