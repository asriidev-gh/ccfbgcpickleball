import { NextResponse } from "next/server";

import { runWithDatabase } from "@/lib/db";
import { cancelGame } from "@/lib/queue-engine";
import { cancelCourtAssignmentSchema } from "@/lib/validations";
import { getAuthUserFromCookie } from "@/lib/auth";
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
      const payload = cancelCourtAssignmentSchema.parse({ ...body, gameId: id });
      await cancelGame(payload);

      return NextResponse.json({
        message: `Court ${payload.courtNumber} game cancelled. Players moved to the end of the queue.`,
      });
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to cancel game." },
      { status: 400 },
    );
  }
}
