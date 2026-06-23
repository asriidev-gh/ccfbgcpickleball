"use client";

import { Loader2 } from "lucide-react";
import { useParams } from "next/navigation";

import { GameDashboard } from "@/components/game/game-dashboard";
import { SinglesGameDashboard } from "@/components/singles/singles-game-dashboard";
import { useQuickGameSessionAfterMount } from "@/hooks/use-quick-game-session-after-mount";
import { isEphemeralQuickGame } from "@/lib/local-game-id";

type QuickPlayDashboardRouterProps = {
  quickGameSurface: "account" | "ephemeral";
};

export function QuickPlayDashboardRouter({ quickGameSurface }: QuickPlayDashboardRouterProps) {
  const gameId = String(useParams().id ?? "");
  const { payload, mounted } = useQuickGameSessionAfterMount(gameId);

  if (!mounted) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-5 animate-spin" aria-hidden />
          Loading session…
        </div>
      </main>
    );
  }

  if (
    payload?.game.gameMode === "singles" &&
    isEphemeralQuickGame(gameId) &&
    quickGameSurface === "ephemeral"
  ) {
    return <SinglesGameDashboard quickGameSurface={quickGameSurface} />;
  }

  return <GameDashboard mode="operator" quickGameSurface={quickGameSurface} />;
}
