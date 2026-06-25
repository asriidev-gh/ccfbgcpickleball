"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, LogOut } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { LeaderboardPageContent } from "@/components/game/leaderboard-page-content";
import { SpectatorPlayerCardShareDialog } from "@/components/game/spectator-player-card-share-dialog";
import type { LeaderboardRow } from "@/components/game/leaderboard-standings";
import { resolveLeaderboardPlayerId } from "@/components/game/leaderboard-standings";
import { SpectatePlayerEndorsementsListDialog } from "@/components/player/spectate-player-endorsements-list-dialog";
import { EphemeralLeaderboardSaveBanner } from "@/components/play/ephemeral-leaderboard-save-banner";
import { ScrollToTopButton } from "@/components/scroll-to-top-button";
import { Button } from "@/components/ui/button";
import { useQuickGameSessionAfterMount } from "@/hooks/use-quick-game-session-after-mount";
import { useOperatorDashboardLeaseCheck } from "@/hooks/use-operator-dashboard-lease";
import {
  fetchLeaderboardRecap,
  leaderboardRecapQueryKey,
} from "@/lib/fetch-leaderboard";
import { fetchSpectateGame, spectatorLiveQueryKey } from "@/lib/fetch-spectate-game";
import {
  fetchSpectateGameEndorsementCounts,
  spectateGameEndorsementCountsQueryKey,
} from "@/lib/fetch-spectate-player-endorsement";
import { buildPlayerLeaderboardRankMap } from "@/lib/games-played-map";
import { leaderboardRowToShareEntry } from "@/lib/leaderboard-share";
import { formatOpenPlayScheduleLabel, formatVenueShareLabel } from "@/lib/open-play-time-range";
import { getActiveQueueHighlightPlayerIds } from "@/lib/queue-highlight";
import {
  spectatorEndorsementQueryOptions,
  spectatorLeaderboardQueryOptions,
  spectatorLiveQueryOptions,
} from "@/lib/spectator-query-options";
import {
  getQuickGameDashboardPath,
  isEphemeralQuickGame,
  isQuickGame,
} from "@/lib/local-game-id";
import { buildLocalLeaderboardRecap } from "@/lib/local-leaderboard-recap";

type LeaderboardPageClientProps = {
  gameId: string;
  isSpectatorView: boolean;
};

const QUICK_GAME_LOOKUP_TIMEOUT_MS = 750;

