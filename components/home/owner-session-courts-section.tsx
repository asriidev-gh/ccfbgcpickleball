"use client";

import { ArrowRight, Gauge, Loader2, Pause, Play } from "lucide-react";
import Link from "next/link";
import { useCallback, useMemo, useRef, useState } from "react";

import { FillCourtFlow, type FillCourtFlowHandle } from "@/components/game/fill-court-flow";
import { DashboardPanelFullscreenButton } from "@/components/game/dashboard-panel-fullscreen-button";
import { GameCourtsGrid } from "@/components/game/game-courts-grid";
import { SpectatorNextOnQueueButton } from "@/components/game/spectator-next-on-queue-dialog";
import { OperatorCourtActionDialogs } from "@/components/game/operator-court-action-dialogs";
import { OperatorDashboardLeaseBanner, OperatorDashboardLeaseBannerCollapsed } from "@/components/game/operator-dashboard-lease-banner";
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
import { ReplacePlayerDialog } from "@/components/game/replace-player-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useOperatorDashboardLease } from "@/hooks/use-operator-dashboard-lease";
import { useOperatorCourtActions } from "@/hooks/use-operator-court-actions";
import {
  attachSessionStatsToQueueEntry,
  buildPlayerSessionStatsMap,
} from "@/lib/games-played-map";
import { operatorPayloadToCourtsViewSession } from "@/lib/local-courts-view";
import { getQuickGameDashboardPath, isQuickGame } from "@/lib/local-game-id";
import {
  DOUBLES_PLAYERS_PER_COURT,
  isDoublesWinnerLoserRotation,
  pickDoublesCourtFoursome,
} from "@/lib/doubles/doubles-queue-fill";
import { isMixedDoublesMatching } from "@/lib/quick-play-wizard-shared";
import { buildSessionPlayerLookup } from "@/lib/session-player-lookup";
import { getMatchScoreInputError } from "@/lib/match-score-validation";
import type { OwnerCourtsViewSession } from "@/lib/owner-courts-view-payload";
import { useQuickGameSession } from "@/lib/quick-game-store";
import type { CourtsViewCourtTheme } from "@/lib/courts-view-court-theme";
import { cn } from "@/lib/utils";

type OwnerSessionCourtsSectionProps = {
  session: OwnerCourtsViewSession;
  courtTheme?: CourtsViewCourtTheme;
  leaseBannerCollapsed?: boolean;
  onLeaseBannerCollapsedChange?: (collapsed: boolean) => void;
};

