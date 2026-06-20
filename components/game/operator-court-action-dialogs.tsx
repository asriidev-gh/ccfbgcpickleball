"use client";

import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CourtEndGameDialog } from "@/components/game/court-end-game-dialog";
import type { CourtView } from "@/components/game/court-card";

type OperatorCourtActionDialogsProps = {
  courts: CourtView[];
  cancelCourtTarget: number | null;
  onCancelCourtTargetChange: (courtNumber: number | null) => void;
  onConfirmCancelCourt: (courtNumber: number) => void;
  cancelRematchTarget: number | null;
  onCancelRematchTargetChange: (courtNumber: number | null) => void;
  onConfirmCancelRematch: (courtNumber: number) => void;
  cancelRematchPending: boolean;
  endTargetCourt: number | null;
  pendingWinner: "A" | "B" | null;
  onPendingWinnerChange: (winner: "A" | "B" | null) => void;
  endGameRematch: boolean;
  onEndGameRematchChange: (rematch: boolean) => void;
  teamAScore: string;
  onTeamAScoreChange: (value: string) => void;
  teamBScore: string;
  onTeamBScoreChange: (value: string) => void;
  onCloseEndDialog: () => void;
  onSubmitEndGame: (input: {
    courtNumber: number;
    winnerTeam: "A" | "B";
    teamAScore: number;
    teamBScore: number;
    rematch: boolean;
  }) => void;
  endGameScoreError: string | null;
};

export function OperatorCourtActionDialogs({
  courts,
  cancelCourtTarget,
  onCancelCourtTargetChange,
  onConfirmCancelCourt,
  cancelRematchTarget,
  onCancelRematchTargetChange,
  onConfirmCancelRematch,
  cancelRematchPending,
  endTargetCourt,
  pendingWinner,
  onPendingWinnerChange,
  endGameRematch,
  onEndGameRematchChange,
  teamAScore,
  onTeamAScoreChange,
  teamBScore,
  onTeamBScoreChange,
  onCloseEndDialog,
  onSubmitEndGame,
  endGameScoreError,
}: OperatorCourtActionDialogsProps) {
  const endCourt =
    endTargetCourt != null ? courts.find((court) => court.courtNumber === endTargetCourt) : undefined;

  return (
    <>
      <Dialog
        open={cancelCourtTarget !== null}
        onOpenChange={(open) => {
          if (!open) onCancelCourtTargetChange(null);
        }}
      >
        <DialogContent className="cancel-court-dialog sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cancel court assignment?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Return all four players on{" "}
            <span className="font-medium text-foreground">Court {cancelCourtTarget}</span> to the top
            of the queue? The waiting line order will be restored. You can only cancel within the
            first 5 minutes after filling the court.
          </p>
          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => onCancelCourtTargetChange(null)}>
              Keep on court
            </Button>
            <Button
              type="button"
              disabled={cancelCourtTarget === null}
              onClick={() => {
                if (cancelCourtTarget === null) return;
                onConfirmCancelCourt(cancelCourtTarget);
              }}
            >
              Yes, cancel assignment
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={cancelRematchTarget !== null}
        onOpenChange={(open) => {
          if (!open && !cancelRematchPending) onCancelRematchTargetChange(null);
        }}
      >
        <DialogContent className="cancel-rematch-dialog sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cancel rematch?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Return all four players on{" "}
            <span className="font-medium text-foreground">Court {cancelRematchTarget}</span> to the
            queue? The last completed match stays in history — only this rematch is undone. You can
            only cancel within the first 5 minutes after the rematch started.
          </p>
          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              disabled={cancelRematchPending}
              onClick={() => onCancelRematchTargetChange(null)}
            >
              Keep playing
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={cancelRematchPending || cancelRematchTarget === null}
              onClick={() => {
                if (cancelRematchTarget === null) return;
                onConfirmCancelRematch(cancelRematchTarget);
              }}
            >
              {cancelRematchPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                  Cancelling…
                </>
              ) : (
                "Yes, cancel rematch"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <CourtEndGameDialog
        open={endTargetCourt !== null}
        endCourt={endCourt}
        pendingWinner={pendingWinner}
        onPendingWinnerChange={onPendingWinnerChange}
        endGameRematch={endGameRematch}
        onEndGameRematchChange={onEndGameRematchChange}
        teamAScore={teamAScore}
        onTeamAScoreChange={onTeamAScoreChange}
        teamBScore={teamBScore}
        onTeamBScoreChange={onTeamBScoreChange}
        endGameScoreError={endGameScoreError}
        onClose={onCloseEndDialog}
        onSubmit={(input) => {
          if (endTargetCourt == null) return;
          onSubmitEndGame({ courtNumber: endTargetCourt, ...input });
        }}
      />
    </>
  );
}
