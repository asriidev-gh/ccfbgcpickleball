import { NextResponse } from "next/server";

import { handleApiError } from "@/lib/handle-api-error";
import { runWithDatabase } from "@/lib/db";
import { loadOwnerCourtsView } from "@/lib/load-owner-courts-view";
import { authorizeAuthPayload, readAuthTokenPayload } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    return await runWithDatabase(async () => {
      const tokenPayload = await readAuthTokenPayload();
      if (!tokenPayload) {
        return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
      }
      const authUser = await authorizeAuthPayload(tokenPayload);
      if (!authUser) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });

      const payload = await loadOwnerCourtsView(authUser.userId);
      return NextResponse.json(payload);
    });
  } catch (error) {
    return handleApiError(error, {
      source: "api/games/courts-view",
      request,
      message: "Failed to load courts view.",
    });
  }
}
