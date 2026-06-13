import { NextResponse } from "next/server";

import { runWithDatabase } from "@/lib/db";
import { formatZodError } from "@/lib/format-zod-error";
import { getSpectatePlayerPrayerStatus } from "@/lib/owner-prayer-requests";
import {
  assertPlayerRegisteredForGame,
  resolveGameShowsCcfQuestionnaire,
} from "@/lib/player-profile";
import { submitSpectatePlayerPrayerRequest } from "@/lib/spectate-player-features";
import { PlayerProfileAccessError } from "@/lib/player-profile";
import { spectatePlayerPrayerRequestSchema } from "@/lib/validations";
import { PickleGame } from "@/models/PickleGame";

async function getGameOwnerId(gameId: string) {
  const game = await PickleGame.findOne({ gameId }).select("ownerId").lean<{ ownerId: { toString(): string } }>();
  if (!game?.ownerId) {
    throw new Error("Game not found.");
  }
  return String(game.ownerId);
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: gameId } = await params;
    const playerId = new URL(request.url).searchParams.get("playerId")?.trim() ?? "";
    if (!playerId) {
      return NextResponse.json({ message: "Player session is required." }, { status: 400 });
    }

    return await runWithDatabase(async () => {
      await assertPlayerRegisteredForGame(gameId, playerId);
      const showCcf = await resolveGameShowsCcfQuestionnaire(gameId);
      if (!showCcf) {
        return NextResponse.json({ showCcfFeatures: false, hasRequest: false, replies: [] });
      }

      const ownerId = await getGameOwnerId(gameId);
      const status = await getSpectatePlayerPrayerStatus(ownerId, playerId);
      return NextResponse.json({ showCcfFeatures: true, ...status });
    });
  } catch (error) {
    if (error instanceof PlayerProfileAccessError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to load prayer request." },
      { status: 400 },
    );
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: gameId } = await params;
    const body = await request.json();
    const parsed = spectatePlayerPrayerRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ message: formatZodError(parsed.error) }, { status: 400 });
    }

    return await runWithDatabase(async () => {
      const result = await submitSpectatePlayerPrayerRequest(
        gameId,
        parsed.data.playerId,
        parsed.data.requestText,
      );
      return NextResponse.json({
        ...result,
        message: "Prayer request submitted. The club will follow up with you.",
      });
    });
  } catch (error) {
    if (error instanceof PlayerProfileAccessError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to submit prayer request." },
      { status: 400 },
    );
  }
}
