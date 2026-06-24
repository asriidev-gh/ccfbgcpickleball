"use client";

import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from "react";
import { Loader2, Play } from "lucide-react";
import { toast } from "sonner";

import { FillCourtConfirmDialog } from "@/components/game/fill-court-confirm-dialog";
import { FillCourtSelectDialog } from "@/components/game/fill-court-select-dialog";
import type { QueueEntryView } from "@/components/game/queue-entry-row";
import { Button } from "@/components/ui/button";
import { announceNextCourtPlayers, cancelCallNamesSpeech } from "@/lib/call-names-speech";

type FillCourtFlowProps = {
  canFillNextCourt: boolean;
  courtsClearingInProgress?: boolean;
  queuePlayerCount: number;
  teamA: QueueEntryView[];
  teamB: QueueEntryView[];
  waitingLineEntries: QueueEntryView[];
  emptyCourtNumbers: number[];
  fillPending: boolean;
  replacePendingSourceIndex: number | null;
  onConfirmFill: (courtNumber: number) => void;
  onShuffle: () => Promise<void>;
  onReplace: (sourceIndex: number, sourceEntry: QueueEntryView) => void;
  /** When true, only dialogs are rendered (for mounting outside tab panels). */
  hideTrigger?: boolean;
};

export type FillCourtFlowHandle = {
  openFillCourt: (courtNumber: number) => void;
  openFillNextCourt: () => void;
};

export const FillCourtFlow = forwardRef<FillCourtFlowHandle, FillCourtFlowProps>(
  function FillCourtFlow(
    {
      canFillNextCourt,
      courtsClearingInProgress = false,
      queuePlayerCount,
      teamA,
      teamB,
      waitingLineEntries,
      emptyCourtNumbers,
      fillPending,
      replacePendingSourceIndex,
      onConfirmFill,
      onShuffle,
      onReplace,
      hideTrigger = false,
    },
    ref,
  ) {
  const [fillCourtDialogOpen, setFillCourtDialogOpen] = useState(false);
  const [fillCourtSelectDialogOpen, setFillCourtSelectDialogOpen] = useState(false);
  const [fillCourtTarget, setFillCourtTarget] = useState<number | null>(null);
  const [callingNames, setCallingNames] = useState(false);
  const callNamesRunIdRef = useRef(0);

  const activeFillCourtNumber =
    fillCourtTarget ?? (emptyCourtNumbers.length === 1 ? emptyCourtNumbers[0] : null) ?? null;

  const openFillCourtConfirmDialog = useCallback(
    (courtNumber: number) => {
      if (queuePlayerCount < 4) {
        toast.error("Not enough players in the queue. At least 4 are required.");
        return;
      }

      if (!emptyCourtNumbers.includes(courtNumber)) {
        if (courtsClearingInProgress) {
          toast.info("This court is still clearing. Try again in a moment.");
        } else {
          toast.error("This court is not available to fill.");
        }
        return;
      }

      setFillCourtTarget(courtNumber);
      setFillCourtDialogOpen(true);
    },
    [courtsClearingInProgress, emptyCourtNumbers, queuePlayerCount],
  );

  const handleFillNextCourtClick = useCallback(() => {
    if (!canFillNextCourt) {
      if (queuePlayerCount < 4) {
        toast.error("Not enough players in the queue. At least 4 are required.");
      } else if (courtsClearingInProgress) {
        toast.info("A court is still clearing. Try again in a moment.");
      } else {
        toast.error("No empty court available.");
      }
      return;
    }

    if (emptyCourtNumbers.length >= 2) {
      setFillCourtSelectDialogOpen(true);
      return;
    }

    openFillCourtConfirmDialog(emptyCourtNumbers[0]);
  }, [
    canFillNextCourt,
    courtsClearingInProgress,
    emptyCourtNumbers,
    openFillCourtConfirmDialog,
    queuePlayerCount,
  ]);

  useImperativeHandle(
    ref,
    () => ({
      openFillCourt: openFillCourtConfirmDialog,
      openFillNextCourt: handleFillNextCourtClick,
    }),
    [handleFillNextCourtClick, openFillCourtConfirmDialog],
  );

  const cancelPlayerAnnouncement = useCallback(() => {
    callNamesRunIdRef.current += 1;
    cancelCallNamesSpeech();
    setCallingNames(false);
  }, []);

  const handleFillCourtDialogOpenChange = useCallback(
    (open: boolean) => {
      setFillCourtDialogOpen(open);
      if (!open) {
        setFillCourtTarget(null);
        if (callingNames) {
          cancelPlayerAnnouncement();
        }
      }
    },
    [callingNames, cancelPlayerAnnouncement],
  );

  const startPlayerAnnouncement = useCallback(
    (announceTeamA: QueueEntryView[], announceTeamB: QueueEntryView[]) => {
      if (callingNames) return;

      const runId = callNamesRunIdRef.current + 1;
      callNamesRunIdRef.current = runId;
      setCallingNames(true);
      void announceNextCourtPlayers(
        announceTeamA.map((entry) => entry.playerId),
        announceTeamB.map((entry) => entry.playerId),
        {
          courtNumber: activeFillCourtNumber,
          onComplete: () => {
            if (callNamesRunIdRef.current !== runId) return;
            setCallingNames(false);
          },
        },
      ).then((started) => {
        if (callNamesRunIdRef.current !== runId) return;
        if (!started) {
          setCallingNames(false);
          toast.error("Text-to-speech is not available in this browser.");
        }
      });
    },
    [activeFillCourtNumber, callingNames],
  );

  const handleConfirmFill = useCallback(() => {
    if (activeFillCourtNumber == null) return;
    onConfirmFill(activeFillCourtNumber);
    setFillCourtDialogOpen(false);
  }, [activeFillCourtNumber, onConfirmFill]);

  return (
    <>
      {hideTrigger ? null : (
        <Button onClick={handleFillNextCourtClick} disabled={fillPending || !canFillNextCourt}>
          {fillPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
              Filling…
            </>
          ) : (
            <>
              <Play className="mr-2 h-4 w-4" aria-hidden />
              Fill next court
            </>
          )}
        </Button>
      )}

      <FillCourtSelectDialog
        open={fillCourtSelectDialogOpen}
        onOpenChange={setFillCourtSelectDialogOpen}
        emptyCourtNumbers={emptyCourtNumbers}
        onSelect={(courtNumber) => {
          setFillCourtSelectDialogOpen(false);
          openFillCourtConfirmDialog(courtNumber);
        }}
      />
      <FillCourtConfirmDialog
        open={fillCourtDialogOpen}
        onOpenChange={handleFillCourtDialogOpenChange}
        callingNames={callingNames}
        onCallNames={startPlayerAnnouncement}
        onCancelCallNames={cancelPlayerAnnouncement}
        courtNumber={activeFillCourtNumber}
        teamA={teamA}
        teamB={teamB}
        canReplace={waitingLineEntries.length > 0}
        onReplace={onReplace}
        replacePendingSourceIndex={replacePendingSourceIndex}
        onConfirmFill={handleConfirmFill}
        fillPending={fillPending}
        onShuffle={onShuffle}
      />
    </>
  );
  },
);
