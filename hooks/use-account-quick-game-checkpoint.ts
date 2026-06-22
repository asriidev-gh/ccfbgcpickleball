"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";

import { isAccountQuickGame } from "@/lib/local-game-id";
import type { OperatorFullPayload } from "@/lib/operator-payload";
import { saveQuickGameSession } from "@/lib/quick-game-persistence-client";

const CHECKPOINT_DEBOUNCE_MS = 45_000;

export function useAccountQuickGameCheckpoint(
  gameId: string,
  payload: OperatorFullPayload | undefined,
) {
  const queryClient = useQueryClient();
  const payloadRef = useRef(payload);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const enabled = isAccountQuickGame(gameId) && payload?.game.status === "active";

  payloadRef.current = payload;

  useEffect(() => {
    if (!enabled) return;

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const current = payloadRef.current;
      if (!current || current.game.status !== "active") return;
      void saveQuickGameSession(gameId, current, "checkpoint").catch(() => {
        // Best-effort checkpoint; ignore transient failures.
      });
    }, CHECKPOINT_DEBOUNCE_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [enabled, gameId, payload]);

  useEffect(() => {
    if (!isAccountQuickGame(gameId)) return;

    return () => {
      const current = payloadRef.current;
      if (!current || current.game.status !== "active") return;
      void saveQuickGameSession(gameId, current, "exit").catch(() => {
        // Best-effort save on leave.
      });
      void queryClient.invalidateQueries({ queryKey: ["saved-quick-games"] });
    };
  }, [gameId, queryClient]);
}
