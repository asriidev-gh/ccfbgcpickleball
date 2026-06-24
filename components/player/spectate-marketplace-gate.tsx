"use client";

import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { getLinkedPlayerIdForGame } from "@/lib/player-session";
import {
  fetchSpectatePlayerFeatures,
  spectatePlayerFeaturesQueryKey,
} from "@/lib/fetch-spectate-player-features";
import { spectatorNavQueryOptions } from "@/lib/spectator-query-options";

export function SpectateMarketplaceGate({
  gameId,
  children,
}: {
  gameId: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [sessionChecked, setSessionChecked] = useState(false);

  useEffect(() => {
    const readSession = () => {
      setPlayerId(getLinkedPlayerIdForGame(gameId));
      setSessionChecked(true);
    };
    readSession();
    window.addEventListener("focus", readSession);
    return () => window.removeEventListener("focus", readSession);
  }, [gameId]);

  const featuresQuery = useQuery({
    queryKey: spectatePlayerFeaturesQueryKey(gameId, playerId ?? ""),
    queryFn: () => fetchSpectatePlayerFeatures(gameId, playerId!),
    enabled: Boolean(playerId),
    retry: false,
    ...spectatorNavQueryOptions,
  });

  useEffect(() => {
    if (!sessionChecked) return;

    if (!playerId) {
      router.replace(`/games/${gameId}/spectate`);
      return;
    }

    if (featuresQuery.isPending) return;

    if (featuresQuery.isError || !featuresQuery.data?.showMarketplace) {
      router.replace(`/games/${gameId}/spectate`);
    }
  }, [
    sessionChecked,
    playerId,
    featuresQuery.isPending,
    featuresQuery.isError,
    featuresQuery.data,
    gameId,
    router,
  ]);

  if (!sessionChecked || !playerId || featuresQuery.isPending || !featuresQuery.data?.showMarketplace) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center px-6 py-12 text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" aria-hidden />
        Loading marketplace…
      </div>
    );
  }

  return <>{children}</>;
}
