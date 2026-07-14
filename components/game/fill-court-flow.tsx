"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { Play } from "lucide-react";
import { toast } from "sonner";

import { FillCourtConfirmDialog } from "@/components/game/fill-court-confirm-dialog";
import { FillCourtSelectDialog } from "@/components/game/fill-court-select-dialog";
import type { QueueEntryView } from "@/components/game/queue-entry-row";
import { Button } from "@/components/ui/button";
import { announceNextCourtPlayers, cancelCallNamesSpeech } from "@/lib/call-names-speech";
import { randomTeamSplit } from "@/lib/shuffle-teams-animation";

type FillCourtFlowProps = {
  canFillNextCourt: boolean;
  courtsClearingInProgress?: boolean;
  queuePlayerCount: number;
  teamA: QueueEntryView[];
  teamB: QueueEntryView[];
  waitingLineEntries: QueueEntryView[];
  emptyCourtNumbers: number[];
  /** Courts whose fill API is still in flight. Confirm is only blocked for those courts. */
  pendingFillCourtNumbers?: ReadonlySet<number>;
  replacePendingSourceIndex: number | null;
  onConfirmFill: (courtNumber: number, queueEntryIds?: string[]) => void;
  mixedDoubles?: boolean;
  minQueueToFill?: number;
  onReplace: (sourceIndex: number, sourceEntry: QueueEntryView) => void;
  /** When true, only dialogs are rendered (for mounting outside tab panels). */
  hideTrigger?: boolean;
};

export type FillCourtFlowHandle = {
  openFillCourt: (courtNumber: number) => void;
  openFillNextCourt: () => void;
};

function foursomeKey(teamA: QueueEntryView[], teamB: QueueEntryView[]) {
  return [...teamA, ...teamB].map((entry) => entry._id).join("\0");
}

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
      pendingFillCourtNumbers,
      replacePendingSourceIndex,
      onConfirmFill,
      mixedDoubles = false,
      minQueueToFill = 4,
      onReplace,
      hideTrigger = false,
    },
    ref,
  ) {
    const [fillCourtDialogOpen, setFillCourtDialogOpen] = useState(false);
    const [fillCourtSelectDialogOpen, setFillCourtSelectDialogOpen] = useState(false);
    const [fillCourtTarget, setFillCourtTarget] = useState<number | null>(null);
    const [draftTeamA, setDraftTeamA] = useState<QueueEntryView[]>(teamA);
    const [draftTeamB, setDraftTeamB] = useState<QueueEntryView[]>(teamB);
    const [callingNames, setCallingNames] = useState(false);
    const callNamesRunIdRef = useRef(0);

    const activeFillCourtNumber =
      fillCourtTarget ?? (emptyCourtNumbers.length === 1 ? emptyCourtNumbers[0] : null) ?? null;
    const confirmFillPending =
      activeFillCourtNumber != null &&
      (pendingFillCourtNumbers?.has(activeFillCourtNumber) ?? false);

    const propsFoursomeKey = useMemo(() => foursomeKey(teamA, teamB), [teamA, teamB]);

    // Snapshot / re-sync from the live queue when the dialog opens or Replace changes who is next.
    // Local Shuffle only reorders draft state and must not hit the network.
    useEffect(() => {
      if (!fillCourtDialogOpen) return;
      setDraftTeamA(teamA);
      setDraftTeamB(teamB);
    }, [fillCourtDialogOpen, propsFoursomeKey, teamA, teamB]);

    const openFillCourtConfirmDialog = useCallback(
      (courtNumber: number) => {
        if (queuePlayerCount < minQueueToFill) {
          toast.error(
            `Not enough players in the queue. At least ${minQueueToFill} are required.`,
          );
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
      [courtsClearingInProgress, emptyCourtNumbers, minQueueToFill, queuePlayerCount],
    );

    const handleFillNextCourtClick = useCallback(() => {
      if (!canFillNextCourt) {
        if (queuePlayerCount < minQueueToFill) {
          toast.error(
            `Not enough players in the queue. At least ${minQueueToFill} are required.`,
          );
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
      minQueueToFill,
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

    const handleLocalShuffle = useCallback(() => {
      const split = randomTeamSplit([...draftTeamA, ...draftTeamB], {
        mixedDoubles,
        getGender: (entry) => entry.playerId.gender,
      });
      setDraftTeamA(split.teamA);
      setDraftTeamB(split.teamB);
    }, [draftTeamA, draftTeamB, mixedDoubles]);

    const handleConfirmFill = useCallback(() => {
      if (activeFillCourtNumber == null) return;
      setFillCourtDialogOpen(false);
      onConfirmFill(
        activeFillCourtNumber,
        [...draftTeamA, ...draftTeamB].map((entry) => String(entry._id)),
      );
    }, [activeFillCourtNumber, draftTeamA, draftTeamB, onConfirmFill]);

    return (
      <>
        {hideTrigger ? null : (
          <Button onClick={handleFillNextCourtClick} disabled={!canFillNextCourt}>
            <Play className="mr-2 h-4 w-4" aria-hidden />
            Fill next court
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
          teamA={draftTeamA}
          teamB={draftTeamB}
          canReplace={waitingLineEntries.length > 0}
          onReplace={onReplace}
          replacePendingSourceIndex={replacePendingSourceIndex}
          onConfirmFill={handleConfirmFill}
          fillPending={confirmFillPending}
          onShuffle={handleLocalShuffle}
          mixedDoubles={mixedDoubles}
        />
      </>
    );
  },
);
