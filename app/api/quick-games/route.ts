import { NextResponse } from "next/server";

import { authorizeAuthPayload, readAuthTokenPayload } from "@/lib/auth";
import { runWithDatabase } from "@/lib/db";
import { handleApiError } from "@/lib/handle-api-error";
import { formatZodError } from "@/lib/format-zod-error";
import { listOwnerQuickGameSessions } from "@/lib/quick-game-persistence-server";
import { saveQuickGameSessionSchema } from "@/lib/quick-game-persistence-shared";

export async function GET(request: Request) {
  try {
    return await runWithDatabase(async () => {
      const tokenPayload = await readAuthTokenPayload();
      if (!tokenPayload) {
        return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
      }
      const authUser = await authorizeAuthPayload(tokenPayload);
      if (!authUser) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });

      const games = await listOwnerQuickGameSessions(authUser.userId);
      return NextResponse.json({ games });
    });
  } catch (error) {
    return handleApiError(error, {
      source: "api/quick-games",
      request,
      status: 503,
      message: "Unable to load quick games right now. Please try again.",
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

      const body = await request.json();
      const payload = saveQuickGameSessionSchema.parse(body);
      const { upsertQuickGameSession } = await import("@/lib/quick-game-persistence-server");

      await upsertQuickGameSession(
        authUser.userId,
        payload.gameId,
        payload.payload,
        payload.saveReason,
        payload.status,
      );

      return NextResponse.json({ message: "Quick game saved." });
    });
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return NextResponse.json({ message: formatZodError(error) }, { status: 400 });
    }
    return handleApiError(error, {
      source: "api/quick-games",
      request,
      status: 503,
      message: "Unable to save quick game right now. Please try again.",
    });
  }
}
