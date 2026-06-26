import { NextResponse } from "next/server";

import { runWithDatabase } from "@/lib/db";
import { loadOperatorMatchHistory } from "@/lib/load-operator-game";
import { loadQueueCourtsAndCheckedOut } from "@/lib/load-spectate-game";
import { buildSmartShuffleQueueOrder } from "@/lib/next-court-match-analysis";
import { serializeQueueEntriesForPayload } from "@/lib/queue-first-timer";
import { reorderQueuedPlayers } from "@/lib/queue-engine";
import { PickleGame } from "@/models/PickleGame";
import { getAuthUserFromCookie } from "@/lib/auth";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
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

    const [history, queueState] = await Promise.all([
      loadOperatorMatchHistory(gameId, authUser.userId),
      loadQueueCourtsAndCheckedOut(gameId),
    ]);
    const queue = serializeQueueEntriesForPayload(
      queueState.queue as Parameters<typeof serializeQueueEntriesForPayload>[0],
      new Set(),
    ) as Parameters<typeof buildSmartShuffleQueueOrder>[0];
    const order = buildSmartShuffleQueueOrder(queue, history?.matches ?? [], { queue });
    if (!order) {
      return NextResponse.json(
        { message: "Not enough queued players. At least 4 players are required." },
        { status: 400 },
      );
    }

    await reorderQueuedPlayers(gameId, order);

    return NextResponse.json({ message: "Optimized next four for best balance." });

    });} catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "Failed to shuffle next-on-court players.",
      },
      { status: 400 },
    );
  }
}
