import { NextResponse } from "next/server";

import { connectToDatabase } from "@/lib/db";
import { PickleGame } from "@/models/PickleGame";
import { QueueEntry } from "@/models/QueueEntry";
import { Court } from "@/models/Court";
import { MatchHistory } from "@/models/MatchHistory";
import "@/models/Player";

/** Public read-only game state for spectator dashboard (no auth). */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectToDatabase();
    const { id } = await params;

    const game = await PickleGame.findOne({ gameId: id });
    if (!game) return NextResponse.json({ message: "Game not found." }, { status: 404 });

    const [queue, courts, matches] = await Promise.all([
      QueueEntry.find({ gameId: id, status: "queued" })
        .sort({ registeredAt: 1 })
        .populate("playerId"),
      Court.find({ gameId: id }).sort({ courtNumber: 1 }).populate([
        "teamA.playerIds",
        "teamB.playerIds",
      ]),
      MatchHistory.find({ gameId: id })
        .sort({ endedAt: -1 })
        .populate(["teamAPlayerIds", "teamBPlayerIds"]),
    ]);

    return NextResponse.json({ game, queue, courts, matches });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to load game." },
      { status: 400 },
    );
  }
}
