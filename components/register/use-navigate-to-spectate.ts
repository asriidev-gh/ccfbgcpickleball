"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { toast } from "sonner";

import { refreshSpectatorLive } from "@/lib/fetch-spectate-game";
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
      try {
        await refreshSpectatorLive(queryClient, gameId);
      } catch (error) {
        if (isSpectatorViewUnavailableError(error)) {
          toast.error(error.message);
        }
        // Still open the live view so the full-screen message can appear.
      } finally {
        router.push(`/games/${gameId}/spectate`);
        setNavigating(false);
      }
    },
    [gameId, navigating, queryClient, router],
  );

  return { navigateToSpectate, navigating };
}
