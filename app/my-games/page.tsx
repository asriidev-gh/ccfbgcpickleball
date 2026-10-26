import { Suspense } from "react";

import { MyGamesPageClient } from "@/components/home/my-games-page-client";
import { MyGamesPageLoading } from "@/components/owner-hub/my-games-page-loading";
import { SeedGamesList } from "@/components/owner-hub/seed-games-list";
import { loadInitialOwnerGames } from "@/lib/load-owner-games";

async function MyGamesWithGames() {
  return (
    <SeedGamesList initialGames={await loadInitialOwnerGames()}>
      <MyGamesPageClient />
    </SeedGamesList>
  );
}

export default function MyGamesPage() {
  return (
    <Suspense fallback={<MyGamesPageLoading />}>
      <MyGamesWithGames />
    </Suspense>
  );
}
