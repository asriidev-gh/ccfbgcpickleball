import { NextResponse } from "next/server";

import { getAuthUserFromCookie } from "@/lib/auth";
import { assertPlayerRegisteredWithOwner } from "@/lib/owner-player-actions";
import { getOwnerPlayerSessions } from "@/lib/owner-player-sessions";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authUser = await getAuthUserFromCookie();
    if (!authUser) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });

    const { id } = await params;
    await assertPlayerRegisteredWithOwner(authUser.userId, id);

    const sessions = await getOwnerPlayerSessions(authUser.userId, id);
    if (!sessions) return NextResponse.json({ message: "Player not found." }, { status: 404 });

    return NextResponse.json(sessions);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load player sessions.";
    const status = message.includes("not registered") ? 403 : 400;
    return NextResponse.json({ message }, { status });
  }
}
