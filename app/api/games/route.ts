import { NextResponse } from "next/server";

import { runWithDatabase } from "@/lib/db";
import { handleApiError } from "@/lib/handle-api-error";
import { getHomeSessionInsights } from "@/lib/home-session-insights";
import { loadOwnerGamesList } from "@/lib/load-owner-games";
import { reactivateEndedGameForOwner } from "@/lib/reactivate-ended-game";
import { authorizeAuthPayload, readAuthTokenPayload } from "@/lib/auth";
import { isSuperAdmin } from "@/lib/superadmin";

export async function GET(request: Request) {
  try {
    return await runWithDatabase(async () => {
      const tokenPayload = await readAuthTokenPayload();
      if (!tokenPayload) {
        return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
      }
      const authUser = await authorizeAuthPayload(tokenPayload);
      if (!authUser) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });

      const view = new URL(request.url).searchParams.get("view");
      if (view === "session-insights") {
        const insights = await getHomeSessionInsights(authUser.userId);
        return NextResponse.json(insights);
      }

      return NextResponse.json(await loadOwnerGamesList(authUser));
    });
  } catch (error) {
    return handleApiError(error, {
      source: "api/games",
      request,
      status: 503,
      message: "Unable to load games right now. Please try again.",
    });
  }
}

export async function POST(request: Request) {
  try {
    return await runWithDatabase(async () => {
      const tokenPayload = await readAuthTokenPayload();
      if (!tokenPayload) {
        return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
      }
      const authUser = await authorizeAuthPayload(tokenPayload);
      if (!authUser) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });

      if (!isSuperAdmin(authUser.email)) {
        return NextResponse.json({ message: "Forbidden." }, { status: 403 });
      }

      const body = (await request.json()) as { action?: string; gameId?: string };
      if (body.action !== "reactivate") {
        return NextResponse.json({ message: "Unknown action." }, { status: 400 });
      }

      const gameId = typeof body.gameId === "string" ? body.gameId.trim() : "";
      if (!gameId) {
        return NextResponse.json({ message: "gameId is required." }, { status: 400 });
      }

      await reactivateEndedGameForOwner(authUser.userId, gameId);
      return NextResponse.json({ message: "Open play reactivated." });
    });
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Failed to reactivate open play.",
      },
      { status: 400 },
    );
  }
}
