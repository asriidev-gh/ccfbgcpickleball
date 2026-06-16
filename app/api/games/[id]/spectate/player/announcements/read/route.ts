import { NextResponse } from "next/server";

import { runWithDatabase } from "@/lib/db";
import { formatZodError } from "@/lib/format-zod-error";
import { markSpectatePlayerAnnouncementsRead } from "@/lib/spectate-player-features";
import { PlayerProfileAccessError } from "@/lib/player-profile";
import { spectatePlayerAnnouncementsReadSchema } from "@/lib/validations";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: gameId } = await params;
    const body = await request.json();
    const parsed = spectatePlayerAnnouncementsReadSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ message: formatZodError(parsed.error) }, { status: 400 });
    }

    return await runWithDatabase(async () => {
      const result = await markSpectatePlayerAnnouncementsRead(
        gameId,
        parsed.data.playerId,
        parsed.data.announcementIds,
      );
      return NextResponse.json(result);
    });
  } catch (error) {
    if (error instanceof PlayerProfileAccessError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to update community posts." },
      { status: 400 },
    );
  }
}
