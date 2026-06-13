import { NextResponse } from "next/server";

import { runWithDatabase } from "@/lib/db";
import { PickleGame } from "@/models/PickleGame";
import { getAuthUserFromCookie } from "@/lib/auth";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {

    return await runWithDatabase(async () => {
    const authUser = await getAuthUserFromCookie();
    if (!authUser) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
    const { id: gameId } = await params;

    const game = await PickleGame.findOneAndUpdate(
      { gameId, ownerId: authUser.userId },
      { $set: { status: "ended" } },
      { returnDocument: 'after' }
    );

    if (!game) {
      return NextResponse.json({ message: "Game not found." }, { status: 404 });
    }

    return NextResponse.json({ message: "Open play ended successfully." });

    });} catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to end open play." },
      { status: 400 }
    );
  }
}
