import { NextResponse } from "next/server";

import { getAuthUserFromCookie } from "@/lib/auth";
import { getOwnerRegisteredPlayers } from "@/lib/owner-registered-players";
import { OWNER_REGISTERED_PLAYERS_PAGE_SIZE } from "@/lib/owner-registered-players-shared";
import { isSuperAdmin } from "@/lib/superadmin";

function parsePositiveInt(value: string | null, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export async function GET(request: Request) {
  try {
    const authUser = await getAuthUserFromCookie();
    if (!authUser) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });

    const url = new URL(request.url);
    const page = parsePositiveInt(url.searchParams.get("page"), 1);
    const pageSize = Math.min(
      100,
      parsePositiveInt(url.searchParams.get("pageSize"), OWNER_REGISTERED_PLAYERS_PAGE_SIZE),
    );
    const query = url.searchParams.get("q")?.trim() ?? "";

    const gameId = url.searchParams.get("gameId")?.trim() ?? "";

    const result = await getOwnerRegisteredPlayers(authUser.userId, {
      page,
      pageSize,
      query,
      gameId: gameId || undefined,
    });
    const showEmailStatus = isSuperAdmin(authUser.email);

    return NextResponse.json({
      count: result.total,
      ...result,
      players: showEmailStatus
        ? result.players
        : result.players.map((player) => ({
            ...player,
            welcomeEmailStatus: "" as const,
            welcomeEmailError: "",
            welcomeEmailSentAt: null,
          })),
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to load registered players." },
      { status: 400 },
    );
  }
}
