"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { LeaderboardPageContent } from "@/components/game/leaderboard-page-content";
import { ScrollToTopButton } from "@/components/scroll-to-top-button";
import { Button } from "@/components/ui/button";
import {
  fetchLeaderboardRecap,
  leaderboardRecapQueryKey,
} from "@/lib/fetch-leaderboard";

type LeaderboardPageClientProps = {
  gameId: string;
  isSpectatorView: boolean;
};

export function LeaderboardPageClient({ gameId, isSpectatorView }: LeaderboardPageClientProps) {
  const backHref = isSpectatorView ? `/games/${gameId}/spectate` : `/games/${gameId}`;

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
          <Link href={backHref}>
            <Button variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Game
            </Button>
          </Link>
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
