import { NextResponse } from "next/server";

import { connectToDatabase } from "@/lib/db";
import { PickleGame } from "@/models/PickleGame";
import { QueueEntry } from "@/models/QueueEntry";
import { Court } from "@/models/Court";
import { LeaderboardStats } from "@/models/LeaderboardStats";
import { MatchHistory } from "@/models/MatchHistory";
import "@/models/Player";
import { getAuthUserFromCookie } from "@/lib/auth";
import { ensureGameRegistrationQr } from "@/lib/game-qr";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectToDatabase();
    const authUser = await getAuthUserFromCookie();
    if (!authUser) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
    const { id } = await params;

    const [game, queue, courts, leaderboard, matches] = await Promise.all([
      PickleGame.findOne({ gameId: id, ownerId: authUser.userId }),
      QueueEntry.find({ gameId: id, status: "queued" })
        .sort({ registeredAt: 1 })
        .populate("playerId"),
      Court.find({ gameId: id }).sort({ courtNumber: 1 }).populate([
        "teamA.playerIds",
        "teamB.playerIds",
      ]),
      LeaderboardStats.find({ gameId: id }).sort({ wins: -1 }).populate("playerId"),
      MatchHistory.find({ gameId: id })
        .sort({ endedAt: -1 })
        .populate(["teamAPlayerIds", "teamBPlayerIds"]),
    ]);

    if (!game) return NextResponse.json({ message: "Game not found." }, { status: 404 });

    const { registerUrl, publicQrCodeDataUrl } = await ensureGameRegistrationQr(game);

    const gamePayload = {
      ...game.toObject(),
      registerUrl,
      publicQrCodeDataUrl,
    };

    return NextResponse.json({ game: gamePayload, queue, courts, leaderboard, matches });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to load game." },
      { status: 400 }
    );
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectToDatabase();
    const authUser = await getAuthUserFromCookie();
    if (!authUser) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
    const { id: gameId } = await params;

    const game = await PickleGame.findOne({ gameId, ownerId: authUser.userId });
    if (!game) return NextResponse.json({ message: "Game not found." }, { status: 404 });

    await Promise.all([
      QueueEntry.deleteMany({ gameId }),
      MatchHistory.deleteMany({ gameId }),
      LeaderboardStats.deleteMany({ gameId }),
      Court.deleteMany({ gameId }),
      PickleGame.deleteOne({ _id: game._id }),
    ]);

    return NextResponse.json({ message: "Game deleted." });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to delete game." },
      { status: 400 },
    );
  }
}
