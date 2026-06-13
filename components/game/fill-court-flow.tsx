"use client";

import { useCallback, useState } from "react";
import { Loader2, Play } from "lucide-react";
import { toast } from "sonner";

import { FillCourtConfirmDialog } from "@/components/game/fill-court-confirm-dialog";
import { FillCourtSelectDialog } from "@/components/game/fill-court-select-dialog";
import type { QueueEntryView } from "@/components/game/queue-entry-row";
import { Button } from "@/components/ui/button";
import { announceNextCourtPlayers } from "@/lib/call-names-speech";

type FillCourtFlowProps = {
  canFillNextCourt: boolean;
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
};

export function FillCourtFlow({
  canFillNextCourt,
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
}: FillCourtFlowProps) {
  const [fillCourtDialogOpen, setFillCourtDialogOpen] = useState(false);
  const [fillCourtSelectDialogOpen, setFillCourtSelectDialogOpen] = useState(false);
  const [fillCourtTarget, setFillCourtTarget] = useState<number | null>(null);
  const [callingNames, setCallingNames] = useState(false);

  const activeFillCourtNumber =
    fillCourtTarget ?? (emptyCourtNumbers.length === 1 ? emptyCourtNumbers[0] : null) ?? null;

  const openFillCourtConfirmDialog = useCallback((courtNumber: number) => {
    setFillCourtTarget(courtNumber);
    setFillCourtDialogOpen(true);
  }, []);

  const handleFillNextCourtClick = useCallback(() => {
    if (!canFillNextCourt) {
      if (queuePlayerCount < 4) {
        toast.error("Not enough players in the queue. At least 4 are required.");
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
  }, [canFillNextCourt, emptyCourtNumbers, openFillCourtConfirmDialog, queuePlayerCount]);

  const handleFillCourtDialogOpenChange = useCallback(
    (open: boolean) => {
      setFillCourtDialogOpen(open);
      if (!open) {
        setFillCourtTarget(null);
        if (callingNames) {
          window.speechSynthesis?.cancel();
          setCallingNames(false);
        }
      }
    },
    [callingNames],
  );

  const startPlayerAnnouncement = useCallback(
    (announceTeamA: QueueEntryView[], announceTeamB: QueueEntryView[]) => {
      if (callingNames) return;

      setCallingNames(true);
      void announceNextCourtPlayers(
        announceTeamA.map((entry) => entry.playerId),
        announceTeamB.map((entry) => entry.playerId),
        {
          courtNumber: activeFillCourtNumber,
          onComplete: () => setCallingNames(false),
        },
      ).then((started) => {
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

  const showDialogs = fillCourtDialogOpen || fillCourtSelectDialogOpen;

  return (
    <>
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

      {showDialogs ? (
        <>
          {fillCourtSelectDialogOpen ? (
            <FillCourtSelectDialog
              open={fillCourtSelectDialogOpen}
              onOpenChange={setFillCourtSelectDialogOpen}
              emptyCourtNumbers={emptyCourtNumbers}
              onSelect={(courtNumber) => {
                setFillCourtSelectDialogOpen(false);
                openFillCourtConfirmDialog(courtNumber);
              }}
            />
          ) : null}
          {fillCourtDialogOpen ? (
            <FillCourtConfirmDialog
              open={fillCourtDialogOpen}
              onOpenChange={handleFillCourtDialogOpenChange}
              callingNames={callingNames}
              onCallNames={startPlayerAnnouncement}
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
          ) : null}
        </>
      ) : null}
    </>
  );
}
