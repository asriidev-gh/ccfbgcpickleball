import { NextResponse } from "next/server";

import { runWithDatabase } from "@/lib/db";
import { handleApiError } from "@/lib/handle-api-error";
import { loadPublicAllTimeLeaderboard } from "@/lib/public-all-time-leaderboard";

/** Public club-wide all-time standings (no auth). */
export async function GET(request: Request) {
  try {
    return await runWithDatabase(async () => {
      const standings = await loadPublicAllTimeLeaderboard();
      return NextResponse.json({
        ...standings,
        // Unauthenticated endpoint: never expose QR codes or storage ids.
        rows: standings.rows.map((row) => ({
          id: row.id,
          firstName: row.firstName,
          lastName: row.lastName,
          photoUrl: row.photoUrl,
          gender: row.gender,
          pickleballLevel: row.pickleballLevel,
          wins: row.wins,
          losses: row.losses,
          gamesPlayed: row.gamesPlayed,
          winRate: row.winRate,
          sessionsPlayed: row.sessionsPlayed,
          undefeatedSessions: row.undefeatedSessions,
          mvpSessions: row.mvpSessions,
          endorsements: row.endorsements,
        })),
      });
    });
  } catch (error) {
    return handleApiError(error, {
      source: "api/standings",
      request,
      message: "Failed to load the all-time leaderboard.",
    });
  }
}
