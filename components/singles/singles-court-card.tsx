"use client";

import { CircleDot, Loader2, Pause, Play, Users } from "lucide-react";

import type { CourtView } from "@/components/game/court-card";
import { CourtCancelAssignmentButton } from "@/components/game/court-cancel-assignment-button";
import { CourtInPlayElapsedPanel } from "@/components/game/court-play-timer";
import { SinglesCourtLayout } from "@/components/singles/singles-court-layout";
import { isCourtTimerPaused, toCourtTimerClock } from "@/lib/court-cancel-grace";
import {
  getPlayerSessionStats,
  type PlayerSessionStats,
} from "@/lib/games-played-map";
import { SINGLES_MIN_QUEUE_TO_FILL } from "@/lib/singles/singles-constants";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type SinglesCourtCardProps = {
  court: CourtView;
  playerSessionStats: Map<string, PlayerSessionStats>;
  playerLeaderboardRanks?: Map<string, number>;
  onEndGame: () => void;
  onCancelAssignment?: () => void;
  cancelPending?: boolean;
  onTogglePause?: () => void;
  pausePending?: boolean;
  isFilling?: boolean;
  isClearing?: boolean;
  canFillCourt?: boolean;
  fillCourtPending?: boolean;
  onFillCourt?: () => void;
};

export function SinglesCourtCard({
  court,
  playerSessionStats,
  playerLeaderboardRanks,
  onEndGame,
  onCancelAssignment,
  cancelPending = false,
  onTogglePause,
  pausePending = false,
  isFilling = false,
  isClearing = false,
  canFillCourt = false,
  fillCourtPending = false,
  onFillCourt,
}: SinglesCourtCardProps) {
  const isActive = court.status === "active";
  const teamA = court.teamA?.playerIds ?? [];
  const teamB = court.teamB?.playerIds ?? [];
  const timerClock = toCourtTimerClock(court);
  const isPaused = isCourtTimerPaused(timerClock);

  return (
    <Card
      className={`court-card overflow-hidden ${isActive ? "court-active" : "court-empty"}${isFilling ? " court-filling" : ""}${isClearing ? " court-clearing" : ""} court-card--pickleball`}
      data-court-status={court.status}
      aria-busy={isFilling || isClearing}
    >
      <CardHeader className="court-card-header flex flex-row items-start justify-between gap-2">
        <CardTitle>Court {court.courtNumber}</CardTitle>
        <Badge
          variant={isActive ? "default" : "outline"}
          className={isActive ? "court-badge-active shrink-0" : "court-badge-empty shrink-0"}
        >
          {isActive ? (
            isPaused ? (
              <>
                <Pause className="mr-1 h-3 w-3" />
                Paused
              </>
            ) : (
              <>
                <CircleDot className="mr-1 h-3 w-3" />
                In Play
              </>
            )
          ) : isClearing ? (
            <>
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              Clearing
            </>
          ) : (
            "Available"
          )}
        </Badge>
      </CardHeader>

      <CardContent className="space-y-2.5 pt-0">
        {isActive ? (
          <>
            <SinglesCourtLayout
              courtNumber={court.courtNumber}
              teamA={teamA}
              teamB={teamB}
              playerSessionStats={playerSessionStats}
              playerLeaderboardRanks={playerLeaderboardRanks}
            />
            <div className="court-active-actions space-y-2">
              {onCancelAssignment ? (
                <CourtCancelAssignmentButton
                  clock={timerClock}
                  pending={cancelPending}
                  onClick={onCancelAssignment}
                />
              ) : null}
              <CourtInPlayElapsedPanel clock={timerClock} />
              <div className="grid grid-cols-2 gap-2">
                {onTogglePause ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="court-pause-btn w-full"
                    disabled={pausePending}
                    onClick={onTogglePause}
                  >
                    {pausePending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                        {isPaused ? "Resuming…" : "Pausing…"}
                      </>
                    ) : isPaused ? (
                      <>
                        <Play className="mr-2 h-4 w-4" aria-hidden />
                        Unpause
                      </>
                    ) : (
                      <>
                        <Pause className="mr-2 h-4 w-4" aria-hidden />
                        Pause
                      </>
                    )}
                  </Button>
                ) : null}
                <Button
                  variant="destructive"
                  className={onTogglePause ? "court-end-btn w-full" : "court-end-btn col-span-2 w-full"}
                  onClick={onEndGame}
                >
                  End Game
                </Button>
              </div>
            </div>
          </>
        ) : isFilling || isClearing ? (
          <div className="singles-court-empty">
            <SinglesCourtLayout
              courtNumber={court.courtNumber}
              teamA={[]}
              teamB={[]}
              playerSessionStats={playerSessionStats}
              empty
            />
            <div className="singles-court-empty__panel singles-court-empty__panel--filling">
              <Loader2 className="h-7 w-7 shrink-0 animate-spin text-primary" aria-hidden />
              <p className="singles-court-empty__title">
                {isClearing ? "Clearing court…" : "Filling court…"}
              </p>
            </div>
          </div>
        ) : (
          <div className="singles-court-empty">
            <SinglesCourtLayout
              courtNumber={court.courtNumber}
              teamA={[]}
              teamB={[]}
              playerSessionStats={playerSessionStats}
              empty
            />
            <div className="singles-court-empty__panel">
              <div className="singles-court-empty__icon" aria-hidden>
                <Users className="h-5 w-5" />
              </div>
              <p className="singles-court-empty__title">No game in progress</p>
              <p className="singles-court-empty__caption">
                {onFillCourt
                  ? "Assign the next two players from the queue to this court."
                  : `Fill a court when at least ${SINGLES_MIN_QUEUE_TO_FILL} players are waiting.`}
              </p>
              {onFillCourt ? (
                <Button
                  type="button"
                  className="singles-court-empty__fill-btn w-full"
                  onClick={onFillCourt}
                  disabled={!canFillCourt || fillCourtPending || isClearing}
                >
                  {fillCourtPending || isFilling ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                      Filling…
                    </>
                  ) : (
                    <>
                      <Play className="mr-2 h-4 w-4" aria-hidden />
                      Fill this court
                    </>
                  )}
                </Button>
              ) : null}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
