import { NextResponse } from "next/server";

import { runWithDatabase } from "@/lib/db";
import {
  canCreateDemoOpenPlay,
  DEMO_OPEN_PLAY_DEFAULT_COURT_COUNT,
  DEMO_OPEN_PLAY_DEFAULT_PLAYER_COUNT,
  DEMO_OPEN_PLAY_TITLE,
} from "@/lib/demo-open-play";
import { getAuthUserFromCookie } from "@/lib/auth";
import { isSuperAdmin } from "@/lib/superadmin";
import { createTestGame } from "@/lib/test-game";
import { generateDemoOpenPlaySchema } from "@/lib/validations";
import { PickleGame } from "@/models/PickleGame";
import { User } from "@/models/User";

const DEMO_OPEN_PLAY_TITLE_LABEL = "Test Open Play 1";

export async function POST(request: Request) {
  try {

    return await runWithDatabase(async () => {
    const authUser = await getAuthUserFromCookie();
    if (!authUser) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });

    const owner = await User.findById(authUser.userId).select("createdAt").lean();
    if (
      !canCreateDemoOpenPlay({
        accountCreatedAt: owner?.createdAt,
        isSuperAdmin: isSuperAdmin(authUser.email),
      })
    ) {
      return NextResponse.json(
        { message: "Demo open plays are only available during your first 3 days." },
        { status: 403 },
      );
    }

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

    let body: unknown = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const parsed = generateDemoOpenPlaySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { message: parsed.error.issues[0]?.message ?? "Invalid demo open play settings." },
        { status: 400 },
      );
    }

    const courtCount = parsed.data.courtCount ?? DEMO_OPEN_PLAY_DEFAULT_COURT_COUNT;
    const playerCount = parsed.data.playerCount ?? DEMO_OPEN_PLAY_DEFAULT_PLAYER_COUNT;

    const { game, playerCount: createdPlayerCount } = await createTestGame({
      ownerId: authUser.userId,
      title: DEMO_OPEN_PLAY_TITLE_LABEL,
      courtCount,
      playerCount,
    });

    return NextResponse.json({
      game: { gameId: game.gameId, title: game.title },
      playerCount: createdPlayerCount,
      courtCount,
      message: `Demo open play created with ${createdPlayerCount} players and ${courtCount} courts.`,
    });

    });} catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to generate test game." },
      { status: 400 },
    );
  }
}
