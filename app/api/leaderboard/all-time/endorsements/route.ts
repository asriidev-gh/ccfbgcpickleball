import { NextResponse } from "next/server";

import { listAllTimeEndorsementsReceived } from "@/lib/all-time-endorsements";
import { getAuthUserFromCookie } from "@/lib/auth";
import { runWithDatabase } from "@/lib/db";
import { handleApiError } from "@/lib/handle-api-error";

/** Endorsements one all-time row received across the signed-in account's sessions. */
export async function GET(request: Request) {
  try {
    const authUser = await getAuthUserFromCookie();
    if (!authUser) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });

    const id = new URL(request.url).searchParams.get("id")?.trim() ?? "";
    if (!id) return NextResponse.json({ message: "Player is required." }, { status: 400 });

    return await runWithDatabase(async () =>
      NextResponse.json({ endorsements: await listAllTimeEndorsementsReceived(authUser.userId, id) }),
    );
  } catch (error) {
    return handleApiError(error, {
      source: "api/leaderboard/all-time/endorsements",
      request,
      message: "Failed to load endorsements.",
    });
  }
}
