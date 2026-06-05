import { NextResponse } from "next/server";

import { connectToDatabase } from "@/lib/db";
import { getAuthUserFromCookie } from "@/lib/auth";
import { removePlayerFromGame } from "@/lib/remove-game-player";
import { removePlayerFromGameSchema } from "@/lib/validations";
import { PickleGame } from "@/models/PickleGame";
import { QueueEntry } from "@/models/QueueEntry";
import "@/models/Player";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectToDatabase();
    const authUser = await getAuthUserFromCookie();
    if (!authUser) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });

    const { id: gameId } = await params;
    const game = await PickleGame.findOne({ gameId, ownerId: authUser.userId });
    if (!game) return NextResponse.json({ message: "Game not found." }, { status: 404 });
    if (game.status === "ended") {
      return NextResponse.json(
        { message: "Open play has ended. Reset the game to restart." },
        { status: 400 },
      );
    }

    const body = await request.json();
    const payload = removePlayerFromGameSchema.parse({ ...body, gameId });

    let playerId = payload.playerId?.trim() ?? "";
    if (!playerId && payload.queueEntryId) {
      const entry = await QueueEntry.findOne({
        _id: payload.queueEntryId,
        gameId,
      }).select("playerId");
      if (!entry) {
        return NextResponse.json({ message: "Player record not found for this open play." }, { status: 404 });
      }
      playerId = entry.playerId.toString();
    }

    if (!playerId) {
      return NextResponse.json({ message: "playerId or queueEntryId is required." }, { status: 400 });
    }

    const { playerName } = await removePlayerFromGame({ gameId, playerId });

    return NextResponse.json({
      message: `${playerName} was removed from this open play.`,
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to remove player." },
      { status: 400 },
    );
  }
}
