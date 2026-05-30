import { NextResponse } from "next/server";

import { connectToDatabase } from "@/lib/db";
import { DEMO_OPEN_PLAY_TITLE } from "@/lib/demo-open-play";
import { PickleGame } from "@/models/PickleGame";
import { getAuthUserFromCookie } from "@/lib/auth";

export async function GET() {
  try {
    await connectToDatabase();
    const authUser = await getAuthUserFromCookie();
    if (!authUser) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });

    const [games, hasDemoOpenPlay] = await Promise.all([
      PickleGame.find({ ownerId: authUser.userId })
        .sort({ createdAt: -1 })
        .limit(20)
        .select(
          "title gameId openPlayType courtCount expectedPlayers strictPlayerCount status createdAt updatedAt",
        ),
      PickleGame.exists({
        ownerId: authUser.userId,
        title: { $regex: DEMO_OPEN_PLAY_TITLE },
      }),
    ]);

    return NextResponse.json({ games, hasDemoOpenPlay: Boolean(hasDemoOpenPlay) });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to load games." },
      { status: 400 }
    );
  }
}
