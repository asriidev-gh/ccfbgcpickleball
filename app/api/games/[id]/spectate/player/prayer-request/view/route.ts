import { NextResponse } from "next/server";

import { runWithDatabase } from "@/lib/db";
import { formatZodError } from "@/lib/format-zod-error";
import { markSpectatePlayerPrayerViewed } from "@/lib/owner-prayer-requests";
import {
  assertPlayerRegisteredForGame,
  PlayerProfileAccessError,
  resolveGameShowsCcfQuestionnaire,
} from "@/lib/player-profile";
import { spectatePlayerPrayerViewSchema } from "@/lib/validations";
import { PickleGame } from "@/models/PickleGame";

async function getGameOwnerId(gameId: string) {
  const game = await PickleGame.findOne({ gameId }).select("ownerId").lean<{ ownerId: { toString(): string } }>();
  if (!game?.ownerId) {
    throw new Error("Game not found.");
  }
  return String(game.ownerId);
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: gameId } = await params;
    const body = await request.json();
    const parsed = spectatePlayerPrayerViewSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ message: formatZodError(parsed.error) }, { status: 400 });
    }

    return await runWithDatabase(async () => {
      await assertPlayerRegisteredForGame(gameId, parsed.data.playerId);
      const showCcf = await resolveGameShowsCcfQuestionnaire(gameId);
      if (!showCcf) {
        return NextResponse.json({ marked: false });
      }

      const ownerId = await getGameOwnerId(gameId);
      const result = await markSpectatePlayerPrayerViewed(ownerId, parsed.data.playerId);
      return NextResponse.json(result);
    });
  } catch (error) {
    if (error instanceof PlayerProfileAccessError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to update prayer request." },
      { status: 400 },
    );
  }
}