export function OwnerSessionCourtsSection({
  session: sessionProp,
  courtTheme = "classic",
  leaseBannerCollapsed = false,
  onLeaseBannerCollapsedChange,
}: OwnerSessionCourtsSectionProps) {
  const isBrowserQuickGame = isQuickGame(sessionProp.gameId);
  const localPayload = useQuickGameSession(sessionProp.gameId);
  const session = useMemo(
    () =>
      localPayload ? operatorPayloadToCourtsViewSession(localPayload) : sessionProp,
    [localPayload, sessionProp],
  );

  const { layout, setLayout } = useCourtsViewSessionLayout(session.gameId);
  const { showPhotos, setShowPhotos } = useCourtsViewSessionPhotos(session.gameId);
  const sessionShowPlayerPhotos = resolveCourtsViewShowPlayerPhotos(layout, showPhotos);

  const handleLayoutChange = useCallback(
    (nextLayout: CourtsViewLayout) => {
      setLayout(nextLayout);
      if (nextLayout === "list") {
        setShowPhotos(true);
      }
    },
    [setLayout, setShowPhotos],
  );
  const fillCourtFlowRef = useRef<FillCourtFlowHandle>(null);
  const courtsSectionRef = useRef<HTMLDivElement>(null);
  const [takeOverPending, setTakeOverPending] = useState(false);

  const {
    leaseState: operatorLeaseState,
    takeOver: takeOverOperatorDashboard,
    hasDashboardLease,
  } = useOperatorDashboardLease(session.gameId, !isBrowserQuickGame);

  const handleLeaseTakeOver = useCallback(async () => {
    setTakeOverPending(true);
    try {
      await takeOverOperatorDashboard();
    } finally {
      setTakeOverPending(false);
    }
  }, [takeOverOperatorDashboard]);

  const operatorLeaseBlocked = operatorLeaseState.status === "blocked";
  const operatorLeaseLoading = operatorLeaseState.status === "loading";
  const showLeaseBlock = !isBrowserQuickGame && (operatorLeaseLoading || operatorLeaseBlocked);
  const canOperateSession = isBrowserQuickGame || (hasDashboardLease && !operatorLeaseLoading);

  const playerSessionStats = useMemo(
    () => buildPlayerSessionStatsMap(session.leaderboard),
    [session.leaderboard],
  );

  const queueWithStats = useMemo(
    () =>
      session.queue.map((entry) => attachSessionStatsToQueueEntry(entry, playerSessionStats)),
    [session.queue, playerSessionStats],
  );

  const matchingType = localPayload?.game.matchingType ?? session.matchingType;
  const usesWinnerLoserRotation = isDoublesWinnerLoserRotation(matchingType);
  const usesMixedDoubles = isMixedDoublesMatching(matchingType);

  const nextCourtFoursome = useMemo(() => {
    const foursome = pickDoublesCourtFoursome(session.queue, matchingType) ?? [];
    const byId = new Map(queueWithStats.map((entry) => [entry._id, entry]));
    return foursome
      .map((entry) => byId.get(entry._id))
      .filter((entry): entry is (typeof queueWithStats)[number] => entry != null);
  }, [matchingType, queueWithStats, session.queue]);

  const waitingLineEntries = useMemo(() => {
    if (usesWinnerLoserRotation) {
      const nextIds = new Set(nextCourtFoursome.map((entry) => entry._id));
      return queueWithStats.filter((entry) => !nextIds.has(entry._id));
    }
    return queueWithStats.slice(DOUBLES_PLAYERS_PER_COURT);
  }, [nextCourtFoursome, queueWithStats, usesWinnerLoserRotation]);

  const emptyCourtNumbers = useMemo(
    () =>
      [...session.courts]
        .filter((court) => court.status === "empty")
        .sort((a, b) => a.courtNumber - b.courtNumber)
        .map((court) => court.courtNumber),
    [session.courts],
  );

  const canFillNextCourt =
    pickDoublesCourtFoursome(session.queue, matchingType) != null &&
    emptyCourtNumbers.length > 0;
  const fillCourtTeamA = nextCourtFoursome.slice(0, 2);
  const fillCourtTeamB = nextCourtFoursome.slice(2, 4);

  const courtActions = useOperatorCourtActions({
    gameId: session.gameId,
    courts: session.courts,
    enabled: canOperateSession,
    invalidateQueryKey: ["games", "courts-view"],
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

  const sessionPlayerLookup = useMemo(
    () =>
      buildSessionPlayerLookup({
        queue: queueWithStats,
        checkedOut: session.checkedOut ?? [],
        courts: session.courts,
      }),
    [queueWithStats, session.checkedOut, session.courts],
  );

  const queueCounts = useMemo(
    () => ({
      queuedCount: queueWithStats.length,
      waitingLineCount: waitingLineEntries.length,
      canFillFromQueue: pickDoublesCourtFoursome(session.queue, matchingType) != null,
    }),
    [matchingType, queueWithStats.length, session.queue, waitingLineEntries.length],
  );

  const getCourtCardProps = useCallback(
    (court: (typeof session.courts)[number]) => ({
      ...courtActions.getCourtCardProps(court, queueCounts, (courtNumber) =>
        fillCourtFlowRef.current?.openFillCourt(courtNumber),
      ),
      mixedDoubles: usesMixedDoubles,
    }),
    [courtActions, queueCounts, usesMixedDoubles],
  );

  const showPauseAll = canOperateSession && courtActions.activeCourts.length > 0;

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
          <DashboardPanelFullscreenButton
            containerRef={courtsSectionRef}
            panelName="courts"
          />
        </div>
      </CardHeader>
      <CardContent className="dashboard-panel-content space-y-3">
        {showLeaseBlock ? (
          operatorLeaseLoading ? (
            <OperatorDashboardLeaseBanner loading />
          ) : leaseBannerCollapsed ? (
            <OperatorDashboardLeaseBannerCollapsed
              takenOver={operatorLeaseBlocked ? operatorLeaseState.takenOver : false}
              onShow={() => onLeaseBannerCollapsedChange?.(false)}
            />
          ) : (
            <OperatorDashboardLeaseBanner
              deviceHint={operatorLeaseBlocked ? operatorLeaseState.deviceHint : undefined}
              lastSeenAt={operatorLeaseBlocked ? operatorLeaseState.lastSeenAt : undefined}
              takenOver={operatorLeaseBlocked ? operatorLeaseState.takenOver : false}
              takeOverPending={takeOverPending}
              onTakeOver={() => void handleLeaseTakeOver()}
              onHide={
                onLeaseBannerCollapsedChange
                  ? () => onLeaseBannerCollapsedChange(true)
                  : undefined
              }
            />
          )
        ) : null}

      <GameCourtsGrid
        courts={session.courts}
        leaderboard={session.leaderboard}
        gameId={session.gameId}
        layout={layout}
        showPlayerPhotos={sessionShowPlayerPhotos}
        layoutVariant="pickleball"
        courtTheme={courtTheme}
        showLeaderboardRank
        summaryAddon={
          <SpectatorNextOnQueueButton
            queue={queueWithStats}
            enableCallNames
            courtNumber={emptyCourtNumbers[0] ?? null}
            hasEmptyCourt={emptyCourtNumbers.length > 0}
            canFillNextCourt={canFillNextCourt}
            fillPending={courtActions.startMutation.isPending}
            onFillNextCourt={
              canOperateSession
                ? () => fillCourtFlowRef.current?.openFillNextCourt()
                : undefined
            }
            showLeaderboardRank
            leaderboard={session.leaderboard}
          />
        }
        getCourtCardProps={getCourtCardProps}
      />

      {canOperateSession ? (
        <FillCourtFlow
          ref={fillCourtFlowRef}
          hideTrigger
          canFillNextCourt={canFillNextCourt}
          queuePlayerCount={queueWithStats.length}
          teamA={fillCourtTeamA}
          teamB={fillCourtTeamB}
          waitingLineEntries={waitingLineEntries}
          emptyCourtNumbers={emptyCourtNumbers}
          fillPending={courtActions.startMutation.isPending}
          replacePendingSourceIndex={courtActions.replacePendingSourceIndex}
          onConfirmFill={(courtNumber) => courtActions.startMutation.mutate(courtNumber)}
          onShuffle={async () => {
            await courtActions.shuffleNextMutation.mutateAsync();
          }}
          mixedDoubles={usesMixedDoubles}
          onReplace={(sourceIndex, sourceEntry) => {
            courtActions.setReplaceDialog({ kind: "queue", sourceIndex, sourceEntry });
          }}
        />
      ) : null}
      <ReplacePlayerDialog
        open={courtActions.replaceDialog !== null}
        onOpenChange={(open) => {
          if (!open) courtActions.setReplaceDialog(null);
        }}
        state={courtActions.replaceDialog}
        waitingEntries={waitingLineEntries}
        courtReplaceEntries={queueWithStats}
        onConfirm={courtActions.handleReplaceConfirm}
      />
      {canOperateSession ? (
        <OperatorCourtActionDialogs
          courts={session.courts}
          cancelCourtTarget={courtActions.cancelCourtTarget}
          onCancelCourtTargetChange={courtActions.setCancelCourtTarget}
          onConfirmCancelCourt={(courtNumber) => courtActions.cancelCourtMutation.mutate(courtNumber)}
          cancelRematchTarget={courtActions.cancelRematchTarget}
          onCancelRematchTargetChange={courtActions.setCancelRematchTarget}
          onConfirmCancelRematch={(courtNumber) =>
            courtActions.cancelRematchMutation.mutate(courtNumber)
          }
          cancelRematchPending={courtActions.cancelRematchMutation.isPending}
          endTargetCourt={courtActions.endTargetCourt}
          pendingWinner={courtActions.pendingWinner}
          onPendingWinnerChange={courtActions.setPendingWinner}
          endGameRematch={courtActions.endGameRematch}
          onEndGameRematchChange={courtActions.setEndGameRematch}
          teamAScore={courtActions.teamAScore}
          onTeamAScoreChange={courtActions.setTeamAScore}
          teamBScore={courtActions.teamBScore}
          onTeamBScoreChange={courtActions.setTeamBScore}
          onCloseEndDialog={courtActions.closeEndDialog}
          onSubmitEndGame={(input) => courtActions.endMutation.mutate(input)}
          endGameScoreError={endGameScoreError}
          playerLookup={sessionPlayerLookup}
        />
      ) : null}
      </CardContent>
    </Card>
  );
}
