import { NextResponse } from "next/server";

import { runWithDatabase } from "@/lib/db";
import { getAuthUserFromCookie } from "@/lib/auth";
import { setAllActiveCourtsPaused } from "@/lib/queue-engine";
import { pauseAllCourtsSchema } from "@/lib/validations";
import { PickleGame } from "@/models/PickleGame";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    return await runWithDatabase(async () => {
      const authUser = await getAuthUserFromCookie();
      if (!authUser) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });

      const { id } = await params;
      const game = await PickleGame.findOne({ gameId: id, ownerId: authUser.userId });
      if (!game) return NextResponse.json({ message: "Game not found." }, { status: 404 });
      if (game.status === "ended") {
        return NextResponse.json(
          { message: "Open play has ended. Reset the game to restart." },
          { status: 400 },
        );
      }

      const body = await request.json();
      const payload = pauseAllCourtsSchema.parse({ ...body, gameId: id });
      const result = await setAllActiveCourtsPaused(payload);

      return NextResponse.json({
        message: payload.paused
          ? `${result.updatedCount} court${result.updatedCount === 1 ? "" : "s"} paused.`
          : `${result.updatedCount} court${result.updatedCount === 1 ? "" : "s"} resumed.`,
        updatedCount: result.updatedCount,
      });
    });
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Failed to update court pause state.",
      },
      { status: 400 },
    );
  }
}
