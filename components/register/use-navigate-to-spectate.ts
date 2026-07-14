"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { toast } from "sonner";

import { shouldSuppressUserNotification } from "@/lib/infrastructure-error";
import {
  fetchSpectateGame,
  spectatorLiveQueryKey,
} from "@/lib/fetch-spectate-game";
import { isSpectatorViewUnavailableError } from "@/lib/spectator-availability-shared";
import {
  getActiveQueueHighlightPlayerId,
  setQueueHighlightPlayerId,
} from "@/lib/queue-highlight";

export function useNavigateToSpectate(gameId: string) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [navigating, setNavigating] = useState(false);

  const navigateToSpectate = useCallback(
    async (options?: { applyQueueHighlight?: boolean }) => {
      if (!gameId || navigating) return;

      if (options?.applyQueueHighlight !== false) {
        const activePlayerId = getActiveQueueHighlightPlayerId(gameId);
        if (activePlayerId) {
          setQueueHighlightPlayerId(gameId, activePlayerId);
        }
      }

      setNavigating(true);
      // Warm the live query in the background — do not block navigation on it.
      void queryClient
        .prefetchQuery({
          queryKey: spectatorLiveQueryKey(gameId),
          queryFn: () => fetchSpectateGame(gameId, "live"),
          staleTime: 0,
        })
        .catch((error) => {
          if (isSpectatorViewUnavailableError(error) && !shouldSuppressUserNotification(error)) {
            toast.error(error.message);
          }
        });

      router.push(`/games/${gameId}/spectate`);
      setNavigating(false);
    },
    [gameId, navigating, queryClient, router],
  );

  return { navigateToSpectate, navigating };
}
