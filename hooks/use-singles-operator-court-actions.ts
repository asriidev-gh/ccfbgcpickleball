"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import type { CourtView } from "@/components/game/court-card";
import { applyCourtPauseOptimistic, applyAllCourtsPauseOptimistic } from "@/lib/game-payload-mutations";
import {
  readOperatorGamePayload,
  writeOperatorGamePayload,
} from "@/lib/operator-game-cache";
import {
  applySinglesCancelCourtAssignmentOptimistic,
  applySinglesEndGameWithHistoryOptimistic,
  applySinglesFillCourtOptimistic,
  canSinglesFillCourt,
  type SinglesEndGameInput,
} from "@/lib/singles/singles-payload-mutations";
import { SINGLES_MIN_QUEUE_TO_FILL } from "@/lib/singles/singles-constants";
import {
  canCancelCourtAssignment,
  toCourtTimerClock,
} from "@/lib/court-cancel-grace";
import { toastOperationError } from "@/lib/toast-error";

type UseSinglesOperatorCourtActionsOptions = {
  gameId: string;
  courts: CourtView[];
  enabled: boolean;
};

export function useSinglesOperatorCourtActions({
  gameId,
  courts,
  enabled,
}: UseSinglesOperatorCourtActionsOptions) {
  const queryClient = useQueryClient();
  const [cancelCourtTarget, setCancelCourtTarget] = useState<number | null>(null);
  const [endTargetCourt, setEndTargetCourt] = useState<number | null>(null);
  const [pendingWinner, setPendingWinner] = useState<"A" | "B" | null>(null);
  const [endGameRematch, setEndGameRematch] = useState(false);
  const [teamAScore, setTeamAScore] = useState("");
  const [teamBScore, setTeamBScore] = useState("");

  const closeEndDialog = useCallback(() => {
    setEndTargetCourt(null);
    setPendingWinner(null);
    setEndGameRematch(false);
    setTeamAScore("");
    setTeamBScore("");
  }, []);

  const fillMutation = useMutation({
    mutationFn: async (courtNumber: number) => courtNumber,
    onMutate: async (courtNumber) => {
      const previous = readOperatorGamePayload(queryClient, gameId);
      if (!previous) return { previous: undefined };
      const optimistic = applySinglesFillCourtOptimistic(previous, courtNumber);
      if (!optimistic) return { previous };
      writeOperatorGamePayload(queryClient, gameId, optimistic);
      return { previous };
    },
    onSuccess: () => toast.success("Court filled from the queue."),
    onError: (error, _, context) => {
      if (context?.previous) writeOperatorGamePayload(queryClient, gameId, context.previous);
      toastOperationError(error, "Failed to fill court.");
    },
  });

  const endMutation = useMutation({
    mutationFn: async (input: SinglesEndGameInput) => input,
    onMutate: async (input) => {
      const previous = readOperatorGamePayload(queryClient, gameId);
      if (!previous) return { previous: undefined };
      const optimistic = applySinglesEndGameWithHistoryOptimistic(previous, input);
      if (!optimistic) return { previous };
      writeOperatorGamePayload(queryClient, gameId, optimistic);
      closeEndDialog();
      return { previous };
    },
    onSuccess: (input) => {
      toast.success(
        input.rematch
          ? `Court ${input.courtNumber} rematch started.`
          : "Game ended and players returned to the queue.",
      );
    },
    onError: (error, _, context) => {
      if (context?.previous) writeOperatorGamePayload(queryClient, gameId, context.previous);
      toastOperationError(error, "Failed to end game.");
    },
  });

  const pauseCourtMutation = useMutation({
    mutationFn: async ({ courtNumber, paused }: { courtNumber: number; paused: boolean }) => ({
      courtNumber,
      paused,
    }),
    onMutate: async ({ courtNumber, paused }) => {
      const previous = readOperatorGamePayload(queryClient, gameId);
      if (!previous) return { previous: undefined };
      const optimistic = applyCourtPauseOptimistic(previous, courtNumber, paused);
      if (!optimistic) return { previous };
      writeOperatorGamePayload(queryClient, gameId, optimistic);
      return { previous };
    },
    onError: (error, _, context) => {
      if (context?.previous) writeOperatorGamePayload(queryClient, gameId, context.previous);
      toastOperationError(error, "Failed to update court pause.");
    },
  });

  const pauseAllCourtsMutation = useMutation({
    mutationFn: async (paused: boolean) => paused,
    onMutate: async (paused) => {
      const previous = readOperatorGamePayload(queryClient, gameId);
      if (!previous) return { previous: undefined };
      const optimistic = applyAllCourtsPauseOptimistic(previous, paused);
      if (!optimistic) return { previous };
      writeOperatorGamePayload(queryClient, gameId, optimistic);
      return { previous };
    },
    onError: (error, _, context) => {
      if (context?.previous) writeOperatorGamePayload(queryClient, gameId, context.previous);
      toastOperationError(error, "Failed to update courts.");
    },
  });

  const cancelCourtMutation = useMutation({
    mutationFn: async (courtNumber: number) => courtNumber,
    onMutate: async (courtNumber) => {
      const previous = readOperatorGamePayload(queryClient, gameId);
      if (!previous) return { previous: undefined };
      const optimistic = applySinglesCancelCourtAssignmentOptimistic(previous, courtNumber);
      if (!optimistic) return { previous };
      writeOperatorGamePayload(queryClient, gameId, optimistic);
      return { previous };
    },
    onSuccess: () => toast.success("Court assignment cancelled."),
    onError: (error, _, context) => {
      if (context?.previous) writeOperatorGamePayload(queryClient, gameId, context.previous);
      toastOperationError(error, "Failed to cancel court assignment.");
    },
  });

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

  const fillingCourtNumber =
    fillMutation.isPending && fillMutation.variables != null ? fillMutation.variables : null;

  const openEndGameDialog = useCallback((courtNumber: number) => {
    setPendingWinner(null);
    setTeamAScore("");
    setTeamBScore("");
    setEndGameRematch(false);
    setEndTargetCourt(courtNumber);
  }, []);

  const getCourtCardProps = useCallback(
    (court: CourtView, canFillCourt: boolean) => {
      if (!enabled) {
        return {
          onEndGame: () => {},
        };
      }

      const timerClock = toCourtTimerClock(court);
      const canCancel =
        court.status === "active" && canCancelCourtAssignment(timerClock);

      return {
        onEndGame: () => openEndGameDialog(court.courtNumber),
        onCancelAssignment: canCancel
          ? () => cancelCourtMutation.mutate(court.courtNumber)
          : undefined,
        cancelPending:
          cancelCourtMutation.isPending && cancelCourtMutation.variables === court.courtNumber,
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
        isFilling: fillingCourtNumber != null && court.courtNumber === fillingCourtNumber,
        isClearing: clearingCourtNumbers.has(court.courtNumber),
        onFillCourt:
          court.status === "empty" && canFillCourt
            ? () => fillMutation.mutate(court.courtNumber)
            : undefined,
        canFillCourt: court.status === "empty" && canFillCourt && !clearingCourtNumbers.has(court.courtNumber),
        fillCourtPending: fillMutation.isPending && fillMutation.variables === court.courtNumber,
      };
    },
    [
      cancelCourtMutation.isPending,
      cancelCourtMutation.variables,
      clearingCourtNumbers,
      enabled,
      fillMutation,
      fillingCourtNumber,
      openEndGameDialog,
      pauseAllCourtsMutation.isPending,
      pauseCourtMutation,
    ],
  );

  return {
    fillMutation,
    endMutation,
    pauseAllCourtsMutation,
    cancelCourtMutation,
    cancelCourtTarget,
    setCancelCourtTarget,
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
    activeCourts,
    allActiveCourtsPaused,
    getCourtCardProps,
    canFillAnyCourt: (payload: Parameters<typeof canSinglesFillCourt>[0] | null | undefined) =>
      courts.some((court) => payload != null && canSinglesFillCourt(payload, court)),
    minQueueToFill: SINGLES_MIN_QUEUE_TO_FILL,
  };
}
