"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo } from "react";

import { LeaderboardPageContent } from "@/components/game/leaderboard-page-content";
import { ScrollToTopButton } from "@/components/scroll-to-top-button";
import { Button } from "@/components/ui/button";
import { useOperatorDashboardLeaseCheck } from "@/hooks/use-operator-dashboard-lease";
import {
  fetchLeaderboardRecap,
  leaderboardRecapQueryKey,
} from "@/lib/fetch-leaderboard";
import {
  getQuickGameDashboardPath,
  isEphemeralQuickGame,
  isQuickGame,
} from "@/lib/local-game-id";
import { buildLocalLeaderboardRecap } from "@/lib/local-leaderboard-recap";
import { useQuickGameSession } from "@/lib/quick-game-store";

type LeaderboardPageClientProps = {
  gameId: string;
  isSpectatorView: boolean;
};

export function LeaderboardPageClient({ gameId, isSpectatorView }: LeaderboardPageClientProps) {
  const queryClient = useQueryClient();
  const isQuickGameSession = isQuickGame(gameId);
  const quickPayload = useQuickGameSession(gameId);

  const { hasDashboardLease, leaseCheckState } = useOperatorDashboardLeaseCheck(
    gameId,
    !isSpectatorView && !isQuickGameSession,
  );

  const backHref = isSpectatorView
    ? `/games/${gameId}/spectate`
    : isQuickGameSession || hasDashboardLease
      ? getQuickGameDashboardPath(gameId)
      : "/my-games";

  const backLabel =
    isSpectatorView || isQuickGameSession || hasDashboardLease
      ? "Back to Game"
      : "Back to Dashboard";
  const showBackButton = isSpectatorView || isQuickGameSession || leaseCheckState !== "loading";

  const localRecap = useMemo(
    () => (quickPayload ? buildLocalLeaderboardRecap(quickPayload) : null),
    [quickPayload],
  );

  const recapQuery = useQuery({
    queryKey: leaderboardRecapQueryKey(gameId, isSpectatorView),
    queryFn: () => fetchLeaderboardRecap(gameId, isSpectatorView),
    enabled: Boolean(gameId) && !isQuickGameSession,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (!isQuickGameSession || !localRecap) return;
    queryClient.setQueryData(leaderboardRecapQueryKey(gameId, isSpectatorView), localRecap);
  }, [gameId, isQuickGameSession, isSpectatorView, localRecap, queryClient]);

  const rows = isQuickGameSession ? (localRecap?.rows ?? []) : (recapQuery.data?.rows ?? []);
  const insights = isQuickGameSession
    ? (localRecap?.insights ?? [])
    : (recapQuery.data?.insights ?? []);
  const loading = !isQuickGameSession && recapQuery.isPending && !recapQuery.data;
  const error = isQuickGameSession
    ? quickPayload
      ? null
      : new Error("Session not found.")
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
                <ArrowLeft className="mr-2 h-4 w-4" aria-hidden />
                {backLabel}
              </Button>
            </Link>
          ) : null}
        </div>
        {error ? (
          <p className="text-destructive">
            Failed to load leaderboard:{" "}
            {error instanceof Error ? error.message : "Unknown error"}
          </p>
        ) : (
          <LeaderboardPageContent insights={insights} rows={rows} loading={loading} />
        )}
      </section>
      <ScrollToTopButton />
    </main>
  );
}
