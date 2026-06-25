import { LeaderboardPageClient } from "@/components/game/leaderboard-page-client";

export default async function LeaderboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ gameId: string }>;
  searchParams: Promise<{ from?: string; returnGame?: string }>;
}) {
  const { gameId } = await params;
  const { from, returnGame } = await searchParams;

  return (
    <LeaderboardPageClient
      gameId={gameId}
      isSpectatorView={from === "spectator"}
      returnGameId={returnGame}
    />
  );
}
