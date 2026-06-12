import { NextResponse } from "next/server";

import { runWithDatabase } from "@/lib/db";
import { endGameSchema } from "@/lib/validations";
import { endGameAndRequeue } from "@/lib/queue-engine";
import { PickleGame } from "@/models/PickleGame";
import { getAuthUserFromCookie } from "@/lib/auth";

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
        { status: 400 }
      );
    }
    const body = await request.json();
    const payload = endGameSchema.parse({ ...body, gameId: id });
    const result = await endGameAndRequeue(payload);
    return NextResponse.json(result);

    });} catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to end game." },
      { status: 400 }
    );
  }
}
