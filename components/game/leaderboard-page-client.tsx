"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { LeaderboardPageContent } from "@/components/game/leaderboard-page-content";
import { ScrollToTopButton } from "@/components/scroll-to-top-button";
import { Button } from "@/components/ui/button";
import { useOperatorDashboardLeaseCheck } from "@/hooks/use-operator-dashboard-lease";
import {
  fetchLeaderboardRecap,
  leaderboardRecapQueryKey,
} from "@/lib/fetch-leaderboard";

type LeaderboardPageClientProps = {
  gameId: string;
  isSpectatorView: boolean;
};

export function LeaderboardPageClient({ gameId, isSpectatorView }: LeaderboardPageClientProps) {
  const { hasDashboardLease, leaseCheckState } = useOperatorDashboardLeaseCheck(
    gameId,
    !isSpectatorView,
  );

  const backHref = isSpectatorView
    ? `/games/${gameId}/spectate`
    : hasDashboardLease
      ? `/games/${gameId}`
      : "/my-games";

  const backLabel = isSpectatorView || hasDashboardLease ? "Back to Game" : "Back to Dashboard";
  const showBackButton = isSpectatorView || leaseCheckState !== "loading";

  const recapQuery = useQuery({
    queryKey: leaderboardRecapQueryKey(gameId, isSpectatorView),
    queryFn: () => fetchLeaderboardRecap(gameId, isSpectatorView),
    enabled: Boolean(gameId),
    refetchOnWindowFocus: false,
  });

  const rows = recapQuery.data?.rows ?? [];
  const insights = recapQuery.data?.insights ?? [];
  const loading = recapQuery.isPending && !recapQuery.data;
  const error = recapQuery.isError && !recapQuery.data ? recapQuery.error : null;

  return (
    <main className="min-h-screen p-6">
      <section className="mx-auto flex max-w-7xl flex-col gap-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h1 className="page-title">Leaderboard</h1>
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
