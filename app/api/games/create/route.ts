import { NextResponse } from "next/server";
import { nanoid } from "nanoid";

import { createGameSchema } from "@/lib/validations";
import { connectToDatabase } from "@/lib/db";
import { buildGameRegistrationQr } from "@/lib/game-qr";
import { PickleGame } from "@/models/PickleGame";
import { Court } from "@/models/Court";
import { getAuthUserFromCookie } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    await connectToDatabase();
    const authUser = await getAuthUserFromCookie();
    if (!authUser) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
    const body = await request.json();
    const payload = createGameSchema.parse(body);

    const gameId = nanoid(10);
    const { registerUrl, publicQrCodeDataUrl } = await buildGameRegistrationQr(gameId);

    const game = await PickleGame.create({
      ...payload,
      gameId,
      ownerId: authUser.userId,
      registerUrl,
      publicQrCodeDataUrl,
    });

    await Court.create(
      Array.from({ length: payload.courtCount }, (_, index) => ({
        gameId,
        courtNumber: index + 1,
      })),
    );

    return NextResponse.json({ game });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Unable to create game." },
      { status: 400 },
    );
  }
}
