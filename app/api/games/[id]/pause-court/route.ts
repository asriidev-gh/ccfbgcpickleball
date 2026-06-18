import { NextResponse } from "next/server";

import { runWithDatabase } from "@/lib/db";
import { getAuthUserFromCookie } from "@/lib/auth";
import { setCourtPaused } from "@/lib/queue-engine";
import { pauseCourtSchema } from "@/lib/validations";
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
      const payload = pauseCourtSchema.parse({ ...body, gameId: id });
      const court = await setCourtPaused(payload);

      return NextResponse.json({
        message: payload.paused
          ? `Court ${payload.courtNumber} paused.`
          : `Court ${payload.courtNumber} resumed.`,
        court: {
          courtNumber: court.courtNumber,
          pausedAt: court.pausedAt ? new Date(court.pausedAt).toISOString() : null,
          totalPausedMs: court.totalPausedMs ?? 0,
        },
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
