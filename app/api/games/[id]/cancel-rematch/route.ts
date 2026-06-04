import { NextResponse } from "next/server";

import { connectToDatabase } from "@/lib/db";
import { cancelRematch } from "@/lib/queue-engine";
import { cancelCourtAssignmentSchema } from "@/lib/validations";
import { getAuthUserFromCookie } from "@/lib/auth";
import { PickleGame } from "@/models/PickleGame";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectToDatabase();
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
    await cancelRematch(payload);

    return NextResponse.json({
      message: `Court ${payload.courtNumber} rematch cancelled. Players returned to the queue.`,
    });
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Failed to cancel rematch.",
      },
      { status: 400 },
    );
  }
}
