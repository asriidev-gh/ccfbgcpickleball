import { NextResponse } from "next/server";

import { connectToDatabase } from "@/lib/db";
import { getGameRegistrationStatus } from "@/lib/game-registration-limit";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectToDatabase();
    const { id: gameId } = await params;
    const status = await getGameRegistrationStatus(gameId);

    if (!status) {
      return NextResponse.json({ message: "Game not found." }, { status: 404 });
    }

    return NextResponse.json(status);
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "Failed to load registration status.",
      },
      { status: 400 },
    );
  }
}
