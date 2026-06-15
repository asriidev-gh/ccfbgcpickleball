import { NextResponse } from "next/server";
import { z } from "zod";

import { verifySuperadminPlayerCheckInToken } from "@/lib/auth";
import { runWithDatabase } from "@/lib/db";
import { formatZodError } from "@/lib/format-zod-error";
import { isSuperAdminUserId } from "@/lib/superadmin";
import { resolveSuperadminViewAsPlayer } from "@/lib/superadmin-player-check-in";

const bodySchema = z.object({
  token: z.string().trim().min(1, "Check-in token is required."),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: gameId } = await params;
    const body = await request.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ message: formatZodError(parsed.error) }, { status: 400 });
    }

    const { gameId: tokenGameId, adminUserId, playerId } = verifySuperadminPlayerCheckInToken(
      parsed.data.token,
    );
    if (tokenGameId !== gameId) {
      return NextResponse.json({ message: "Check-in link does not match this game." }, { status: 400 });
    }

    return await runWithDatabase(async () => {
      if (!(await isSuperAdminUserId(adminUserId))) {
        return NextResponse.json({ message: "Check-in link is no longer valid." }, { status: 403 });
      }

      const result = await resolveSuperadminViewAsPlayer(gameId, playerId);
      return NextResponse.json({
        playerId: result.playerId,
        playerName: result.playerName,
        message: `Opening player view for ${result.playerName}.`,
      });
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to open player view." },
      { status: 400 },
    );
  }
}
