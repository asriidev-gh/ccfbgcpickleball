"use client";

import { useQuery } from "@tanstack/react-query";

import { HomeMobileNav } from "@/components/home-mobile-nav";
import { HomeDashboard } from "@/components/home/home-dashboard";
import type { HomeGameSummary } from "@/components/home/home-game-summary";

function HomeInner() {
  const { data } = useQuery({
    queryKey: ["games"],
    queryFn: async () => {
      const response = await fetch("/api/games");
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message);
      return payload as { games: HomeGameSummary[] };
    },
    refetchInterval: 5000,
  });

  const games = data?.games ?? [];
  const activeGames = games.filter((game) => game.status !== "ended");
  const pastGames = games.filter((game) => game.status === "ended");

  return (
    <main className="min-h-screen px-6 py-6 pb-[calc(4.75rem+env(safe-area-inset-bottom))] lg:px-10 lg:pb-6">
      <section className="mx-auto flex max-w-7xl flex-col gap-6">
        <HomeDashboard activeGames={activeGames} pastGames={pastGames} />
      </section>
      <HomeMobileNav />
    </main>
  );
}

export default function Home() {
  return <HomeInner />;
}
