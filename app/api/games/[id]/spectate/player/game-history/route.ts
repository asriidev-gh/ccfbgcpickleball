import { NextResponse } from "next/server";

import { runWithDatabase } from "@/lib/db";
import { PlayerProfileAccessError } from "@/lib/player-profile";
import { getSpectatePlayerGameHistory } from "@/lib/spectate-player-game-history";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: gameId } = await params;
    const playerId = new URL(request.url).searchParams.get("playerId")?.trim() ?? "";
    if (!playerId) {
      return NextResponse.json({ message: "Player session is required." }, { status: 400 });
    }

    return await runWithDatabase(async () => {
      const history = await getSpectatePlayerGameHistory(gameId, playerId);
      return NextResponse.json(history);
    });
  } catch (error) {
    if (error instanceof PlayerProfileAccessError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "Failed to load game history.",
      },
      { status: 400 },
    );
  }
}
