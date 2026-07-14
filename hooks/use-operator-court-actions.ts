"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { toastOperationError } from "@/lib/toast-error";

import type { CourtView } from "@/components/game/court-card";
import type { QueueEntryView } from "@/components/game/queue-entry-row";
import type { ReplacePlayerConfirmInput } from "@/components/game/replace-player-dialog";
import type { ReplacePlayerDialogState } from "@/components/game/replace-player-dialog";
import { applyLocalGameMutation } from "@/lib/apply-local-game-mutation";
import { announceCourtEnded } from "@/lib/call-names-speech";
import {
  applyAllCourtsPauseOptimistic,
  applyCancelCourtAssignmentOptimistic,
  applyCancelRematchOptimistic,
  applyCourtPauseOptimistic,
  applyCourtReplaceOptimistic,
  applyEndGameOptimistic,
  applyEndGameWithHistoryOptimistic,
  applyFillNextCourtOptimistic,
  applyQueueReorderOptimistic,
  applyQueueSwapOptimistic,
  applyShuffleNextOptimistic,
  applyQuickShuffleNextOptimistic,
  applySwapCourtTeamsOptimistic,
} from "@/lib/game-payload-mutations";
import type { GamePayload } from "@/lib/game-payload-mutations";
import {
  isCourtsViewQueryKey,
  readCourtsViewGamePayload,
  writeCourtsViewGamePayload,
} from "@/lib/courts-view-cache";
import { fetchOperatorQueue, operatorQueueQueryKey } from "@/lib/fetch-operator-game";
import { isQuickGame } from "@/lib/local-game-id";
import {
  beginCourtClearWait,
  beginOperatorQueueMutation,
  endCourtClearWait,
  endQueuedMutationLock,
  releaseQueueMutationLock,
  waitForCourtClearIfNeeded,
} from "@/lib/operator-queue-mutation-lock";
import { buildQueueNextCourtWaitingSwapOrder } from "@/lib/next-court-match-analysis";
import {
  readOperatorGamePayload,
  writeOperatorGamePayload,
} from "@/lib/operator-game-cache";
import { resolvePlayerId } from "@/lib/resolve-player-id";

type UseOperatorCourtActionsOptions = {
  gameId: string;
  courts: CourtView[];
  enabled: boolean;
  invalidateQueryKey: readonly unknown[];
};

