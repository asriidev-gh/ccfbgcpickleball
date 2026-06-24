import { NextResponse } from "next/server";

import { getAuthUserFromCookie } from "@/lib/auth";
import { runWithDatabase } from "@/lib/db";
import { handleApiError } from "@/lib/handle-api-error";
import { loadGameLeaderboardRecap } from "@/lib/game-leaderboard-recap";
import {
  getCachedSpectatorLeaderboardRecap,
  setCachedSpectatorLeaderboardRecap,
} from "@/lib/spectate-leaderboard-recap-cache";
import { PickleGame } from "@/models/PickleGame";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: gameId } = await params;

  try {
    const isSpectatorView = new URL(request.url).searchParams.get("from") === "spectator";

    return await runWithDatabase(async () => {
      if (isSpectatorView) {
        const game = await PickleGame.findOne({ gameId }).select("_id");
        if (!game) return NextResponse.json({ message: "Game not found." }, { status: 404 });
      } else {
        const authUser = await getAuthUserFromCookie();
        if (!authUser) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });

        const game = await PickleGame.findOne({ gameId, ownerId: authUser.userId }).select("_id");
        if (!game) return NextResponse.json({ message: "Game not found." }, { status: 404 });
      }

      let recap = isSpectatorView ? getCachedSpectatorLeaderboardRecap(gameId) : null;
      if (!recap) {
        recap = await loadGameLeaderboardRecap(gameId);
        if (isSpectatorView) {
          setCachedSpectatorLeaderboardRecap(gameId, recap);
        }
      }

      return NextResponse.json(recap);
    });
  } catch (error) {
    return handleApiError(error, {
      source: "api/games/leaderboard",
      request,
      metadata: { gameId },
      message: "Failed to load leaderboard.",
    });
  }
}
