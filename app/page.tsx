import { Suspense } from "react";

import { HomePageClient } from "@/components/home/home-page-client";
import { loadInitialOwnerGames } from "@/lib/load-owner-games";

async function HomeWithGames() {
  return <HomePageClient initialGames={await loadInitialOwnerGames()} />;
}

export default function Home() {
  return (
    <Suspense fallback={<HomePageClient pending />}>
      <HomeWithGames />
    </Suspense>
  );
}
