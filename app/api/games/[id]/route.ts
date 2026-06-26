import { NextResponse } from "next/server";

import { handleApiError } from "@/lib/handle-api-error";
import { runWithDatabase } from "@/lib/db";
import { formatZodError } from "@/lib/format-zod-error";
import { ensureGameRegistrationQr } from "@/lib/game-qr";
import { getGameRegistrationCount } from "@/lib/game-registration-limit";
import {
  loadOperatorDetails,
  loadOperatorFull,
  loadOperatorMatchHistory,
  loadOperatorQueueState,
  loadOperatorShell,
  type OperatorScope,
} from "@/lib/load-operator-game";
import { mergeOperatorGamePayload } from "@/lib/operator-payload";
import {
  gameUsesOwnerRegistration,
  syncOwnerPreRegisteredPlayers,
} from "@/lib/owner-pre-registered-players";
import { updateGameSchema } from "@/lib/validations";
import {
  authorizeAuthPayload,
  getAuthUserFromCookie,
  readAuthTokenPayload,
} from "@/lib/auth";
import { Court } from "@/models/Court";
import { LeaderboardStats } from "@/models/LeaderboardStats";
import { MatchHistory } from "@/models/MatchHistory";
import { PickleGame } from "@/models/PickleGame";
import { QueueEntry } from "@/models/QueueEntry";
import "@/models/Player";

