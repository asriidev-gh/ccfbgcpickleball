import { LeaderboardPageClient } from "@/components/game/leaderboard-page-client";

export default async function LeaderboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ gameId: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const { gameId } = await params;
  const { from } = await searchParams;

  return <LeaderboardPageClient gameId={gameId} isSpectatorView={from === "spectator"} />;
}