export function LeaderboardPageClient({ gameId, isSpectatorView }: LeaderboardPageClientProps) {
  const queryClient = useQueryClient();
  const [endorseListTargetRow, setEndorseListTargetRow] = useState<LeaderboardRow | null>(null);
  const [shareTargetRow, setShareTargetRow] = useState<LeaderboardRow | null>(null);
  const isQuickGameSession = isQuickGame(gameId);
  const { payload: quickPayload, mounted: quickSessionMounted } = useQuickGameSessionAfterMount(
    isQuickGameSession ? gameId : "",
  );
  const [quickLookupTimedOut, setQuickLookupTimedOut] = useState(false);

  useEffect(() => {
    if (!isQuickGameSession || !quickSessionMounted) return;
    setQuickLookupTimedOut(false);
    if (quickPayload) return;

    const timer = window.setTimeout(() => {
      setQuickLookupTimedOut(true);
    }, QUICK_GAME_LOOKUP_TIMEOUT_MS);

    return () => window.clearTimeout(timer);
  }, [gameId, isQuickGameSession, quickPayload, quickSessionMounted]);

  const { hasDashboardLease, leaseCheckState } = useOperatorDashboardLeaseCheck(
    gameId,
    !isSpectatorView && !isQuickGameSession,
  );

  const isEndedEphemeralPublic =
    quickSessionMounted &&
    isEphemeralQuickGame(gameId) &&
    quickPayload?.game.status === "ended" &&
    !isSpectatorView;

  const backHref = isSpectatorView
    ? `/games/${gameId}/spectate`
    : isEndedEphemeralPublic
      ? "/play"
      : isQuickGameSession || hasDashboardLease
        ? getQuickGameDashboardPath(gameId)
        : "/my-games";

  const backLabel = isEndedEphemeralPublic
    ? "Exit"
    : isSpectatorView || isQuickGameSession || hasDashboardLease
      ? "Back to Game"
      : "Back to Dashboard";
  const showBackButton =
    (isSpectatorView || leaseCheckState !== "loading") &&
    (!isQuickGameSession || quickSessionMounted);

  const localRecap = useMemo(
    () => (quickPayload ? buildLocalLeaderboardRecap(quickPayload) : null),
    [quickPayload],
  );

  const recapQuery = useQuery({
    queryKey: leaderboardRecapQueryKey(gameId, isSpectatorView),
    queryFn: () => fetchLeaderboardRecap(gameId, isSpectatorView),
    enabled: Boolean(gameId) && !isQuickGameSession,
    ...(isSpectatorView ? spectatorLeaderboardQueryOptions : { refetchOnWindowFocus: false }),
  });

  const { data: endorsementCounts = {} } = useQuery({
    queryKey: spectateGameEndorsementCountsQueryKey(gameId),
    queryFn: () => fetchSpectateGameEndorsementCounts(gameId),
    enabled: Boolean(gameId) && !isQuickGameSession,
    ...spectatorEndorsementQueryOptions,
  });

  const spectatorLiveQuery = useQuery({
    queryKey: spectatorLiveQueryKey(gameId),
    queryFn: () => fetchSpectateGame(gameId, "live"),
    enabled: isSpectatorView && Boolean(gameId) && !isQuickGameSession,
    ...spectatorLiveQueryOptions,
  });

  const handleEndorsementClick = useCallback((row: LeaderboardRow) => {
    setEndorseListTargetRow(row);
  }, []);

  const handlePodiumShareClick = useCallback((row: LeaderboardRow) => {
    setShareTargetRow(row);
  }, []);

  const endorseListEntry = useMemo(
    () =>
      endorseListTargetRow
        ? {
            _id: `leaderboard-${endorseListTargetRow.playerId ?? endorseListTargetRow.id}`,
            queueType: "normal" as const,
            playerId: {
              ...endorseListTargetRow,
              _id: endorseListTargetRow.playerId ?? endorseListTargetRow.id,
            },
            registeredAt: "",
            lastMatchResult: "none" as const,
          }
        : null,
    [endorseListTargetRow],
  );

  useEffect(() => {
    if (!isQuickGameSession || !localRecap) return;
    queryClient.setQueryData(leaderboardRecapQueryKey(gameId, isSpectatorView), localRecap);
  }, [gameId, isQuickGameSession, isSpectatorView, localRecap, queryClient]);

  const rows = isQuickGameSession ? (localRecap?.rows ?? []) : (recapQuery.data?.rows ?? []);
  const insights = isQuickGameSession
    ? (localRecap?.insights ?? [])
    : (recapQuery.data?.insights ?? []);

  const selfPlayerIds = useMemo(
    () => (isSpectatorView && gameId ? getActiveQueueHighlightPlayerIds(gameId) : []),
    [gameId, isSpectatorView],
  );

  const leaderboardRankMap = useMemo(
    () =>
      buildPlayerLeaderboardRankMap(
        rows.map((row) => ({
          playerId: resolveLeaderboardPlayerId(row),
          wins: row.wins,
          losses: row.losses,
          gamesPlayed: row.gamesPlayed,
        })),
      ),
    [rows],
  );

  const shareEntry = useMemo(
    () => (shareTargetRow ? leaderboardRowToShareEntry(shareTargetRow) : null),
    [shareTargetRow],
  );
  const sharePlayerId = shareTargetRow ? resolveLeaderboardPlayerId(shareTargetRow) : "";

  const shareGame = isQuickGameSession ? quickPayload?.game : spectatorLiveQuery.data?.game;
  const canPodiumShare =
    isSpectatorView &&
    (shareGame?.status === "active" || shareGame?.status === "ended");
  const openPlayScheduleLabel = shareGame
    ? formatOpenPlayScheduleLabel(shareGame.openPlayDate, shareGame.openPlayTimeRange)
    : null;
  const venueShareLabel = shareGame
    ? formatVenueShareLabel(shareGame.venueName, shareGame.venueAddress)
    : null;
  const quickGameLoading =
    isQuickGameSession && quickSessionMounted && !quickPayload && !quickLookupTimedOut;
  const loading = quickGameLoading || (!isQuickGameSession && recapQuery.isPending && !recapQuery.data);
  const error = isQuickGameSession
    ? !quickSessionMounted
      ? null
      : quickPayload
        ? null
        : quickLookupTimedOut
          ? new Error("Session not found.")
          : null
    : recapQuery.isError && !recapQuery.data
      ? recapQuery.error
      : null;

  return (
    <main className="min-h-screen p-6">
      <section className="mx-auto flex max-w-7xl flex-col gap-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <h1 className="page-title">Leaderboard</h1>
            {isEphemeralQuickGame(gameId) ? (
              <p className="caption text-muted-foreground">
                Public quick play — standings live in this browser only.
              </p>
            ) : isQuickGameSession ? (
              <p className="caption text-muted-foreground">
                Quick game — standings sync to your account when the session ends.
              </p>
            ) : null}
          </div>
          {showBackButton ? (
            <Link href={backHref}>
              <Button variant="outline">
                {isEndedEphemeralPublic ? (
                  <LogOut className="mr-2 h-4 w-4" aria-hidden />
                ) : (
                  <ArrowLeft className="mr-2 h-4 w-4" aria-hidden />
                )}
                {backLabel}
              </Button>
            </Link>
          ) : null}
        </div>
        {isEndedEphemeralPublic && quickPayload ? (
          <EphemeralLeaderboardSaveBanner gameId={gameId} payload={quickPayload} />
        ) : null}
        {error ? (
          <p className="text-destructive">
            Failed to load leaderboard:{" "}
            {error instanceof Error ? error.message : "Unknown error"}
          </p>
        ) : (
          <LeaderboardPageContent
            insights={insights}
            rows={rows}
            loading={loading}
            endorsementCounts={endorsementCounts}
            onEndorsementClick={handleEndorsementClick}
            onPodiumShareClick={canPodiumShare ? handlePodiumShareClick : undefined}
          />
        )}
      </section>
      <SpectatePlayerEndorsementsListDialog
        gameId={gameId}
        entry={endorseListEntry}
        open={endorseListTargetRow != null}
        onOpenChange={(open) => {
          if (!open) setEndorseListTargetRow(null);
        }}
      />
      {shareEntry && sharePlayerId ? (
        <SpectatorPlayerCardShareDialog
          gameId={gameId}
          entry={shareEntry}
          playerId={sharePlayerId}
          selfPlayerIds={selfPlayerIds}
          gameTitle={shareGame?.title}
          clubName={spectatorLiveQuery.data?.clubBranding?.clubName ?? null}
          clubLogoUrl={spectatorLiveQuery.data?.clubBranding?.clubLogoUrl ?? null}
          clubTagline={spectatorLiveQuery.data?.clubBranding?.clubTagline ?? null}
          openPlaySchedule={openPlayScheduleLabel}
          venueLabel={venueShareLabel}
          leaderboardRankMap={leaderboardRankMap}
          open={shareTargetRow != null}
          onOpenChange={(open) => {
            if (!open) setShareTargetRow(null);
          }}
        />
      ) : null}
      <ScrollToTopButton />
    </main>
  );
}
