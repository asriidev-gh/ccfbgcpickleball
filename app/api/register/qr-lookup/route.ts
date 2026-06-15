import { NextResponse } from "next/server";
import { z } from "zod";

import { runWithDatabase } from "@/lib/db";
import { getPlayerQueueStatusForGame } from "@/lib/game-registration-limit";
import { formatZodError } from "@/lib/format-zod-error";
import { normalizePersonalQrCode } from "@/lib/normalize-personal-qr-code";
import { recordCheckinAttemptNotification } from "@/lib/organizer-notifications";
import { resolveQrUploadCcfQuestionnaireMode } from "@/lib/qr-upload-ccf-questionnaire-shared";
import { resolveGameRegistrationFormVariant } from "@/lib/resolve-game-registration-variant";
import { formatPlayerDisplayName } from "@/lib/utils";
import { Player } from "@/models/Player";

const lookupSchema = z.object({
  personalQrCode: z.string().min(4, "Personal QR code is required."),
  gameId: z.string().min(4).optional(),
});

export async function POST(request: Request) {
  try {
    return await runWithDatabase(async () => {
      const body = await request.json();
      const parsed = lookupSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ message: formatZodError(parsed.error) }, { status: 400 });
      }

      const personalQrCode = normalizePersonalQrCode(parsed.data.personalQrCode);
      const player = await Player.findOne({ personalQrCode }).select(
        "firstName lastName attendedEvents isPartOfDgroup",
      );
      if (!player) {
        return NextResponse.json({ message: "Player QR not found." }, { status: 404 });
      }

      const playerId = String(player._id);
      let queueStatus: "active" | "checked_out" | null = null;
      let ccfQuestionnaireMode: ReturnType<typeof resolveQrUploadCcfQuestionnaireMode> | null =
        null;
      if (parsed.data.gameId) {
        queueStatus = await getPlayerQueueStatusForGame(parsed.data.gameId, playerId);

        const formVariant = await resolveGameRegistrationFormVariant(parsed.data.gameId);
        if (formVariant === "ccf") {
          ccfQuestionnaireMode = resolveQrUploadCcfQuestionnaireMode(player);
        }

        if (queueStatus === "checked_out") {
          await recordCheckinAttemptNotification({
            gameId: parsed.data.gameId,
            playerId,
            playerName: formatPlayerDisplayName(player.firstName, player.lastName),
          });
        }
      }

      return NextResponse.json({
        found: true,
        playerId,
        firstName: player.firstName,
        lastName: player.lastName,
        personalQrCode,
        queueStatus,
        alreadyRegistered: queueStatus === "active",
        ccfQuestionnaireMode,
      });
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to look up QR ID." },
      { status: 400 },
    );
  }
}
