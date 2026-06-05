import { NextResponse } from "next/server";

import { connectToDatabase } from "@/lib/db";
import { getSpectatorCount } from "@/lib/spectator-presence";
import { loadGameLeaderboardRecap } from "@/lib/game-leaderboard-recap";
import { PickleGame } from "@/models/PickleGame";
import { QueueEntry } from "@/models/QueueEntry";
import { Court } from "@/models/Court";
import { LeaderboardStats } from "@/models/LeaderboardStats";
import { MatchHistory } from "@/models/MatchHistory";
import "@/models/Player";

/** Public read-only game state for spectator dashboard (no auth). */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectToDatabase();
    const { id } = await params;

    const game = await PickleGame.findOne({ gameId: id });
    if (!game) return NextResponse.json({ message: "Game not found." }, { status: 404 });

    const [queue, checkedOut, courts, leaderboard, matches, recap] = await Promise.all([
      QueueEntry.find({ gameId: id, status: "queued" })
        .sort({ registeredAt: 1 })
        .populate("playerId"),
      QueueEntry.find({ gameId: id, status: "checked_out" })
        .sort({ updatedAt: -1 })
        .populate("playerId"),
      Court.find({ gameId: id }).sort({ courtNumber: 1 }).populate([
        "teamA.playerIds",
        "teamB.playerIds",
      ]),
      LeaderboardStats.find({ gameId: id }).select("playerId gamesPlayed wins losses"),
      MatchHistory.find({ gameId: id })
        .sort({ endedAt: -1 })
        .populate(["teamAPlayerIds", "teamBPlayerIds"]),
      game.status === "ended" ? loadGameLeaderboardRecap(id) : Promise.resolve(null),
    ]);

    return NextResponse.json({
      game,
      queue,
      checkedOut,
      courts,
      leaderboard,
      matches,
      recap: recap ?? undefined,
      spectatorCount: getSpectatorCount(id),
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to load game." },
      { status: 400 },
    );
  }
}
