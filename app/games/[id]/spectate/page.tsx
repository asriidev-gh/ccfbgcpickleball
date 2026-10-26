import { Loader2 } from "lucide-react";
import { Suspense } from "react";

import { SpectatorDashboardClient } from "@/components/game/spectator-dashboard-client";
import { runWithDatabase } from "@/lib/db";
import { loadSpectateLive } from "@/lib/load-spectate-game";
import type { SpectateLivePayload } from "@/lib/spectate-payload";

async function loadInitialLive(gameId: string): Promise<SpectateLivePayload | undefined> {
  try {
    const payload = await runWithDatabase(() => loadSpectateLive(gameId));
    if (!payload) return undefined;
    // Plain JSON so Mongoose documents can cross the server/client boundary.
    return JSON.parse(JSON.stringify(payload)) as SpectateLivePayload;
  } catch {
    // Fall back to the client-side fetch (and its retry/unavailable handling).
    return undefined;
  }
}

async function SpectatorWithLive({ gameId }: { gameId: string }) {
  return <SpectatorDashboardClient initialLive={await loadInitialLive(gameId)} />;
}

export default async function SpectatorDashboardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: gameId } = await params;

  return (
    <Suspense
      fallback={
        <main className="flex min-h-[60vh] items-center justify-center p-6">
          <Loader2 className="size-5 animate-spin text-muted-foreground" aria-label="Loading" />
        </main>
      }
    >
      <SpectatorWithLive gameId={gameId} />
    </Suspense>
  );
}
