import { NextResponse } from "next/server";

import { listAllTimeEndorsementsReceived } from "@/lib/all-time-endorsements";
import { runWithDatabase } from "@/lib/db";
import { handleApiError } from "@/lib/handle-api-error";
import { resolvePublicLeaderboardOwner } from "@/lib/public-leaderboard-owner";

/** Public: endorsements one club-wide standings row received (no auth, no QR data). */
export async function GET(request: Request) {
  try {
    const id = new URL(request.url).searchParams.get("id")?.trim() ?? "";
    if (!id) return NextResponse.json({ message: "Player is required." }, { status: 400 });

    return await runWithDatabase(async () => {
      const owner = await resolvePublicLeaderboardOwner();
      if (!owner.ownerId) {
        return NextResponse.json({ message: "Standings are not published right now." }, { status: 503 });
      }
      return NextResponse.json({
        endorsements: await listAllTimeEndorsementsReceived(owner.ownerId, id),
      });
    });
  } catch (error) {
    return handleApiError(error, {
      source: "api/standings/endorsements",
      request,
      message: "Failed to load endorsements.",
    });
  }
}
