"use client";

import { useQuery } from "@tanstack/react-query";
import { useCallback, useMemo, useRef, useState } from "react";
import { Play, Users, Volume2, VolumeX, Zap } from "lucide-react";
import { toast } from "sonner";

import type { MatchHistoryView } from "@/components/game/match-history-list";
import { NextCourtMatchAnalysis } from "@/components/game/next-court-match-analysis";
import { QueueEntryRow, type QueueEntryView } from "@/components/game/queue-entry-row";
import { QueueNextUpSlots } from "@/components/game/queue-next-up-slots";
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
  DOUBLES_PLAYERS_PER_COURT,
  formatDoublesNextOnCourtSubtitle,
  isDoublesWinnerLoserRotation,
  resolveDoublesRotationQueue,
  segmentDoublesQueueDisplay,
} from "@/lib/doubles/doubles-queue-fill";
import { isDoublesMatchupAnalysisMatchingType } from "@/lib/next-court-match-analysis";
import {
  fetchOperatorMatchHistory,
  operatorMatchHistoryQueryKey,
} from "@/lib/fetch-operator-game";
import {
  buildPlayerLeaderboardRankMap,
  type LeaderboardGamesPlayedRow,
} from "@/lib/games-played-map";
import { isQuickGame } from "@/lib/local-game-id";
import { operatorMatchHistoryQueryOptions } from "@/lib/operator-query-options";
import type { QuickPlayMatchingType } from "@/lib/quick-play-wizard-shared";
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
  /** When set, overrides the default top-of-queue slice (e.g. singles winner/loser pairing). */
  nextUpEntries?: QueueEntryView[];
  /** Players required per court — used for labels (default 4). */
  courtPlayerCount?: number;
  /** Auto-balanced doubles matchup check (owner courts view / operator). */
  enableMatchupAnalysis?: boolean;
  gameId?: string;
  matchingType?: QuickPlayMatchingType | null;
  gameMode?: "doubles" | "singles";
  matches?: MatchHistoryView[];
  onShuffleNext?: () => void | Promise<void>;
  shuffleNextPending?: boolean;
  onSwapWaiting?: () => void | Promise<void>;
  swapWaitingPending?: boolean;
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
  nextUpEntries,
  courtPlayerCount = 4,
  enableMatchupAnalysis = false,
  gameId,
  matchingType,
  gameMode = "doubles",
  matches: matchesProp = [],
  onShuffleNext,
  shuffleNextPending = false,
  onSwapWaiting,
  swapWaitingPending = false,
}: SpectatorNextOnQueueButtonProps) {
  const [open, setOpen] = useState(false);
  const [callingNames, setCallingNames] = useState(false);
  const callNamesRunIdRef = useRef(0);

  const isDoubles = gameMode !== "singles" && courtPlayerCount === DOUBLES_PLAYERS_PER_COURT;
  const usesWinnerLoserRotation = isDoublesWinnerLoserRotation(matchingType);

  const nextUp = useMemo(
    () => nextUpEntries ?? queue.slice(0, courtPlayerCount),
    [courtPlayerCount, nextUpEntries, queue],
  );
  const teamA = useMemo(() => nextUp.slice(0, 2), [nextUp]);
  const teamB = useMemo(() => nextUp.slice(2, courtPlayerCount), [courtPlayerCount, nextUp]);
  const count = nextUp.length;

  const showNextCourtAnalysis =
    enableMatchupAnalysis &&
    isDoubles &&
    isDoublesMatchupAnalysisMatchingType(matchingType, gameMode) &&
    count === DOUBLES_PLAYERS_PER_COURT;

  const analysisQueue = useMemo(() => {
    if (!usesWinnerLoserRotation) return queue;
    const ordered = resolveDoublesRotationQueue(queue, matchingType);
    const nextIds = new Set(nextUp.map((entry) => entry._id));
    const segments = segmentDoublesQueueDisplay(ordered, nextIds);
    return [
      ...nextUp,
      ...segments.normalWaiting,
      ...segments.winners,
      ...segments.losers,
    ];
  }, [matchingType, nextUp, queue, usesWinnerLoserRotation]);

  const shouldLoadMatchHistory =
    open && showNextCourtAnalysis && Boolean(gameId) && !isQuickGame(gameId ?? "");

  const operatorMatchHistoryQuery = useQuery({
    queryKey: operatorMatchHistoryQueryKey(gameId ?? ""),
    queryFn: () => fetchOperatorMatchHistory(gameId!),
    enabled: shouldLoadMatchHistory,
    ...operatorMatchHistoryQueryOptions,
  });

  const matches = useMemo(() => {
    if (gameId && isQuickGame(gameId)) return matchesProp;
    return operatorMatchHistoryQuery.data?.matches ?? matchesProp;
  }, [gameId, matchesProp, operatorMatchHistoryQuery.data?.matches]);

  const leaderboardRankMap = useMemo(
    () => (showLeaderboardRank ? buildPlayerLeaderboardRankMap(leaderboard) : new Map()),
    [leaderboard, showLeaderboardRank],
  );

  const showCallNames = enableCallNames && isCallNamesSpeechSupported() && count > 0;
  const showFillNextCourt = Boolean(onFillNextCourt && hasEmptyCourt);
  const showFooter = showCallNames || showFillNextCourt;

  const queueSubtitle = useMemo(() => {
    if (count === 0) return null;
    if (showNextCourtAnalysis) return "Slots 1–2 vs 3–4";
    if (usesWinnerLoserRotation) {
      return "Next four in queue order — complete bracket foursomes move to the end of the main line";
    }
    if (isDoubles) {
      return formatDoublesNextOnCourtSubtitle(count);
    }
    return `Top ${count} ${count === 1 ? "player" : "players"} ready to play`;
  }, [count, isDoubles, showNextCourtAnalysis, usesWinnerLoserRotation]);

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
        aria-label={`Next on queue: ${count} of ${courtPlayerCount} players`}
      >
        <Users className="mr-1.5 h-4 w-4 shrink-0" aria-hidden />
        <span className="sm:hidden">Queue</span>
        <span className="hidden sm:inline">Next on queue</span>
        <Badge variant="secondary" className="ml-1.5 h-5 px-1.5 tabular-nums">
          {count}/{courtPlayerCount}
        </Badge>
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Next on queue</DialogTitle>
            <DialogDescription>
              {count === 0
                ? "No players are waiting in the queue right now."
                : isDoubles
                  ? queueSubtitle
                  : `Top ${count} ${count === 1 ? "player" : "players"} waiting for the next open court.`}
            </DialogDescription>
          </DialogHeader>

          {count === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">The queue is empty.</p>
          ) : (
            <div className="queue-next-up-group">
              <div className="queue-next-up-banner">
                <div className="queue-next-up-banner__header">
                  <span className="queue-next-up-icon" aria-hidden>
                    <Zap className="h-4 w-4" />
                  </span>
                  <div className="queue-next-up-banner__heading">
                    <p className="queue-next-up-title">Next on court</p>
                    {queueSubtitle ? (
                      <p className="queue-next-up-subtitle caption">{queueSubtitle}</p>
                    ) : null}
                  </div>
                  <Badge className="badge-next-up-count shrink-0 self-start sm:self-center">
                    {count} / {courtPlayerCount}
                  </Badge>
                </div>
              </div>
              {showNextCourtAnalysis ? (
                <NextCourtMatchAnalysis
                  foursome={nextUp}
                  queue={analysisQueue}
                  matchingType={matchingType}
                  matches={matches}
                  matchesLoading={
                    shouldLoadMatchHistory &&
                    operatorMatchHistoryQuery.isLoading &&
                    !operatorMatchHistoryQuery.data
                  }
                  onShuffle={onShuffleNext}
                  shufflePending={shuffleNextPending}
                  onSwapWaiting={onSwapWaiting}
                  swapWaitingPending={swapWaitingPending}
                  maxVisible={2}
                />
              ) : null}
              <QueueNextUpSlots
                entries={nextUp}
                showDoublesTeamPreview={isDoubles}
                renderEntry={(entry, index) => (
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
                )}
              />
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
                  disabled={!canFillNextCourt}
                  onClick={handleFillNextCourt}
                >
                  <Play className="mr-2 h-4 w-4" aria-hidden />
                  Fill next court
                </Button>
              ) : null}
            </DialogFooter>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
