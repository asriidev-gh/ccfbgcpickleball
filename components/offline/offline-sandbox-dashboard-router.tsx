"use client";

import { Loader2 } from "lucide-react";
import { useParams } from "next/navigation";

import { GameDashboard } from "@/components/game/game-dashboard";
import { SinglesGameDashboard } from "@/components/singles/singles-game-dashboard";
import { useQuickGameSessionAfterMount } from "@/hooks/use-quick-game-session-after-mount";
import { isOfflineSandboxGame } from "@/lib/offline-sandbox-id";

/**
 * Isolated router for offline sandbox sessions (`of_*`).
 * Reuses GameDashboard in client-only mode; never loads live Mongo queue APIs.
 */
export function OfflineSandboxDashboardRouter() {
  const gameId = String(useParams().id ?? "");
  const { payload, mounted } = useQuickGameSessionAfterMount(
    isOfflineSandboxGame(gameId) ? gameId : "",
  );

  if (!mounted) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-5 animate-spin" aria-hidden />
          Loading offline sandbox…
        </div>
      </main>
    );
  }

  if (!isOfflineSandboxGame(gameId) || !payload) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <div className="max-w-md space-y-2 text-center">
          <p className="text-base font-medium text-foreground">Offline session not found</p>
          <p className="text-sm text-muted-foreground">
            This offline sandbox is no longer in this browser tab. Open the live game dashboard and
            choose Switch offline mode again.
          </p>
        </div>
      </main>
    );
  }

  if (payload.game.gameMode === "singles") {
    return <SinglesGameDashboard />;
  }

  return <GameDashboard mode="operator" />;
}
