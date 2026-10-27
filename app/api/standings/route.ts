import { NextResponse } from "next/server";

import { runWithDatabase } from "@/lib/db";
import { handleApiError } from "@/lib/handle-api-error";
import { loadPublicAllTimeLeaderboard } from "@/lib/public-all-time-leaderboard";

/** Public club-wide all-time standings (no auth). */
export async function GET(request: Request) {
  try {
    return await runWithDatabase(async () =>
      NextResponse.json(await loadPublicAllTimeLeaderboard()),
    );
  } catch (error) {
    return handleApiError(error, {
      source: "api/standings",
      request,
      message: "Failed to load the all-time leaderboard.",
    });
  }
}
