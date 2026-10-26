"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";

import { HomeMobileNav } from "@/components/home-mobile-nav";
import {
  mergeHomeGameSummaries,
  quickGameListCardToHomeSummary,
} from "@/components/home/home-game-summary";
import { HomeDashboard } from "@/components/home/home-dashboard";
import { useAuthMe } from "@/hooks/use-auth-me";
import { useGamesList, type GamesListPayload } from "@/hooks/use-games-list";
import { useSavedQuickGames } from "@/hooks/use-saved-quick-games";
import { listLocalGameCards } from "@/lib/local-game-list";
import { mergeQuickGameListCards } from "@/lib/merge-quick-game-list";
import { seedLocalGameOperatorCache } from "@/lib/operator-game-cache";
import { useLocalGameStore } from "@/store/local-game-store";

type HomePageClientProps = {
  /** Server-loaded list; seeds the React Query cache so no client fetch is needed on first paint. */
  initialGames?: GamesListPayload;
  /** Server data still streaming: render the shell without fetching. */
  pending?: boolean;
};

function HomeInner({ initialGames, pending }: HomePageClientProps) {
  const queryClient = useQueryClient();
  const { data: authData } = useAuthMe();
  const { data, isLoading: isGamesListLoading, isFetching: isGamesListFetching } = useGamesList({
    initialData: initialGames,
    enabled: !pending,
  });
  const { data: savedQuickGames = [] } = useSavedQuickGames(Boolean(authData?.user));
  const localSessionsRecord = useLocalGameStore((state) => state.sessions);

  const games = data?.games ?? [];
  const quickGames = useMemo(
    () => mergeQuickGameListCards(listLocalGameCards(localSessionsRecord), savedQuickGames),
    [localSessionsRecord, savedQuickGames],
  );

  const activeGames = useMemo(
    () =>
      mergeHomeGameSummaries(
        games.filter((game) => game.status !== "ended"),
        quickGames
          .filter((game) => game.status !== "ended")
          .map(quickGameListCardToHomeSummary),
      ),
    [games, quickGames],
  );

  const pastGames = useMemo(
    () =>
      mergeHomeGameSummaries(
        games.filter((game) => game.status === "ended"),
        quickGames
          .filter((game) => game.status === "ended")
          .map(quickGameListCardToHomeSummary),
      ),
    [games, quickGames],
  );

  useEffect(() => {
    const activeQuickGames = quickGames.filter((item) => item.status !== "ended");
    if (activeQuickGames.length === 0) return;

    const seed = () => {
      for (const game of activeQuickGames) {
        seedLocalGameOperatorCache(queryClient, game.gameId);
      }
    };

    if (typeof window.requestIdleCallback === "function") {
      const idleId = window.requestIdleCallback(seed);
      return () => window.cancelIdleCallback(idleId);
    }

    const timer = window.setTimeout(seed, 0);
    return () => window.clearTimeout(timer);
  }, [quickGames, queryClient]);

  const gamesLoading =
    pending ||
    isGamesListLoading || (isGamesListFetching && games.length === 0 && quickGames.length === 0);

  return (
    <main className="min-h-screen px-6 py-6 pb-[calc(4.75rem+env(safe-area-inset-bottom))] lg:px-10 lg:pb-6">
      <section className="mx-auto flex max-w-7xl flex-col gap-6">
        <HomeDashboard
          activeGames={activeGames}
          pastGames={pastGames}
          gamesLoading={gamesLoading}
        />
      </section>
      <HomeMobileNav />
    </main>
  );
}

export function HomePageClient(props: HomePageClientProps) {
  return <HomeInner {...props} />;
}
