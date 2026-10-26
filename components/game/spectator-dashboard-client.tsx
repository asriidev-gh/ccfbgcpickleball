"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { useState } from "react";

import { GameDashboard } from "@/components/game/game-dashboard";
import { spectatorLiveQueryKey } from "@/lib/fetch-spectate-game";
import type { SpectateLivePayload } from "@/lib/spectate-payload";

/** Seeds the spectator live query with the server-loaded payload, then renders the dashboard. */
export function SpectatorDashboardClient({ initialLive }: { initialLive?: SpectateLivePayload }) {
  const gameId = String(useParams().id ?? "");
  const queryClient = useQueryClient();

  // Seed before any query observer mounts; never overwrite data already in the cache.
  useState(() => {
    if (initialLive && !queryClient.getQueryData(spectatorLiveQueryKey(gameId))) {
      queryClient.setQueryData(spectatorLiveQueryKey(gameId), initialLive);
    }
  });

  return <GameDashboard mode="spectator" />;
}
