import { NextResponse } from "next/server";

import { connectToDatabase } from "@/lib/db";
import { swapPlayersBetweenCourtTeams } from "@/lib/queue-engine";
import { swapCourtTeamsSchema } from "@/lib/validations";
import { PickleGame } from "@/models/PickleGame";
import { getAuthUserFromCookie } from "@/lib/auth";

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
    const payload = swapCourtTeamsSchema.parse({ ...body, gameId: id });
    await swapPlayersBetweenCourtTeams(payload);

    return NextResponse.json({ message: "Shuffled players into new teams." });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to swap court players." },
      { status: 400 },
    );
  }
}
