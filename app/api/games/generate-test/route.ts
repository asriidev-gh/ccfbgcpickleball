import { NextResponse } from "next/server";

import { runWithDatabase } from "@/lib/db";
import { DEMO_OPEN_PLAY_TITLE } from "@/lib/demo-open-play";
import { getAuthUserFromCookie } from "@/lib/auth";
import { createTestGame } from "@/lib/test-game";
import { PickleGame } from "@/models/PickleGame";

const DEMO_OPEN_PLAY_TITLE_LABEL = "Test Open Play 1";

export async function POST() {
  try {

    return await runWithDatabase(async () => {
    const authUser = await getAuthUserFromCookie();
    if (!authUser) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });

    const existingDemo = await PickleGame.findOne({
      ownerId: authUser.userId,
      title: { $regex: DEMO_OPEN_PLAY_TITLE },
    }).select("gameId title");

    if (existingDemo) {
      return NextResponse.json(
        {
          message:
            "You already have a demo open play. Delete it from your games list before creating another.",
        },
        { status: 400 },
      );
    }

    const { game, playerCount } = await createTestGame({
      ownerId: authUser.userId,
      title: DEMO_OPEN_PLAY_TITLE_LABEL,
      courtCount: 2,
      playerCount: 18,
    });

    return NextResponse.json({
      game: { gameId: game.gameId, title: game.title },
      playerCount,
      message: `Test game created with ${playerCount} players.`,
    });

    });} catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to generate test game." },
      { status: 400 },
    );
  }
}
