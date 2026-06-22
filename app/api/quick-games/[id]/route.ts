import { NextResponse } from "next/server";

import { authorizeAuthPayload, readAuthTokenPayload } from "@/lib/auth";
import { runWithDatabase } from "@/lib/db";
import { handleApiError } from "@/lib/handle-api-error";
import { formatZodError } from "@/lib/format-zod-error";
import {
  deleteOwnerQuickGameSession,
  loadOwnerQuickGameSession,
  upsertQuickGameSession,
} from "@/lib/quick-game-persistence-server";
import { saveQuickGameSessionSchema } from "@/lib/quick-game-persistence-shared";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: gameId } = await params;

    return await runWithDatabase(async () => {
      const tokenPayload = await readAuthTokenPayload();
      if (!tokenPayload) {
        return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
      }
      const authUser = await authorizeAuthPayload(tokenPayload);
      if (!authUser) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });

      const doc = await loadOwnerQuickGameSession(authUser.userId, gameId);
      if (!doc) {
        return NextResponse.json({ message: "Quick game not found." }, { status: 404 });
      }

      return NextResponse.json({
        gameId: doc.gameId,
        status: doc.status,
        payload: doc.payload,
        updatedAt: doc.updatedAt,
      });
    });
  } catch (error) {
    return handleApiError(error, {
      source: "api/quick-games/[id]",
      request,
      status: 503,
      message: "Unable to load quick game right now. Please try again.",
    });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: gameId } = await params;

    return await runWithDatabase(async () => {
      const tokenPayload = await readAuthTokenPayload();
      if (!tokenPayload) {
        return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
      }
      const authUser = await authorizeAuthPayload(tokenPayload);
      if (!authUser) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });

      const body = await request.json();
      const payload = saveQuickGameSessionSchema.parse({ ...body, gameId });

      await upsertQuickGameSession(
        authUser.userId,
        gameId,
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
      source: "api/quick-games/[id]",
      request,
      status: 503,
      message: "Unable to save quick game right now. Please try again.",
    });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: gameId } = await params;

    return await runWithDatabase(async () => {
      const tokenPayload = await readAuthTokenPayload();
      if (!tokenPayload) {
        return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
      }
      const authUser = await authorizeAuthPayload(tokenPayload);
      if (!authUser) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });

      const result = await deleteOwnerQuickGameSession(authUser.userId, gameId);
      if (result.deletedCount === 0) {
        return NextResponse.json({ message: "Quick game not found." }, { status: 404 });
      }

      return NextResponse.json({ message: "Quick game deleted." });
    });
  } catch (error) {
    return handleApiError(error, {
      source: "api/quick-games/[id]",
      request,
      status: 503,
      message: "Unable to delete quick game right now. Please try again.",
    });
  }
}