export function useOperatorCourtActions({
  gameId,
  courts,
  enabled,
  invalidateQueryKey,
}: UseOperatorCourtActionsOptions) {
  const queryClient = useQueryClient();
  const queueMutationLockRef = useRef(0);
  const courtClearWaitersRef = useRef(
    new Map<number, { promise: Promise<void>; resolve: () => void }>(),
  );
  const pendingFillCourtNumbersRef = useRef(new Set<number>());
  const [pendingFillCourtNumbers, setPendingFillCourtNumbers] = useState(
    () => new Set<number>(),
  );
  const isLocalGame = isQuickGame(gameId);

  const [replaceDialog, setReplaceDialog] = useState<ReplacePlayerDialogState | null>(null);
  const [cancelCourtTarget, setCancelCourtTarget] = useState<number | null>(null);
  const [cancelRematchTarget, setCancelRematchTarget] = useState<number | null>(null);
  const [endTargetCourt, setEndTargetCourt] = useState<number | null>(null);
  const [pendingWinner, setPendingWinner] = useState<"A" | "B" | null>(null);
  const [endGameRematch, setEndGameRematch] = useState(false);
  const [teamAScore, setTeamAScore] = useState("");
  const [teamBScore, setTeamBScore] = useState("");
  const [rematchCourtNumbers, setRematchCourtNumbers] = useState<Set<number>>(() => new Set());

  const invalidate = useCallback(() => {
    if (isLocalGame) return;
    void queryClient.invalidateQueries({ queryKey: invalidateQueryKey });
  }, [invalidateQueryKey, isLocalGame, queryClient]);

  const readCachedGamePayload = useCallback((): GamePayload | undefined => {
    if (isCourtsViewQueryKey(invalidateQueryKey)) {
      return readCourtsViewGamePayload(queryClient, gameId);
    }
    return readOperatorGamePayload(queryClient, gameId);
  }, [gameId, invalidateQueryKey, queryClient]);

  const writeCachedGamePayload = useCallback(
    (next: GamePayload) => {
      if (isCourtsViewQueryKey(invalidateQueryKey)) {
        writeCourtsViewGamePayload(queryClient, gameId, next);
        return;
      }
      writeOperatorGamePayload(queryClient, gameId, next);
    },
    [gameId, invalidateQueryKey, queryClient],
  );

  const syncAfterMutation = useCallback(async () => {
    if (isLocalGame) return;
    if (isCourtsViewQueryKey(invalidateQueryKey)) {
      await queryClient.invalidateQueries({ queryKey: invalidateQueryKey });
      return;
    }
    const queue = await fetchOperatorQueue(gameId);
    // Another mutation started while fetching — keep its optimistic UI.
    if (queueMutationLockRef.current !== 1) return;
    queryClient.setQueryData(operatorQueueQueryKey(gameId), queue);
  }, [gameId, invalidateQueryKey, isLocalGame, queryClient]);

  const finishQueueMutation = useCallback(() => {
    void endQueuedMutationLock(queueMutationLockRef, syncAfterMutation);
  }, [syncAfterMutation]);

  const closeEndDialog = useCallback(() => {
    setEndTargetCourt(null);
    setPendingWinner(null);
    setEndGameRematch(false);
    setTeamAScore("");
    setTeamBScore("");
  }, []);

  const requestFillCourt = useCallback(
    (courtNumber: number) => {
      if (pendingFillCourtNumbersRef.current.has(courtNumber)) return;

      void (async () => {
        pendingFillCourtNumbersRef.current.add(courtNumber);
        setPendingFillCourtNumbers(new Set(pendingFillCourtNumbersRef.current));

        let previous: GamePayload | undefined;
        let lockAcquired = false;
        try {
          if (isLocalGame) {
            applyLocalGameMutation(
              queryClient,
              gameId,
              (payload) => applyFillNextCourtOptimistic(payload, courtNumber),
              "Failed to fill court.",
            );
            toast.success("Court filled from the queue.");
            return;
          }

          beginOperatorQueueMutation(queryClient, gameId, queueMutationLockRef);
          lockAcquired = true;

          previous = readCachedGamePayload();
          if (previous) {
            const optimistic = applyFillNextCourtOptimistic(previous, courtNumber);
            if (optimistic) {
              writeCachedGamePayload(optimistic);
            }
          }

          await waitForCourtClearIfNeeded(courtClearWaitersRef, courtNumber);

          const maxAttempts = 3;
          let lastMessage = "Failed to fill court.";
          let succeeded = false;

          for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
            const response = await fetch(`/api/games/${gameId}/start`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ courtNumber }),
            });
            const data = await response.json();
            if (response.ok) {
              succeeded = true;
              break;
            }

            lastMessage = typeof data.message === "string" ? data.message : lastMessage;
            const isCourtBusy =
              typeof lastMessage === "string" && /is not available/i.test(lastMessage);
            if (!isCourtBusy || attempt === maxAttempts - 1) {
              throw new Error(lastMessage);
            }

            await new Promise((resolve) => setTimeout(resolve, 500));
          }

          if (!succeeded) {
            throw new Error(lastMessage);
          }

          toast.success("Court filled from the queue.");
        } catch (error) {
          if (lockAcquired && queueMutationLockRef.current <= 1 && previous) {
            writeCachedGamePayload(previous);
          }
          toastOperationError(error, "Failed to fill court.");
        } finally {
          pendingFillCourtNumbersRef.current.delete(courtNumber);
          setPendingFillCourtNumbers(new Set(pendingFillCourtNumbersRef.current));
          if (lockAcquired) {
            finishQueueMutation();
          }
        }
      })();
    },
    [
      finishQueueMutation,
      gameId,
      isLocalGame,
      queryClient,
      readCachedGamePayload,
      writeCachedGamePayload,
    ],
  );

  const startMutation = useMemo(
    () => ({
      mutate: requestFillCourt,
      isPending: pendingFillCourtNumbers.size > 0,
      variables:
        pendingFillCourtNumbers.size > 0
          ? ([...pendingFillCourtNumbers][pendingFillCourtNumbers.size - 1] as number)
          : undefined,
    }),
    [pendingFillCourtNumbers, requestFillCourt],
  );

  const endMutation = useMutation({
    mutationFn: async (input: {
      courtNumber: number;
      winnerTeam: "A" | "B";
      teamAScore: number;
      teamBScore: number;
      rematch: boolean;
    }) => {
      if (isLocalGame) {
        applyLocalGameMutation(
          queryClient,
          gameId,
          (payload) =>
            input.rematch
              ? applyEndGameOptimistic(payload, input)
              : applyEndGameWithHistoryOptimistic(payload, input),
          "Failed to end game.",
        );
        return {
          message: input.rematch
            ? `Court ${input.courtNumber} rematch started — same players, fresh clock.`
            : "Game ended and players returned to the queue.",
          rematch: input.rematch,
        };
      }

      const response = await fetch(`/api/games/${gameId}/end`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      return data as { message?: string; rematch?: boolean };
    },
    onMutate: (variables) => {
      if (!variables.rematch) {
        void announceCourtEnded(variables.courtNumber);
      }
      if (isLocalGame) return {};

      beginOperatorQueueMutation(queryClient, gameId, queueMutationLockRef);
      if (!variables.rematch) {
        beginCourtClearWait(courtClearWaitersRef, variables.courtNumber);
      }
      const previous = readCachedGamePayload();
      if (previous) {
        const optimistic = applyEndGameOptimistic(previous, variables);
        if (optimistic) {
          writeCachedGamePayload(optimistic);
        }
      }

      const previousRematchCourtNumbers = new Set(rematchCourtNumbers);
      if (variables.rematch) {
        setRematchCourtNumbers((prev) => new Set(prev).add(variables.courtNumber));
      } else {
        setRematchCourtNumbers((prev) => {
          const next = new Set(prev);
          next.delete(variables.courtNumber);
          return next;
        });
      }
      closeEndDialog();
      return { previous, previousRematchCourtNumbers };
    },
    onSuccess: (data) => {
      toast.success(data.message ?? "Court updated.");
    },
    onSettled: (_data, _error, variables) => {
      if (!variables.rematch) {
        endCourtClearWait(courtClearWaitersRef, variables.courtNumber);
      }
      finishQueueMutation();
    },
    onError: (error, _, context) => {
      if (!isLocalGame && context?.previous && queueMutationLockRef.current <= 1) {
        writeCachedGamePayload(context.previous);
      }
      if (context?.previousRematchCourtNumbers) {
        setRematchCourtNumbers(context.previousRematchCourtNumbers);
      }
      toastOperationError(error, "Failed to end game.");
    },
  });

  const swapCourtMutation = useMutation({
    mutationFn: async (courtNumber: number) => {
      if (isLocalGame) {
        return { message: "Court teams shuffled." };
      }

      const current = readCachedGamePayload();
      const court = current?.courts.find(
        (item) => item.courtNumber === courtNumber && item.status === "active",
      );
      const teamAPlayerIds = court?.teamA.playerIds
        .map((player) => resolvePlayerId(player))
        .filter((id): id is string => Boolean(id));
      const teamBPlayerIds = court?.teamB.playerIds
        .map((player) => resolvePlayerId(player))
        .filter((id): id is string => Boolean(id));

      const response = await fetch(`/api/games/${gameId}/swap-court`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courtNumber,
          ...(teamAPlayerIds?.length === 2 && teamBPlayerIds?.length === 2
            ? { teamAPlayerIds, teamBPlayerIds }
            : {}),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      return data as { message: string };
    },
    onMutate: (courtNumber) => {
      if (isLocalGame) {
        applyLocalGameMutation(
          queryClient,
          gameId,
          (payload) => applySwapCourtTeamsOptimistic(payload, courtNumber),
          "Active court not found.",
        );
        return {};
      }

      beginOperatorQueueMutation(queryClient, gameId, queueMutationLockRef);
      const previous = readCachedGamePayload();
      if (previous) {
        const optimistic = applySwapCourtTeamsOptimistic(previous, courtNumber);
        if (optimistic) {
          writeCachedGamePayload(optimistic);
        }
      }
      return { previous };
    },
    onSuccess: (data) => {
      toast.success(data.message);
    },
    onSettled: () => {
      if (!isLocalGame) {
        // Optimistic UI already applied — don't refetch and clobber it.
        releaseQueueMutationLock(queueMutationLockRef);
      }
    },
    onError: (error, _, context) => {
      if (!isLocalGame && context?.previous && queueMutationLockRef.current <= 1) {
        writeCachedGamePayload(context.previous);
      }
      toastOperationError(error, "Failed to shuffle teams.");
    },
  });

  const pauseCourtMutation = useMutation({
    mutationFn: async ({ courtNumber, paused }: { courtNumber: number; paused: boolean }) => {
      if (isLocalGame) {
        applyLocalGameMutation(
          queryClient,
          gameId,
          (payload) => applyCourtPauseOptimistic(payload, courtNumber, paused),
          "Active court not found.",
        );
        return { message: paused ? "Court timer paused." : "Court timer resumed." };
      }

      const response = await fetch(`/api/games/${gameId}/pause-court`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courtNumber, paused }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      return data as { message: string };
    },
    onSuccess: (data) => {
      toast.success(data.message);
      invalidate();
    },
    onError: (error) => {
      toastOperationError(error, "Failed to update court timer.");
    },
  });

  const pauseAllCourtsMutation = useMutation({
    mutationFn: async (paused: boolean) => {
      if (isLocalGame) {
        applyLocalGameMutation(
          queryClient,
          gameId,
          (payload) => applyAllCourtsPauseOptimistic(payload, paused),
          "No active courts to update.",
        );
        return { message: paused ? "All courts paused." : "All courts resumed." };
      }

      const response = await fetch(`/api/games/${gameId}/pause-all-courts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paused }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      return data as { message: string };
    },
    onSuccess: (data) => {
      toast.success(data.message);
      invalidate();
    },
    onError: (error) => {
      toastOperationError(error, "Failed to pause courts.");
    },
  });

  const cancelCourtMutation = useMutation({
    mutationFn: async (courtNumber: number) => {
      if (isLocalGame) {
        applyLocalGameMutation(
          queryClient,
          gameId,
          (payload) => applyCancelCourtAssignmentOptimistic(payload, courtNumber),
          "Failed to cancel assignment.",
        );
        return { message: "Court assignment cancelled — players returned to the queue." };
      }

      const response = await fetch(`/api/games/${gameId}/cancel-court`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courtNumber }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      return data as { message: string };
    },
    onMutate: (courtNumber) => {
      if (isLocalGame) return {};

      beginOperatorQueueMutation(queryClient, gameId, queueMutationLockRef);
      beginCourtClearWait(courtClearWaitersRef, courtNumber);
      const previous = readCachedGamePayload();
      if (previous) {
        const optimistic = applyCancelCourtAssignmentOptimistic(previous, courtNumber);
        if (optimistic) {
          writeCachedGamePayload(optimistic);
        }
      }
      setRematchCourtNumbers((prev) => {
        const next = new Set(prev);
        next.delete(courtNumber);
        return next;
      });
      setCancelCourtTarget(null);
      return { previous };
    },
    onSuccess: (data) => {
      toast.success(data.message);
    },
    onSettled: (_data, _error, courtNumber) => {
      endCourtClearWait(courtClearWaitersRef, courtNumber);
      finishQueueMutation();
    },
    onError: (error, _, context) => {
      if (!isLocalGame && context?.previous && queueMutationLockRef.current <= 1) {
        writeCachedGamePayload(context.previous);
      }
      toastOperationError(error, "Failed to cancel assignment.");
    },
  });

  const cancelRematchMutation = useMutation({
    mutationFn: async (courtNumber: number) => {
      if (isLocalGame) {
        applyLocalGameMutation(
          queryClient,
          gameId,
          (payload) => applyCancelRematchOptimistic(payload, courtNumber),
          "Failed to cancel rematch.",
        );
        return { message: "Rematch cancelled — players returned to the queue." };
      }

      const response = await fetch(`/api/games/${gameId}/cancel-rematch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courtNumber }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      return data as { message: string };
    },
    onMutate: (courtNumber) => {
      if (isLocalGame) return {};

      beginOperatorQueueMutation(queryClient, gameId, queueMutationLockRef);
      beginCourtClearWait(courtClearWaitersRef, courtNumber);
      const previous = readCachedGamePayload();
      if (previous) {
        const optimistic = applyCancelRematchOptimistic(previous, courtNumber);
        if (optimistic) {
          writeCachedGamePayload(optimistic);
        }
      }
      setRematchCourtNumbers((prev) => {
        const next = new Set(prev);
        next.delete(courtNumber);
        return next;
      });
      setCancelRematchTarget(null);
      return { previous };
    },
    onSuccess: (data) => {
      toast.success(data.message);
    },
    onSettled: (_data, _error, courtNumber) => {
      endCourtClearWait(courtClearWaitersRef, courtNumber);
      if (!isLocalGame) {
        finishQueueMutation();
      }
    },
    onError: (error, _, context) => {
      if (!isLocalGame && context?.previous && queueMutationLockRef.current <= 1) {
        writeCachedGamePayload(context.previous);
      }
      toastOperationError(error, "Failed to cancel rematch.");
    },
  });

  const shuffleNextMutation = useMutation({
    mutationFn: async () => {
      if (isLocalGame) {
        applyLocalGameMutation(
          queryClient,
          gameId,
          applyShuffleNextOptimistic,
          "Not enough queued players.",
        );
        return { message: "Optimized next four for best balance." };
      }

      const response = await fetch(`/api/games/${gameId}/shuffle-next`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      return data as { message: string };
    },
    onMutate: () => {
      if (isLocalGame) return {};

      const previous = readCachedGamePayload();
      if (previous) {
        const optimistic = applyShuffleNextOptimistic(previous);
        if (optimistic) {
          writeCachedGamePayload(optimistic);
        }
      }
      void queryClient.cancelQueries({ queryKey: invalidateQueryKey });
      return { previous };
    },
    onSuccess: (data) => {
      toast.success(data.message);
      invalidate();
    },
    onError: (error, _, context) => {
      if (!isLocalGame && context?.previous) {
        writeCachedGamePayload(context.previous);
      }
      toastOperationError(error, "Failed to shuffle queue.");
    },
  });

  const quickShuffleNextMutation = useMutation({
    mutationFn: async (nextFourEntryIds: string[]) => {
      if (isLocalGame) {
        return { message: "Shuffled teams." };
      }

      const response = await fetch(`/api/games/${gameId}/shuffle-next`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "quick", nextFourEntryIds }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      return data as { message: string };
    },
    onMutate: () => {
      if (isLocalGame) return {};
      beginOperatorQueueMutation(queryClient, gameId, queueMutationLockRef);
      const previous = readCachedGamePayload();
      return { previous };
    },
    onSettled: () => {
      if (!isLocalGame) {
        releaseQueueMutationLock(queueMutationLockRef);
      }
    },
    onError: (error, _, context) => {
      if (!isLocalGame && context?.previous && queueMutationLockRef.current <= 1) {
        writeCachedGamePayload(context.previous);
      }
      toastOperationError(error, "Failed to shuffle teams.");
    },
  });

  const requestQuickShuffleNext = useCallback(() => {
    const previous = readCachedGamePayload();
    if (!previous) {
      toast.error("Session not found.");
      return;
    }
    if (isLocalGame) {
      applyLocalGameMutation(
        queryClient,
        gameId,
        applyQuickShuffleNextOptimistic,
        "Not enough queued players.",
      );
      return;
    }

    const optimistic = applyQuickShuffleNextOptimistic(previous);
    if (!optimistic) {
      toast.error("Not enough queued players.");
      return;
    }
    writeCachedGamePayload(optimistic);

    const nextFourEntryIds = optimistic.queue.slice(0, 4).map((entry) => String(entry._id));
    quickShuffleNextMutation.mutate(nextFourEntryIds);
  }, [
    gameId,
    isLocalGame,
    queryClient,
    quickShuffleNextMutation,
    readCachedGamePayload,
    writeCachedGamePayload,
  ]);

  const swapNextWaitingMutation = useMutation({
    mutationFn: async (orderedEntryIds: string[]) => {
      if (isLocalGame) {
        applyLocalGameMutation(
          queryClient,
          gameId,
          (payload) => applyQueueReorderOptimistic(payload, orderedEntryIds),
          "Need at least six players in the queue to swap.",
        );
        return { message: "Swapped in the next two players from the waiting line." };
      }

      const response = await fetch(`/api/games/${gameId}/reorder-queue`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedEntryIds }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      return { message: "Swapped in the next two players from the waiting line." };
    },
    onMutate: (orderedEntryIds) => {
      if (isLocalGame) return {};

      const previous = readCachedGamePayload();
      if (previous) {
        const optimistic = applyQueueReorderOptimistic(previous, orderedEntryIds);
        if (optimistic) {
          writeCachedGamePayload(optimistic);
        }
      }
      void queryClient.cancelQueries({ queryKey: invalidateQueryKey });
      return { previous };
    },
    onSuccess: (data) => {
      toast.success(data.message);
      invalidate();
    },
    onError: (error, _, context) => {
      if (!isLocalGame && context?.previous) {
        writeCachedGamePayload(context.previous);
      }
      toastOperationError(error, "Failed to swap waiting players.");
    },
  });

  const replaceMutation = useMutation({
    mutationFn: async (input: { sourceIndex: number; targetIndex: number }) => {
      if (isLocalGame) {
        return { message: "Queue player replaced." };
      }

      const response = await fetch(`/api/games/${gameId}/swap-next`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      return data as { message: string };
    },
    onMutate: (input) => {
      if (isLocalGame) {
        applyLocalGameMutation(
          queryClient,
          gameId,
          (payload) => applyQueueSwapOptimistic(payload, input),
          "Failed to replace player.",
        );
        setReplaceDialog(null);
        return {};
      }

      beginOperatorQueueMutation(queryClient, gameId, queueMutationLockRef);
      const previous = readCachedGamePayload();
      if (previous) {
        const optimistic = applyQueueSwapOptimistic(previous, input);
        if (optimistic) {
          writeCachedGamePayload(optimistic);
        }
      }
      setReplaceDialog(null);
      return { previous };
    },
    onSuccess: (data) => {
      toast.success(data.message);
    },
    onSettled: () => {
      if (!isLocalGame) {
        releaseQueueMutationLock(queueMutationLockRef);
      }
    },
    onError: (error, _, context) => {
      if (!isLocalGame && context?.previous && queueMutationLockRef.current <= 1) {
        writeCachedGamePayload(context.previous);
      }
      toastOperationError(error, "Failed to replace player.");
    },
  });

  const replaceCourtMutation = useMutation({
    mutationFn: async (input: {
      courtNumber: number;
      team: "A" | "B";
      slotIndex: number;
      targetIndex: number;
    }) => {
      if (isLocalGame) {
        return { message: "Court player replaced." };
      }

      const response = await fetch(`/api/games/${gameId}/replace-court-player`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      return data as { message: string };
    },
    onMutate: (input) => {
      if (isLocalGame) {
        applyLocalGameMutation(
          queryClient,
          gameId,
          (payload) => applyCourtReplaceOptimistic(payload, input),
          "Failed to replace player.",
        );
        setReplaceDialog(null);
        return {};
      }

      beginOperatorQueueMutation(queryClient, gameId, queueMutationLockRef);
      const previous = readCachedGamePayload();
      if (previous) {
        const optimistic = applyCourtReplaceOptimistic(previous, input);
        if (optimistic) {
          writeCachedGamePayload(optimistic);
        }
      }
      setReplaceDialog(null);
      return { previous };
    },
    onSuccess: (data) => {
      toast.success(data.message);
    },
    onSettled: () => {
      if (!isLocalGame) {
        releaseQueueMutationLock(queueMutationLockRef);
      }
    },
    onError: (error, _, context) => {
      if (!isLocalGame && context?.previous && queueMutationLockRef.current <= 1) {
        writeCachedGamePayload(context.previous);
      }
      toastOperationError(error, "Failed to replace player.");
    },
  });

  const isCourtRematch = useCallback(
    (court: CourtView) => court.isRematch === true || rematchCourtNumbers.has(court.courtNumber),
    [rematchCourtNumbers],
  );

  const clearingCourtNumbers = useMemo(() => {
    const clearing = new Set<number>();
    if (endMutation.isPending && endMutation.variables != null && !endMutation.variables.rematch) {
      clearing.add(endMutation.variables.courtNumber);
    }
    if (cancelCourtMutation.isPending && cancelCourtMutation.variables != null) {
      clearing.add(cancelCourtMutation.variables);
    }
    return clearing;
  }, [cancelCourtMutation.isPending, cancelCourtMutation.variables, endMutation.isPending, endMutation.variables]);

  const activeCourts = useMemo(
    () => courts.filter((court) => court.status === "active"),
    [courts],
  );

  const allActiveCourtsPaused =
    activeCourts.length > 0 && activeCourts.every((court) => Boolean(court.pausedAt));

  const courtReplacePendingKey = null;

  const fillingCourtNumber =
    [...pendingFillCourtNumbers].find((courtNumber) =>
      courts.some((court) => court.courtNumber === courtNumber && court.status !== "active"),
    ) ?? null;

  const handleReplaceConfirm = useCallback(
    (input: ReplacePlayerConfirmInput) => {
      if (input.kind === "queue") {
        replaceMutation.mutate({
          sourceIndex: input.sourceIndex,
          targetIndex: input.targetIndex,
        });
        return;
      }
      replaceCourtMutation.mutate({
        courtNumber: input.courtNumber,
        team: input.team,
        slotIndex: input.slotIndex,
        targetIndex: input.targetIndex,
      });
    },
    [replaceCourtMutation, replaceMutation],
  );

  const openEndGameDialog = useCallback((courtNumber: number) => {
    setPendingWinner(null);
    setTeamAScore("");
    setTeamBScore("");
    setEndGameRematch(false);
    setEndTargetCourt(courtNumber);
  }, []);

  const getCourtCardProps = useCallback(
    (
      court: CourtView,
      queueCounts: { queuedCount: number; waitingLineCount: number; canFillFromQueue?: boolean },
      onFillCourt: (courtNumber: number) => void,
    ) => {
      if (!enabled) {
        return {
          hideEndGame: true,
          onEndGame: () => {},
        };
      }

      const emptyCourtNumbers = courts
        .filter((item) => item.status === "empty")
        .map((item) => item.courtNumber);

      const canReplaceFromCourt =
        court.status === "active" &&
        (queueCounts.queuedCount > 0 || queueCounts.waitingLineCount > 0);

      return {
        hideEndGame: false,
        canReplacePlayers: canReplaceFromCourt,
        onReplacePlayer: ({
          courtNumber,
          team,
          slotIndex,
          player,
        }: {
          courtNumber: number;
          team: "A" | "B";
          slotIndex: number;
          player: QueueEntryView["playerId"];
        }) =>
          setReplaceDialog({
            kind: "court",
            courtNumber,
            team,
            slotIndex,
            player,
          }),
        replacePendingKey: courtReplacePendingKey,
        onEndGame: () => openEndGameDialog(court.courtNumber),
        onSwapTeams: () => {
          swapCourtMutation.mutate(court.courtNumber);
        },
        swapPending: false,
        onTogglePause:
          court.status === "active"
            ? () =>
                pauseCourtMutation.mutate({
                  courtNumber: court.courtNumber,
                  paused: !court.pausedAt,
                })
            : undefined,
        pausePending:
          pauseAllCourtsMutation.isPending ||
          (pauseCourtMutation.isPending &&
            pauseCourtMutation.variables?.courtNumber === court.courtNumber),
        onCancelAssignment:
          court.status === "active" && !isCourtRematch(court)
            ? () => setCancelCourtTarget(court.courtNumber)
            : undefined,
        cancelPending:
          cancelCourtMutation.isPending && cancelCourtMutation.variables === court.courtNumber,
        onCancelRematch:
          court.status === "active" && isCourtRematch(court)
            ? () => setCancelRematchTarget(court.courtNumber)
            : undefined,
        cancelRematchPending:
          cancelRematchMutation.isPending && cancelRematchMutation.variables === court.courtNumber,
        isFilling:
          fillingCourtNumber != null &&
          court.courtNumber === fillingCourtNumber &&
          court.status !== "active",
        isClearing:
          clearingCourtNumbers.has(court.courtNumber) && court.status === "active",
        onFillCourt:
          court.status === "empty" ? () => onFillCourt(court.courtNumber) : undefined,
        canFillCourt:
          court.status === "empty" &&
          emptyCourtNumbers.includes(court.courtNumber) &&
          (queueCounts.canFillFromQueue ?? queueCounts.queuedCount >= 4),
        fillCourtPending: pendingFillCourtNumbers.has(court.courtNumber),
      };
    },
    [
      cancelCourtMutation.isPending,
      cancelCourtMutation.variables,
      cancelRematchMutation.isPending,
      cancelRematchMutation.variables,
      clearingCourtNumbers,
      courtReplacePendingKey,
      courts,
      enabled,
      fillingCourtNumber,
      isCourtRematch,
      openEndGameDialog,
      pauseAllCourtsMutation.isPending,
      pauseCourtMutation,
      pendingFillCourtNumbers,
      swapCourtMutation,
    ],
  );

  return {
    startMutation,
    endMutation,
    shuffleNextMutation,
    quickShuffleNextMutation,
    requestQuickShuffleNext,
    swapNextWaitingMutation,
    replaceMutation,
    pauseAllCourtsMutation,
    cancelCourtMutation,
    cancelRematchMutation,
    replaceDialog,
    setReplaceDialog,
    cancelCourtTarget,
    setCancelCourtTarget,
    cancelRematchTarget,
    setCancelRematchTarget,
    endTargetCourt,
    pendingWinner,
    setPendingWinner,
    endGameRematch,
    setEndGameRematch,
    teamAScore,
    setTeamAScore,
    teamBScore,
    setTeamBScore,
    closeEndDialog,
    handleReplaceConfirm,
    getCourtCardProps,
    activeCourts,
    allActiveCourtsPaused,
    fillingCourtNumber,
    pendingFillCourtNumbers,
    replacePendingSourceIndex: null,
  };
}
