import { NextResponse } from "next/server";

import { runWithDatabase } from "@/lib/db";
import { getAuthUserFromCookie } from "@/lib/auth";
import { RegistrationLimitError } from "@/lib/game-registration-limit";
import {
  getDatabaseCheckInPlayersForGame,
  operatorCheckInPlayerFromDatabase,
} from "@/lib/operator-database-check-in";

function parsePositiveInt(value: string | null, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    return await runWithDatabase(async () => {
      const authUser = await getAuthUserFromCookie();
      if (!authUser) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });

      const { id: gameId } = await params;
      const url = new URL(request.url);
      const page = parsePositiveInt(url.searchParams.get("page"), 1);
      const pageSize = parsePositiveInt(url.searchParams.get("pageSize"), 10);
      const query = url.searchParams.get("q")?.trim() ?? "";

      const result = await getDatabaseCheckInPlayersForGame(authUser.userId, gameId, {
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
          error instanceof Error ? error.message : "Failed to load registered players.",
      },
      { status: 400 },
    );
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    return await runWithDatabase(async () => {
      const authUser = await getAuthUserFromCookie();
      if (!authUser) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });

      const { id: gameId } = await params;
      const body = await request.json();
      const playerId = typeof body?.playerId === "string" ? body.playerId.trim() : "";
      if (!playerId) {
        return NextResponse.json({ message: "playerId is required." }, { status: 400 });
      }

      const result = await operatorCheckInPlayerFromDatabase(authUser.userId, gameId, playerId);
      return NextResponse.json(result);
    });
  } catch (error) {
    if (error instanceof RegistrationLimitError) {
      return NextResponse.json(
        {
          message: error.message,
          alreadyRegistered: error.alreadyRegistered ?? false,
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
