import { NextResponse } from "next/server";

import { runWithDatabase } from "@/lib/db";
import { getGameRegistrationStatus } from "@/lib/game-registration-limit";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    return await runWithDatabase(async () => {
      const { id: gameId } = await params;
      const status = await getGameRegistrationStatus(gameId);

      if (!status) {
        return NextResponse.json({ message: "Game not found." }, { status: 404 });
      }

      return NextResponse.json(status, {
        headers: {
          // Short private cache so phones reopening the QR don't always wait on Mongo.
          "Cache-Control": "private, max-age=15, stale-while-revalidate=30",
        },
      });
    });
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
