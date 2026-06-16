import { NextResponse } from "next/server";

import { runWithDatabase } from "@/lib/db";
import { listSpectatePlayerAnnouncements } from "@/lib/spectate-player-features";
import { PlayerProfileAccessError } from "@/lib/player-profile";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: gameId } = await params;
    const playerId = new URL(request.url).searchParams.get("playerId")?.trim() ?? "";
    if (!playerId) {
      return NextResponse.json({ message: "Player session is required." }, { status: 400 });
    }

    return await runWithDatabase(async () => {
      const result = await listSpectatePlayerAnnouncements(gameId, playerId);
      return NextResponse.json(result);
    });
  } catch (error) {
    if (error instanceof PlayerProfileAccessError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to load community posts." },
      { status: 400 },
    );
  }
}
