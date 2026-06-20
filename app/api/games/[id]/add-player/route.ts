import { NextResponse } from "next/server";

import { runWithDatabase } from "@/lib/db";
import { getAuthUserFromCookie } from "@/lib/auth";
import {
  addManualPlayerToOwnerGame,
  gameUsesOwnerRegistration,
} from "@/lib/owner-pre-registered-players";
import { recordPlayerRegisteredNotification } from "@/lib/organizer-notifications";
import { addManualGamePlayerSchema } from "@/lib/validations";
import { PickleGame } from "@/models/PickleGame";
import "@/models/Player";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    return await runWithDatabase(async () => {
      const authUser = await getAuthUserFromCookie();
      if (!authUser) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });

      const { id: gameId } = await params;
      const game = await PickleGame.findOne({ gameId, ownerId: authUser.userId });
      if (!game) return NextResponse.json({ message: "Game not found." }, { status: 404 });
      if (game.status === "ended") {
        return NextResponse.json(
          { message: "Open play has ended. Reset the game to restart." },
          { status: 400 },
        );
      }

      const usesOwnerRegistration = await gameUsesOwnerRegistration({
        gameId,
        registrationMode: game.registrationMode,
      });
      if (!usesOwnerRegistration || !game.allowManualPlayerAdd) {
        return NextResponse.json(
          { message: "Manual player add is not enabled for this game." },
          { status: 403 },
        );
      }

      const body = await request.json();
      const parsed = addManualGamePlayerSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { message: parsed.error.issues[0]?.message ?? "Invalid request." },
          { status: 400 },
        );
      }

      const result = await addManualPlayerToOwnerGame(gameId, parsed.data.displayName);

      if (result.playerId) {
        await recordPlayerRegisteredNotification({
          gameId,
          playerId: result.playerId,
          playerName: result.displayName,
        });
      }

      return NextResponse.json({
        message: `${result.displayName} added to the queue.`,
        playerId: result.playerId,
        queueEntryId: result.queueEntryId,
      });
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to add player." },
      { status: 400 },
    );
  }
}
