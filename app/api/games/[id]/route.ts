import { NextResponse } from "next/server";

import { connectToDatabase } from "@/lib/db";
import { formatZodError } from "@/lib/format-zod-error";
import { getGameRegistrationCount } from "@/lib/game-registration-limit";
import { updateGameSchema } from "@/lib/validations";
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

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectToDatabase();
    const authUser = await getAuthUserFromCookie();
    if (!authUser) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
    const { id: gameId } = await params;

    const body = await request.json();
    const parsed = updateGameSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ message: formatZodError(parsed.error) }, { status: 400 });
    }

    const game = await PickleGame.findOne({ gameId, ownerId: authUser.userId });
    if (!game) return NextResponse.json({ message: "Game not found." }, { status: 404 });

    if (parsed.data.strictPlayerCount) {
      const registeredCount = await getGameRegistrationCount(gameId);
      if (parsed.data.expectedPlayers < registeredCount) {
        return NextResponse.json(
          {
            message: `Expected players cannot be below current registrations (${registeredCount}).`,
          },
          { status: 400 },
        );
      }
    }

    const newCourtCount = parsed.data.courtCount;
    const oldCourtCount = game.courtCount;

    if (newCourtCount !== oldCourtCount) {
      if (newCourtCount > oldCourtCount) {
        await Court.insertMany(
          Array.from({ length: newCourtCount - oldCourtCount }, (_, index) => ({
            gameId,
            courtNumber: oldCourtCount + index + 1,
          })),
        );
      } else {
        const courtsToRemove = await Court.find({
          gameId,
          courtNumber: { $gt: newCourtCount },
        });

        const courtInUse = courtsToRemove.some(
          (court) =>
            court.status === "active" ||
            court.teamA.playerIds.length > 0 ||
            court.teamB.playerIds.length > 0,
        );

        if (courtInUse) {
          return NextResponse.json(
            {
              message:
                "Cannot reduce courts while removed courts are active or have players assigned.",
            },
            { status: 400 },
          );
        }

        await Court.deleteMany({ gameId, courtNumber: { $gt: newCourtCount } });
      }
    }

    const updatedGame = await PickleGame.findOneAndUpdate(
      { gameId, ownerId: authUser.userId },
      {
        $set: {
          title: parsed.data.title,
          openPlayType: parsed.data.openPlayType,
          courtCount: parsed.data.courtCount,
          expectedPlayers: parsed.data.expectedPlayers,
          strictPlayerCount: parsed.data.strictPlayerCount,
        },
      },
      { new: true },
    );

    if (!updatedGame) {
      return NextResponse.json({ message: "Game not found." }, { status: 404 });
    }

    return NextResponse.json({ game: updatedGame, message: "Game updated." });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to update game." },
      { status: 400 },
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
