import { NextResponse } from "next/server";

import { getAuthUserFromCookie } from "@/lib/auth";
import { runWithDatabase } from "@/lib/db";
import { promoteDeckMatchToOpenCourt } from "@/lib/queue-engine";
import { PickleGame } from "@/models/PickleGame";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {

    return await runWithDatabase(async () => {
    const authUser = await getAuthUserFromCookie();
    if (!authUser) {
      return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
    }

    const { id } = await params;
    const game = await PickleGame.findOne({ gameId: id, ownerId: authUser.userId });
    if (!game) {
      return NextResponse.json({ message: "Game not found." }, { status: 404 });
    }
    if (game.status === "ended") {
      return NextResponse.json(
        { message: "Open play has ended. Reset the game to restart." },
        { status: 400 },
      );
    }

    const body = (await request.json()) as {
      teamAEntryIds?: string[];
      teamBEntryIds?: string[];
    };
    const teamAEntryIds = body.teamAEntryIds;
    const teamBEntryIds = body.teamBEntryIds;

    if (
      !Array.isArray(teamAEntryIds) ||
      teamAEntryIds.length !== 2 ||
      !Array.isArray(teamBEntryIds) ||
      teamBEntryIds.length !== 2
    ) {
      return NextResponse.json(
        { message: "teamAEntryIds and teamBEntryIds must each contain exactly two ids." },
        { status: 400 },
      );
    }

    await promoteDeckMatchToOpenCourt({ gameId: id, teamAEntryIds, teamBEntryIds });
    return NextResponse.json({ message: "Matchup moved to the open-court line." });

    });} catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "Failed to move matchup to the queue.",
      },
      { status: 400 },
    );
  }
}
