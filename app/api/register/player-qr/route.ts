import { NextResponse } from "next/server";

import { connectToDatabase } from "@/lib/db";
import { normalizePersonalQrCode } from "@/lib/normalize-personal-qr-code";
import { buildPlayerQrDataUrlWithBranding } from "@/lib/player-qr";
import { resolvePlayerQrBrandingForPlayer } from "@/lib/player-qr-branding";
import { Player } from "@/models/Player";

export async function GET(request: Request) {
  try {
    await connectToDatabase();
    const url = new URL(request.url);
    const code = url.searchParams.get("code")?.trim();
    const gameId = url.searchParams.get("gameId")?.trim() ?? null;
    if (!code) {
      return NextResponse.json({ message: "QR code is required." }, { status: 400 });
    }

    const personalQrCode = normalizePersonalQrCode(code);
    const player = await Player.findOne({ personalQrCode }).select(
      "firstName lastName personalQrCode",
    );
    if (!player) {
      return NextResponse.json({ message: "Player QR not found." }, { status: 404 });
    }

    const branding = await resolvePlayerQrBrandingForPlayer(player._id.toString(), gameId);
    const personalQrCodeDataUrl = await buildPlayerQrDataUrlWithBranding(player.personalQrCode, {
      registrantFirstName: player.firstName,
      registrantLastName: player.lastName,
      branding,
    });

    return NextResponse.json({
      firstName: player.firstName,
      personalQrCode: player.personalQrCode,
      personalQrCodeDataUrl,
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to load player QR." },
      { status: 400 },
    );
  }
}
