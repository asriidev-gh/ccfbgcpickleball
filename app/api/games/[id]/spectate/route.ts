import { NextResponse } from "next/server";

import { runWithDatabase } from "@/lib/db";
import { handleApiError } from "@/lib/handle-api-error";
import {
  loadSpectateDetails,
  loadSpectateFull,
  loadSpectateLive,
  type SpectateScope,
} from "@/lib/load-spectate-game";

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
    const scope = parseScope(new URL(request.url).searchParams.get("scope"));

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
