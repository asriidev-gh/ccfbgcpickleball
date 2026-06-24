"use client";

import { ArrowRight, Gauge, Loader2, Pause, Play } from "lucide-react";
import Link from "next/link";
import { useCallback, useMemo, useRef } from "react";

import { CourtEndGameDialog } from "@/components/game/court-end-game-dialog";
import { DashboardPanelFullscreenButton } from "@/components/game/dashboard-panel-fullscreen-button";
import {
  CourtsViewLayoutToggle,
  useCourtsViewSessionLayout,
  type CourtsViewLayout,
} from "@/components/game/courts-view-layout-toggle";
import {
  CourtsViewPhotosToggle,
  courtsViewShowsPhotosToggle,
  resolveCourtsViewShowPlayerPhotos,
  useCourtsViewSessionPhotos,
} from "@/components/game/courts-view-photos-toggle";
import { GamePlayerProfileProvider } from "@/components/game/game-player-profile-context";
import { SpectatorNextOnQueueButton } from "@/components/game/spectator-next-on-queue-dialog";
import { SinglesGameCourtsGrid } from "@/components/singles/singles-game-courts-grid";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSinglesOperatorCourtActions } from "@/hooks/use-singles-operator-court-actions";
import {
  attachSessionStatsToQueueEntry,
  buildPlayerSessionStatsMap,
  buildSessionLeaderboardRankMap,
} from "@/lib/games-played-map";
import { operatorPayloadToCourtsViewSession } from "@/lib/local-courts-view";
import { getQuickGameDashboardPath, isQuickGame } from "@/lib/local-game-id";
import { getMatchScoreInputError } from "@/lib/match-score-validation";
import { buildSessionPlayerLookup } from "@/lib/session-player-lookup";
import type { OwnerCourtsViewSession } from "@/lib/owner-courts-view-payload";
import { useQuickGameSession } from "@/lib/quick-game-store";
import { pickSinglesCourtPair } from "@/lib/singles/singles-queue-fill";
import { canSinglesFillCourt } from "@/lib/singles/singles-payload-mutations";
import { SINGLES_MIN_QUEUE_TO_FILL } from "@/lib/singles/singles-constants";
import type { CourtsViewCourtTheme } from "@/lib/courts-view-court-theme";
import { cn } from "@/lib/utils";

type SinglesSessionCourtsSectionProps = {
  session: OwnerCourtsViewSession;
  courtTheme?: CourtsViewCourtTheme;
};

