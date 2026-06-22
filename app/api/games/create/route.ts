import { NextResponse } from "next/server";
import { nanoid } from "nanoid";

import { createGameSchema } from "@/lib/validations";
import { runWithDatabase } from "@/lib/db";
import { createPreRegisteredPlayers } from "@/lib/create-game-players";
import { buildGameRegistrationQr } from "@/lib/game-qr";
import { PickleGame } from "@/models/PickleGame";
import { Court } from "@/models/Court";
import { getAuthUserFromCookie } from "@/lib/auth";
import { requireVerifiedEmailForUserId } from "@/lib/user-email-verification";

export async function POST(request: Request) {
  try {

    return await runWithDatabase(async () => {
    const authUser = await getAuthUserFromCookie();
    if (!authUser) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });

    const verified = await requireVerifiedEmailForUserId(authUser.userId);
    if (!verified.ok) {
      return NextResponse.json({ message: verified.message }, { status: verified.status });
    }

    const body = await request.json();
    const payload = createGameSchema.parse(body);

    const preRegisteredPlayers =
      payload.registrationMode === "owner"
        ? (payload.preRegisteredPlayers ??
          (payload.preRegisteredPlayerNames ?? []).map((displayName) => ({ displayName })))
        : [];
    const expectedPlayers =
      preRegisteredPlayers.length > 0 ? preRegisteredPlayers.length : payload.expectedPlayers;
    const strictPlayerCount =
      preRegisteredPlayers.length > 0
        ? payload.allowQrRegistration !== true
        : payload.strictPlayerCount;
    const allowQrRegistration =
      payload.registrationMode === "owner" ? payload.allowQrRegistration === true : true;

    const gameId = nanoid(10);
    const { registerUrl, publicQrCodeDataUrl } = await buildGameRegistrationQr(gameId, {
      allowQrRegistration,
    });

    const liveQueue =
      payload.registrationMode === "owner" ? payload.liveQueue !== false : true;

    const game = await PickleGame.create({
      title: payload.title,
      openPlayDate: new Date(`${payload.openPlayDate}T12:00:00.000Z`),
      openPlayTimeRange: payload.openPlayTimeRange,
      venueName: payload.venueName ?? "",
      venueAddress: payload.venueAddress ?? "",
      venueGoogleMapEmbedUrl: payload.venueGoogleMapEmbedUrl ?? "",
      openPlayType: payload.openPlayType,
      courtCount: payload.courtCount,
      expectedPlayers,
      strictPlayerCount,
      allowQrRegistration,
      allowManualPlayerAdd:
        payload.registrationMode === "owner" ? payload.allowManualPlayerAdd === true : false,
      liveQueue,
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
    if (preRegisteredPlayers.length > 0 && liveQueue) {
      preRegisteredCount = await createPreRegisteredPlayers({
        gameId,
        names: preRegisteredPlayers,
        checkInAllPlayers: payload.defaultCheckInAllPlayers !== false,
      });
    }

    return NextResponse.json({ game, preRegisteredCount });

    });} catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Unable to create game." },
      { status: 400 },
    );
  }
}
