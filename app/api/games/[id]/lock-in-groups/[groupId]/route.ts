import { NextResponse } from "next/server";

import { getAuthUserFromCookie } from "@/lib/auth";
import { runWithDatabase } from "@/lib/db";
import { deleteLockInGroup, listLockInGroups } from "@/lib/lock-in-groups";
import { PickleGame } from "@/models/PickleGame";

export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ id: string; groupId: string }> },
) {
  try {
    return await runWithDatabase(async () => {
      const authUser = await getAuthUserFromCookie();
      if (!authUser) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });

      const { id: gameId, groupId } = await params;
      const game = await PickleGame.findOne({ gameId, ownerId: authUser.userId }).select("gameId");
      if (!game) return NextResponse.json({ message: "Game not found." }, { status: 404 });

      await deleteLockInGroup(gameId, groupId);
      const groups = await listLockInGroups(gameId);

      return NextResponse.json({
        message: "Lock-in group removed.",
        groups,
      });
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to delete lock-in group." },
      { status: 400 },
    );
  }
}
