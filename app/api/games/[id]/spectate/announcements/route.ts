import { NextResponse } from "next/server";

import { runWithDatabase } from "@/lib/db";
import { listSpectateGameAnnouncements } from "@/lib/spectate-player-features";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: gameId } = await params;

    return await runWithDatabase(async () => {
      const result = await listSpectateGameAnnouncements(gameId);
      return NextResponse.json(result);
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to load community posts." },
      { status: 400 },
    );
  }
}
