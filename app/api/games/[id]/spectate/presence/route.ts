import { NextResponse } from "next/server";
import { z } from "zod";

import { runWithDatabase } from "@/lib/db";
import { formatZodError } from "@/lib/format-zod-error";
import {
  getSpectatorCount,
  removeSpectatorPresence,
  touchSpectatorPresence,
} from "@/lib/spectator-presence";
import { PickleGame } from "@/models/PickleGame";

const presenceSchema = z.object({
  sessionId: z.string().min(1),
  leave: z.boolean().optional(),
});

async function gameExists(gameId: string) {
  const game = await PickleGame.findOne({ gameId }).select("_id");
  return Boolean(game);
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {

    return await runWithDatabase(async () => {
    const { id } = await params;
    if (!(await gameExists(id))) {
      return NextResponse.json({ message: "Game not found." }, { status: 404 });
    }

    return NextResponse.json({ count: getSpectatorCount(id) });

    });} catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to load spectator count." },
      { status: 400 },
    );
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {

    return await runWithDatabase(async () => {
    const { id } = await params;
    if (!(await gameExists(id))) {
      return NextResponse.json({ message: "Game not found." }, { status: 404 });
    }

    const body = await request.json();
    const parsed = presenceSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ message: formatZodError(parsed.error) }, { status: 400 });
    }

    if (parsed.data.leave) {
      removeSpectatorPresence(id, parsed.data.sessionId);
    } else {
      touchSpectatorPresence(id, parsed.data.sessionId);
    }

    return NextResponse.json({ count: getSpectatorCount(id) });

    });} catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Failed to update spectator presence." },
      { status: 400 },
    );
  }
}
