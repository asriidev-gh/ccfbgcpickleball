import { NextResponse } from "next/server";
import { z } from "zod";

import { getAuthUserFromCookie } from "@/lib/auth";
import { formatZodError } from "@/lib/format-zod-error";
import {
  assertPlayerRegisteredWithOwner,
  removePlayerFromOwnerGames,
} from "@/lib/owner-player-actions";
import { setOrganizerPlayerBlocked } from "@/lib/organizer-blocked-player";

const patchSchema = z.object({
  blocked: z.boolean(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authUser = await getAuthUserFromCookie();
    if (!authUser) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });

    const { id } = await params;
    const player = await assertPlayerRegisteredWithOwner(authUser.userId, id);

    const body = await request.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ message: formatZodError(parsed.error) }, { status: 400 });
    }

    await setOrganizerPlayerBlocked(authUser.userId, player.email, parsed.data.blocked);

    return NextResponse.json({
      message: parsed.data.blocked
        ? `${player.name} is blocked from your open plays.`
        : `${player.name} has been unblocked.`,
      isBlocked: parsed.data.blocked,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update player.";
    const status = message.includes("not registered") ? 403 : 400;
    return NextResponse.json({ message }, { status });
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authUser = await getAuthUserFromCookie();
    if (!authUser) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });

    const { id } = await params;
    const player = await assertPlayerRegisteredWithOwner(authUser.userId, id);
    await removePlayerFromOwnerGames(authUser.userId, id);

    return NextResponse.json({
      message: `${player.name} was removed from all of your open play sessions.`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to remove player.";
    const status =
      message.includes("not registered") || message.includes("on a court") ? 403 : 400;
    return NextResponse.json({ message }, { status });
  }
}
