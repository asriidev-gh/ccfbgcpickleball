import type { Metadata } from "next";
import { Suspense } from "react";

import { HomeLanding } from "@/components/landing/home-landing";
import { HomePageClient } from "@/components/home/home-page-client";
import { readAuthTokenPayload } from "@/lib/auth";
import { APP_NAME, APP_TAGLINE } from "@/lib/app-config";
import { runWithDatabase } from "@/lib/db";
import { loadInitialOwnerGames } from "@/lib/load-owner-games";
import { loadPublicClubLinksSafe } from "@/lib/public-club-links";
import { loadPublicPlayerSpotlight } from "@/lib/public-player-spotlight";

export const metadata: Metadata = {
  title: `${APP_NAME} — Open Play Queue`,
  description: APP_TAGLINE,
};

async function HomeWithGames() {
  return <HomePageClient initialGames={await loadInitialOwnerGames()} />;
}

/** Signed-in organizers get the dashboard; everyone else gets the public club home page. */
export default async function Home() {
  const isSignedIn = Boolean(await readAuthTokenPayload());

  if (!isSignedIn) {
    const [clubLinks, players] = await Promise.all([
      runWithDatabase(() => loadPublicClubLinksSafe()).catch(() => undefined),
      // The strip is decoration: if it cannot load, the page renders without it.
      runWithDatabase(() => loadPublicPlayerSpotlight()).catch(() => []),
    ]);
    return <HomeLanding clubLinks={clubLinks} players={players} />;
  }

  return (
    <Suspense fallback={<HomePageClient pending />}>
      <HomeWithGames />
    </Suspense>
  );
}
