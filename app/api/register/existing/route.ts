import { NextResponse } from "next/server";

import { connectToDatabase } from "@/lib/db";
import {
  assertGameRegistrationAllowed,
  RegistrationLimitError,
} from "@/lib/game-registration-limit";
import { formatZodError } from "@/lib/format-zod-error";
import {
  existingPlayerSchema,
  type ExistingPlayerInput,
  volunteerExistingPlayerSchema,
} from "@/lib/validations";
import { Player } from "@/models/Player";
import { QueueEntry } from "@/models/QueueEntry";
import { Volunteer } from "@/models/Volunteer";

export async function POST(request: Request) {
  try {
    await connectToDatabase();
    const body = await request.json();
    const isVolunteer =
      body?.volunteerType === "Pickleball" ||
      body?.volunteerType === "Running" ||
      body?.volunteerType === "Badminton" ||
      body?.volunteerType === "Other";
    const parsed = isVolunteer
      ? volunteerExistingPlayerSchema.safeParse(body)
      : existingPlayerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ message: formatZodError(parsed.error) }, { status: 400 });
    }
    const payload = parsed.data;

    const player = await Player.findOne({ personalQrCode: payload.personalQrCode });
    if (!player) {
      return NextResponse.json({ message: "Player QR not found." }, { status: 404 });
    }

    await assertGameRegistrationAllowed(payload.gameId, {
      playerId: String(player._id),
    });

    if (!isVolunteer) {
      const playerPayload = payload as ExistingPlayerInput;
      player.isPartOfDgroup = playerPayload.isPartOfDgroup;
      player.attendedEvents = playerPayload.attendedEvents;
      player.attendedEventsOther = playerPayload.attendedEventsOther;
    }
    player.lastAttendedAt = new Date();
    await player.save();

    await QueueEntry.create({
      gameId: payload.gameId,
      playerId: player._id,
      status: "queued",
      queueType: "normal",
    });

    if (payload.volunteerType) {
      await Volunteer.findOneAndUpdate(
        { playerId: player._id, gameId: payload.gameId },
        {
          playerId: player._id,
          gameId: payload.gameId,
          volunteerType: payload.volunteerType,
          volunteerTypeOther: payload.volunteerTypeOther,
        },
        { upsert: true, new: true }
      );
    }

    return NextResponse.json({ player, message: "Welcome back! Added to queue." });
  } catch (error) {
    if (error instanceof RegistrationLimitError) {
      return NextResponse.json(
        {
          message: error.message,
          alreadyRegistered: error.alreadyRegistered ?? false,
          ...(error.playerId ? { player: { _id: error.playerId } } : {}),
        },
        { status: error.status },
      );
    }
    return NextResponse.json(
      { message: formatZodError(error) },
      { status: 400 }
    );
  }
}
