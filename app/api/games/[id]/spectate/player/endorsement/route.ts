import { NextResponse } from "next/server";

import { runWithDatabase } from "@/lib/db";
import { formatZodError } from "@/lib/format-zod-error";
import { PlayerProfileAccessError } from "@/lib/player-profile";
import {
  getSpectatePlayerEndorsement,
  listSpectateGameEndorsementCounts,
  listSpectatePlayerEndorsements,
  listSpectatePlayerEndorsementsReceived,
  submitSpectatePlayerEndorsement,
} from "@/lib/spectate-player-endorsement";
import { spectatePlayerEndorsementSchema } from "@/lib/validations";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: gameId } = await params;
    const url = new URL(request.url);
    const endorserPlayerId = url.searchParams.get("endorserPlayerId")?.trim() ?? "";
    const endorsedPlayerId = url.searchParams.get("endorsedPlayerId")?.trim() ?? "";
    const counts = url.searchParams.get("counts") === "1";
    const received = url.searchParams.get("received") === "1";

    return await runWithDatabase(async () => {
      if (counts) {
        const endorsementCounts = await listSpectateGameEndorsementCounts(gameId);
        return NextResponse.json({ counts: endorsementCounts });
      }

      if (endorsedPlayerId && received) {
        const endorsements = await listSpectatePlayerEndorsementsReceived(
          gameId,
          endorsedPlayerId,
        );
        return NextResponse.json({ endorsements });
      }

      if (!endorserPlayerId) {
        return NextResponse.json({ message: "Player session is required." }, { status: 400 });
      }

      if (endorsedPlayerId) {
        const endorsement = await getSpectatePlayerEndorsement(
          gameId,
          endorserPlayerId,
          endorsedPlayerId,
        );
        return NextResponse.json({ endorsement });
      }

      const endorsements = await listSpectatePlayerEndorsements(gameId, endorserPlayerId);
      return NextResponse.json({ endorsements });
    });
  } catch (error) {
    if (error instanceof PlayerProfileAccessError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to load endorsements." },
      { status: 400 },
    );
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: gameId } = await params;
    const body = await request.json();
    const parsed = spectatePlayerEndorsementSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ message: formatZodError(parsed.error) }, { status: 400 });
    }

    return await runWithDatabase(async () => {
      const result = await submitSpectatePlayerEndorsement({
        gameId,
        endorserPlayerId: parsed.data.endorserPlayerId,
        endorsedPlayerId: parsed.data.endorsedPlayerId,
        badges: parsed.data.badges,
        notes: parsed.data.notes,
      });
      return NextResponse.json({
        ...result,
        message: `Thanks for endorsing ${result.endorsedPlayerName}.`,
      });
    });
  } catch (error) {
    if (error instanceof PlayerProfileAccessError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to submit endorsement." },
      { status: 400 },
    );
  }
}
