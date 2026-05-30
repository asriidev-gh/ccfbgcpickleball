import { NextResponse } from "next/server";

import { connectToDatabase } from "@/lib/db";
import { getAuthUserFromCookie } from "@/lib/auth";
import { createTestGame } from "@/lib/test-game";
import { PickleGame } from "@/models/PickleGame";

const TEST_GAME_TITLE_BASE = "Test Open Play";

export async function POST() {
  try {
    await connectToDatabase();
    const authUser = await getAuthUserFromCookie();
    if (!authUser) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });

    const existing = await PickleGame.find({
      ownerId: authUser.userId,
      title: { $regex: `^${TEST_GAME_TITLE_BASE} \\d+$` },
    }).select("title");

    const highest = existing.reduce((max: number, doc: { title: string }) => {
      const match = doc.title.match(/(\d+)$/);
      const value = match ? Number(match[1]) : 0;
      return value > max ? value : max;
    }, 0);

    const { game, playerCount } = await createTestGame({
      ownerId: authUser.userId,
      title: `${TEST_GAME_TITLE_BASE} ${highest + 1}`,
      courtCount: 2,
      playerCount: 18,
    });

    return NextResponse.json({
      game: { gameId: game.gameId, title: game.title },
      playerCount,
      message: `Test game created with ${playerCount} players.`,
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to generate test game." },
      { status: 400 },
    );
  }
}
