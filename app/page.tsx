"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";

import { HomeMobileNav } from "@/components/home-mobile-nav";
import {
  mergeHomeGameSummaries,
  quickGameListCardToHomeSummary,
} from "@/components/home/home-game-summary";
import { HomeDashboard } from "@/components/home/home-dashboard";
import { useGamesList } from "@/hooks/use-games-list";
import { savedQuickGamesQueryKey, useSavedQuickGames } from "@/hooks/use-saved-quick-games";
import { listLocalGameCards } from "@/lib/local-game-list";
import { mergeQuickGameListCards } from "@/lib/merge-quick-game-list";
import { seedLocalGameOperatorCache } from "@/lib/operator-game-cache";
import { useLocalGameStore } from "@/store/local-game-store";

function HomeInner() {
  const queryClient = useQueryClient();
  const { data, refetch } = useGamesList();
  const { data: savedQuickGames = [] } = useSavedQuickGames();
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
    for (const game of quickGames.filter((item) => item.status !== "ended")) {
      seedLocalGameOperatorCache(queryClient, game.gameId);
    }
  }, [quickGames, queryClient]);

  return (
    <main className="min-h-screen px-6 py-6 pb-[calc(4.75rem+env(safe-area-inset-bottom))] lg:px-10 lg:pb-6">
      <section className="mx-auto flex max-w-7xl flex-col gap-6">
        <HomeDashboard
          activeGames={activeGames}
          pastGames={pastGames}
          onSessionTabChange={() => {
            void refetch();
            void queryClient.invalidateQueries({ queryKey: ["games-session-insights"] });
            void queryClient.invalidateQueries({ queryKey: savedQuickGamesQueryKey() });
          }}
        />
      </section>
      <HomeMobileNav />
    </main>
  );
}

export default function Home() {
  return <HomeInner />;
}
