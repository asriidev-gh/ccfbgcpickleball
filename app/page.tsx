"use client";

import { useQueryClient } from "@tanstack/react-query";

import { HomeMobileNav } from "@/components/home-mobile-nav";
import { HomeDashboard } from "@/components/home/home-dashboard";
import { useGamesList } from "@/hooks/use-games-list";

function HomeInner() {
  const queryClient = useQueryClient();
  const { data, refetch } = useGamesList();

  const games = data?.games ?? [];
  const activeGames = games.filter((game) => game.status !== "ended");
  const pastGames = games.filter((game) => game.status === "ended");

  return (
    <main className="min-h-screen px-6 py-6 pb-[calc(4.75rem+env(safe-area-inset-bottom))] lg:px-10 lg:pb-6">
      <section className="mx-auto flex max-w-7xl flex-col gap-6">
        <HomeDashboard
          activeGames={activeGames}
          pastGames={pastGames}
          onSessionTabChange={() => {
            void refetch();
            void queryClient.invalidateQueries({ queryKey: ["games-session-insights"] });
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
