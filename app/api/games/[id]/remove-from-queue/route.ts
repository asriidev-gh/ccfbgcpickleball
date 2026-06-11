import { NextResponse } from "next/server";

import { connectToDatabase } from "@/lib/db";
import { getAuthUserFromCookie } from "@/lib/auth";
import { recordPlayerCheckoutNotification } from "@/lib/organizer-notifications";
import { formatPlayerDisplayName } from "@/lib/utils";
import { PickleGame } from "@/models/PickleGame";
import { QueueEntry } from "@/models/QueueEntry";
import "@/models/Player";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectToDatabase();
    const authUser = await getAuthUserFromCookie();

    const { id: gameId } = await params;
    const game = await PickleGame.findOne({ gameId });
    if (!game) return NextResponse.json({ message: "Game not found." }, { status: 404 });
    if (game.status === "ended") {
      return NextResponse.json(
        { message: "Open play has ended. Reset the game to restart." },
        { status: 400 },
      );
    }

    const body = await request.json();
    const queueEntryId = typeof body?.queueEntryId === "string" ? body.queueEntryId.trim() : "";
    const selfPlayerId = typeof body?.selfPlayerId === "string" ? body.selfPlayerId.trim() : "";
    const selfPlayerIds =
      Array.isArray(body?.selfPlayerIds)
        ? body.selfPlayerIds
            .filter((value: unknown): value is string => typeof value === "string")
            .map((value: string) => value.trim())
            .filter(Boolean)
        : [];
    const allowedSelfPlayerIds = Array.from(new Set([selfPlayerId, ...selfPlayerIds].filter(Boolean)));
    if (!queueEntryId) {
      return NextResponse.json({ message: "queueEntryId is required." }, { status: 400 });
    }
    if (!authUser && allowedSelfPlayerIds.length === 0) {
      return NextResponse.json(
        { message: "Unauthorized. Sign in or provide your player identity." },
        { status: 401 },
      );
    }

    const updateFilter: {
      _id: string;
      gameId: string;
      status: "queued";
      playerId?: { $in: string[] };
    } = {
      _id: queueEntryId,
      gameId,
      status: "queued",
    };
    if (!authUser) {
      updateFilter.playerId = { $in: allowedSelfPlayerIds };
    }

    const entry = await QueueEntry.findOneAndUpdate(
      updateFilter,
      { $set: { status: "checked_out" } },
      { new: true },
    ).populate("playerId", "firstName lastName");

    if (!entry) {
      return NextResponse.json(
        {
          message: authUser
            ? "Queued player not found."
            : "Your queued player record was not found.",
        },
        { status: 404 },
      );
    }

    const player = entry.playerId as {
      _id?: { toString(): string };
      firstName?: string;
      lastName?: string;
    } | null;
    const name =
      formatPlayerDisplayName(player?.firstName ?? "", player?.lastName ?? "") || "Player";

    if (player?._id) {
      await recordPlayerCheckoutNotification({
        gameId,
        playerId: String(player._id),
        playerName: name,
        queueEntryId: String(entry._id),
      });
    }

    return NextResponse.json({ message: `${name} checked out of the queue.` });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to remove player from queue." },
      { status: 400 },
    );
  }
}
