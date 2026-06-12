import { NextResponse } from "next/server";
import { z } from "zod";

import { getAuthUserFromCookie } from "@/lib/auth";
import { runWithDatabase } from "@/lib/db";
import {
  acquireOperatorDashboardLease,
  releaseOperatorDashboardLease,
  renewOperatorDashboardLease,
} from "@/lib/operator-dashboard-lease";
import { PickleGame } from "@/models/PickleGame";

const leaseBodySchema = z.object({
  leaseId: z.string().min(8),
  action: z.enum(["acquire", "renew", "takeover", "release"]).default("acquire"),
});

async function authorizeGameOwner(gameId: string, userId: string) {
  const game = await PickleGame.findOne({ gameId, ownerId: userId }).select("gameId");
  return Boolean(game);
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: gameId } = await params;

    return await runWithDatabase(async () => {
      const authUser = await getAuthUserFromCookie();
      if (!authUser) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });

      const ownsGame = await authorizeGameOwner(gameId, authUser.userId);
      if (!ownsGame) return NextResponse.json({ message: "Game not found." }, { status: 404 });

      const body = await request.json();
      const parsed = leaseBodySchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ message: "Invalid lease request." }, { status: 400 });
      }

      const userAgent = request.headers.get("user-agent") ?? undefined;
      const { leaseId, action } = parsed.data;

      if (action === "release") {
        await releaseOperatorDashboardLease({
          gameId,
          ownerId: authUser.userId,
          leaseId,
        });
        return NextResponse.json({ released: true });
      }

      if (action === "renew") {
        const result = await renewOperatorDashboardLease({
          gameId,
          ownerId: authUser.userId,
          leaseId,
          userAgent,
        });
        if (result.status === "blocked") {
          return NextResponse.json(result, { status: 409 });
        }
        return NextResponse.json(result);
      }

      const result = await acquireOperatorDashboardLease({
        gameId,
        ownerId: authUser.userId,
        leaseId,
        userAgent,
        force: action === "takeover",
      });

      if (result.status === "blocked") {
        return NextResponse.json(result, { status: 409 });
      }

      return NextResponse.json(result);
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to update dashboard lease." },
      { status: 400 },
    );
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: gameId } = await params;

    return await runWithDatabase(async () => {
      const authUser = await getAuthUserFromCookie();
      if (!authUser) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });

      const ownsGame = await authorizeGameOwner(gameId, authUser.userId);
      if (!ownsGame) return NextResponse.json({ message: "Game not found." }, { status: 404 });

      let leaseId: string | undefined;
      try {
        const body = await request.json();
        leaseId = typeof body?.leaseId === "string" ? body.leaseId : undefined;
      } catch {
        leaseId = undefined;
      }

      if (!leaseId) {
        return NextResponse.json({ message: "leaseId is required." }, { status: 400 });
      }

      await releaseOperatorDashboardLease({
        gameId,
        ownerId: authUser.userId,
        leaseId,
      });

      return NextResponse.json({ released: true });
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to release dashboard lease." },
      { status: 400 },
    );
  }
}
