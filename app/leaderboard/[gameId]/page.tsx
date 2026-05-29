import { connectToDatabase } from "@/lib/db";
import { computeSessionInsights } from "@/lib/session-insights";
import { formatPlayerTableName } from "@/lib/utils";
import { LeaderboardStats } from "@/models/LeaderboardStats";
import { MatchHistory } from "@/models/MatchHistory";
import "@/models/Player";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PickleGame } from "@/models/PickleGame";
import { getAuthUserFromCookie } from "@/lib/auth";

import { LeaderboardPageContent } from "@/components/game/leaderboard-page-content";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

type LeaderboardEntry = {
  _id: string;
  wins: number;
  losses: number;
  gamesPlayed: number;
  winRate: number;
  currentStreak: number;
  playerId: {
    _id: string;
    firstName: string;
    lastName: string;
    photoUrl?: string;
    photoPublicId?: string;
    personalQrCode?: string;
  } | null;
};

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

  const [stats, matches] = await Promise.all([
    LeaderboardStats.find({ gameId }).sort({ wins: -1, winRate: -1 }).populate("playerId"),
    MatchHistory.find({ gameId })
      .sort({ endedAt: 1 })
      .populate(["teamAPlayerIds", "teamBPlayerIds"]),
  ]);
  const safeStats = (stats as unknown as LeaderboardEntry[]).filter((item) =>
    Boolean(item.playerId),
  );
  const insights = computeSessionInsights(
    matches.map((m) => ({
      endedAt: m.endedAt,
      courtNumber: m.courtNumber,
      teamAPlayerIds: m.teamAPlayerIds,
      teamBPlayerIds: m.teamBPlayerIds,
      winnerTeam: m.winnerTeam,
      durationSeconds: m.durationSeconds,
    })),
    safeStats.map((row) => ({
      playerId: String(row.playerId!._id),
      name: formatPlayerTableName(row.playerId!.firstName, row.playerId!.lastName),
      gamesPlayed: row.gamesPlayed,
      wins: row.wins,
      losses: row.losses,
      winRate: row.winRate,
      currentStreak: row.currentStreak,
    })),
  );

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
        <LeaderboardPageContent
          insights={insights}
          rows={safeStats.map((item) => ({
            id: String(item._id),
            firstName: item.playerId?.firstName ?? "Unknown",
            lastName: item.playerId?.lastName ?? "Player",
            photoUrl: item.playerId?.photoUrl,
            photoPublicId: item.playerId?.photoPublicId,
            personalQrCode: item.playerId?.personalQrCode,
            wins: item.wins,
            losses: item.losses,
            gamesPlayed: item.gamesPlayed,
            winRate: item.winRate,
            currentStreak: item.currentStreak,
          }))}
        />
      </section>
    </main>
  );
}
