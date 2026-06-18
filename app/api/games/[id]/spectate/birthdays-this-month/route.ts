import { NextResponse } from "next/server";

import { runWithDatabase } from "@/lib/db";
import { getGameBirthdaysThisMonth } from "@/lib/game-birthdays-this-month";
import { PickleGame } from "@/models/PickleGame";

/** Public birthdays-this-month list for spectator dashboard. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: gameId } = await params;

    return await runWithDatabase(async () => {
      const game = await PickleGame.findOne({ gameId }).select("_id");
      if (!game) {
        return NextResponse.json({ message: "Game not found." }, { status: 404 });
      }

      const birthdays = await getGameBirthdaysThisMonth(gameId);
      return NextResponse.json(birthdays);
    });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "Failed to load birthdays this month.",
      },
      { status: 400 },
    );
  }
}
