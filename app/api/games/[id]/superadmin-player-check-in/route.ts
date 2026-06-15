import { NextResponse } from "next/server";
import { z } from "zod";

import { getAuthUserFromCookie, signSuperadminPlayerCheckInToken } from "@/lib/auth";
import { runWithDatabase } from "@/lib/db";
import { formatZodError } from "@/lib/format-zod-error";
import { resolveSuperadminViewAsPlayer } from "@/lib/superadmin-player-check-in";
import { isSuperAdminUserId } from "@/lib/superadmin";

const bodySchema = z.object({
  playerId: z.string().trim().min(1, "Player is required."),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: gameId } = await params;
    const body = await request.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ message: formatZodError(parsed.error) }, { status: 400 });
    }

    return await runWithDatabase(async () => {
      const authUser = await getAuthUserFromCookie();
      if (!authUser) {
        return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
      }
      if (!(await isSuperAdminUserId(authUser.userId))) {
        return NextResponse.json({ message: "Forbidden." }, { status: 403 });
      }

      const player = await resolveSuperadminViewAsPlayer(gameId, parsed.data.playerId);
      const token = signSuperadminPlayerCheckInToken(
        gameId,
        authUser.userId,
        parsed.data.playerId,
      );

      return NextResponse.json({
        token,
        playerName: player.playerName,
        message: `Opening player view for ${player.playerName}.`,
      });
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to open player view." },
      { status: 400 },
    );
  }
}
