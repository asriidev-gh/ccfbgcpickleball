import { NextResponse } from "next/server";

import { runWithDatabase } from "@/lib/db";
import { RegistrationLimitError } from "@/lib/game-registration-limit";
import {
  checkInPlayerByNameSearch,
  searchPlayersByNameForRegistration,
} from "@/lib/register-name-search-check-in";
import { recordCheckinAttemptNotification } from "@/lib/organizer-notifications";
import { formatPlayerDisplayName } from "@/lib/utils";
import { Player } from "@/models/Player";

function parsePositiveInt(value: string | null, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export async function GET(request: Request) {
  try {
    return await runWithDatabase(async () => {
      const url = new URL(request.url);
      const gameId = url.searchParams.get("gameId")?.trim() ?? "";
      if (!gameId) {
        return NextResponse.json({ message: "gameId is required." }, { status: 400 });
      }

      const page = parsePositiveInt(url.searchParams.get("page"), 1);
      const pageSize = parsePositiveInt(url.searchParams.get("pageSize"), 10);
      const query = url.searchParams.get("q")?.trim() ?? "";

      const result = await searchPlayersByNameForRegistration(gameId, {
        page,
        pageSize,
        query,
      });

      return NextResponse.json(result);
    });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "Failed to search players.",
      },
      { status: 400 },
    );
  }
}

export async function POST(request: Request) {
  let gameIdFromRequest: string | null = null;
  try {
    return await runWithDatabase(async () => {
      const body = await request.json();
      const gameId = typeof body?.gameId === "string" ? body.gameId.trim() : "";
      const playerId = typeof body?.playerId === "string" ? body.playerId.trim() : "";
      gameIdFromRequest = gameId || null;

      if (!gameId) {
        return NextResponse.json({ message: "gameId is required." }, { status: 400 });
      }
      if (!playerId) {
        return NextResponse.json({ message: "playerId is required." }, { status: 400 });
      }

      const result = await checkInPlayerByNameSearch(gameId, playerId);
      return NextResponse.json(result);
    });
  } catch (error) {
    if (error instanceof RegistrationLimitError) {
      const gameId = gameIdFromRequest;
      const playerId = error.playerId;
      if (error.checkedOut && gameId && playerId) {
        await runWithDatabase(async () => {
          const checkedOutPlayer = await Player.findById(playerId).select("firstName lastName");
          if (checkedOutPlayer) {
            await recordCheckinAttemptNotification({
              gameId,
              playerId,
              playerName: formatPlayerDisplayName(
                checkedOutPlayer.firstName,
                checkedOutPlayer.lastName,
              ),
            });
          }
        });
      }

      return NextResponse.json(
        {
          message: error.message,
          alreadyRegistered: error.alreadyRegistered ?? false,
          checkedOut: error.checkedOut ?? false,
          ...(error.playerId ? { player: { _id: error.playerId } } : {}),
        },
        { status: error.status },
      );
    }

    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Failed to check in player.",
      },
      { status: 400 },
    );
  }
}
