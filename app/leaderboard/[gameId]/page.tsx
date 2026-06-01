import { connectToDatabase } from "@/lib/db";
import { loadGameLeaderboardRecap } from "@/lib/game-leaderboard-recap";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PickleGame } from "@/models/PickleGame";
import { getAuthUserFromCookie } from "@/lib/auth";

import { LeaderboardPageContent } from "@/components/game/leaderboard-page-content";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function LeaderboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ gameId: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  await connectToDatabase();
  const { gameId } = await params;
  const { from } = await searchParams;
  const isSpectatorView = from === "spectator";
  const backHref = isSpectatorView
    ? `/games/${gameId}/spectate`
    : `/games/${gameId}`;

  if (isSpectatorView) {
    const game = await PickleGame.findOne({ gameId }).select("_id");
    if (!game) notFound();
  } else {
    const authUser = await getAuthUserFromCookie();
    if (!authUser) notFound();
    const game = await PickleGame.findOne({ gameId, ownerId: authUser.userId }).select("_id");
    if (!game) notFound();
  }

  const { rows, insights } = await loadGameLeaderboardRecap(gameId);

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
        <LeaderboardPageContent insights={insights} rows={rows} />
      </section>
    </main>
  );
}
