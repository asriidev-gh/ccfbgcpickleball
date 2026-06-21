"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { toastOperationError } from "@/lib/toast-error";

import type { CourtView } from "@/components/game/court-card";
import type { QueueEntryView } from "@/components/game/queue-entry-row";
import type { ReplacePlayerConfirmInput } from "@/components/game/replace-player-dialog";
import type { ReplacePlayerDialogState } from "@/components/game/replace-player-dialog";

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
    void queryClient.invalidateQueries({ queryKey: invalidateQueryKey });
  }, [invalidateQueryKey, queryClient]);

  const closeEndDialog = useCallback(() => {
    setEndTargetCourt(null);
    setPendingWinner(null);
    setEndGameRematch(false);
    setTeamAScore("");
    setTeamBScore("");
  }, []);

  const startMutation = useMutation({
    mutationFn: async (courtNumber: number) => {
      const maxAttempts = 3;
      let lastMessage = "Failed to fill court.";

      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        const response = await fetch(`/api/games/${gameId}/start`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ courtNumber }),
        });
        const data = await response.json();
        if (response.ok) return data;

        lastMessage = typeof data.message === "string" ? data.message : lastMessage;
        const isCourtBusy =
          typeof lastMessage === "string" && /is not available/i.test(lastMessage);
        if (!isCourtBusy || attempt === maxAttempts - 1) {
          throw new Error(lastMessage);
        }

        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      throw new Error(lastMessage);
    },
    onSuccess: () => {
      toast.success("Court filled from the queue.");
      invalidate();
    },
    onError: (error) => {
      toastOperationError(error, "Failed to fill court.");
    },
  });

  const endMutation = useMutation({
    mutationFn: async (input: {
      courtNumber: number;
      winnerTeam: "A" | "B";
      teamAScore: number;
      teamBScore: number;
      rematch: boolean;
    }) => {
      const response = await fetch(`/api/games/${gameId}/end`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      return data as { message?: string; rematch?: boolean };
    },
    onSuccess: (data, variables) => {
      toast.success(data.message ?? "Court updated.");
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
      invalidate();
    },
    onError: (error) => {
      toastOperationError(error, "Failed to end game.");
    },
  });

  const swapCourtMutation = useMutation({
    mutationFn: async (courtNumber: number) => {
      const response = await fetch(`/api/games/${gameId}/swap-court`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courtNumber }),
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
      toastOperationError(error, "Failed to shuffle teams.");
    },
  });

  const pauseCourtMutation = useMutation({
    mutationFn: async ({ courtNumber, paused }: { courtNumber: number; paused: boolean }) => {
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
      const response = await fetch(`/api/games/${gameId}/cancel-court`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courtNumber }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      return data as { message: string };
    },
    onSuccess: (data, courtNumber) => {
      toast.success(data.message);
      setRematchCourtNumbers((prev) => {
        const next = new Set(prev);
        next.delete(courtNumber);
        return next;
      });
      setCancelCourtTarget(null);
      invalidate();
    },
    onError: (error) => {
      toastOperationError(error, "Failed to cancel assignment.");
    },
  });

  const cancelRematchMutation = useMutation({
    mutationFn: async (courtNumber: number) => {
      const response = await fetch(`/api/games/${gameId}/cancel-rematch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courtNumber }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      return data as { message: string };
    },
    onSuccess: (data, courtNumber) => {
      setRematchCourtNumbers((prev) => {
        const next = new Set(prev);
        next.delete(courtNumber);
        return next;
      });
      toast.success(data.message);
      setCancelRematchTarget(null);
      invalidate();
    },
    onError: (error) => {
      toastOperationError(error, "Failed to cancel rematch.");
    },
  });

  const shuffleNextMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/games/${gameId}/shuffle-next`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      return data as { message: string };
    },
    onSuccess: (data) => {
      toast.success(data.message);
      invalidate();
    },
    onError: (error) => {
      toastOperationError(error, "Failed to shuffle queue.");
    },
  });

  const replaceMutation = useMutation({
    mutationFn: async (input: { sourceIndex: number; targetIndex: number }) => {
      const response = await fetch(`/api/games/${gameId}/swap-next`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      return data as { message: string };
    },
    onSuccess: (data) => {
      toast.success(data.message);
      setReplaceDialog(null);
      invalidate();
    },
    onError: (error) => {
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
      const response = await fetch(`/api/games/${gameId}/replace-court-player`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      return data as { message: string };
    },
    onSuccess: (data) => {
      toast.success(data.message);
      setReplaceDialog(null);
      invalidate();
    },
    onError: (error) => {
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

  const courtReplacePendingKey =
    replaceCourtMutation.isPending && replaceCourtMutation.variables
      ? `${replaceCourtMutation.variables.courtNumber}-${replaceCourtMutation.variables.team}-${replaceCourtMutation.variables.slotIndex}`
      : null;

  const fillingCourtNumber =
    startMutation.isPending && startMutation.variables != null ? startMutation.variables : null;

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
      queueCounts: { queuedCount: number; waitingLineCount: number },
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
        onSwapTeams: async () => {
          await swapCourtMutation.mutateAsync(court.courtNumber);
        },
        swapPending: swapCourtMutation.isPending && swapCourtMutation.variables === court.courtNumber,
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
        isFilling: fillingCourtNumber != null && court.courtNumber === fillingCourtNumber,
        isClearing: clearingCourtNumbers.has(court.courtNumber),
        onFillCourt:
          court.status === "empty" ? () => onFillCourt(court.courtNumber) : undefined,
        canFillCourt:
          court.status === "empty" &&
          !clearingCourtNumbers.has(court.courtNumber) &&
          emptyCourtNumbers.includes(court.courtNumber) &&
          queueCounts.queuedCount >= 4,
        fillCourtPending: startMutation.isPending && startMutation.variables === court.courtNumber,
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
      startMutation.isPending,
      startMutation.variables,
      swapCourtMutation,
    ],
  );

  return {
    startMutation,
    endMutation,
    shuffleNextMutation,
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
    replacePendingSourceIndex:
      replaceMutation.isPending ? (replaceMutation.variables?.sourceIndex ?? null) : null,
  };
}
