import { NextResponse } from "next/server";

import { runWithDatabase } from "@/lib/db";
import { isDemoOpenPlayTitle } from "@/lib/demo-open-play";
import { Court } from "@/models/Court";
import { LeaderboardStats } from "@/models/LeaderboardStats";
import { MatchHistory } from "@/models/MatchHistory";
import { PickleGame } from "@/models/PickleGame";
import { QueueEntry } from "@/models/QueueEntry";
import { getAuthUserFromCookie } from "@/lib/auth";
import { isSuperAdmin } from "@/lib/superadmin";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {

    return await runWithDatabase(async () => {
    const authUser = await getAuthUserFromCookie();
    if (!authUser) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
    const { id: gameId } = await params;
    const superAdmin = isSuperAdmin(authUser.email);
    const game = await PickleGame.findOne(
      superAdmin ? { gameId } : { gameId, ownerId: authUser.userId },
    );
    if (!game) return NextResponse.json({ message: "Game not found." }, { status: 404 });
    if (!superAdmin && !isDemoOpenPlayTitle(game.title)) {
      return NextResponse.json(
        { message: "Reset is only available for demo open play." },
        { status: 403 },
      );
    }

    // Keep all known players for this game, then rebuild a clean FIFO queue.
    const previousEntries = await QueueEntry.find({ gameId }).sort({ registeredAt: 1 }).select("playerId");
    const uniquePlayerIds = Array.from(
      new Set(previousEntries.map((entry) => entry.playerId.toString()))
    );

    await Promise.all([
      QueueEntry.deleteMany({ gameId }),
      MatchHistory.deleteMany({ gameId }),
      LeaderboardStats.deleteMany({ gameId }),
      PickleGame.updateOne({ gameId }, { $set: { status: "active" } }),
      Court.updateMany(
        { gameId },
        {
          $set: {
            status: "empty",
            teamA: { playerIds: [], queueEntryIds: [] },
            teamB: { playerIds: [], queueEntryIds: [] },
            startedAt: null,
            pausedAt: null,
            totalPausedMs: 0,
          },
        }
      ),
    ]);

    if (uniquePlayerIds.length > 0) {
      await QueueEntry.create(
        uniquePlayerIds.map((playerId, index) => ({
          gameId,
          playerId,
          status: "queued" as const,
          queueType: "normal" as const,
          registeredAt: new Date(Date.now() + index * 1000),
          lastMatchResult: "none" as const,
          winStreak: 0,
        }))
      );
    }

    const playerCount = uniquePlayerIds.length;
    const resetMessage =
      playerCount === 0
        ? "Game reset complete. The queue is empty."
        : `Game reset complete. Re-queued ${playerCount} ${playerCount === 1 ? "player" : "players"}.`;

    return NextResponse.json({
      message: resetMessage,
    });

    });} catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to reset game." },
      { status: 400 }
    );
  }
}
