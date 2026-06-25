"use client";

import { Loader2 } from "lucide-react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

import { GameDashboard } from "@/components/game/game-dashboard";
import { SinglesGameDashboard } from "@/components/singles/singles-game-dashboard";
import {
  fetchOperatorShell,
  operatorShellQueryKey,
} from "@/lib/fetch-operator-game";
import { isSinglesGameMode } from "@/lib/singles/singles-constants";
import { operatorShellQueryOptions } from "@/lib/operator-query-options";

export function LiveGameDashboardRouter() {
  const gameId = String(useParams().id ?? "");
  const shellQuery = useQuery({
    queryKey: operatorShellQueryKey(gameId),
    queryFn: () => fetchOperatorShell(gameId),
    enabled: Boolean(gameId),
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
