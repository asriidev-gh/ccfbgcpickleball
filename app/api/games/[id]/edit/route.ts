import { NextResponse } from "next/server";

import { runWithDatabase } from "@/lib/db";
import { getAuthUserFromCookie } from "@/lib/auth";
import {
  gameUsesOwnerRegistration,
  getOwnerPreRegisteredPlayersForGame,
} from "@/lib/owner-pre-registered-players";
import { PickleGame } from "@/models/PickleGame";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {

    return await runWithDatabase(async () => {
    const authUser = await getAuthUserFromCookie();
    if (!authUser) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });

    const { id: gameId } = await params;
    const game = await PickleGame.findOne({ gameId, ownerId: authUser.userId }).lean();
    if (!game) return NextResponse.json({ message: "Game not found." }, { status: 404 });

    const usesOwnerRegistration = await gameUsesOwnerRegistration(game);
    const ownerPlayers = usesOwnerRegistration
      ? await getOwnerPreRegisteredPlayersForGame(gameId)
      : [];

    return NextResponse.json({
      game: {
        gameId: game.gameId,
        title: game.title,
        openPlayType: game.openPlayType,
        openPlayDate: game.openPlayDate ? new Date(game.openPlayDate).toISOString() : null,
        openPlayTimeRange: game.openPlayTimeRange ?? null,
        courtCount: game.courtCount,
        expectedPlayers: game.expectedPlayers,
        strictPlayerCount: game.strictPlayerCount === true,
        allowQrRegistration: game.allowQrRegistration !== false,
        allowManualPlayerAdd: game.allowManualPlayerAdd === true,
        registrationMode: usesOwnerRegistration ? "owner" : "self",
      },
      ownerPlayers,
    });

    });} catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to load game for editing." },
      { status: 400 },
    );
  }
}
