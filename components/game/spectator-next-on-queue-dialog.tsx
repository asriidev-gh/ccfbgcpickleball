"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { Loader2, Play, Users, Volume2, VolumeX, Zap } from "lucide-react";
import { toast } from "sonner";

import { QueueEntryRow, type QueueEntryView } from "@/components/game/queue-entry-row";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  announceNextCourtPlayers,
  cancelCallNamesSpeech,
  isCallNamesSpeechSupported,
} from "@/lib/call-names-speech";
import {
  buildPlayerLeaderboardRankMap,
  type LeaderboardGamesPlayedRow,
} from "@/lib/games-played-map";
import { cn } from "@/lib/utils";

type SpectatorNextOnQueueButtonProps = {
  queue: QueueEntryView[];
  className?: string;
  enableCallNames?: boolean;
  courtNumber?: number | null;
  hasEmptyCourt?: boolean;
  canFillNextCourt?: boolean;
  fillPending?: boolean;
  onFillNextCourt?: () => void;
  showLeaderboardRank?: boolean;
  leaderboard?: LeaderboardGamesPlayedRow[];
};

export function SpectatorNextOnQueueButton({
  queue,
  className,
  enableCallNames = false,
  courtNumber = null,
  hasEmptyCourt = false,
  canFillNextCourt = false,
  fillPending = false,
  onFillNextCourt,
  showLeaderboardRank = false,
  leaderboard = [],
}: SpectatorNextOnQueueButtonProps) {
  const [open, setOpen] = useState(false);
  const [callingNames, setCallingNames] = useState(false);
  const callNamesRunIdRef = useRef(0);
  const nextUp = useMemo(() => queue.slice(0, 4), [queue]);
  const teamA = useMemo(() => nextUp.slice(0, 2), [nextUp]);
  const teamB = useMemo(() => nextUp.slice(2, 4), [nextUp]);
  const count = nextUp.length;
  const leaderboardRankMap = useMemo(
    () => (showLeaderboardRank ? buildPlayerLeaderboardRankMap(leaderboard) : new Map()),
    [leaderboard, showLeaderboardRank],
  );
  const showCallNames = enableCallNames && isCallNamesSpeechSupported() && count > 0;
  const showFillNextCourt = Boolean(onFillNextCourt && hasEmptyCourt);
  const showFooter = showCallNames || showFillNextCourt;

  const cancelPlayerAnnouncement = useCallback(() => {
    callNamesRunIdRef.current += 1;
    cancelCallNamesSpeech();
    setCallingNames(false);
  }, []);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      setOpen(nextOpen);
      if (!nextOpen && callingNames) {
        cancelPlayerAnnouncement();
      }
    },
    [callingNames, cancelPlayerAnnouncement],
  );

  const startPlayerAnnouncement = useCallback(() => {
    if (callingNames) return;

    const runId = callNamesRunIdRef.current + 1;
    callNamesRunIdRef.current = runId;
    setCallingNames(true);
    void announceNextCourtPlayers(
      teamA.map((entry) => entry.playerId),
      teamB.map((entry) => entry.playerId),
      {
        courtNumber,
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
  }, [callingNames, courtNumber, teamA, teamB]);

  const handleFillNextCourt = useCallback(() => {
    if (!onFillNextCourt) return;
    if (callingNames) {
      cancelPlayerAnnouncement();
    }
    setOpen(false);
    onFillNextCourt();
  }, [callingNames, cancelPlayerAnnouncement, onFillNextCourt]);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={cn("inline-flex shrink-0", className)}
        onClick={() => setOpen(true)}
        aria-label={`Next on queue: ${count} of 4 players`}
      >
        <Users className="mr-1.5 h-4 w-4 shrink-0" aria-hidden />
        <span className="sm:hidden">Queue</span>
        <span className="hidden sm:inline">Next on queue</span>
        <Badge variant="secondary" className="ml-1.5 h-5 px-1.5 tabular-nums">
          {count}/4
        </Badge>
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Next on queue</DialogTitle>
            <DialogDescription>
              {count === 0
                ? "No players are waiting in the queue right now."
                : `Top ${count} ${count === 1 ? "player" : "players"} waiting for the next open court.`}
            </DialogDescription>
          </DialogHeader>

          {count === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">The queue is empty.</p>
          ) : (
            <div className="queue-next-up-group">
              <div className="queue-next-up-banner">
                <div className="flex items-center gap-2">
                  <span className="queue-next-up-icon">
                    <Zap className="h-4 w-4" aria-hidden />
                  </span>
                  <div>
                    <p className="queue-next-up-title">Next on court</p>
                    <p className="caption">
                      Top {count} {count === 1 ? "player" : "players"} — ready to play
                    </p>
                  </div>
                </div>
                <Badge className="badge-next-up-count shrink-0">{count} / 4</Badge>
              </div>
              <div className="queue-next-up-slots">
                {nextUp.map((entry, index) => (
                  <QueueEntryRow
                    key={entry._id}
                    entry={entry}
                    index={index}
                    isNextUp
                    hideReplacePanel
                    onReplace={() => {}}
                    replacePending={false}
                    showLeaderboardRank={showLeaderboardRank}
                    leaderboardRankMap={leaderboardRankMap}
                  />
                ))}
              </div>
            </div>
          )}

          {showFooter ? (
            <DialogFooter
              className={cn(
                "!mx-0 !mb-0 mt-4 shrink-0 !flex-row items-center gap-2 border-t border-border bg-muted/30 px-0 pt-4 sm:gap-3",
                showCallNames && showFillNextCourt ? "justify-between" : "justify-start",
              )}
            >
              {showCallNames ? (
                <Button
                  type="button"
                  className={cn(
                    "call-names-btn h-11 min-w-0 flex-1 px-3 text-sm tracking-wide sm:min-w-[11rem] sm:flex-none sm:px-5",
                    callingNames && "call-names-btn--calling",
                    callingNames && "call-names-btn--cancel",
                    courtNumber != null && !callingNames && "call-names-btn--glow",
                  )}
                  onClick={() => {
                    if (callingNames) {
                      cancelPlayerAnnouncement();
                      return;
                    }
                    startPlayerAnnouncement();
                  }}
                  aria-label={callingNames ? "Cancel call names" : "Call player names aloud"}
                >
                  {callingNames ? (
                    <VolumeX className="call-names-btn-icon mr-2 h-4 w-4" aria-hidden />
                  ) : (
                    <Volume2 className="call-names-btn-icon mr-2 h-4 w-4" aria-hidden />
                  )}
                  {callingNames ? "Cancel" : "Call Names"}
                </Button>
              ) : null}
              {showFillNextCourt ? (
                <Button
                  type="button"
                  className="h-11 min-w-0 flex-1 sm:w-auto sm:flex-none"
                  disabled={fillPending || !canFillNextCourt}
                  onClick={handleFillNextCourt}
                >
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
              ) : null}
            </DialogFooter>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
