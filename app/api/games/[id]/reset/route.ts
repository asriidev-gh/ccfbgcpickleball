import { NextResponse } from "next/server";

import { connectToDatabase } from "@/lib/db";
import { isGameResetEnabled } from "@/lib/feature-flags";
import { Court } from "@/models/Court";
import { LeaderboardStats } from "@/models/LeaderboardStats";
import { MatchHistory } from "@/models/MatchHistory";
import { PickleGame } from "@/models/PickleGame";
import { QueueEntry } from "@/models/QueueEntry";
import { getAuthUserFromCookie } from "@/lib/auth";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectToDatabase();
    const authUser = await getAuthUserFromCookie();
    if (!authUser) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
    if (!isGameResetEnabled()) {
      return NextResponse.json({ message: "Game reset is disabled." }, { status: 403 });
    }
    const { id: gameId } = await params;
    const game = await PickleGame.findOne({ gameId, ownerId: authUser.userId });
    if (!game) return NextResponse.json({ message: "Game not found." }, { status: 404 });

    // Keep all known players for this game, then rebuild a clean FIFO queue.
    const previousEntries = await QueueEntry.find({ gameId }).sort({ registeredAt: 1 }).select("playerId");
    const uniquePlayerIds = Array.from(
      new Set(previousEntries.map((entry) => entry.playerId.toString()))
    );

    await Promise.all([
      QueueEntry.deleteMany({ gameId }),
      MatchHistory.deleteMany({ gameId }),
      LeaderboardStats.deleteMany({ gameId }),
      PickleGame.updateOne({ gameId, ownerId: authUser.userId }, { $set: { status: "active" } }),
      Court.updateMany(
        { gameId },
        {
          $set: {
            status: "empty",
            teamA: { playerIds: [], queueEntryIds: [] },
            teamB: { playerIds: [], queueEntryIds: [] },
            startedAt: null,
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
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to reset game." },
      { status: 400 }
    );
  }
}
