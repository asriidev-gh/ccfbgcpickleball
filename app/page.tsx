import { Suspense } from "react";

import { HomePageClient } from "@/components/home/home-page-client";
import type { GamesListPayload } from "@/hooks/use-games-list";
import { authorizeAuthPayload, readAuthTokenPayload } from "@/lib/auth";
import { runWithDatabase } from "@/lib/db";
import { loadOwnerGamesList } from "@/lib/load-owner-games";

async function loadInitialGames(): Promise<GamesListPayload | undefined> {
  try {
    return await runWithDatabase(async () => {
      const tokenPayload = await readAuthTokenPayload();
      if (!tokenPayload) return undefined;
      const authUser = await authorizeAuthPayload(tokenPayload);
      if (!authUser) return undefined;
      // Plain JSON so Mongoose documents can cross the server/client boundary.
      return JSON.parse(JSON.stringify(await loadOwnerGamesList(authUser))) as GamesListPayload;
    });
  } catch {
    // Fall back to the client-side fetch (and its retry/error handling).
    return undefined;
  }
}

async function HomeWithGames() {
  return <HomePageClient initialGames={await loadInitialGames()} />;
}

export default function Home() {
  return (
    <Suspense fallback={<HomePageClient pending />}>
      <HomeWithGames />
    </Suspense>
  );
}