function parseOperatorScope(value: string | null): OperatorScope {
  if (
    value === "shell" ||
    value === "queue" ||
    value === "live" ||
    value === "details" ||
    value === "history" ||
    value === "full"
  ) {
    return value;
  }
  return "full";
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const scope = parseOperatorScope(new URL(request.url).searchParams.get("scope"));

    return await runWithDatabase(async () => {
      const tokenPayload = await readAuthTokenPayload();
      if (!tokenPayload) {
        return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
      }
      const authUser = await authorizeAuthPayload(tokenPayload);
      if (!authUser) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });

      if (scope === "shell") {
        const payload = await loadOperatorShell(id, authUser.userId);
        if (!payload) return NextResponse.json({ message: "Game not found." }, { status: 404 });
        return NextResponse.json(payload);
      }

      if (scope === "queue") {
        const payload = await loadOperatorQueueState(id, authUser.userId);
        if (!payload) return NextResponse.json({ message: "Game not found." }, { status: 404 });
        return NextResponse.json(payload);
      }

      if (scope === "live") {
        const [shell, queue] = await Promise.all([
          loadOperatorShell(id, authUser.userId),
          loadOperatorQueueState(id, authUser.userId),
        ]);
        if (!shell || !queue) {
          return NextResponse.json({ message: "Game not found." }, { status: 404 });
        }
        return NextResponse.json(mergeOperatorGamePayload(shell, queue));
      }

      if (scope === "details") {
        const payload = await loadOperatorDetails(id, authUser.userId);
        if (!payload) return NextResponse.json({ message: "Game not found." }, { status: 404 });
        return NextResponse.json(payload);
      }

      if (scope === "history") {
        const payload = await loadOperatorMatchHistory(id, authUser.userId);
        if (!payload) return NextResponse.json({ message: "Game not found." }, { status: 404 });
        return NextResponse.json(payload);
      }

      if (scope === "full") {
        const payload = await loadOperatorFull(id, authUser.userId);
        if (!payload) return NextResponse.json({ message: "Game not found." }, { status: 404 });
        return NextResponse.json(
          mergeOperatorGamePayload(payload.shell, payload.queue, payload.details),
        );
      }

      return NextResponse.json({ message: "Invalid scope." }, { status: 400 });
    });
  } catch (error) {
    return handleApiError(error, {
      source: "api/games/[id]",
      request,
      message: "Failed to load game.",
    });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    return await runWithDatabase(async () => {
    const authUser = await getAuthUserFromCookie();
    if (!authUser) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
    const { id: gameId } = await params;

    const body = await request.json();
    const parsed = updateGameSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ message: formatZodError(parsed.error) }, { status: 400 });
    }

    const game = await PickleGame.findOne({ gameId, ownerId: authUser.userId });
    if (!game) return NextResponse.json({ message: "Game not found." }, { status: 404 });

    const usesOwnerRegistration =
      parsed.data.ownerPlayers != null || (await gameUsesOwnerRegistration(game));

    let expectedPlayers = parsed.data.expectedPlayers ?? game.expectedPlayers;
    let strictPlayerCount = parsed.data.strictPlayerCount ?? game.strictPlayerCount === true;
    let allowQrRegistration =
      parsed.data.allowQrRegistration ?? game.allowQrRegistration !== false;
    let allowManualPlayerAdd = game.allowManualPlayerAdd === true;

    if (usesOwnerRegistration) {
      if (parsed.data.allowQrRegistration != null) {
        allowQrRegistration = parsed.data.allowQrRegistration;
        strictPlayerCount = !allowQrRegistration;
      }

      if (parsed.data.allowManualPlayerAdd != null) {
        allowManualPlayerAdd = parsed.data.allowManualPlayerAdd;
      }

      if (parsed.data.ownerPlayers) {
        expectedPlayers = await syncOwnerPreRegisteredPlayers({
          gameId,
          ownerPlayers: parsed.data.ownerPlayers,
        });
        game.registrationMode = "owner";
      }
    }

    if (strictPlayerCount) {
      const registeredCount = await getGameRegistrationCount(gameId);
      if (expectedPlayers < registeredCount) {
        return NextResponse.json(
          {
            message: `Expected players cannot be below current registrations (${registeredCount}).`,
          },
          { status: 400 },
        );
      }
    }

    const newCourtCount = parsed.data.courtCount;
    const oldCourtCount = game.courtCount;

    if (newCourtCount !== oldCourtCount) {
      if (newCourtCount > oldCourtCount) {
        await Court.insertMany(
          Array.from({ length: newCourtCount - oldCourtCount }, (_, index) => ({
            gameId,
            courtNumber: oldCourtCount + index + 1,
          })),
        );
      } else {
        const courtsToRemove = await Court.find({
          gameId,
          courtNumber: { $gt: newCourtCount },
        });

        const courtInUse = courtsToRemove.some(
          (court) =>
            court.status === "active" ||
            court.teamA.playerIds.length > 0 ||
            court.teamB.playerIds.length > 0,
        );

        if (courtInUse) {
          return NextResponse.json(
            {
              message:
                "Cannot reduce courts while removed courts are active or have players assigned.",
            },
            { status: 400 },
          );
        }

        await Court.deleteMany({ gameId, courtNumber: { $gt: newCourtCount } });
      }
    }

    const updatedGame = await PickleGame.findOneAndUpdate(
      { gameId, ownerId: authUser.userId },
      {
        $set: {
          title: parsed.data.title,
          openPlayType: parsed.data.openPlayType,
          openPlayDate: new Date(`${parsed.data.openPlayDate}T12:00:00.000Z`),
          openPlayTimeRange: parsed.data.openPlayTimeRange,
          ...(parsed.data.venueName != null ? { venueName: parsed.data.venueName } : {}),
          ...(parsed.data.venueAddress != null ? { venueAddress: parsed.data.venueAddress } : {}),
          ...(parsed.data.venueGoogleMapEmbedUrl != null
            ? { venueGoogleMapEmbedUrl: parsed.data.venueGoogleMapEmbedUrl }
            : {}),
          courtCount: parsed.data.courtCount,
          expectedPlayers,
          strictPlayerCount,
          allowQrRegistration,
          allowManualPlayerAdd: usesOwnerRegistration ? allowManualPlayerAdd : false,
          ...(usesOwnerRegistration ? { registrationMode: "owner" as const } : {}),
        },
      },
      { returnDocument: 'after' },
    );

    if (!updatedGame) {
      return NextResponse.json({ message: "Game not found." }, { status: 404 });
    }

    if (parsed.data.allowQrRegistration != null) {
      await ensureGameRegistrationQr(updatedGame);
    }

    return NextResponse.json({ game: updatedGame, message: "Game updated." });
    });
  } catch (error) {
    return handleApiError(error, {
      source: "api/games/[id]",
      request,
      message: "Failed to update game.",
    });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    return await runWithDatabase(async () => {
    const authUser = await getAuthUserFromCookie();
    if (!authUser) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
    const { id: gameId } = await params;

    const game = await PickleGame.findOne({ gameId, ownerId: authUser.userId });
    if (!game) return NextResponse.json({ message: "Game not found." }, { status: 404 });

    await Promise.all([
      QueueEntry.deleteMany({ gameId }),
      MatchHistory.deleteMany({ gameId }),
      LeaderboardStats.deleteMany({ gameId }),
      Court.deleteMany({ gameId }),
      PickleGame.deleteOne({ _id: game._id }),
    ]);

    return NextResponse.json({ message: "Game deleted." });
    });
  } catch (error) {
    return handleApiError(error, {
      source: "api/games/[id]",
      request,
      message: "Failed to delete game.",
    });
  }
}
