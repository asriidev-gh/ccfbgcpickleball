import { NextResponse } from "next/server";

import { connectToDatabase } from "@/lib/db";
import { QueueEntry } from "@/models/QueueEntry";
import { PickleGame } from "@/models/PickleGame";
import { getAuthUserFromCookie } from "@/lib/auth";

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
        { status: 400 }
      );
    }
    const body = await request.json();
    const sourceIndex = Number(body?.sourceIndex);

    if (!Number.isInteger(sourceIndex) || sourceIndex < 0 || sourceIndex > 3) {
      return NextResponse.json(
        { message: "sourceIndex must be an integer from 0 to 3." },
        { status: 400 }
      );
    }

    const queue = await QueueEntry.find({ gameId, status: "queued" }).sort({ registeredAt: 1 });
    const primaryTargetIndex = sourceIndex + 4;
    const fallbackTargetIndex =
      sourceIndex === 2 ? 4 : sourceIndex === 3 ? 5 : primaryTargetIndex;
    const targetIndex =
      queue.length > primaryTargetIndex
        ? primaryTargetIndex
        : queue.length > fallbackTargetIndex
          ? fallbackTargetIndex
          : -1;

    if (targetIndex < 0 || targetIndex === sourceIndex) {
      return NextResponse.json(
        { message: "Not enough players in queue to perform this replacement." },
        { status: 400 }
      );
    }

    // Swap in-memory order first, then rewrite deterministic timestamps for the whole queue.
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
          { $set: { registeredAt: new Date(baseTime + index * 1000) } }
        )
      )
    );

    return NextResponse.json({
      message: `Swapped queue #${sourceIndex + 1} with #${targetIndex + 1}.`,
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to swap players in the queue." },
      { status: 400 }
    );
  }
}
