import { NextResponse } from "next/server";

import { runWithDatabase } from "@/lib/db";
import { formatZodError } from "@/lib/format-zod-error";
import { markSpectatorPlayerCardShared } from "@/lib/spectate-player-card-share";
import { spectatePlayerCardShareSchema } from "@/lib/validations";

/** Public: record that a spectator shared a player's stats card. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: gameId } = await params;
    const body = await request.json();
    const parsed = spectatePlayerCardShareSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ message: formatZodError(parsed.error) }, { status: 400 });
    }

    return await runWithDatabase(async () => {
      const result = await markSpectatorPlayerCardShared(gameId, parsed.data.queueEntryId);
      return NextResponse.json(result);
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to record share." },
      { status: 400 },
    );
  }
}
