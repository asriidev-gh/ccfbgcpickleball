import { NextResponse } from "next/server";

import { runWithDatabase } from "@/lib/db";
import { getGameFirstTimers } from "@/lib/game-first-timers";
import { PickleGame } from "@/models/PickleGame";

/** Public first-timer list for spectator dashboard. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: gameId } = await params;

    return await runWithDatabase(async () => {
      const game = await PickleGame.findOne({ gameId }).select("_id");
      if (!game) {
        return NextResponse.json({ message: "Game not found." }, { status: 404 });
      }

      const firstTimers = await getGameFirstTimers(gameId);
      return NextResponse.json(firstTimers);
    });
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Failed to load first timers.",
      },
      { status: 400 },
    );
  }
}
