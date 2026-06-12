import { NextResponse } from "next/server";

import { getAuthUserFromCookie } from "@/lib/auth";
import { runWithDatabase } from "@/lib/db";
import { listRecentOrganizerNotifications } from "@/lib/organizer-notifications";
import { PickleGame } from "@/models/PickleGame";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    return await runWithDatabase(async () => {
      const authUser = await getAuthUserFromCookie();
      if (!authUser) {
        return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
      }

      const { id: gameId } = await params;
      const game = await PickleGame.findOne({ gameId, ownerId: authUser.userId }).select("gameId");
      if (!game) {
        return NextResponse.json({ message: "Game not found." }, { status: 404 });
      }

      const notifications = await listRecentOrganizerNotifications(gameId);
      return NextResponse.json({ notifications });
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to load notifications." },
      { status: 400 },
    );
  }
}
