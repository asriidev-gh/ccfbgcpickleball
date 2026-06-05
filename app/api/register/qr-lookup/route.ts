import { NextResponse } from "next/server";
import { z } from "zod";

import { connectToDatabase } from "@/lib/db";
import { formatZodError } from "@/lib/format-zod-error";
import { normalizePersonalQrCode } from "@/lib/normalize-personal-qr-code";
import { recordCheckinAttemptNotification } from "@/lib/organizer-notifications";
import { formatPlayerDisplayName } from "@/lib/utils";
import { Player } from "@/models/Player";
import { QueueEntry } from "@/models/QueueEntry";

const lookupSchema = z.object({
  personalQrCode: z.string().min(4, "Personal QR code is required."),
  gameId: z.string().min(4).optional(),
});

export async function POST(request: Request) {
  try {
    await connectToDatabase();
    const body = await request.json();
    const parsed = lookupSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ message: formatZodError(parsed.error) }, { status: 400 });
    }

    const personalQrCode = normalizePersonalQrCode(parsed.data.personalQrCode);
    const player = await Player.findOne({ personalQrCode }).select("firstName lastName");
    if (!player) {
      return NextResponse.json({ message: "Player QR not found." }, { status: 404 });
    }

    let queueStatus: "active" | "checked_out" | null = null;
    if (parsed.data.gameId) {
      const entry = await QueueEntry.findOne({
        gameId: parsed.data.gameId,
        playerId: player._id,
      }).select("status");

      if (entry) {
        queueStatus = entry.status === "checked_out" ? "checked_out" : "active";
      }

      if (queueStatus === "checked_out") {
        await recordCheckinAttemptNotification({
          gameId: parsed.data.gameId,
          playerId: String(player._id),
          playerName: formatPlayerDisplayName(player.firstName, player.lastName),
        });
      }
    }

    return NextResponse.json({
      found: true,
      firstName: player.firstName,
      lastName: player.lastName,
      personalQrCode,
      queueStatus,
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to look up QR ID." },
      { status: 400 },
    );
  }
}
