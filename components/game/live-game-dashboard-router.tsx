"use client";

import { Loader2 } from "lucide-react";
import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { GameDashboard } from "@/components/game/game-dashboard";
import { useHydrateOperatorDashboardSessionCache } from "@/hooks/use-hydrate-operator-dashboard-session-cache";
import {
  fetchOperatorShell,
  operatorQueueQueryKey,
  operatorShellQueryKey,
} from "@/lib/fetch-operator-game";
import {
  writeOperatorQueueSessionCache,
  writeOperatorShellSessionCache,
} from "@/lib/operator-dashboard-session-cache";
import type { OperatorQueuePayload, OperatorShellPayload } from "@/lib/operator-payload";
import { isSinglesGameMode } from "@/lib/singles/singles-constants";
import { operatorShellQueryOptions } from "@/lib/operator-query-options";

const SinglesGameDashboard = dynamic(
  () => import("@/components/singles/singles-game-dashboard").then((mod) => mod.SinglesGameDashboard),
  {
    loading: () => (
      <main className="flex min-h-screen items-center justify-center p-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-5 animate-spin" aria-hidden />
          Loading session…
        </div>
      </main>
    ),
  },
);

type LiveGameDashboardRouterProps = {
  /** Server-loaded payloads; seed the cache so the dashboard needs no initial client fetches. */
  initialShell?: OperatorShellPayload;
  initialQueue?: OperatorQueuePayload;
  /** Server data still streaming: show the loading state without fetching. */
  pending?: boolean;
};

export function LiveGameDashboardRouter({
  initialShell,
  initialQueue,
  pending = false,
}: LiveGameDashboardRouterProps) {
  const gameId = String(useParams().id ?? "");
  const queryClient = useQueryClient();

  // Seed before any query observer mounts; never overwrite data already in the cache.
  useState(() => {
    if (initialShell && !queryClient.getQueryData(operatorShellQueryKey(gameId))) {
      queryClient.setQueryData(operatorShellQueryKey(gameId), initialShell);
    }
    if (initialQueue && !queryClient.getQueryData(operatorQueueQueryKey(gameId))) {
      queryClient.setQueryData(operatorQueueQueryKey(gameId), initialQueue);
    }
  });

  useEffect(() => {
    if (initialShell) writeOperatorShellSessionCache(gameId, initialShell);
    if (initialQueue) writeOperatorQueueSessionCache(gameId, initialQueue);
  }, [gameId, initialShell, initialQueue]);

  useHydrateOperatorDashboardSessionCache(queryClient, gameId);

  const shellQuery = useQuery({
    queryKey: operatorShellQueryKey(gameId),
    queryFn: () => fetchOperatorShell(gameId),
    enabled: Boolean(gameId) && !pending,
    ...operatorShellQueryOptions,
  });

  if (shellQuery.isPending && !shellQuery.data) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-5 animate-spin" aria-hidden />
          Loading session…
        </div>
      </main>
    );
  }

  if (isSinglesGameMode(shellQuery.data?.game.gameMode)) {
    return <SinglesGameDashboard />;
  }

  return <GameDashboard mode="operator" />;
}
