import { NextResponse } from "next/server";

import { connectToDatabase } from "@/lib/db";
import { ensureGameRegistrationQr } from "@/lib/game-qr";
import { getAuthUserFromCookie } from "@/lib/auth";
import { PickleGame } from "@/models/PickleGame";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectToDatabase();
    const authUser = await getAuthUserFromCookie();
    if (!authUser) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
    const { id } = await params;

    const game = await PickleGame.findOne({ gameId: id, ownerId: authUser.userId }).select(
      "title gameId registerUrl publicQrCodeDataUrl",
    );
    if (!game) return NextResponse.json({ message: "Game not found." }, { status: 404 });

    const { registerUrl, publicQrCodeDataUrl } = await ensureGameRegistrationQr(game);

    return NextResponse.json({
      title: game.title,
      registerUrl,
      publicQrCodeDataUrl,
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to load registration QR." },
      { status: 400 },
    );
  }
}
