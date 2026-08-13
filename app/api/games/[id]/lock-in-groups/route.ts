import { NextResponse } from "next/server";
import { z } from "zod";

import { getAuthUserFromCookie } from "@/lib/auth";
import { runWithDatabase } from "@/lib/db";
import { createLockInGroup, listLockInGroups } from "@/lib/lock-in-groups";
import { LOCK_IN_MAX_PLAYERS, LOCK_IN_MIN_PLAYERS } from "@/lib/lock-in-groups-shared";
import { PickleGame } from "@/models/PickleGame";

const createSchema = z.object({
  playerIds: z
    .array(z.string().min(1))
    .min(LOCK_IN_MIN_PLAYERS)
    .max(LOCK_IN_MAX_PLAYERS),
});

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    return await runWithDatabase(async () => {
      const authUser = await getAuthUserFromCookie();
      if (!authUser) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });

      const { id: gameId } = await params;
      const game = await PickleGame.findOne({ gameId, ownerId: authUser.userId }).select("gameId");
      if (!game) return NextResponse.json({ message: "Game not found." }, { status: 404 });

      const groups = await listLockInGroups(gameId);
      return NextResponse.json({ groups });
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to load lock-in groups." },
      { status: 400 },
    );
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    return await runWithDatabase(async () => {
      const authUser = await getAuthUserFromCookie();
      if (!authUser) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });

      const { id: gameId } = await params;
      const game = await PickleGame.findOne({ gameId, ownerId: authUser.userId }).select("gameId");
      if (!game) return NextResponse.json({ message: "Game not found." }, { status: 404 });

      const body = createSchema.parse(await request.json());
      const groupId = await createLockInGroup({ gameId, playerIds: body.playerIds });
      const groups = await listLockInGroups(gameId);

      return NextResponse.json({
        message: "Lock-in group created. Players are clustered in the queue.",
        groupId,
        groups,
      });
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to create lock-in group." },
      { status: 400 },
    );
  }
}
