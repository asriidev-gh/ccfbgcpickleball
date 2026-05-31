import { NextResponse } from "next/server";

import { connectToDatabase } from "@/lib/db";
import { getAuthUserFromCookie } from "@/lib/auth";
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
    const queueEntryId = typeof body?.queueEntryId === "string" ? body.queueEntryId.trim() : "";
    if (!queueEntryId) {
      return NextResponse.json({ message: "queueEntryId is required." }, { status: 400 });
    }

    const entry = await QueueEntry.findOne({
      _id: queueEntryId,
      gameId,
      status: "queued",
    }).populate("playerId", "firstName lastName");

    if (!entry) {
      return NextResponse.json({ message: "Queued player not found." }, { status: 404 });
    }

    await QueueEntry.deleteOne({ _id: entry._id });

    const player = entry.playerId as { firstName?: string; lastName?: string } | null;
    const name = [player?.firstName, player?.lastName].filter(Boolean).join(" ").trim() || "Player";

    return NextResponse.json({ message: `${name} checked out of the queue.` });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to remove player from queue." },
      { status: 400 },
    );
  }
}
