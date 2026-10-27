import { NextResponse } from "next/server";

import { loadAllTimeLeaderboard } from "@/lib/all-time-leaderboard";
import { getAuthUserFromCookie } from "@/lib/auth";
import { runWithDatabase } from "@/lib/db";
import { handleApiError } from "@/lib/handle-api-error";

/** All-time standings across every session owned by the signed-in account. */
export async function GET(request: Request) {
  try {
    const authUser = await getAuthUserFromCookie();
    if (!authUser) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });

    return await runWithDatabase(async () =>
      NextResponse.json(await loadAllTimeLeaderboard(authUser.userId)),
    );
  } catch (error) {
    return handleApiError(error, {
      source: "api/leaderboard/all-time",
      request,
      message: "Failed to load the all-time leaderboard.",
    });
  }
}
