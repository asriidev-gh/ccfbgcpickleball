import { NextResponse } from "next/server";

import { getAuthUserFromCookie } from "@/lib/auth";
import { runWithDatabase } from "@/lib/db";
import { assertPlayerRegisteredWithOwner, resolvePlayerSiblings } from "@/lib/owner-player-actions";
import { sendRegistrationWelcomeEmail } from "@/lib/registration-welcome-email";
import { isSuperAdmin } from "@/lib/superadmin";
import {
  buildWelcomeEmailPlayerUpdate,
  type WelcomeEmailStatus,
} from "@/lib/welcome-email-status";
import { PickleGame } from "@/models/PickleGame";
import { Player } from "@/models/Player";
import { QueueEntry } from "@/models/QueueEntry";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {

    return await runWithDatabase(async () => {
    const authUser = await getAuthUserFromCookie();
    if (!authUser) {
      return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
    }
    if (!isSuperAdmin(authUser.email)) {
      return NextResponse.json({ message: "Forbidden." }, { status: 403 });
    }

    const { id: playerId } = await params;
    await assertPlayerRegisteredWithOwner(authUser.userId, playerId);

    const player = await Player.findById(playerId).select(
      "firstName lastName email personalQrCode welcomeEmailStatus",
    );
    if (!player) {
      return NextResponse.json({ message: "Player not found." }, { status: 404 });
    }

    const resolved = await resolvePlayerSiblings(playerId);
    if (!resolved) {
      return NextResponse.json({ message: "Player not found." }, { status: 404 });
    }

    const ownerGameIds = await PickleGame.find({ ownerId: authUser.userId }).distinct("gameId");
    const latestEntry = await QueueEntry.findOne({
      gameId: { $in: ownerGameIds },
      playerId: { $in: resolved.playerObjectIds },
    })
      .sort({ registeredAt: -1 })
      .select("gameId")
      .lean<{ gameId: string } | null>();

    if (!latestEntry?.gameId) {
      return NextResponse.json(
        { message: "No open play session found for this player." },
        { status: 400 },
      );
    }

    const game = await PickleGame.findOne({ gameId: latestEntry.gameId }).select("title").lean();
    const emailResult = await sendRegistrationWelcomeEmail({
      to: player.email,
      firstName: player.firstName,
      lastName: player.lastName,
      personalQrCode: player.personalQrCode,
      gameId: latestEntry.gameId,
      gameTitle: game?.title?.trim() || "Open play",
    });

    const emailTracking = buildWelcomeEmailPlayerUpdate(emailResult);
    await Player.findByIdAndUpdate(playerId, emailTracking);

    const message = emailResult.sent
      ? "Welcome email sent successfully."
      : "Welcome email could not be sent.";

    return NextResponse.json({
      message,
      emailSent: emailResult.sent,
      welcomeEmailStatus: emailTracking.welcomeEmailStatus as WelcomeEmailStatus,
      welcomeEmailError: emailTracking.welcomeEmailError,
      welcomeEmailSentAt: emailTracking.welcomeEmailSentAt.toISOString(),
    });

    });} catch (error) {
    const message = error instanceof Error ? error.message : "Failed to resend welcome email.";
    const status = message.includes("not registered") ? 403 : 400;
    return NextResponse.json({ message }, { status });
  }
}
