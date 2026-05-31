import { NextResponse } from "next/server";
import { nanoid } from "nanoid";

import { createGameSchema } from "@/lib/validations";
import { connectToDatabase } from "@/lib/db";
import { createPreRegisteredPlayers } from "@/lib/create-game-players";
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

    const preRegisteredNames =
      payload.registrationMode === "owner" ? (payload.preRegisteredPlayerNames ?? []) : [];
    const expectedPlayers =
      preRegisteredNames.length > 0 ? preRegisteredNames.length : payload.expectedPlayers;
    const strictPlayerCount =
      preRegisteredNames.length > 0
        ? payload.allowQrRegistration !== true
        : payload.strictPlayerCount;
    const allowQrRegistration =
      payload.registrationMode === "owner" ? payload.allowQrRegistration === true : true;

    const gameId = nanoid(10);
    const { registerUrl, publicQrCodeDataUrl } = await buildGameRegistrationQr(gameId, {
      allowQrRegistration,
    });

    const game = await PickleGame.create({
      title: payload.title,
      openPlayType: payload.openPlayType,
      courtCount: payload.courtCount,
      expectedPlayers,
      strictPlayerCount,
      allowQrRegistration,
      registrationMode: payload.registrationMode === "owner" ? "owner" : "self",
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

    let preRegisteredCount = 0;
    if (preRegisteredNames.length > 0) {
      preRegisteredCount = await createPreRegisteredPlayers({
        gameId,
        names: preRegisteredNames,
      });
    }

    return NextResponse.json({ game, preRegisteredCount });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Unable to create game." },
      { status: 400 },
    );
  }
}