export function SinglesSessionCourtsSection({
  session: sessionProp,
  courtTheme = "classic",
}: SinglesSessionCourtsSectionProps) {
  const isBrowserQuickGame = isQuickGame(sessionProp.gameId);
  const localPayload = useQuickGameSession(sessionProp.gameId);
  const session = useMemo(
    () => (localPayload ? operatorPayloadToCourtsViewSession(localPayload) : sessionProp),
    [localPayload, sessionProp],
  );
  const matchingType = localPayload?.game.matchingType ?? session.matchingType;

  const { layout, setLayout } = useCourtsViewSessionLayout(session.gameId);
  const { showPhotos, setShowPhotos } = useCourtsViewSessionPhotos(session.gameId);
  const sessionShowPlayerPhotos = resolveCourtsViewShowPlayerPhotos(layout, showPhotos);
  const courtsSectionRef = useRef<HTMLDivElement>(null);

  const handleLayoutChange = useCallback(
    (nextLayout: CourtsViewLayout) => {
      setLayout(nextLayout);
      if (nextLayout === "list") {
        setShowPhotos(true);
      }
    },
    [setLayout, setShowPhotos],
  );

  const playerSessionStats = useMemo(
    () => buildPlayerSessionStatsMap(session.leaderboard),
    [session.leaderboard],
  );

  const queueWithStats = useMemo(
    () => session.queue.map((entry) => attachSessionStatsToQueueEntry(entry, playerSessionStats)),
    [session.queue, playerSessionStats],
  );

  const nextCourtPair = useMemo(
    () => pickSinglesCourtPair(session.queue, matchingType) ?? [],
    [session.queue, matchingType],
  );

  const emptyCourtNumbers = useMemo(
    () =>
      [...session.courts]
        .filter((court) => court.status === "empty")
        .sort((a, b) => a.courtNumber - b.courtNumber)
        .map((court) => court.courtNumber),
    [session.courts],
  );

  const canFillNextCourt =
    localPayload != null &&
    nextCourtPair.length >= SINGLES_MIN_QUEUE_TO_FILL &&
    emptyCourtNumbers.length > 0 &&
    session.courts.some((court) => canSinglesFillCourt(localPayload, court));

  const leaderboardRankMap = useMemo(() => {
    const courtParticipants = session.courts.flatMap((court) => [
      ...(court.teamA?.playerIds ?? []).map((playerId) => ({ playerId })),
      ...(court.teamB?.playerIds ?? []).map((playerId) => ({ playerId })),
    ]);
    return buildSessionLeaderboardRankMap(session.leaderboard, [
      ...queueWithStats,
      ...courtParticipants,
    ]);
  }, [session.courts, session.leaderboard, queueWithStats]);

  const courtActions = useSinglesOperatorCourtActions({
    gameId: session.gameId,
    courts: session.courts,
    enabled: true,
  });

  const endGameScoreError =
    courtActions.pendingWinner != null
      ? getMatchScoreInputError(
          courtActions.pendingWinner,
          courtActions.teamAScore,
          courtActions.teamBScore,
          { required: true },
        )
      : null;

  const endCourt =
    courtActions.endTargetCourt != null
      ? session.courts.find((court) => court.courtNumber === courtActions.endTargetCourt)
      : undefined;

  const sessionPlayerLookup = useMemo(
    () =>
      buildSessionPlayerLookup({
        queue: queueWithStats,
        checkedOut: session.checkedOut ?? [],
        courts: session.courts,
      }),
    [queueWithStats, session.checkedOut, session.courts],
  );

  const showPauseAll = courtActions.activeCourts.length > 0;

  const pauseAllButton = showPauseAll ? (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="courts-pause-all-btn h-7 shrink-0 px-2 text-xs"
      disabled={courtActions.pauseAllCourtsMutation.isPending}
      onClick={() =>
        courtActions.pauseAllCourtsMutation.mutate(!courtActions.allActiveCourtsPaused)
      }
      aria-label={
        courtActions.allActiveCourtsPaused ? "Unpause all courts" : "Pause all courts"
      }
    >
      {courtActions.pauseAllCourtsMutation.isPending ? (
        <>
          <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" aria-hidden />
          {courtActions.allActiveCourtsPaused ? "Resuming…" : "Pausing…"}
        </>
      ) : courtActions.allActiveCourtsPaused ? (
        <>
          <Play className="mr-1 h-3.5 w-3.5" aria-hidden />
          Unpause all
        </>
      ) : (
        <>
          <Pause className="mr-1 h-3.5 w-3.5" aria-hidden />
          Pause all
        </>
      )}
    </Button>
  ) : null;

  return (
    <GamePlayerProfileProvider profileEnabled>
      <Card
        ref={courtsSectionRef}
        className="glass-panel courts-panel dashboard-panel dashboard-panel--courts"
      >
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-1">
            <CardTitle className="truncate">{session.title}</CardTitle>
            <p className="caption flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="inline-flex items-center gap-1">
                <Gauge className="h-3.5 w-3.5" aria-hidden />
                {session.openPlayType}
              </span>
              <span className="text-muted-foreground">·</span>
              <span>Singles · 1v1</span>
              {session.openPlayTimeRange ? (
                <>
                  <span className="text-muted-foreground">·</span>
                  <span>{session.openPlayTimeRange}</span>
                </>
              ) : null}
              {showPauseAll ? (
                <>
                  <span className="hidden text-muted-foreground sm:inline">·</span>
                  <span className="hidden sm:inline-flex">{pauseAllButton}</span>
                </>
              ) : null}
            </p>
          </div>
          <div className="flex w-full flex-wrap items-center gap-2 sm:ml-auto sm:w-auto">
            {showPauseAll ? <div className="sm:hidden">{pauseAllButton}</div> : null}
            <div className="hidden items-center gap-2 sm:flex">
              <CourtsViewLayoutToggle value={layout} onChange={handleLayoutChange} />
              {courtsViewShowsPhotosToggle(layout) ? (
                <CourtsViewPhotosToggle value={showPhotos} onChange={setShowPhotos} />
              ) : null}
            </div>
            <Link
              href={
                isBrowserQuickGame
                  ? getQuickGameDashboardPath(session.gameId)
                  : `/games/${session.gameId}`
              }
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "inline-flex shrink-0",
              )}
            >
              Game Dashboard
              <ArrowRight className="ml-1.5 h-4 w-4" aria-hidden />
            </Link>
            <DashboardPanelFullscreenButton containerRef={courtsSectionRef} panelName="courts" />
          </div>
        </CardHeader>
        <CardContent className="dashboard-panel-content space-y-3">
          <SinglesGameCourtsGrid
            courts={session.courts}
            leaderboard={session.leaderboard}
            playerSessionStats={playerSessionStats}
            playerLeaderboardRanks={leaderboardRankMap}
            gameId={session.gameId}
            layout={layout}
            showPlayerPhotos={sessionShowPlayerPhotos}
            courtTheme={courtTheme}
            summaryAddon={
              <SpectatorNextOnQueueButton
                queue={queueWithStats}
                nextUpEntries={nextCourtPair}
                courtPlayerCount={SINGLES_MIN_QUEUE_TO_FILL}
                enableCallNames
                courtNumber={emptyCourtNumbers[0] ?? null}
                hasEmptyCourt={emptyCourtNumbers.length > 0}
                canFillNextCourt={canFillNextCourt}
                fillPending={courtActions.fillMutation.isPending}
                onFillNextCourt={
                  canFillNextCourt
                    ? () => {
                        const courtNumber = emptyCourtNumbers[0];
                        if (courtNumber != null) courtActions.fillMutation.mutate(courtNumber);
                      }
                    : undefined
                }
                showLeaderboardRank
                leaderboard={session.leaderboard}
              />
            }
            getCourtCardProps={(court) =>
              courtActions.getCourtCardProps(
                court,
                localPayload != null && canSinglesFillCourt(localPayload, court),
              )
            }
          />

          <CourtEndGameDialog
            open={courtActions.endTargetCourt != null}
            endCourt={endCourt}
            playerLookup={sessionPlayerLookup}
            gameMode="singles"
            pendingWinner={courtActions.pendingWinner}
            onPendingWinnerChange={courtActions.setPendingWinner}
            endGameRematch={courtActions.endGameRematch}
            onEndGameRematchChange={courtActions.setEndGameRematch}
            teamAScore={courtActions.teamAScore}
            onTeamAScoreChange={courtActions.setTeamAScore}
            teamBScore={courtActions.teamBScore}
            onTeamBScoreChange={courtActions.setTeamBScore}
            endGameScoreError={endGameScoreError}
            onClose={courtActions.closeEndDialog}
            onSubmit={(input) => {
              if (courtActions.endTargetCourt == null) return;
              courtActions.endMutation.mutate({
                courtNumber: courtActions.endTargetCourt,
                ...input,
              });
            }}
          />
        </CardContent>
      </Card>
    </GamePlayerProfileProvider>
  );
}
