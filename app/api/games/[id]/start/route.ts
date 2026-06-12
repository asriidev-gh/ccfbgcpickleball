import { NextResponse } from "next/server";

import { runWithDatabase } from "@/lib/db";
import { startGameOnCourt } from "@/lib/queue-engine";
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

    let courtNumber: number | undefined;
    const body = await request.json().catch(() => null);
    if (body != null && typeof body === "object" && "courtNumber" in body) {
      const parsed = Number((body as { courtNumber: unknown }).courtNumber);
      if (!Number.isInteger(parsed) || parsed < 1) {
        return NextResponse.json({ message: "Invalid court number." }, { status: 400 });
      }
      courtNumber = parsed;
    }

    const court = await startGameOnCourt(id, courtNumber);
    return NextResponse.json({ court });

    });} catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to fill court." },
      { status: 400 }
    );
  }
}
