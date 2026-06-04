import { NextResponse } from "next/server";

import { connectToDatabase } from "@/lib/db";
import { reorderQueuedPlayers } from "@/lib/queue-engine";
import { getAuthUserFromCookie } from "@/lib/auth";
import { PickleGame } from "@/models/PickleGame";

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
    const orderedEntryIds = body?.orderedEntryIds;

    if (!Array.isArray(orderedEntryIds) || orderedEntryIds.length === 0) {
      return NextResponse.json(
        { message: "orderedEntryIds must be a non-empty array of queue entry ids." },
        { status: 400 },
      );
    }

    if (
      !orderedEntryIds.every((id: unknown) => typeof id === "string" && id.trim().length > 0)
    ) {
      return NextResponse.json(
        { message: "Each orderedEntryIds item must be a non-empty string." },
        { status: 400 },
      );
    }

    await reorderQueuedPlayers(gameId, orderedEntryIds);

    return NextResponse.json({ message: "Queue order updated." });
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Failed to reorder queue.",
      },
      { status: 400 },
    );
  }
}
