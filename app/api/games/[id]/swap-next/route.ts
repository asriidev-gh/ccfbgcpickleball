import { NextResponse } from "next/server";

import { runWithDatabase } from "@/lib/db";
import { QueueEntry } from "@/models/QueueEntry";
import { PickleGame } from "@/models/PickleGame";
import { getAuthUserFromCookie } from "@/lib/auth";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {

    return await runWithDatabase(async () => {
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
    const sourceIndex = Number(body?.sourceIndex);
    const targetIndex = Number(body?.targetIndex);

    if (!Number.isInteger(sourceIndex) || sourceIndex < 0 || sourceIndex > 3) {
      return NextResponse.json(
        { message: "sourceIndex must be an integer from 0 to 3." },
        { status: 400 },
      );
    }

    if (!Number.isInteger(targetIndex) || targetIndex < 4) {
      return NextResponse.json(
        { message: "targetIndex must be an integer of 4 or greater (waiting line)." },
        { status: 400 },
      );
    }

    const queue = await QueueEntry.find({ gameId, status: "queued" }).sort({ registeredAt: 1 });

    if (targetIndex >= queue.length) {
      return NextResponse.json(
        { message: "Selected player is not in the waiting line." },
        { status: 400 },
      );
    }

    if (targetIndex === sourceIndex) {
      return NextResponse.json(
        { message: "Cannot swap a player with themselves." },
        { status: 400 },
      );
    }

    const reorderedQueue = [...queue];
    [reorderedQueue[sourceIndex], reorderedQueue[targetIndex]] = [
      reorderedQueue[targetIndex],
      reorderedQueue[sourceIndex],
    ];

    const baseTime =
      reorderedQueue.length > 0
        ? new Date(reorderedQueue[0].registeredAt).getTime()
        : Date.now();

    await Promise.all(
      reorderedQueue.map((entry, index) =>
        QueueEntry.updateOne(
          { _id: entry._id },
          { $set: { registeredAt: new Date(baseTime + index * 1000) } },
        ),
      ),
    );

    return NextResponse.json({
      message: `Swapped queue #${sourceIndex + 1} with #${targetIndex + 1}.`,
    });

    });} catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to swap players in the queue." },
      { status: 400 },
    );
  }
}
