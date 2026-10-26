import { Suspense } from "react";

import { LiveGameDashboardRouter } from "@/components/game/live-game-dashboard-router";
import { QuickPlayDashboardRouter } from "@/components/play/quick-play-dashboard-router";
import { authorizeAuthPayload, readAuthTokenPayload } from "@/lib/auth";
import { runWithDatabase } from "@/lib/db";
import { loadOperatorQueueState, loadOperatorShell } from "@/lib/load-operator-game";
import { isQuickGame } from "@/lib/local-game-id";
import type { OperatorQueuePayload, OperatorShellPayload } from "@/lib/operator-payload";

async function loadInitialOperatorGame(gameId: string) {
  try {
    return await runWithDatabase(async () => {
      const tokenPayload = await readAuthTokenPayload();
      if (!tokenPayload) return null;
      const authUser = await authorizeAuthPayload(tokenPayload);
      if (!authUser) return null;

      const [shell, queue] = await Promise.all([
        loadOperatorShell(gameId, authUser.userId),
        loadOperatorQueueState(gameId, authUser.userId),
      ]);
      if (!shell || !queue) return null;
      // Plain JSON so Mongoose documents can cross the server/client boundary.
      return JSON.parse(JSON.stringify({ shell, queue })) as {
        shell: OperatorShellPayload;
        queue: OperatorQueuePayload;
      };
    });
  } catch {
    // Fall back to the client-side fetches (and their retry/error handling).
    return null;
  }
}

async function LiveGame({ gameId }: { gameId: string }) {
  const initial = await loadInitialOperatorGame(gameId);
  return (
    <LiveGameDashboardRouter
      initialShell={initial?.shell}
      initialQueue={initial?.queue}
    />
  );
}

export default async function GameDashboardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: gameId } = await params;

  if (isQuickGame(gameId)) {
    return <QuickPlayDashboardRouter quickGameSurface="account" />;
  }

  return (
    <Suspense fallback={<LiveGameDashboardRouter pending />}>
      <LiveGame gameId={gameId} />
    </Suspense>
  );
}
