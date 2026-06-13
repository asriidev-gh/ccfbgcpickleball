import { NextResponse } from "next/server";

import { runWithDatabase } from "@/lib/db";
import { formatZodError } from "@/lib/format-zod-error";
import { submitSpectatePlayerDgroupRequest } from "@/lib/spectate-player-features";
import { PlayerProfileAccessError } from "@/lib/player-profile";
import { spectatePlayerDgroupRequestSchema } from "@/lib/validations";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: gameId } = await params;
    const body = await request.json();
    const parsed = spectatePlayerDgroupRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ message: formatZodError(parsed.error) }, { status: 400 });
    }

    return await runWithDatabase(async () => {
      const result = await submitSpectatePlayerDgroupRequest(gameId, parsed.data.playerId, {
        wantsToJoinDgroup: parsed.data.wantsToJoinDgroup,
        dgroupAvailableDays: parsed.data.dgroupAvailableDays,
        dgroupAvailableTimeFrom: parsed.data.dgroupAvailableTimeFrom,
        dgroupAvailableTimeTo: parsed.data.dgroupAvailableTimeTo,
      });
      return NextResponse.json({
        ...result,
        message: parsed.data.wantsToJoinDgroup
          ? "D-group request submitted."
          : "D-group request removed.",
      });
    });
  } catch (error) {
    if (error instanceof PlayerProfileAccessError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to submit D-group request." },
      { status: 400 },
    );
  }
}
