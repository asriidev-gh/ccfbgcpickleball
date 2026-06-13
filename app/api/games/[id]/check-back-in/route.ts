import { NextResponse } from "next/server";

import { runWithDatabase } from "@/lib/db";
import { getAuthUserFromCookie } from "@/lib/auth";
import { PickleGame } from "@/models/PickleGame";
import { QueueEntry } from "@/models/QueueEntry";
import "@/models/Player";

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
    const queueEntryId = typeof body?.queueEntryId === "string" ? body.queueEntryId.trim() : "";
    if (!queueEntryId) {
      return NextResponse.json({ message: "queueEntryId is required." }, { status: 400 });
    }

    const checkedOutEntry = await QueueEntry.findOne({
      _id: queueEntryId,
      gameId,
      status: "checked_out",
    }).select("playerId");
    if (!checkedOutEntry) {
      return NextResponse.json({ message: "Checked-out player not found." }, { status: 404 });
    }

    const alreadyQueued = await QueueEntry.findOne({
      gameId,
      status: "queued",
      playerId: checkedOutEntry.playerId,
    }).select("_id");
    if (alreadyQueued) {
      return NextResponse.json({ message: "Player is already in the queue." }, { status: 400 });
    }

    const lastQueued = await QueueEntry.findOne({ gameId, status: "queued" })
      .sort({ registeredAt: -1 })
      .select("registeredAt")
      .lean<{ registeredAt?: Date } | null>();

    const baseTime = lastQueued?.registeredAt
      ? new Date(lastQueued.registeredAt).getTime()
      : Date.now();
    const registeredAt = new Date(baseTime + 1000);

    const entry = await QueueEntry.findOneAndUpdate(
      { _id: queueEntryId, gameId, status: "checked_out" },
      {
        $set: {
          status: "queued",
          queueType: "normal",
          pairGroupId: null,
          registeredAt,
        },
      },
      { returnDocument: 'after' },
    ).populate("playerId", "firstName lastName");

    if (!entry) {
      return NextResponse.json({ message: "Checked-out player not found." }, { status: 404 });
    }

    const player = entry.playerId as { firstName?: string; lastName?: string } | null;
    const name = [player?.firstName, player?.lastName].filter(Boolean).join(" ").trim() || "Player";

    return NextResponse.json({
      message: `${name} checked back in at the end of the queue.`,
    });

    });} catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to check player back in." },
      { status: 400 },
    );
  }
}
