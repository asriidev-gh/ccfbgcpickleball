import { NextResponse } from "next/server";

import { runWithDatabase } from "@/lib/db";
import { handleApiError } from "@/lib/handle-api-error";
import {
  loadSpectateDetails,
  loadSpectateFull,
  loadSpectateLive,
  type SpectateScope,
} from "@/lib/load-spectate-game";
import { getSpectateClubProfile } from "@/lib/spectate-club-profile";

function parseScope(value: string | null): SpectateScope {
  if (value === "live" || value === "details" || value === "full") {
    return value;
  }
  return "full";
}

/** Public read-only game state for spectator dashboard (no auth). */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const scopeParam = new URL(request.url).searchParams.get("scope");

    if (scopeParam === "club-profile") {
      return await runWithDatabase(async () => {
        const profile = await getSpectateClubProfile(id);
        if (!profile) {
          return NextResponse.json({ message: "Club profile not found." }, { status: 404 });
        }
        return NextResponse.json({ profile });
      });
    }

    const scope = parseScope(scopeParam);

    return await runWithDatabase(async () => {
      if (scope === "live") {
        const payload = await loadSpectateLive(id);
        if (!payload) return NextResponse.json({ message: "Game not found." }, { status: 404 });
        return NextResponse.json(payload);
      }

      if (scope === "details") {
        const payload = await loadSpectateDetails(id);
        if (!payload) return NextResponse.json({ message: "Game not found." }, { status: 404 });
        return NextResponse.json(payload);
      }

      const payload = await loadSpectateFull(id);
      if (!payload) return NextResponse.json({ message: "Game not found." }, { status: 404 });
      return NextResponse.json(payload);
    });
  } catch (error) {
    return handleApiError(error, {
      source: "api/games/spectate",
      request,
      metadata: { gameId: id },
      message: "Failed to load game.",
    });
  }
}
