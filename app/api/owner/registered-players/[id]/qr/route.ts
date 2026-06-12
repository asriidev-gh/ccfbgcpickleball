import { NextResponse } from "next/server";

import { getAuthUserFromCookie } from "@/lib/auth";
import { runWithDatabase } from "@/lib/db";
import { assertPlayerRegisteredWithOwner, resolvePlayerSiblings } from "@/lib/owner-player-actions";
import { buildPlayerQrDataUrlWithBranding } from "@/lib/player-qr";
import { resolvePlayerQrBrandingForOwner } from "@/lib/player-qr-branding";
import { Player } from "@/models/Player";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {

    return await runWithDatabase(async () => {
    const authUser = await getAuthUserFromCookie();
    if (!authUser) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });

    const { id } = await params;
    await assertPlayerRegisteredWithOwner(authUser.userId, id);

    const resolved = await resolvePlayerSiblings(id);
    if (!resolved) {
      return NextResponse.json({ message: "Player not found." }, { status: 404 });
    }

    const siblings = await Player.find({ _id: { $in: resolved.playerObjectIds } })
      .select("firstName lastName personalQrCode")
      .lean();

    const player =
      siblings.find((doc) => doc._id.toString() === id) ??
      siblings.find((doc) => doc.personalQrCode?.trim()) ??
      siblings[0];

    const personalQrCode = player?.personalQrCode?.trim();
    if (!player || !personalQrCode) {
      return NextResponse.json({ message: "This player has no QR code on file." }, { status: 404 });
    }

    const branding = await resolvePlayerQrBrandingForOwner(authUser.userId);
    const personalQrCodeDataUrl = await buildPlayerQrDataUrlWithBranding(personalQrCode, {
      registrantFirstName: player.firstName ?? "",
      registrantLastName: player.lastName ?? "",
      branding,
    });

    return NextResponse.json({
      firstName: player.firstName ?? "",
      personalQrCode,
      personalQrCodeDataUrl,
    });

    });} catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load player QR.";
    const status = message.includes("not registered") ? 403 : 400;
    return NextResponse.json({ message }, { status });
  }
}
